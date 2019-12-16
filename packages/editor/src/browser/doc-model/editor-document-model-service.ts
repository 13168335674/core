import * as md5 from 'md5';
import { URI, IRef, ReferenceManager, IEditorDocumentChange, IEditorDocumentModelSaveResult, WithEventBus, OnEvent, StorageProvider, IStorage, STORAGE_NAMESPACE, STORAGE_SCHEMA, ILogger } from '@ali/ide-core-browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';

import { IEditorDocumentModel, IEditorDocumentModelContentRegistry, IEditorDocumentModelService, EditorDocumentModelOptionExternalUpdatedEvent, EditorDocumentModelCreationEvent } from './types';
import { EditorDocumentModel } from './editor-document-model';
import { mapToSerializable, serializableToMap } from '@ali/ide-core-common/lib/map';

export const EDITOR_DOCUMENT_MODEL_STORAGE: URI = URI.from({scheme: STORAGE_SCHEMA.SCOPE, path: 'editor-doc'});
export const EDITOR_DOC_ENCODING_PREF_KEY = 'editor_encoding_pref';
@Injectable()
export class EditorDocumentModelServiceImpl extends WithEventBus implements IEditorDocumentModelService {

  @Autowired(IEditorDocumentModelContentRegistry)
  contentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(StorageProvider)
  getStorage: StorageProvider;

  @Autowired(ILogger)
  logger: ILogger;

  private storage: IStorage;

  private editorDocModels = new Map<string, EditorDocumentModel>();

  private creatingEditorModels = new Map<string, Promise<EditorDocumentModel>>();

  private _modelReferenceManager: ReferenceManager<EditorDocumentModel>;

  private _modelsToDispose = new Set<string>();

  private  preferredModelEncodings = new Map<string, string>();

  private _ready: Promise<void> | undefined;

  constructor() {
    super();
    this._modelReferenceManager = new ReferenceManager<EditorDocumentModel>((key: string) => {
      if (this._modelsToDispose.has(key)) {
        this._modelsToDispose.delete(key);
      }
      return this.getOrCreateModel(key);
    });
    this._modelReferenceManager.onReferenceAllDisposed((key: string) => {
      this._delete(key);
    });
    this._modelReferenceManager.onInstanceCreated((model) => {
      this.eventBus.fire(new EditorDocumentModelCreationEvent({
        uri: model.uri,
        languageId: model.languageId,
        eol: model.eol,
        encoding: model.encoding,
        content: model.getText(),
        readonly: model.readonly,
        versionId: model.getMonacoModel().getVersionId(),
      }));
    });
  }

  private _delete(uri: string | URI): void {
    // debounce
    this._modelsToDispose.add(uri.toString());
    setTimeout(() => {
      if (this._modelsToDispose.has(uri.toString())) {
        this._doDelete(uri.toString());
      }
    }, 3000);
  }

  private _doDelete(uri: string) {
    const doc = this.editorDocModels.get(uri);
    if (doc) {
      doc.dispose();
      this.editorDocModels.delete(uri);
      return doc;
    }
    this._modelsToDispose.delete(uri);
  }

  async changeModelEncoding(uri: URI, encoding: string) {
    await this.ready;
    this.preferredModelEncodings.set(uri.toString(), encoding);
    const docRef = this.getModelReference(uri);
    if (docRef) {
      docRef.instance.updateEncoding(encoding);
      docRef.dispose();
    }
    return this.persistEncodingPreference();
  }

  persistEncodingPreference() {
    return this.storage.set(EDITOR_DOC_ENCODING_PREF_KEY, JSON.stringify(mapToSerializable(this.preferredModelEncodings)));
  }

  get ready() {
    if (!this._ready) {
      this._ready = new Promise(async (resolve) => {
        this.storage = await this.getStorage(EDITOR_DOCUMENT_MODEL_STORAGE);
        if (this.storage.get(EDITOR_DOC_ENCODING_PREF_KEY)) {
          try {
            this.preferredModelEncodings = serializableToMap(JSON.parse(this.storage.get(EDITOR_DOC_ENCODING_PREF_KEY)!));
          } catch (e) {
            this.logger.error(e);
          }
        }
        resolve();
      });
    }
    return this._ready;
  }

