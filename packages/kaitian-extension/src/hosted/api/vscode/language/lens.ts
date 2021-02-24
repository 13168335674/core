/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import type * as vscode from 'vscode';
import * as Converter from '../../../../common/vscode/converter';
import { Uri as URI } from '@ali/ide-core-common';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import { CodeLensList, CodeLens } from '../../../../common/vscode/model.api';
import { createToken, ObjectIdentifier } from './util';
import { CommandsConverter } from '../ext.host.command';
import { DisposableStore } from '@ali/ide-core-common';

/** Adapts the calls from main to extension thread for providing/resolving the code lenses. */
export class CodeLensAdapter {

  private static readonly BAD_CMD: vscode.Command = { command: 'missing', title: '<<MISSING COMMAND>>' };

  private cacheId = 0;
  private cache = new Map<number, vscode.CodeLens>();

  constructor(
    private readonly provider: vscode.CodeLensProvider,
    private readonly documents: ExtensionDocumentDataManager,
    private readonly commandConverter: CommandsConverter,
  ) { }

  async provideCodeLenses(resource: URI): Promise<CodeLensList | undefined> {
    const document = this.documents.getDocumentData(resource.toString());
    if (!document) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const doc = document.document;
    // TODO 实现releaseCodeAction
    const disposables = new DisposableStore();

    const lenses = await Promise.resolve(this.provider.provideCodeLenses(doc, createToken())).then((lenses) => {
      if (Array.isArray(lenses)) {
        return lenses.map((lens) => {
          const id = this.cacheId++;
          const lensSymbol = ObjectIdentifier.mixin({
            range: Converter.fromRange(lens.range)!,
            command: lens.command ? this.commandConverter.toInternal(lens.command, disposables) : undefined,
          }, id);
          this.cache.set(id, lens);
          return lensSymbol;
        });
      }
      return undefined;
    });

    if (lenses) {
      return {
        lenses,
        dispose: () => {
          disposables.dispose();
        },
      };
    }
    return undefined;
  }

  resolveCodeLens(resource: URI, symbol: CodeLens): Promise<CodeLens | undefined> {
    const lens = this.cache.get(ObjectIdentifier.of(symbol));
    if (!lens) {
      return Promise.resolve(undefined);
    }

    let resolve: Promise<vscode.CodeLens | undefined>;
    if (typeof this.provider.resolveCodeLens !== 'function' || lens.isResolved) {
      resolve = Promise.resolve(lens);
    } else {
      resolve = Promise.resolve(this.provider.resolveCodeLens(lens, createToken())) as any;
    }
    // TODO cache dispose
    const disposables = new DisposableStore();
    return resolve.then((newLens) => {
      newLens = newLens || lens;
      symbol.command = this.commandConverter.toInternal(newLens.command ? newLens.command : CodeLensAdapter.BAD_CMD, disposables);
      return symbol;
    });
  }
}
