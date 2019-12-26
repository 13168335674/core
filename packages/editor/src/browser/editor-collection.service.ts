import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ILineChange, URI, WithEventBus, OnEvent, Emitter as EventEmitter, Event, ISelection, Disposable } from '@ali/ide-core-common';
import { ICodeEditor, IEditor, EditorCollectionService, IDiffEditor, ResourceDecorationChangeEvent, CursorStatus, IUndoStopOptions, IDecorationApplyOptions } from '../common';
import { IRange, MonacoService, PreferenceService, corePreferenceSchema } from '@ali/ide-core-browser';
import { MonacoEditorDecorationApplier } from './decoration-applier';
import { IEditorDocumentModelRef, EditorDocumentModelContentChangedEvent } from './doc-model/types';
import { Emitter } from '@ali/vscode-jsonrpc';
import { IEditorFeatureRegistry } from './types';
import { EditorFeatureRegistryImpl } from './feature';
import { getConvertedMonacoOptions, isEditorOption } from './preference/converter';

@Injectable()
export class EditorCollectionServiceImpl extends WithEventBus implements EditorCollectionService {

  @Autowired()
  private monacoService: MonacoService;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(IEditorFeatureRegistry)
  editorFeatureRegistry: EditorFeatureRegistryImpl;

  private collection: Map<string, ICodeEditor> = new Map();

  private _editors: Set<IMonacoImplEditor> = new Set();
  private _diffEditors: Set<IDiffEditor> = new Set();

  private _onCodeEditorCreate = new Emitter<ICodeEditor>();
  private _onDiffEditorCreate = new Emitter<IDiffEditor>();

  public onCodeEditorCreate = this._onCodeEditorCreate.event;
  public onDiffEditorCreate = this._onDiffEditorCreate.event;

  constructor() {
    super();
    this.preferenceService.onPreferencesChanged((e) => {
      const changedEditorKeys = Object.keys(e).filter((key) => isEditorOption(key));
      if (changedEditorKeys.length > 0) {
        const optionsDelta = getConvertedMonacoOptions(this.preferenceService, changedEditorKeys);
        this._editors.forEach((editor) => {
          editor.updateOptions(optionsDelta.editorOptions, optionsDelta.modelOptions);
        });
        this._diffEditors.forEach((editor) => {
          (editor as BrowserDiffEditor).updateDiffOptions(optionsDelta.diffOptions);
        });
      }
    });
  }

  async createCodeEditor(dom: HTMLElement, options?: any, overrides?: {[key: string]: any}): Promise<ICodeEditor> {
    const mergedOptions = { ...getConvertedMonacoOptions(this.preferenceService).editorOptions, ...options };
    const monacoCodeEditor = await this.monacoService.createCodeEditor(dom, mergedOptions, overrides);
    const editor = this.injector.get(BrowserCodeEditor, [monacoCodeEditor]);

    this._onCodeEditorCreate.fire(editor);
    return editor;
  }

  public listEditors(): IMonacoImplEditor[] {
    return Array.from(this._editors.values());
  }

  public addEditors(editors: IMonacoImplEditor[]) {
    const beforeSize = this._editors.size;
    editors.forEach((editor) => {
      if (!this._editors.has(editor)) {
        this._editors.add(editor);
        this.editorFeatureRegistry.runContributions(editor);
      }
    });
    if (this._editors.size !== beforeSize) {
      // fire event;
    }
  }

  public removeEditors(editors: IMonacoImplEditor[]) {
    const beforeSize = this._editors.size;
    editors.forEach((editor) => {
      this._editors.delete(editor);
    });
    if (this._editors.size !== beforeSize) {
      // fire event;
    }
  }

  public async createDiffEditor(dom: HTMLElement, options?: any, overrides?: {[key: string]: any}): Promise<IDiffEditor> {
    const preferenceOptions = getConvertedMonacoOptions(this.preferenceService);
    const mergedOptions = {...preferenceOptions.editorOptions, ...preferenceOptions.diffOptions, ...options};
    const monacoDiffEditor = await this.monacoService.createDiffEditor(dom, mergedOptions, overrides);
    const editor = this.injector.get(BrowserDiffEditor, [monacoDiffEditor]);
    this._onDiffEditorCreate.fire(editor);
    return editor;
  }