  @OnEvent(EditorDocumentModelOptionExternalUpdatedEvent)
  async acceptExternalChange(e: EditorDocumentModelOptionExternalUpdatedEvent) {
    const doc = this.editorDocModels.get(e.payload.toString());
    if (doc) {
      if (doc.dirty) {
        // do nothing
      } else {
        const provider = this.contentRegistry.getProvider(doc.uri);
        if (provider) {
          if (provider.provideEditorDocumentModelContentMd5) {
            const nextMd5 = await provider.provideEditorDocumentModelContentMd5(doc.uri, doc.encoding);
            if (nextMd5 !== doc.baseContentMd5) {
              doc.updateContent(await this.contentRegistry.getContentForUri(doc.uri, doc.encoding), undefined, true);
            }
          } else {
            const content = await this.contentRegistry.getContentForUri(doc.uri, doc.encoding);
            if (md5(content) !== doc.baseContentMd5) {
              doc.updateContent(content, undefined, true);
            }
          }
        }
      }
    }
  }

  createModelReference(uri: URI, reason?: string | undefined): Promise<IRef<IEditorDocumentModel>> {
    return this._modelReferenceManager.getReference(uri.toString(), reason);
  }

  getModelReference(uri: URI, reason?: string | undefined): IRef<IEditorDocumentModel> | null {
    return this._modelReferenceManager.getReferenceIfHasInstance(uri.toString(), reason);
  }

  getAllModels(): IEditorDocumentModel[] {
    return Array.from(this.editorDocModels.values());
  }

  async getOrCreateModel(uri: string, encoding?: string): Promise<EditorDocumentModel> {
    if (this.editorDocModels.has(uri)) {
      return this.editorDocModels.get(uri)!;
    }
    return this.createModel(uri, encoding);
  }

  private createModel(uri: string, encoding?: string): Promise<EditorDocumentModel> {
    // 防止异步重复调用
    if (!this.creatingEditorModels.has(uri)) {
      const promise = this.doCreateModel(uri, encoding).then((model) => {
        this.creatingEditorModels.delete(uri);
        return model;
      }, (e) => {
        this.creatingEditorModels.delete(uri);
        throw e;
      });
      this.creatingEditorModels.set(uri, promise);
    }
    return this.creatingEditorModels.get(uri)!;
  }

  private async doCreateModel(uriString: string, encoding?: string): Promise<EditorDocumentModel> {
    await this.ready;
    const uri = new URI(uriString);
    const provider = this.contentRegistry.getProvider(uri);

    if (!provider) {
      throw new Error(`未找到${uri.toString()}的文档提供商`);
    }

    if (!encoding && provider.provideEncoding) {
      if (this.preferredModelEncodings.has(uri.toString())) {
        encoding = this.preferredModelEncodings.get(uri.toString());
      } else if (provider.provideEncoding) {
        encoding = await provider.provideEncoding(uri);
      }
    }

    const [
      content,
      readonly,
      languageId,
      eol,
    ] = await Promise.all([
      (async () => provider.provideEditorDocumentModelContent(uri, encoding))(),
      (async () => provider.isReadonly ? provider.isReadonly(uri) : undefined)(),
      (async () => provider.preferLanguageForUri ? provider.preferLanguageForUri(uri) : undefined)(),
      (async () => provider.provideEOL ? provider.provideEOL(uri) : undefined)(),
    ] as const);

    const savable = !!provider.saveDocumentModel;

    const model = this.injector.get(EditorDocumentModel, [uri, content, {
      readonly,
      languageId,
      savable,
      eol,
      encoding,
    }]);

    this.editorDocModels.set(uri.toString(), model);
    return model;
  }

  async saveEditorDocumentModel(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding?: string, ignoreDiff?: boolean): Promise<IEditorDocumentModelSaveResult> {
    const provider = this.contentRegistry.getProvider(uri);

    if (!provider) {
      throw new Error(`未找到${uri.toString()}的文档提供商`);
    }
    if (!provider.saveDocumentModel) {
      throw new Error(`${uri.toString()}的文档提供商不存在保存方法`);
    }

    const result = await provider.saveDocumentModel(uri, content, baseContent, changes, encoding, ignoreDiff);
    return result;
  }

}
