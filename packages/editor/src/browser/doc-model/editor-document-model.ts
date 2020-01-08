import { Autowired, Injectable } from '@ali/common-di';
import { CommandService, CorePreferences, Disposable, formatLocalize, IEventBus, ILogger, IRange, IReporterService, isThenable, isUndefinedOrNull, localize, PreferenceService, REPORT_NAME, URI } from '@ali/ide-core-browser';
import { IMessageService } from '@ali/ide-overlay';
import * as md5 from 'md5';
import { EndOfLineSequence, EOL, IDocCache, IDocPersistentCacheProvider, isDocContentCache, parseRangeFrom } from '../../common';
import { CompareResult, ICompareService } from '../types';
import { EditorDocumentError } from './editor-document-error';
import { IEditorDocumentModelServiceImpl, SaveTask } from './save-task';
import { EditorDocumentModelContentChangedEvent, EditorDocumentModelOptionChangedEvent, EditorDocumentModelRemovalEvent, EditorDocumentModelSavedEvent, IEditorDocumentModel, IEditorDocumentModelContentChange, IEditorDocumentModelContentRegistry, IEditorDocumentModelService, ORIGINAL_DOC_SCHEME } from './types';

import debounce = require('lodash.debounce');

export interface EditorDocumentModelConstructionOptions {
  eol?: EOL;
  encoding?: string;
  languageId?: string;
  readonly?: boolean;
  savable?: boolean;
  alwaysDirty?: boolean;
  closeAutoSave?: boolean;
}

export interface IDirtyChange {
  fromVersionId: number;
  toVersionId: number;
  changes: IEditorDocumentModelContentChange[];
}

@Injectable({multiple: true})
export class EditorDocumentModel extends Disposable implements IEditorDocumentModel {

  @Autowired(IEditorDocumentModelContentRegistry)
  contentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(IEditorDocumentModelService)
  service: IEditorDocumentModelServiceImpl;

  @Autowired(ICompareService)
  compareService: ICompareService;

  @Autowired(IDocPersistentCacheProvider)
  cacheProvider: IDocPersistentCacheProvider;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(IMessageService)
  messageService: IMessageService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(CorePreferences)
  private corePreferences: CorePreferences;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(IReporterService)
  private reporter: IReporterService;

  private monacoModel: monaco.editor.ITextModel;

  public _encoding: string = 'utf8';

  public readonly readonly: boolean = false;

  public readonly savable: boolean = false;

  public readonly alwaysDirty: boolean = false;

  public readonly closeAutoSave: boolean = false;

  private _originalEncoding: string = this._encoding;

  private _persistVersionId: number = 0;

  private _baseContent: string = '';

  private _baseContentMd5: string | null;

  private savingTasks: SaveTask[] = [];

  private dirtyChanges: IDirtyChange[] = [];

  private _previousVersionId: number;

  private _tryAutoSaveAfterDelay: (() => any) | undefined;

  constructor(public readonly uri: URI, content: string, options: EditorDocumentModelConstructionOptions = {}) {
    super();
    this.onDispose(() => {
      this.eventBus.fire(new EditorDocumentModelRemovalEvent(this.uri));
    });
    if (options.encoding) {
      this._encoding = options.encoding;
    }
    this.readonly = !!options.readonly;
    this.savable = !!options.savable;
    this.alwaysDirty = !!options.alwaysDirty;
    this.closeAutoSave = !!options.closeAutoSave;

    this.monacoModel = monaco.editor.createModel(content, options.languageId, monaco.Uri.parse(uri.toString()));
    if (options.eol) {
      this.eol = options.eol;
    }
    this._originalEncoding = this._encoding;
    this._previousVersionId = this.monacoModel.getVersionId(),
    this._persistVersionId = this.monacoModel.getAlternativeVersionId();
    this.baseContent = content;

    this.listenTo(this.monacoModel);
    this.readCacheToApply();
  }

  private listenTo(monacoModel: monaco.editor.ITextModel) {
    monacoModel.onDidChangeContent((e) => {
      if (e.changes && e.changes.length > 0) {
        this.dirtyChanges.push({
          fromVersionId: this._previousVersionId,
          toVersionId: e.versionId,
          changes: e.changes,
        });
      }
      this._previousVersionId = e.versionId;
      this.notifyChangeEvent(e.changes);
    });

    this.addDispose(monacoModel);
  }

  private readCacheToApply() {
    if (!this.cacheProvider.hasCache(this.uri)) {
      return;
    }

    const maybePromiseCache = this.cacheProvider.getCache(this.uri, this.encoding);
    if (maybePromiseCache) {
      if (isThenable(maybePromiseCache)) {
        maybePromiseCache
          .then((cache) => {
            if (cache) {
              this.applyCache(cache);
            }
          })
          .catch((err) => {
            this.logger.error(`${EditorDocumentError.READ_CACHE_ERROR} ${err && err.message}`);
          });
      } else {
        this.applyCache(maybePromiseCache as IDocCache);
      }
    }
  }