  public listDiffEditors(): IDiffEditor[] {
    return Array.from(this._diffEditors.values());
  }

  public addDiffEditors(diffEditors: IDiffEditor[]) {
    const beforeSize = this._diffEditors.size;
    diffEditors.forEach((diffEditor) => {
      if (!this._diffEditors.has(diffEditor)) {
        this._diffEditors.add(diffEditor);
      }
    });
    if (this._diffEditors.size !== beforeSize) {
      // fire event _onDiffEditorAdd;
    }
  }

  public removeDiffEditors(diffEditors: IDiffEditor[]) {
    const beforeSize = this._diffEditors.size;
    diffEditors.forEach((diffEditor) => {
      this._diffEditors.delete(diffEditor);
    });
    if (this._diffEditors.size !== beforeSize) {
      // fire event _onDiffEditorRemove;
    }
  }

  // 将docModel的变更事件反映至resource的dirty装饰
  @OnEvent(EditorDocumentModelContentChangedEvent)
  onDocModelContentChangedEvent(e: EditorDocumentModelContentChangedEvent) {
    this.eventBus.fire(new ResourceDecorationChangeEvent({
      uri: e.payload.uri,
      decoration: {
        dirty: !!e.payload.dirty,
      },
    }));
  }

}

export interface IMonacoImplEditor extends IEditor {

  monacoEditor: monaco.editor.ICodeEditor;

}

export function insertSnippetWithMonacoEditor(editor: monaco.editor.ICodeEditor, template: string, ranges: IRange[], opts: IUndoStopOptions ) {

  const snippetController = editor.getContribution('snippetController2') as any;
  const selections: ISelection[] = ranges.map((r) => new monaco.Selection(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn));
  editor.setSelections(selections);
  editor.focus();

  snippetController.insert(template, 0, 0, opts.undoStopBefore, opts.undoStopAfter);

}

function updateOptionsWithMonacoEditor(monacoEditor: monaco.editor.ICodeEditor, editorOptions: monaco.editor.IEditorOptions, modelOptions: monaco.editor.ITextModelUpdateOptions) {
  monacoEditor.updateOptions(editorOptions);
  if (monacoEditor.getModel()) {
    monacoEditor.getModel()!.updateOptions(modelOptions);
  }
}

export class BrowserCodeEditor extends Disposable implements ICodeEditor  {

  @Autowired(EditorCollectionService)
  private collectionService: EditorCollectionServiceImpl;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private editorState: Map<string, monaco.editor.ICodeEditorViewState> = new Map();

  private readonly toDispose: monaco.IDisposable[] = [];

  public currentUri: URI | null;

  protected _currentDocumentModelRef: IEditorDocumentModelRef;

  private _onCursorPositionChanged = new EventEmitter<CursorStatus>();
  public onCursorPositionChanged = this._onCursorPositionChanged.event;

  public _disposed: boolean = false;

  private decorationApplier: MonacoEditorDecorationApplier;

  private _onRefOpen = new Emitter<IEditorDocumentModelRef>();
  public onRefOpen = this._onRefOpen.event;

  public get currentDocumentModel() {
    if (this._currentDocumentModelRef && !this._currentDocumentModelRef.disposed) {
      return this._currentDocumentModelRef.instance;
    } else {
      return null;
    }
  }

  public getId() {
    return this.monacoEditor.getId();
  }

  getSelections() {
    return this.monacoEditor.getSelections() || [];
  }

  setSelections(selections) {
    return this.monacoEditor.setSelections(selections);
  }

  setSelection(selection) {
    return this.monacoEditor.setSelection(selection);
  }

  updateOptions(editorOptions: monaco.editor.IEditorOptions, modelOptions: monaco.editor.ITextModelUpdateOptions) {
    // TODO sd
    updateOptionsWithMonacoEditor(this.monacoEditor, editorOptions, modelOptions);
  }

