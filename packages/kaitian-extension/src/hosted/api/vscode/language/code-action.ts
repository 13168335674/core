import type { CodeActionContext, CodeActionList, CodeAction, WorkspaceEdit } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import type { IMarker } from '@ali/monaco-editor-core/esm/vs/platform/markers/common/markers';
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
import { Uri as URI } from '@ali/ide-core-common';
import { CodeActionKind } from '../../../../common/vscode/ext-types';
import { Selection, Range } from '../../../../common/vscode/model.api';
import * as Converter from '../../../../common/vscode/converter';
import { createToken } from './util';
import { ExtensionDocumentDataManager } from '../../../../common/vscode/doc';
import { Diagnostics } from './diagnostics';
import { CommandsConverter } from '../ext.host.command';
import { DisposableStore } from '@ali/ide-core-common';

export class CodeActionAdapter {

    constructor(
        private readonly provider: vscode.CodeActionProvider,
        private readonly document: ExtensionDocumentDataManager,
        private readonly diagnostics: Diagnostics,
    ) { }

    async provideCodeAction(resource: URI, rangeOrSelection: Range | Selection, context: CodeActionContext, commandConverter: CommandsConverter): Promise<CodeActionList | undefined> {
        const document = this.document.getDocumentData(resource);
        if (!document) {
            return Promise.reject(new Error(`There are no document for ${resource}`));
        }

        const doc = document.document;
        const ran = CodeActionAdapter._isSelection(rangeOrSelection)
            ? Converter.toSelection(rangeOrSelection) as vscode.Selection
            : Converter.toRange(rangeOrSelection) as vscode.Range;
        const allDiagnostics: vscode.Diagnostic[] = [];

        for (const diagnostic of this.diagnostics.getDiagnostics(resource)) {
            if (ran.intersection(diagnostic.range)) {
                allDiagnostics.push(diagnostic);
            }
        }

        const codeActionContext: vscode.CodeActionContext = {
            diagnostics: allDiagnostics,
            only: context.only ? new CodeActionKind(context.only) : undefined,
        };
        // TODO dispose
        const disposables = new DisposableStore();
        const actions = await Promise.resolve(this.provider.provideCodeActions(doc, ran, codeActionContext, createToken())).then((commandsOrActions) => {
            if (!Array.isArray(commandsOrActions) || commandsOrActions.length === 0) {
                return undefined!;
            }
            const result: CodeAction[] = [];
            for (const candidate of commandsOrActions) {
                if (!candidate) {
                    continue;
                }
                if (CodeActionAdapter._isCommand(candidate)) {
                    result.push({
                        title: candidate.title || '',
                        command: commandConverter.toInternal(candidate, disposables),
                    });
                } else {
                    if (codeActionContext.only) {
                        if (!candidate.kind) {
                            /* tslint:disable-next-line:max-line-length */
                            // tslint:disable-next-line:no-console
                            console.warn(`Code actions of kind '${codeActionContext.only.value}' requested but returned code action does not have a 'kind'. Code action will be dropped. Please set 'CodeAction.kind'.`);
                        } else if (!codeActionContext.only.contains(candidate.kind)) {
                            /* tslint:disable-next-line:max-line-length */
                            // tslint:disable-next-line:no-console
                            console.warn(`Code actions of kind '${codeActionContext.only.value}' requested but returned code action is of kind '${candidate.kind.value}'. Code action will be dropped. Please check 'CodeActionContext.only' to only return requested code action.`);
                        }
                    }

                    result.push({
                        title: candidate.title,
                        command: candidate.command && commandConverter.toInternal(candidate.command, disposables),
                        diagnostics: candidate.diagnostics && candidate.diagnostics.map(Converter.convertDiagnosticToMarkerData) as IMarker[],
                        edit: candidate.edit && Converter.TypeConverts.WorkspaceEdit.from(candidate.edit) as WorkspaceEdit,
                        kind: candidate.kind && candidate.kind.value,
                    });
                }
            }

            return result;
        });

        if (actions) {
          return {
            // FIXME 这里 CodeActionList 类型是 readonly
            // @ts-ignore
            actions,
            dispose: () => {
              disposables.dispose();
            },
          };
        }

        return undefined;
    }

    // tslint:disable-next-line:no-any
    private static _isCommand(smth: any): smth is vscode.Command {
        return typeof (smth as vscode.Command).command === 'string';
    }

    // tslint:disable-next-line:no-any
    private static _isSelection(obj: any): obj is Selection {
        return (
            obj
            && (typeof obj.selectionStartLineNumber === 'number')
            && (typeof obj.selectionStartColumn === 'number')
            && (typeof obj.positionLineNumber === 'number')
            && (typeof obj.positionColumn === 'number')
        );
    }

}