  private applyCache(cache: IDocCache) {
    if (this.dirty) {
      // TODO: 此时应该弹出 DiffView 让用户选择
      this.logger.error(EditorDocumentError.APPLY_CACHE_TO_DIRTY_DOCUMENT);
      return;
    }

    if (this.baseContentMd5 !== cache.startMD5) {
      // TODO: 此时应该弹出 DiffView 让用户选择
      this.logger.error(EditorDocumentError.APPLY_CACHE_TO_DIFFERENT_DOCUMENT);
      return;
    }

    if (isDocContentCache(cache)) {
      this.monacoModel.setValue(cache.content);
    } else {
      for (const changes of cache.changeMatrix) {
        const operations = changes.map((change) => ({
          range: parseRangeFrom(change),
          text: change[0],
        }));
        this.monacoModel.applyEdits(operations);
      }
    }
  }

  cleanAndUpdateContent(content) {
    this.monacoModel.setValue(content);
    (this.monacoModel as any)._commandManager.clear();
    this._persistVersionId = this.monacoModel.getVersionId();
    this.savingTasks = [];
    this.notifyChangeEvent();
    this.baseContent = content;
  }

  async updateEncoding(encoding: string) {
    let shouldFireChange = false;
    if (this._encoding !== encoding) {
      shouldFireChange = true;
    }
    this._encoding = encoding;
    await this.reload();
    if (shouldFireChange) {
      this.eventBus.fire(new EditorDocumentModelOptionChangedEvent({
        uri: this.uri,
        encoding: this._encoding,
      }));
    }
  }

  get encoding() {
    return this._encoding;
  }

  set eol(eol) {
    this.monacoModel.setEOL(eol === EOL.LF ? EndOfLineSequence.LF : EndOfLineSequence.CRLF as any);
  }

  get eol() {
    return this.monacoModel.getEOL() as EOL;
  }

  get dirty() {
    if (this.alwaysDirty) {
      return true;
    }
    if (!this.savable) {
      return false;
    }
    return this._persistVersionId !== this.monacoModel.getAlternativeVersionId();
  }

  set languageId(languageId) {
    monaco.editor.setModelLanguage(this.monacoModel, languageId);
    this.eventBus.fire(new EditorDocumentModelOptionChangedEvent({
      uri: this.uri,
      encoding: languageId,
    }));
  }

  get languageId() {
    return this.monacoModel.getModeId();
  }

  getMonacoModel(): monaco.editor.ITextModel {
    return this.monacoModel;
  }

  async save(force: boolean = false): Promise<boolean> {
    await this.formatOnSave();
    if (!this.preferenceService.get<boolean>('editor.askIfDiff')) {
      force = true;
    }
    // 新建的文件也可以保存
    if (!this.dirty) {
      return false;
    }
    const versionId = this.monacoModel.getVersionId();
    const lastSavingTask = this.savingTasks[this.savingTasks.length - 1];
    if (lastSavingTask && lastSavingTask.versionId === versionId) {
      return false;
    }
    const task = new SaveTask(this.uri, versionId, this.monacoModel.getAlternativeVersionId(), this.getText(), force);
    this.savingTasks.push(task);
    if (this.savingTasks.length === 1) {
      this.initSave();
    }
    const res = await task.finished;
    if (res.state === 'success') {
      return true;
    } else if (res.state === 'error') {
      this.logger.error(res.errorMessage);
      this.messageService.error(localize('doc.saveError.failed') + '\n' + res.errorMessage);
      return false;
    } else if (res.state === 'diff') {
      this.messageService.error(formatLocalize('doc.saveError.diff', this.uri.toString()), [localize('doc.saveError.diffAndSave')]).then((res) => {
        if (res) {
          this.compareAndSave();
        }
      });
      this.logger.error('文件无法保存，版本和磁盘不一致');
      return false;
    }
    return false;
  }

  private async compareAndSave() {
    const originalUri = URI.from({
      scheme: ORIGINAL_DOC_SCHEME,
      query: URI.stringifyQuery({
        target: this.uri.toString(),
      }),
    });
    const fileName = this.uri.path.base;
    const res = await this.compareService.compare(originalUri, this.uri, formatLocalize('editor.compareAndSave.title', fileName, fileName));
    if (res === CompareResult.revert ) {
      this.revert();
    } else if (res === CompareResult.accept ) {
      this.save(true);
    }
  }

  async initSave() {
    while (this.savingTasks.length > 0 ) {
      const res = await this.savingTasks[0].run(this.service, this.baseContent, this.getChangesFromVersion(this._persistVersionId), this.encoding);
      if (res.state === 'success' && this.savingTasks[0]) {
        this.baseContent = this.savingTasks[0].content;

        this.eventBus.fire(new EditorDocumentModelSavedEvent(this.uri));
        this.setPersist(this.savingTasks[0].alternativeVersionId);
      }
      this.savingTasks.shift();
    }
  }

  setPersist(versionId) {
    this._persistVersionId = versionId;
    this.notifyChangeEvent();
  }