  constructor(
    public readonly monacoEditor: monaco.editor.IStandaloneCodeEditor,
  ) {
    super();

    this.collectionService.addEditors([this]);
    this.decorationApplier = this.injector.get(MonacoEditorDecorationApplier, [this.monacoEditor]);
    // 防止浏览器后退前进手势
    const disposer = monacoEditor.onDidChangeModel(() => {
      bindPreventNavigation(this.monacoEditor.getDomNode()!);
      disposer.dispose();
    });
    this.toDispose.push(monacoEditor.onDidChangeCursorPosition(() => {
      if (!this.currentDocumentModel) {
        return;
      }
      const selection = monacoEditor.getSelection();
      this._onCursorPositionChanged.fire({
        position: monacoEditor.getPosition(),
        selectionLength: selection ? this.currentDocumentModel.getMonacoModel().getValueInRange(selection).length : 0,
      });
    }));
  }

  layout(): void {
    this.monacoEditor.layout();
  }

  focus(): void {
    this.monacoEditor.focus();
  }

  insertSnippet(template: string, ranges: IRange[], opts: IUndoStopOptions ) {
    insertSnippetWithMonacoEditor(this.monacoEditor, template, ranges, opts);
  }

  dispose() {
    super.dispose();
    this.saveCurrentState();
    this.collectionService.removeEditors([this]);
    this.monacoEditor.dispose();
    this._disposed = true;
    this.toDispose.forEach((disposable) => disposable.dispose());
  }

  protected saveCurrentState() {
    if (this.currentUri) {
      const state = this.monacoEditor.saveViewState();
      if (state) {
        this.editorState.set(this.currentUri.toString(), state);
        // TODO store in storage
      }
    }
  }

  protected restoreState() {
    if (this.currentUri) {
      const state = this.editorState.get(this.currentUri.toString());
      if (state) {
        this.monacoEditor.restoreViewState(state);
      }
    }
  }

  async open(documentModelRef: IEditorDocumentModelRef, range?: IRange): Promise<void> {
    this.saveCurrentState();
    this._currentDocumentModelRef = documentModelRef;
    const model = this.currentDocumentModel!.getMonacoModel();
    this.monacoEditor.updateOptions({
      readOnly: !!documentModelRef.instance.readonly,
    });
    this.currentUri = new URI(model.uri.toString());
    this.monacoEditor.setModel(model);
    if (range) {
      this.monacoEditor.revealRangeInCenter(range);
      this.monacoEditor.setSelection(range);
    } else {
      this.restoreState();
    }
    this._onRefOpen.fire(documentModelRef);
    // monaco 在文件首次打开时不会触发 cursorChange
    this._onCursorPositionChanged.fire({
      position: this.monacoEditor.getPosition(),
      selectionLength: 0,
    });
  }

  public async save(): Promise<void> {
    if (this.currentDocumentModel) {
      await this.currentDocumentModel.save();
    }
  }

  applyDecoration(key, options) {
    this.decorationApplier.applyDecoration(key, options);
  }

  onSelectionsChanged(listener) {
    return this.monacoEditor.onDidChangeCursorSelection((e) => {
      listener({
        selections: this.getSelections(),
        source: e.source,
      });
    });
  }

  onVisibleRangesChanged(listener) {
    const disposer = new Disposable();
    const monacoEditor = this.monacoEditor;
    disposer.addDispose(monacoEditor.onDidScrollChange((e) => {
      listener(this.monacoEditor.getVisibleRanges());
    }));
    disposer.addDispose(monacoEditor.onDidLayoutChange((e) => {
      listener(this.monacoEditor.getVisibleRanges());
    }));
    return disposer;
  }

  onConfigurationChanged(listener) {
    const monacoEditor = this.monacoEditor;
    return monacoEditor.onDidChangeConfiguration((e) => {
      listener();
    });
  }
}

export class BrowserDiffEditor extends Disposable implements IDiffEditor {
  @Autowired(EditorCollectionService)
  private collectionService: EditorCollectionServiceImpl;

  private originalDocModelRef: IEditorDocumentModelRef | null;

  private modifiedDocModelRef: IEditorDocumentModelRef | null;

  get originalDocModel() {
    if (this.originalDocModelRef && !this.originalDocModelRef.disposed) {
      return this.originalDocModelRef.instance;
    }
    return null;
  }

