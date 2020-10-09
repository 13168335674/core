import { IEditorDocumentModelContentProvider } from '../doc-model/types';
import { Emitter, URI, Event, CorePreferences, IApplicationService, FileChangeType, OS, IEditorDocumentChange, IEditorDocumentModelSaveResult } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { IFileServiceClient } from '@ali/ide-file-service';
import { EditorPreferences } from '../preference/schema';
import { EOL } from '../types';

/**
 * 通用的用来处理 FileSystem 提供的文档
 * 可以 extend 这个来添加更强的能力，如 file-scheme 中的 file-doc
 */
@Injectable()
export class BaseFileSystemEditorDocumentProvider implements IEditorDocumentModelContentProvider {

  protected _onDidChangeContent: Emitter<URI> = new Emitter();

  public onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  protected _fileContentMd5OnBrowserFs: Set<string> = new Set();

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  @Autowired(EditorPreferences)
  protected readonly editorPreferences: EditorPreferences;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  constructor() {
    this.fileServiceClient.onFilesChanged((changes) => {
      changes.forEach((change) => {
        if (this._fileContentMd5OnBrowserFs.has(change.uri)) {
          if (change.type === FileChangeType.ADDED || change.type === FileChangeType.UPDATED) {
            this._onDidChangeContent.fire(new URI(change.uri));
          }
        }
      });
    });
  }

  handlesScheme(scheme: string) {
    return this.fileServiceClient.handlesScheme(scheme);
  }

  async provideEncoding(uri: URI) {

    return await this.fileServiceClient.getEncoding(uri.toString());
  }

  async provideEOL() {
    const backendOS = await this.applicationService.getBackendOS();
    const eol = this.corePreferences['files.eol'];

    if (eol !== 'auto') {
      return eol;
    }
    return backendOS === OS.Type.Windows ? EOL.CRLF : EOL.LF;
  }

  async provideEditorDocumentModelContent(uri: URI, encoding) {
    const res = await this.fileServiceClient.resolveContent(uri.toString(), {
      encoding,
    });

    // 记录表示这个文档被[这个editorDocumentProvider]引用了
    const content = res && res.content || '';
    this._fileContentMd5OnBrowserFs.add(uri.toString());

    return content;
  }

  async isReadonly(uri: URI): Promise<boolean> {
    const readonlyFiles: string[] = this.editorPreferences['editor.readonlyFiles'];
    if (readonlyFiles && readonlyFiles.length) {
      for (const file of readonlyFiles) {
        if (uri.isEqual(URI.file(file)) || uri.matchGlobPattern(file) || uri.toString().endsWith(file.replace('./', ''))) {
          return true;
        }
      }
    }
    return this.fileServiceClient.isReadonly(uri.toString());
  }

  async saveDocumentModel(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding: string, ignoreDiff: boolean = false): Promise<IEditorDocumentModelSaveResult> {
    // 默认的文件系统都直接存 content
    try {
      const fileStat = await this.fileServiceClient.getFileStat(uri.toString());
      if (!fileStat) {
        await this.fileServiceClient.createFile(uri.toString(), { content, overwrite: true, encoding});
      } else {
        await this.fileServiceClient.setContent(fileStat, content, { encoding });
      }
      return {
        state: 'success',
      };
    } catch (e) {
      return {
        state: 'error',
        errorMessage: e.message,
      };
    }
  }

  onDidDisposeModel(uri: URI) {
    this._fileContentMd5OnBrowserFs.delete(uri.toString());
  }

}
