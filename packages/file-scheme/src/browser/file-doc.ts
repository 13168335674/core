import { Injectable, Autowired } from '@ali/common-di';
import { IEditorDocumentModelContentProvider, EOL} from '@ali/ide-editor/lib/browser';
import { FILE_SCHEME, FILE_SAVE_BY_CHANGE_THRESHOLD, IFileSchemeDocClient } from '../common';
import { URI, Emitter, Event, IEditorDocumentChange, IEditorDocumentModelSaveResult, CorePreferences, ISchemaStore, IDisposable, Disposable, ISchemaRegistry, replaceLocalizePlaceholder } from '@ali/ide-core-browser';
import { IFileServiceClient } from '@ali/ide-file-service';
import * as md5 from 'md5';
import { BaseFileSystemEditorDocumentProvider } from '@ali/ide-editor/lib/browser/fs-resource/fs-editor-doc';

// TODO 这块其实应该放到file service当中
@Injectable()
export class FileSchemeDocumentProvider extends BaseFileSystemEditorDocumentProvider implements IEditorDocumentModelContentProvider {

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

  @Autowired(IFileSchemeDocClient)
  protected readonly fileSchemeDocClient: IFileSchemeDocClient;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  constructor() {
    super();
  }

  handlesUri(uri: URI): number {
    return uri.scheme === FILE_SCHEME ? 20 : -1;
  }

  handlesScheme() {
    return false; // dummy, 走handlesUri
  }

  async provideEncoding(uri: URI) {
    if (uri.scheme === FILE_SCHEME) {
      const encoding = this.corePreferences['files.encoding'];
      if (!!encoding) {
        return encoding;
      }
    }

    return super.provideEncoding(uri);
  }

  async saveDocumentModel(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding: string, ignoreDiff: boolean = false, eol: EOL = EOL.LF): Promise<IEditorDocumentModelSaveResult> {
    // TODO
    const baseMd5 = md5(baseContent);
    if (content.length > FILE_SAVE_BY_CHANGE_THRESHOLD) {
      return this.fileSchemeDocClient.saveByChange(uri.toString(), {
        baseMd5,
        changes,
        eol,
      }, encoding, ignoreDiff);
    } else {
      return await this.fileSchemeDocClient.saveByContent(uri.toString(), {
        baseMd5,
        content,
      }, encoding, ignoreDiff);
    }
  }

  async provideEditorDocumentModelContentMd5(uri: URI, encoding?: string): Promise<string | undefined> {
    return this.fileSchemeDocClient.getMd5(uri.toString(), encoding);
  }

}

/**
 * TODO: 这个应该换个地方 @寻壑
 */
@Injectable()
export class VscodeSchemeDocumentProvider implements IEditorDocumentModelContentProvider {
  isReadonly(uri: URI) {
    return true;
  }

  @Autowired(ISchemaStore)
  schemaStore: ISchemaStore;

  @Autowired(ISchemaRegistry)
  jsonRegistry: ISchemaRegistry;

  private _onDidChangeContent: Emitter<URI> = new Emitter();

  public onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  private listeners: {[uri: string]: IDisposable} = {};

  // 在main进程将vscode scheme获取model的方法给定义好，在json schema store，把 fileMatch 与 vscode scheme 的 url 关联起来
  handlesScheme(scheme: string) {
    return scheme === 'vscode';
  }

  async provideEditorDocumentModelContent(uri: URI, encoding) {
    const content = this.getSchemaContent(uri);
    return replaceLocalizePlaceholder(content)!;
  }

  protected getSchemaContent(uri: URI): string {
    const uriString = uri.toString();
    const schema = this.jsonRegistry.getSchemaContributions().schemas[uriString];
    if (schema) {
      const modelContent = JSON.stringify(schema);
      if (!this.listeners[uriString]) {
        const disposable = Disposable.create(() => {
          this.jsonRegistry.onDidChangeSchema((schemaUri) => {
            if (schemaUri === uriString) {
              this._onDidChangeContent.fire(uri);
            }
          });
        });
        this.listeners[uriString] = disposable;
      }
      return modelContent;
    }
    return '{}';
  }

  onDidDisposeModel(uri: URI) {
    if (uri.toString()) {
      this.listeners[uri.toString()].dispose();
      delete this.listeners[uri.toString()];
    }
  }
}