  get modifiedDocModel() {
    if (this.modifiedDocModelRef && !this.modifiedDocModelRef.disposed) {
      return this.modifiedDocModelRef.instance;
    }
    return null;
  }

  public originalEditor: IMonacoImplEditor;

  public modifiedEditor: IMonacoImplEditor;

  public _disposed: boolean;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  constructor(public readonly monacoDiffEditor: monaco.editor.IDiffEditor) {
    super();
    this.wrapEditors();
  }

  async compare(originalDocModelRef: IEditorDocumentModelRef, modifiedDocModelRef: IEditorDocumentModelRef) {
    this.originalDocModelRef = originalDocModelRef;
    this.modifiedDocModelRef = modifiedDocModelRef;
    this.monacoDiffEditor.setModel({
      original: this.originalDocModel!.getMonacoModel(),
      modified: this.modifiedDocModel!.getMonacoModel(),
    });
    this.monacoDiffEditor.updateOptions({
      readOnly: !!this.modifiedDocModel!.readonly,
    });
  }

  updateDiffOptions(options: Partial<monaco.editor.IDiffEditorOptions>) {
    this.monacoDiffEditor.updateOptions(options);
  }

  getLineChanges(): ILineChange[] | null {
    throw new Error('Method not implemented.');
  }

  private wrapEditors() {
    const diffEditor = this;
    const decorationApplierOriginal = this.injector.get(MonacoEditorDecorationApplier, [diffEditor.monacoDiffEditor.getOriginalEditor()]);
    this.originalEditor = {
      getId() {
        return diffEditor.monacoDiffEditor.getOriginalEditor().getId();
      },
      get currentDocumentModel() {
        return diffEditor.originalDocModel;
      },
      get currentUri() {
        return diffEditor.originalDocModel ? diffEditor.originalDocModel.uri : null;
      },
      get monacoEditor() {
        return diffEditor.monacoDiffEditor.getOriginalEditor();
      },
      getSelections() {
        return diffEditor.monacoDiffEditor.getOriginalEditor().getSelections();
      },
      insertSnippet(template: string, ranges: IRange[], opts: IUndoStopOptions ) {
        insertSnippetWithMonacoEditor(diffEditor.monacoDiffEditor.getOriginalEditor(), template, ranges, opts);
      },
      applyDecoration(key, options) {
        decorationApplierOriginal.applyDecoration(key, options);
      },
      async save() {
        // do nothing
      },
      get onDispose() {
        return diffEditor.monacoDiffEditor.getOriginalEditor().onDidDispose as Event<void>;
      },
      onSelectionsChanged(listener) {
        return diffEditor.monacoDiffEditor.getOriginalEditor().onDidChangeCursorSelection((e) => {
          listener({
            selections: diffEditor.monacoDiffEditor.getOriginalEditor().getSelections() || [],
            source: e.source,
          });
        });
      },
      onVisibleRangesChanged(listener) {
        const monacoEditor = diffEditor.monacoDiffEditor.getOriginalEditor();
        const disposer = new Disposable();
        disposer.addDispose(monacoEditor.onDidScrollChange((e) => {
          listener(this.monacoEditor.getVisibleRanges());
        }));
        disposer.addDispose(monacoEditor.onDidLayoutChange((e) => {
          listener(this.monacoEditor.getVisibleRanges());
        }));
        return disposer;
      },
      onConfigurationChanged(listener) {
        const monacoEditor = diffEditor.monacoDiffEditor.getOriginalEditor();
        return monacoEditor.onDidChangeConfiguration((e) => {
          listener();
        });
      },
      setSelections(selections) {
        const monacoEditor = diffEditor.monacoDiffEditor.getOriginalEditor();
        return monacoEditor.setSelections(selections as any);
      },
      setSelection(selection) {
        const monacoEditor = diffEditor.monacoDiffEditor.getOriginalEditor();
        return monacoEditor.setSelection(selection as any);
      },
      updateOptions(editorOptions: monaco.editor.IEditorOptions, modelOptions: monaco.editor.ITextModelUpdateOptions) {
        updateOptionsWithMonacoEditor(diffEditor.monacoDiffEditor.getOriginalEditor(), editorOptions, modelOptions);
      },
    };

    const decorationApplierModified = this.injector.get(MonacoEditorDecorationApplier, [diffEditor.monacoDiffEditor.getOriginalEditor()]);
    this.modifiedEditor = {
      getId() {
        return diffEditor.monacoDiffEditor.getModifiedEditor().getId();
      },
      get currentDocumentModel() {
        return diffEditor.modifiedDocModel;
      },
      get currentUri() {
        return diffEditor.modifiedDocModel ? diffEditor.modifiedDocModel.uri : null;
      },
      get monacoEditor() {
        return diffEditor.monacoDiffEditor.getModifiedEditor();
      },
      getSelections() {
        return diffEditor.monacoDiffEditor.getModifiedEditor().getSelections();
      },
      insertSnippet(template: string, ranges: IRange[], opts: IUndoStopOptions ) {
        insertSnippetWithMonacoEditor(diffEditor.monacoDiffEditor.getModifiedEditor(), template, ranges, opts);
      },
      applyDecoration(key: string, options: IDecorationApplyOptions[]) {
        decorationApplierModified.applyDecoration(key, options);
      },
      async save() {
        if (diffEditor.modifiedDocModel) {
          diffEditor.modifiedDocModel.save();
        }
      },
      onSelectionsChanged(listener) {
        const monacoEditor = diffEditor.monacoDiffEditor.getModifiedEditor();
        return monacoEditor.onDidChangeCursorSelection((e) => {
          listener({
            selections: monacoEditor.getSelections() || [],
            source: e.source,
          });
        });
      },
      onVisibleRangesChanged(listener) {
        const monacoEditor = diffEditor.monacoDiffEditor.getModifiedEditor();
        const disposer = new Disposable();
        disposer.addDispose(monacoEditor.onDidScrollChange((e) => {
          listener(this.monacoEditor.getVisibleRanges());
        }));
        disposer.addDispose(monacoEditor.onDidLayoutChange((e) => {
          listener(this.monacoEditor.getVisibleRanges());
        }));
        return disposer;
      },
      onConfigurationChanged(listener) {
        const monacoEditor = diffEditor.monacoDiffEditor.getModifiedEditor();
        return monacoEditor.onDidChangeConfiguration((e) => {
          listener();
        });
      },
      setSelections(selections) {
        const monacoEditor = diffEditor.monacoDiffEditor.getModifiedEditor();
        return monacoEditor.setSelections(selections as any);
      },
      setSelection(selection) {
        const monacoEditor = diffEditor.monacoDiffEditor.getModifiedEditor();
        return monacoEditor.setSelection(selection as any);
      },
      get onDispose() {
        return diffEditor.monacoDiffEditor.getModifiedEditor().onDidDispose as Event<void>;
      },
      updateOptions(editorOptions: monaco.editor.IEditorOptions, modelOptions: monaco.editor.ITextModelUpdateOptions) {
        updateOptionsWithMonacoEditor(diffEditor.monacoDiffEditor.getOriginalEditor(), editorOptions, modelOptions);
      },
    };
    this.collectionService.addEditors([this.originalEditor, this.modifiedEditor]);
    this.collectionService.addDiffEditors([this]);
  }

  layout(): void {
    return this.monacoDiffEditor.layout();
  }

  focus(): void {
    this.monacoDiffEditor.focus();
  }

  dispose(): void {
    super.dispose();
    this.collectionService.removeEditors([this.originalEditor, this.modifiedEditor]);
    this.collectionService.removeDiffEditors([this]);
    this.monacoDiffEditor.dispose();
    this._disposed = true;
  }

}

// utils

function bindPreventNavigation(div: HTMLElement) {
  div.addEventListener('mousewheel', preventNavigation as any);
}

function preventNavigation(this: HTMLDivElement, e: WheelEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (this.offsetWidth + this.scrollLeft + e.deltaX > this.scrollWidth) {
    e.preventDefault();
    e.stopPropagation();
  } else if (this.scrollLeft + e.deltaX < 0) {
    e.preventDefault();
    e.stopPropagation();
  }
}