  async reload() {
    try {
      const content = await this.contentRegistry.getContentForUri(this.uri, this._encoding);
      if (!isUndefinedOrNull(content)) {
        this.cleanAndUpdateContent(content);
      }
    } catch (e) {
      this._persistVersionId = this.monacoModel.getAlternativeVersionId();
    }
  }

  async revert(notOnDisk?: boolean) {
    if (notOnDisk) {
      // FIXME
      // 暂时就让它不dirty, 不是真正的revert
      this._persistVersionId = this.monacoModel.getAlternativeVersionId();
    } else {
      // 利用修改编码的副作用
      await this.updateEncoding(this._originalEncoding);
    }
  }

  getText(range?: IRange) {
    if (range) {
      return this.monacoModel.getValueInRange(range);
    } else {
      return this.monacoModel.getValue();
    }
  }

  updateContent(content: string, eol?: EOL, setPersist: boolean = false) {
    this.monacoModel.pushEditOperations([], [{
      range: this.monacoModel.getFullModelRange(),
      text: content,
    }], () => []);
    if (eol) {
      this.eol = eol;
    }
    if (setPersist) {
      this.setPersist(this.monacoModel.getAlternativeVersionId());
      this.baseContent = content;
    }
  }

  getChangesFromVersion(versionId) {
    for (let i = this.dirtyChanges.length - 1; i >= 0; i --) {
      if (this.dirtyChanges[i].fromVersionId === versionId) {
        return this.dirtyChanges.slice(i).map((d) => {
          return {
            changes: d.changes,
          };
        });
      }
    }
    return [];
  }

  set baseContent(content: string) {
    this._baseContent = content;
    this._baseContentMd5 = null;
  }

  get baseContent() {
    return this._baseContent;
  }

  get baseContentMd5() {
    if (!this._baseContentMd5) {
      this._baseContentMd5 = md5(this._baseContent);
    }
    return this._baseContentMd5;
  }

  get tryAutoSaveAfterDelay() {
    if (!this._tryAutoSaveAfterDelay) {
      this._tryAutoSaveAfterDelay = debounce(() => {
        this.save();
      }, this.corePreferences['editor.autoSaveDelay'] || 1000);
      this.addDispose(this.corePreferences.onPreferenceChanged((change) => {
        this._tryAutoSaveAfterDelay = debounce(() => {
          this.save();
        }, this.corePreferences['editor.autoSaveDelay'] || 1000);
      }));
    }
    return this._tryAutoSaveAfterDelay;
  }

  private notifyChangeEvent(changes: IEditorDocumentModelContentChange[] = []) {
    if (!this.closeAutoSave && this.savable && this.corePreferences['editor.autoSave'] === 'afterDelay') {
      this.tryAutoSaveAfterDelay();
    }
    // 发出内容变化的事件
    this.eventBus.fire(new EditorDocumentModelContentChangedEvent({
      uri: this.uri,
      dirty: this.dirty,
      changes,
      eol: this.eol,
      versionId: this.monacoModel.getVersionId(),
    }));

    const self = this;
    this.cacheProvider.persistCache(this.uri, {
      // 使用 getter 让需要计算的数据变成 lazy 获取的
      get dirty() {
        return self.dirty;
      },
      get startMD5() {
        return self.baseContentMd5;
      },
      get content() {
        return self.getText();
      },
      get changeMatrix() {
        // 计算从起始版本到现在所有的 change 内容，然后让缓存对象进行持久化
        return self.getChangesFromVersion(self._persistVersionId)
          .map(({ changes }) => changes);
      },
      encoding: this.encoding,
    });
  }

  protected async formatOnSave() {
    const formatOnSave = this.corePreferences['editor.formatOnSave'];

    if (formatOnSave) {
      const formatOnSaveTimeout = this.corePreferences['editor.formatOnSaveTimeout'];
      const timer = this.reporter.time(REPORT_NAME.FORMAT_ON_SAVE);
      try {
        await Promise.race([
          new Promise((_, reject) => {
            setTimeout(() => {
              const err = new Error(formatLocalize('preference.editor.formatOnSaveTimeoutError', formatOnSaveTimeout));
              err.name = 'FormatOnSaveTimeoutError';
              reject(err);
            }, formatOnSaveTimeout);
          }),
          this.commandService.executeCommand('monaco.editor.action.formatDocument'),
        ]);
      } catch (err) {
        if (err.name === 'FormatOnSaveTimeoutError') {
          this.reporter.point(REPORT_NAME.FORMAT_ON_SAVE_TIMEOUT_ERROR, this.uri.toString());
        }
        // 目前 command 没有读取到 contextkey，在不支持 format 的地方执行 format 命令会报错，先警告下，后续要接入 contextkey 来判断
        this.logger.warn(`${EditorDocumentError.FORMAT_ERROR} ${err && err.message}`);
      } finally {
        timer.timeEnd(this.uri.path.ext);
      }
    }
  }
}
