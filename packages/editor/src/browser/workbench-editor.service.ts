import { WorkbenchEditorService, EditorCollectionService, ICodeEditor, IResource, ResourceService, IResourceOpenOptions, IDiffEditor, IDiffResource, IEditor, CursorStatus, IEditorOpenType, EditorGroupSplitAction, IEditorGroup, IOpenResourceResult, IEditorGroupState, ResourceDecorationChangeEvent, IUntitledOptions, SaveReason } from '../common';
import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { observable, computed, action, reaction } from 'mobx';
import { CommandService, URI, getLogger, MaybeNull, Deferred, Emitter as EventEmitter, Event, WithEventBus, OnEvent, StorageProvider, IStorage, STORAGE_NAMESPACE, ContributionProvider } from '@ali/ide-core-common';
import { EditorComponentRegistry, IEditorComponent, GridResizeEvent, DragOverPosition, EditorGroupOpenEvent, EditorGroupChangeEvent, EditorSelectionChangeEvent, EditorVisibleChangeEvent, EditorConfigurationChangedEvent, EditorGroupIndexChangedEvent, EditorComponentRenderMode, EditorGroupCloseEvent, EditorGroupDisposeEvent, BrowserEditorContribution, ResourceOpenTypeChangedEvent } from './types';
import { IGridEditorGroup, EditorGrid, SplitDirection, IEditorGridState } from './grid/grid.service';
import { makeRandomHexString } from '@ali/ide-core-common/lib/functional';
import { FILE_COMMANDS, CorePreferences, ResizeEvent, getSlotLocation, AppConfig, IContextKeyService, ServiceNames, MonacoService, IScopedContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IEditorDocumentModelService, IEditorDocumentModelRef } from './doc-model/types';
import { Schemas } from '@ali/ide-core-common';
import { isNullOrUndefined } from 'util';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';

@Injectable()
export class WorkbenchEditorServiceImpl extends WithEventBus implements WorkbenchEditorService {

  @observable.shallow
  editorGroups: EditorGroup[] = [];

  @Autowired()
  private monacoService: MonacoService;

  private _sortedEditorGroups: EditorGroup[] | undefined = [];

  @Autowired(INJECTOR_TOKEN)
  private injector!: Injector;

  private readonly _onActiveResourceChange = new EventEmitter<MaybeNull<IResource>>();
  public readonly onActiveResourceChange: Event<MaybeNull<IResource>> = this._onActiveResourceChange.event;

  private readonly _onCursorChange = new EventEmitter<CursorStatus>();
  public readonly onCursorChange: Event<CursorStatus> = this._onCursorChange.event;

  public topGrid: EditorGrid;

  @observable.ref
  private _currentEditorGroup: IEditorGroup;

  @Autowired(StorageProvider)
  getStorage: StorageProvider;

  openedResourceState: IStorage;

  private _restoring: boolean = true;

  public contributionsReady = new Deferred();

  private initializing: Promise<any>;

  public editorContextKeyService: IScopedContextKeyService;

  private _domNode: HTMLElement;

  @Autowired(BrowserEditorContribution)
  private readonly contributions: ContributionProvider<BrowserEditorContribution>;

  @Autowired(IEditorDocumentModelService)
  protected documentModelManager: IEditorDocumentModelService;

  private untitledIndex = 1;

  private untitledCloseIndex: number[] = [];

  constructor() {
    super();
    this.initialize();
  }

  setCurrentGroup(editorGroup) {
    if (editorGroup) {
      if (this._currentEditorGroup === editorGroup) {
        return;
      }
      this._currentEditorGroup = editorGroup;
      this._onActiveResourceChange.fire(editorGroup.currentResource);
    }
  }

  getAllOpenedUris() {
    const uris: URI[] = [];
    for (const group of this.editorGroups) {
      for (const resource of group.resources) {
        const index = uris.findIndex((u) => u.isEqual(resource.uri));
        if (index === -1) {
          uris.push(resource.uri);
        }
      }
    }
    return uris;
  }

  async saveAll(includeUntitled?: boolean, reason?: SaveReason) {
    for (const editorGroup of this.editorGroups) {
      await editorGroup.saveAll(includeUntitled, reason);
    }
  }

  hasDirty(): boolean {
    for (const editorGroup of this.editorGroups) {
      if (editorGroup.hasDirty()) {
        return true;
      }
    }
    return false;
  }

  createEditorGroup(): EditorGroup {
    const editorGroup = this.injector.get(EditorGroup, [this.generateRandomEditorGroupName()]);
    this.editorGroups.push(editorGroup);
    const currentWatchDisposer = reaction(() => editorGroup.currentResource, () => {
      if (editorGroup === this.currentEditorGroup) {
        this._onActiveResourceChange.fire(editorGroup.currentResource);
      }
    });
    editorGroup.addDispose({
      dispose: () => {
        currentWatchDisposer();
      },
    });
    const groupChangeDisposer = reaction(() => editorGroup.getState(), () => {
      this.saveOpenedResourceState();
    });
    editorGroup.addDispose({
      dispose: () => {
        groupChangeDisposer();
      },
    });
    editorGroup.onCurrentEditorCursorChange((e) => {
      if (this._currentEditorGroup === editorGroup) {
        this._onCursorChange.fire(e);
      }
    });
    this._sortedEditorGroups = undefined;
    return editorGroup;
  }

  /**
   * 随机生成一个不重复的editor Group
   */
  private generateRandomEditorGroupName() {
    let name = makeRandomHexString(5);
    while (this.editorGroups.findIndex((g) => g.name === name) !== -1) {
      name = makeRandomHexString(5);
    }
    return name;
  }

  public initialize() {
    if (!this.initializing) {
      this.initializing = this.doInitialize();
    }
    return this.initializing;
  }

  private async doInitialize() {
    this.openedResourceState = await this.initializeState();
    await this.contributionsReady.promise;
    await this.restoreState();
    this._currentEditorGroup = this.editorGroups[0];
  }

  private async initializeState() {
    const state = await this.getStorage(STORAGE_NAMESPACE.WORKBENCH);
    return state;
  }

  public get currentEditor(): IEditor | null {
    return this.currentEditorGroup && this.currentEditorGroup.currentEditor;
  }

  public get currentCodeEditor(): ICodeEditor | null {
    return this.currentEditorGroup.currentCodeEditor;
  }

  public get currentEditorGroup(): EditorGroup {
    return this._currentEditorGroup as any;
  }

  async open(uri: URI, options?: IResourceOpenOptions) {
    await this.initialize();
    let group = this.currentEditorGroup;
    let groupIndex: number | undefined;
    if (options && (typeof options.groupIndex !== 'undefined')) {
      groupIndex = options.groupIndex;
    } else if (options && options.relativeGroupIndex) {
      groupIndex = this.currentEditorGroup.index + options.relativeGroupIndex;
    }
    if (typeof groupIndex === 'number' && groupIndex >= 0) {
      if (groupIndex >= this.editorGroups.length) {
        return group.open(uri, Object.assign({}, options, { split: EditorGroupSplitAction.Right }));
      } else {
        group = this.sortedEditorGroups[groupIndex] || this.currentEditorGroup;
      }
    }
    return group.open(uri, options);
  }

  async openUris(uris: URI[]) {
    await this.initialize();
    await this.currentEditorGroup.openUris(uris);
    return;
  }

  getEditorGroup(name: string): EditorGroup | undefined {
    return this.editorGroups.find((g) => g.name === name);
  }

  @computed
  get currentResource(): MaybeNull<IResource> {
    if (!this.currentEditorGroup) {
      return null;
    }
    return this.currentEditorGroup.currentResource;
  }

  removeGroup(group: EditorGroup) {
    const index = this.editorGroups.findIndex((e) => e === group);
    if (index !== -1) {
      if (this.editorGroups.length === 1) {
        return;
      }
      this.editorGroups.splice(index, 1);
      if (this.currentEditorGroup === group) {
        this.setCurrentGroup(this.editorGroups[0]);
      }
      for (let i = index; i < this.editorGroups.length; i++) {
        this.eventBus.fire(new EditorGroupIndexChangedEvent({
          group: this.editorGroups[i],
          index: i,
        }));
      }
    }
    this._sortedEditorGroups = undefined;
  }

  public async saveOpenedResourceState() {
    if (this._restoring) {
      return;
    }
    const state: IEditorGridState = this.topGrid.serialize()!;
    await this.openedResourceState.set('grid', state);

  }

  prepareContextKeyService(contextKeyService: IContextKeyService) {
    // 为编辑器创建一个scopedContextService
    const editorContextKeyService = contextKeyService.createScoped(this._domNode);
    this.editorContextKeyService = editorContextKeyService;

    // 经过这个Override, 所有编辑器的contextKeyService都是editorContextKeyService的孩子
    this.monacoService.registerOverride(ServiceNames.CONTEXT_KEY_SERVICE, (this.editorContextKeyService as any).contextKeyService);
    // contextKeys
    const getLanguageFromModel = (uri: URI) => {
      let result: string | null = null;
      const modelRef = this.documentModelManager.getModelReference(uri, 'resourceContextKey');
      if (modelRef) {
        if (modelRef) {
          result = modelRef.instance.languageId;
        }
        modelRef.dispose();
      }
      return result;
    };
    const resourceContext = new ResourceContextKey(this.editorContextKeyService, (uri: URI) => {
        const res = getLanguageFromModel(uri);
        if (res) {
          return res!;
        } else {
          return getLanguageFromModel(uri);
        }
    });
    this.onActiveResourceChange((resource) => {
      if (this.currentEditor && this.currentEditor.currentUri) {
        resourceContext.set(this.currentEditor.currentUri);
      } else {
        if (resource) {
          resourceContext.set(resource.uri);
        } else {
          resourceContext.reset();
        }
      }
    });

    if (this.currentEditor && this.currentEditor.currentUri) {
      resourceContext.set(this.currentEditor.currentUri);
    } else {
      if (this.currentResource) {
        resourceContext.set(this.currentResource.uri);
      } else {
        resourceContext.reset();
      }
    }
  }

  onDomCreated(domNode: HTMLElement) {
    this._domNode = domNode;
    if (this.editorContextKeyService) {
      this.editorContextKeyService.attachToDomNode(domNode);
    }
  }

  public async restoreState() {
    let state: IEditorGridState = { editorGroup: { uris: [], previewIndex: -1 } };
    state = this.openedResourceState.get<IEditorGridState>('grid', state);
    this.topGrid = new EditorGrid();
    this.topGrid.deserialize(state, () => {
      return this.createEditorGroup();
    }).then(() => {
      if (this.topGrid.children.length === 0 && !this.topGrid.editorGroup) {
        this.topGrid.setEditorGroup(this.createEditorGroup());
      }
      this._restoring = false;
      for (const contribution of this.contributions.getContributions()) {
        if (contribution.onDidRestoreState) {
          contribution.onDidRestoreState();
        }
      }
    });
  }

  async closeAll(uri?: URI, force?: boolean) {
    for (const group of this.editorGroups.slice(0)) {
      if (uri) {
        await group.close(uri, {force});
      } else {
        await group.closeAll();
      }
    }
  }

  async close(uri: URI, force?: boolean) {
    return this.closeAll(uri, force);
  }

  get sortedEditorGroups() {
    if (!this._sortedEditorGroups) {
      this._sortedEditorGroups = [];
      this.topGrid.sortEditorGroups(this._sortedEditorGroups);
    }
    return this._sortedEditorGroups;
  }

  @OnEvent(EditorGroupCloseEvent)
  handleOnCloseUntitledResource(e: EditorGroupCloseEvent) {
    if (e.payload.resource.uri.scheme === Schemas.untitled) {
      const { index } = e.payload.resource.uri.getParsedQuery();
      this.untitledCloseIndex.push(parseInt(index, 10));
      // 升序排序，每次可以去到最小的 index
      this.untitledCloseIndex.sort((a, b) => a - b);
    }
  }

  private createUntitledURI() {
    // 优先从已删除的 index 中获取
    const index =  this.untitledCloseIndex.shift() || this.untitledIndex++;
    return new URI()
      .withScheme(Schemas.untitled)
      .withQuery(`name=Untitled-${index}&index=${index}`);
  }

  createUntitledResource(options: IUntitledOptions = {
    uri: this.createUntitledURI(),
  }) {
    return this.open(options.uri, {
      preview: false,
      focus: true,
      ...options.resourceOpenOptions,
    });
  }
}

export interface IEditorCurrentState {

  currentResource: IResource;

  currentOpenType: IEditorOpenType;

}
/**
 * Editor Group是一个可视的编辑区域
 * 它由tab，editor，diff-editor，富组件container组成
 */
@Injectable({ multiple: true })
export class EditorGroup extends WithEventBus implements IGridEditorGroup {

  @Autowired()
  collectionService!: EditorCollectionService;

  @Autowired()
  resourceService: ResourceService;

  @Autowired()
  editorComponentRegistry: EditorComponentRegistry;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(IEditorDocumentModelService)
  protected documentModelManager: IEditorDocumentModelService;

  @Autowired(CommandService)
  private commands: CommandService;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(AppConfig)
  config: AppConfig;

  codeEditor!: ICodeEditor;

  diffEditor!: IDiffEditor;

  private openingPromise: Map<string, Promise<IOpenResourceResult>> = new Map();

  /**
   * 每个group只能有一个preview
   */
  @observable.ref public previewURI: URI | null = null;

  /**
   * 当前打开的所有resource
   */
  @observable.shallow resources: IResource[] = [];

  @observable.ref _currentState: IEditorCurrentState | null = null;

  /**
   * 即将变成currentState的state
   */
  private _pendingState: IEditorCurrentState | null = null;
  /**
   * 当前resource的打开方式
   */
  private cachedResourcesActiveOpenTypes = new Map<string, IEditorOpenType>();

  private cachedResourcesOpenTypes = new Map<string, IEditorOpenType[]>();

  @observable.ref availableOpenTypes: IEditorOpenType[] = [];

  @observable.shallow activeComponents = new Map<IEditorComponent, IResource[]>();

  @observable.shallow activateComponentsProps = new Map<IEditorComponent, any>();

  public grid: EditorGrid;

  private codeEditorReady: Deferred<any> = new Deferred<any>();

  private diffEditorReady: Deferred<any> = new Deferred<any>();

  private holdDocumentModelRefs: Map<string, IEditorDocumentModelRef> = new Map();

  private readonly toDispose: monaco.IDisposable[] = [];

  private _contextKeyService: IContextKeyService;

  private _resourceContext: ResourceContextKey;

  private _editorLangIDContextKey: IContextKey<string>;

  private _isInDiffEditorContextKey: IContextKey<boolean>;

  private _prevDomHeight: number = 0;
  private _prevDomWidth: number = 0;

  private _codeEditorPendingLayout: boolean = false;
  private _diffEditorPendingLayout: boolean = false;

  // 当前为EditorComponent，且monaco光标变化时触发
  private _onCurrentEditorCursorChange = new EventEmitter<CursorStatus>();
  public onCurrentEditorCursorChange = this._onCurrentEditorCursorChange.event;

  private resourceOpenHistory: URI[] = [];

  private _domNode: MaybeNull<HTMLElement> = null;

  constructor(public readonly name: string) {
    super();
    this.eventBus.on(ResizeEvent, (e: ResizeEvent) => {
      if (e.payload.slotLocation === getSlotLocation('@ali/ide-editor', this.config.layoutConfig)) {
        this.doLayoutEditors();
      }
    });
    this.eventBus.on(GridResizeEvent, (e: GridResizeEvent) => {
      if (e.payload.gridId === this.grid.uid) {
        this.doLayoutEditors();
      }
    });
  }

  attachToDom(domNode: HTMLElement | null | undefined) {
    this._domNode = domNode;
    if (domNode) {
      (this.contextKeyService as IScopedContextKeyService).attachToDomNode(domNode);
      this.layoutEditors();
    }
  }

  layoutEditors() {
    if (this._domNode) {
      const currentWidth = this._domNode.offsetWidth;
      const currentHeight = this._domNode.offsetHeight;
      if (currentWidth !== this._prevDomWidth || currentHeight !== this._prevDomHeight) {
        this.doLayoutEditors();
      }
      this._prevDomWidth = currentWidth;
      this._prevDomHeight = currentHeight;
    }
  }

  doLayoutEditors() {
    if (this.codeEditor) {
      if (this.currentOpenType && this.currentOpenType.type === 'code') {
        this.codeEditor.layout();
        this._codeEditorPendingLayout = false;
      } else {
        this._codeEditorPendingLayout = true;
      }
    }
    if (this.diffEditor) {
      if (this.currentOpenType && this.currentOpenType.type === 'diff') {
        this.diffEditor.layout();
        this._diffEditorPendingLayout = false;
      } else {
        this._diffEditorPendingLayout = true;
      }
    }
  }

  @computed
  get currentState() {
    return this._currentState;
  }

  set currentState(value: IEditorCurrentState | null) {
    const oldResource = this.currentResource;
    const oldOpenType = this.currentOpenType;
    this._currentState = value;
    this._pendingState = null;
    if (oldResource && this.resourceOpenHistory[this.resourceOpenHistory.length - 1] !== oldResource.uri) {
      this.resourceOpenHistory.push(oldResource.uri);
    }
    this.eventBus.fire(new EditorGroupChangeEvent({
      group: this,
      newOpenType: this.currentOpenType,
      newResource: this.currentResource,
      oldOpenType,
      oldResource,
    }));
    this.setContextKeys();
  }

  setContextKeys() {
    if (!this._resourceContext) {
      const getLanguageFromModel = (uri: URI) => {
        let result: string | null = null;
        const modelRef = this.documentModelManager.getModelReference(uri, 'resourceContextKey');
        if (modelRef) {
          if (modelRef) {
            result = modelRef.instance.languageId;
          }
          modelRef.dispose();
        }
        return result;
      };
      this._resourceContext = new ResourceContextKey(this.contextKeyService, (uri: URI) => {
          const res = getLanguageFromModel(uri);
          if (res) {
            return res!;
          } else {
            return getLanguageFromModel(uri);
          }
      });
      this._editorLangIDContextKey = this.contextKeyService.createKey<string>('editorLangId', '');
      this._isInDiffEditorContextKey = this.contextKeyService.createKey<boolean>('isInDiffEditor', false);
    }
    if (this.currentEditor && this.currentEditor.currentUri) {
      this._resourceContext.set(this.currentEditor.currentUri);
      if (this.currentEditor.currentDocumentModel) {
        this._editorLangIDContextKey.set(this.currentEditor.currentDocumentModel.languageId);
      }
    } else {
      if (this.currentResource) {
        this._resourceContext.set(this.currentResource.uri);
      } else {
        this._resourceContext.reset();
      }
      this._editorLangIDContextKey.reset();
    }
    this._isInDiffEditorContextKey.set(!!this.currentOpenType && this.currentOpenType.type === 'diff');
  }

  get contextKeyService() {
    if (!this._contextKeyService) {
      this._contextKeyService = this.workbenchEditorService.editorContextKeyService.createScoped();
    }
    return this._contextKeyService;
  }

  get pendingResource() {
    return this._pendingState && this._pendingState.currentResource;
  }

  get index(): number {
    return this.workbenchEditorService.sortedEditorGroups.indexOf(this);
  }

  @OnEvent(ResourceDecorationChangeEvent)
  onResourceDecorationChangeEvent(e: ResourceDecorationChangeEvent) {
    if (e.payload.decoration.dirty) {
      if (this.previewURI && this.previewURI.isEqual(e.payload.uri)) {
        this.pinPreviewed();
      }
    }
  }

  @OnEvent(ResourceOpenTypeChangedEvent)
  oResourceOpenTypeChangedEvent(e: ResourceOpenTypeChangedEvent) {
    const uri = e.payload;
    if (this.cachedResourcesOpenTypes.has(uri.toString())) {
      this.cachedResourcesOpenTypes.delete(uri.toString());
    }
    if (this.currentResource && this.currentResource.uri.isEqual(uri)) {
      this.displayResourceComponent(this.currentResource, {});
    }
  }

  @action.bound
  pinPreviewed(uri?: URI) {
    if (uri === undefined) {
      this.previewURI = null;
    } else if (this.previewURI && this.previewURI.isEqual(uri)) {
      this.previewURI = null;
    }
  }

  get currentEditor(): IEditor | null {
    if (this.currentOpenType) {
      if (this.currentOpenType.type === 'code') {
        return this.codeEditor;
      } else if (this.currentOpenType.type === 'diff') {
        return this.diffEditor.modifiedEditor;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  get currentFocusedEditor(): IEditor | undefined {
    if (this.currentOpenType) {
      if (this.currentOpenType.type === 'code') {
        if (this.codeEditor.monacoEditor.hasWidgetFocus()) {
          return this.codeEditor;
        }
      } else if (this.currentOpenType.type === 'diff') {
        if (this.diffEditor.modifiedEditor.monacoEditor.hasWidgetFocus()) {
          return this.diffEditor.modifiedEditor;
        } else if (this.diffEditor.originalEditor.monacoEditor.hasWidgetFocus()) {
          return this.diffEditor.originalEditor;
        }
      }
    }
  }

  get currentCodeEditor(): ICodeEditor | null {
    if (this.currentOpenType) {
      if (this.currentOpenType.type === 'code') {
        return this.codeEditor;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  async createEditor(dom: HTMLElement) {
    this.codeEditor = await this.collectionService.createCodeEditor(dom, {}, {
      [ServiceNames.CONTEXT_KEY_SERVICE]:  (this.contextKeyService as any).contextKeyService,
    });
    setTimeout(() => {
      this.codeEditor.layout();
    });
    this.toDispose.push(this.codeEditor.onCursorPositionChanged((e) => {
      this._onCurrentEditorCursorChange.fire(e);
    }));
    this.toDispose.push(this.codeEditor.onSelectionsChanged((e) => {
      if (this.currentOpenType && this.currentOpenType.type === 'code') {
        this.eventBus.fire(new EditorSelectionChangeEvent({
          group: this,
          resource: this.pendingResource || this.currentResource!,
          selections: e.selections,
          source: e.source,
          editorUri: this.codeEditor.currentUri!,
        }));
      }
    }));
    this.toDispose.push(this.codeEditor.onVisibleRangesChanged((e) => {
      if (this.currentOpenType && this.currentOpenType.type === 'code') {
        this.eventBus.fire(new EditorVisibleChangeEvent({
          group: this,
          resource: this.pendingResource || this.currentResource!,
          visibleRanges: e,
        }));
      }
    }));
    this.toDispose.push(this.codeEditor.onConfigurationChanged(() => {
      if (this.currentOpenType && this.currentOpenType.type === 'code') {
        this.eventBus.fire(new EditorConfigurationChangedEvent({
          group: this,
          resource: this.pendingResource || this.currentResource!,
        }));
      }
    }));
    this.codeEditorReady.resolve();
  }

  async createDiffEditor(dom: HTMLElement) {
    this.diffEditor = await this.collectionService.createDiffEditor(dom, {}, {
      [ServiceNames.CONTEXT_KEY_SERVICE]: (this.contextKeyService as any).contextKeyService,
    });
    setTimeout(() => {
      this.diffEditor.layout();
    });
    this.toDispose.push(this.diffEditor.modifiedEditor.onSelectionsChanged((e) => {
      if (this.currentOpenType && this.currentOpenType.type === 'diff') {
        this.eventBus.fire(new EditorSelectionChangeEvent({
          group: this,
          resource: this.pendingResource || this.currentResource!,
          selections: e.selections,
          source: e.source,
          editorUri: this.diffEditor.modifiedEditor.currentUri!,
        }));
      }
    }));
    this.toDispose.push(this.diffEditor.modifiedEditor.onVisibleRangesChanged((e) => {
      if (this.currentOpenType && this.currentOpenType.type === 'diff') {
        this.eventBus.fire(new EditorVisibleChangeEvent({
          group: this,
          resource: this.pendingResource || this.currentResource!,
          visibleRanges: e,
        }));
      }
    }));
    this.toDispose.push(this.diffEditor.modifiedEditor.onConfigurationChanged(() => {
      if (this.currentOpenType && this.currentOpenType.type === 'diff') {
        this.eventBus.fire(new EditorConfigurationChangedEvent({
          group: this,
          resource: this.pendingResource || this.currentResource!,
        }));
      }
    }));
    this.diffEditorReady.resolve();
  }

  async split(action: EditorGroupSplitAction, uri: URI, options?: IResourceOpenOptions) {
    const editorGroup = this.workbenchEditorService.createEditorGroup();
    const direction = (action === EditorGroupSplitAction.Left || action === EditorGroupSplitAction.Right) ? SplitDirection.Horizontal : SplitDirection.Vertical;
    const before = (action === EditorGroupSplitAction.Left || action === EditorGroupSplitAction.Top) ? true : false;
    this.grid.split(direction, editorGroup, before);
    return editorGroup.open(uri, options);
  }

  async open(uri: URI, options: IResourceOpenOptions = {}): Promise<IOpenResourceResult> {
    if (uri.scheme === Schemas.file) {
      // 只记录 file 类型的
      this.workspaceService.setMostRecentlyOpenedFile!(uri.toString());
    }
    if (options && options.split) {
      return this.split(options.split, uri, Object.assign({}, options, { split: undefined, preview: false }));
    }
    if (!this.openingPromise.has(uri.toString())) {
      const promise = this.doOpen(uri, options);
      this.openingPromise.set(uri.toString(), promise);
      promise.then(() => {
        this.openingPromise.delete(uri.toString());
      }, () => {
        this.openingPromise.delete(uri.toString());
      });
    }
    const previewMode = this.corePreferences['editor.previewMode'] && (isNullOrUndefined(options.preview) ? true : options.preview);
    if (!previewMode) {
      this.openingPromise.get(uri.toString())!.then(() => {
        this.pinPreviewed(uri);
      });
    }
    return this.openingPromise.get(uri.toString())!;
  }

  async pin(uri: URI) {
    return this.pinPreviewed(uri);
  }

  @action.bound
  async doOpen(uri: URI, options: IResourceOpenOptions = {}): Promise<{ group: IEditorGroup, resource: IResource } | false> {
    if (uri.scheme === 'http' || uri.scheme === 'https') {
      window.open(uri.toString());
      return false;
    }
    try {
      const previewMode = this.corePreferences['editor.previewMode'] && (isNullOrUndefined(options.preview) ? true : options.preview);
      if ((options && options.disableNavigate) || (options && options.backend)) {
        // no-op
      } else {
        this.commands.executeCommand(FILE_COMMANDS.LOCATION.id, uri)
          .catch((err) => {
            // no-op: failed when command not found
            getLogger().warn(err);
          });
      }
      if (this.currentResource && this.currentResource.uri.isEqual(uri)) {
        // 就是当前打开的resource
        if (options.focus && this.currentEditor) {
          this.currentEditor.monacoEditor.focus();
        }
        if (options.range && this.currentEditor) {
          this.currentEditor.monacoEditor.revealRangeInCenter(options.range);
          this.currentEditor.monacoEditor.setSelection(options.range)
;        }
        return {
          group: this,
          resource: this.currentResource,
        };
      } else {
        let resource: IResource | null | undefined = this.resources.find((r) => r.uri.toString() === uri.toString());
        if (!resource) {
          // open new resource
          resource = await this.resourceService.getResource(uri);
          if (!resource) {
            throw new Error('This uri cannot be opened!: ' + uri);
          }
          if (options && options.label) {
            resource.name = options.label;
          }
          if (options && options.index !== undefined && options.index < this.resources.length) {
            this.resources.splice(options.index, 0, resource);
          } else {
            this.resources.push(resource);
          }
          if (previewMode) {
            if (this.previewURI) {
              await this.close(this.previewURI, { treatAsNotCurrent: true});
            }
            this.previewURI = resource.uri;
          }
        }
        if (options.backend) {
          return false;
        }
        await this.displayResourceComponent(resource, options);
        this.eventBus.fire(new EditorGroupOpenEvent({
          group: this,
          resource,
        }));
        return {
          group: this,
          resource,
        };
      }
    } catch (e) {
      getLogger().error(e);
      return false;
      // todo 给用户显示error
    }
  }

  async openUris(uris: URI[]): Promise<void> {
    for (const uri of uris) {
      await this.open(uri);
    }
  }

  async getDocumentModelRef(uri: URI): Promise<IEditorDocumentModelRef> {
    if (!this.holdDocumentModelRefs.has(uri.toString())) {
      this.holdDocumentModelRefs.set(uri.toString(), await this.documentModelManager.createModelReference(uri, 'editor-group-' + this.name));
    }
    return this.holdDocumentModelRefs.get(uri.toString())!;
  }

  disposeDocumentRef(uri: URI) {
    if (this.holdDocumentModelRefs.has(uri.toString())) {
      this.holdDocumentModelRefs.get(uri.toString())!.dispose();
      this.holdDocumentModelRefs.delete(uri.toString());
    }
  }

  private async displayResourceComponent(resource: IResource, options: IResourceOpenOptions = {}) {
    const result = await this.resolveOpenType(resource, options);
    if (result) {
      const { activeOpenType, openTypes } = result;

      this.availableOpenTypes = openTypes;
      this._pendingState = {
        currentResource: resource,
        currentOpenType: activeOpenType,
      };

      if (activeOpenType.type === 'code') {
        await this.codeEditorReady.promise;
        await this.codeEditor.open(await this.getDocumentModelRef(resource.uri), options.range);
        if (options.focus || options.preserveFocus) {
          this.codeEditor.focus();
        }
        // 可能在diff Editor中修改导致为脏
        if (this.codeEditor.currentDocumentModel!.dirty) {
          this.pinPreviewed(resource.uri);
        }
      } else if (activeOpenType.type === 'diff') {
        const diffResource = resource as IDiffResource;
        await this.diffEditorReady.promise;
        const [original, modified] = await Promise.all([this.getDocumentModelRef(diffResource.metadata!.original), this.getDocumentModelRef(diffResource.metadata!.modified)]);
        await this.diffEditor.compare(original, modified);
        if (options.focus || options.preserveFocus) {
          this.diffEditor.focus();
        }
      } else if (activeOpenType.type === 'component') {
        const component = this.editorComponentRegistry.getEditorComponent(activeOpenType.componentId as string);
        const initialProps = this.editorComponentRegistry.getEditorInitialProps(activeOpenType.componentId as string);
        if (!component) {
          throw new Error('Cannot find Editor Component with id: ' + activeOpenType.componentId);
        } else {
          this.activateComponentsProps.set(component, initialProps);
          if (component.renderMode === EditorComponentRenderMode.ONE_PER_RESOURCE) {
            const openedResources = this.activeComponents.get(component) || [];
            const index = openedResources.findIndex((r) => r.uri.toString() === resource.uri.toString());
            if (index === -1) {
              openedResources.push(resource);
            }
            this.activeComponents.set(component, openedResources);
          } else if (component.renderMode === EditorComponentRenderMode.ONE_PER_GROUP) {
            this.activeComponents.set(component, [resource]);
          } else if (component.renderMode === EditorComponentRenderMode.ONE_PER_WORKBENCH) {
            const promises: Promise<any>[] = [];
            this.workbenchEditorService.editorGroups.forEach((g) => {
              if (g === this) {
                return;
              }
              const r = g.resources.find((r) => r.uri.isEqual(resource.uri));
              if (r) {
                promises.push(g.close(r.uri));
              }
            });
            await Promise.all(promises).catch(getLogger().error);
            this.activeComponents.set(component, [resource]);
          }
        }
        // 打开非编辑器的component时需要手动触发
        this._onCurrentEditorCursorChange.fire({
          position: null,
          selectionLength: 0,
        });
      } else {
        return; // other type not handled
      }

      this.currentState = {
        currentResource: resource,
        currentOpenType: activeOpenType,
      };

      if ((this._codeEditorPendingLayout && activeOpenType.type === 'code') || (this._diffEditorPendingLayout && activeOpenType.type === 'diff')) {
        this.doLayoutEditors();
      }

      this.cachedResourcesActiveOpenTypes.set(resource.uri.toString(), activeOpenType);
    }
  }

  private async resolveOpenType(resource: IResource, options: IResourceOpenOptions): Promise<{ activeOpenType: IEditorOpenType, openTypes: IEditorOpenType[] } | null> {
    const openTypes = this.cachedResourcesOpenTypes.get(resource.uri.toString()) || await this.editorComponentRegistry.resolveEditorComponent(resource);
    const activeOpenType = findSuitableOpenType(openTypes, this.cachedResourcesActiveOpenTypes.get(resource.uri.toString()), options.forceOpenType);
    this.cachedResourcesOpenTypes.set(resource.uri.toString(), openTypes);
    return { activeOpenType, openTypes };
  }

  public async close(uri: URI, {treatAsNotCurrent, force}: {
    treatAsNotCurrent?: boolean,
    force?: boolean,
  } = {}) {
    const index = this.resources.findIndex((r) => r.uri.toString() === uri.toString());
    if (index !== -1) {
      const resource = this.resources[index];
      if (!force) {
        if (!await this.shouldClose(resource)) {
          return;
        }
      }
      this.resources.splice(index, 1);
      this.eventBus.fire(new EditorGroupCloseEvent({
        group: this,
        resource,
      }));
      if (this.previewURI && this.previewURI.isEqual(uri)) {
        this.previewURI = null;
      }
      // 优先打开用户打开历史中的uri,
      // 如果历史中的不可打开，打开去除当前关闭目标uri后相同位置的uri, 如果没有，则一直往前找到第一个可用的uri
      if (resource === this.currentResource && !treatAsNotCurrent) {
        let nextUri: URI | undefined;
        while (this.resourceOpenHistory.length > 0) {
          if (this.resources.findIndex((r) => r.uri === this.resourceOpenHistory[this.resourceOpenHistory.length - 1]) !== -1) {
            nextUri = this.resourceOpenHistory.pop();
            break;
          } else {
            this.resourceOpenHistory.pop();
          }
        }
        if (nextUri) {
          this.open(nextUri);
        } else {
          let i = index;
          while (i > 0 && !this.resources[i]) {
            i--;
          }
          if (this.resources[i]) {
            this.open(this.resources[i].uri);
          } else {
            this.currentState = null;
          }
        }
      }
      for (const resources of this.activeComponents.values()) {
        const i = resources.indexOf(resource);
        if (i !== -1) {
          resources.splice(i, 1);
        }
      }
      this.disposeDocumentRef(uri);
    }
    if (this.resources.length === 0) {
      if (this.grid.parent) {
        // 当前不是最后一个 editor Group
        this.dispose();
      }
      this.availableOpenTypes = [];
    }
  }

  private async shouldClose(resource: IResource): Promise<boolean> {
    if (!await this.resourceService.shouldCloseResource(resource, this.workbenchEditorService.editorGroups.map((group) => group.resources))) {
      return false;
    }
    return true;
  }

  /**
   * 关闭全部
   */
  @action.bound
  async closeAll() {
    for (const resource of this.resources) {
      if (!await this.shouldClose(resource)) {
        return;
      }
    }
    this.currentState = null;
    const closed = this.resources.splice(0, this.resources.length);
    closed.forEach((resource) => {
      this.clearResourceOnClose(resource);
    });
    this.activeComponents.clear();
    if (this.workbenchEditorService.editorGroups.length > 1) {
      this.dispose();
    }
  }

  /**
   * 关闭已保存（非dirty）
   */
  @action.bound
  async closeSaved() {
    const saved = this.resources.filter((r) => {
      const decoration = this.resourceService.getResourceDecoration(r.uri);
      if (!decoration || !decoration.dirty) {
        return true;
      }
    });
    for (const resource of saved) {
      if (!await this.shouldClose(resource)) {
        return;
      }
    }
    for (const resource of saved) {
      await this.close(resource.uri);
    }
  }

  /**
   * 关闭向右的tab
   * @param uri
   */
  @action.bound
  async closeToRight(uri: URI) {
    const index = this.resources.findIndex((r) => r.uri.toString() === uri.toString());
    if (index !== -1) {
      const resourcesToClose = this.resources.slice(index + 1);
      for (const resource of resourcesToClose) {
        if (!await this.shouldClose(resource)) {
          return;
        }
      }
      this.resources.splice(index + 1);
      for (const resource of resourcesToClose) {
        this.clearResourceOnClose(resource);
      }
      this.open(uri);
    }
  }

  clearResourceOnClose(resource: IResource) {
    this.eventBus.fire(new EditorGroupCloseEvent({
      group: this,
      resource,
    }));
    for (const resources of this.activeComponents.values()) {
      const i = resources.indexOf(resource);
      if (i !== -1) {
        resources.splice(i, 1);
      }
    }
  }

  @action.bound
  async closeOthers(uri: URI) {
    const index = this.resources.findIndex((r) => r.uri.toString() === uri.toString());
    if (index !== -1) {
      const resourcesToClose = this.resources.filter((v, i) => i !== index);
      for (const resource of resourcesToClose) {
        if (!await this.shouldClose(resource)) {
          return;
        }
      }
      this.resources = [this.resources[index]];
      for (const resource of resourcesToClose) {
        this.clearResourceOnClose(resource);
      }
      this.open(uri);
    }
  }

  /**
   * 当前打开的resource
   */
  get currentResource(): MaybeNull<IResource> {
    return this.currentState && this.currentState.currentResource;
  }

  @computed
  get currentOpenType(): MaybeNull<IEditorOpenType> {
    return this.currentState && this.currentState.currentOpenType;
  }

  async changeOpenType(type: IEditorOpenType) {
    if (!this.currentResource) {
      return;
    }
    if (openTypeSimilar(type, this.currentOpenType!)) {
      return;
    }
    await this.displayResourceComponent(this.currentResource!, { forceOpenType: type });
  }

  /**
   * 拖拽drop方法
   */
  @action.bound
  public async dropUri(uri: URI, position: DragOverPosition, sourceGroup?: EditorGroup, targetResource?: IResource) {
    if (position !== DragOverPosition.CENTER) {
      await this.split(getSplitActionFromDragDrop(position), uri, {preview: false});
    } else {
      // 扔在本体或者tab上
      if (!targetResource) {
        await this.open(uri, {preview: false});
      } else {
        const targetIndex = this.resources.indexOf(targetResource);
        if (targetIndex === -1) {
          await this.open(uri, {preview: false});
        } else {
          const sourceIndex = this.resources.findIndex((resource) => resource.uri.toString() === uri.toString());
          if (sourceIndex === -1) {
            await this.open(uri, {
              index: targetIndex,
              preview: false,
            });
          } else {
            // just move
            const sourceResource = this.resources[sourceIndex];
            if (sourceIndex > targetIndex) {
              this.resources.splice(sourceIndex, 1);
              this.resources.splice(targetIndex, 0, sourceResource);
              await this.open(uri, {preview: false});
            } else if (sourceIndex < targetIndex) {
              this.resources.splice(targetIndex + 1, 0, sourceResource);
              this.resources.splice(sourceIndex, 1);
              await this.open(uri, {preview: false});
            }
          }
        }
      }
    }

    if (sourceGroup) {
      if (sourceGroup !== this) {
        // 从其他group拖动过来
        await sourceGroup.close(uri);
      } else if (position !== DragOverPosition.CENTER) {
        // split行为
        await this.close(uri);
      }

    }

  }

  gainFocus() {
    this.workbenchEditorService.setCurrentGroup(this);
  }

  focus() {
    this.gainFocus();
    if (this.currentOpenType && this.currentOpenType.type === 'code') {
      this.codeEditor.focus();
    }
    if (this.currentOpenType && this.currentOpenType.type === 'diff') {
      this.diffEditor.focus();
    }
  }

  dispose() {
    this.grid.dispose();
    this.workbenchEditorService.removeGroup(this);
    super.dispose();
    this.codeEditor && this.codeEditor.dispose();
    this.diffEditor && this.diffEditor.dispose();
    this.toDispose.forEach((disposable) => disposable.dispose());
    this.eventBus.fire(new EditorGroupDisposeEvent({
      group: this,
    }));
  }

  getState(): IEditorGroupState {
    // TODO 支持虚拟文档恢复
    const allowRecoverSchemes = ['file'];
    const uris = this.resources.filter((r) => allowRecoverSchemes.indexOf(r.uri.scheme) !== -1).map((r) => r.uri.toString());
    return {
      uris,
      current: this.currentResource && allowRecoverSchemes.indexOf(this.currentResource.uri.scheme) !== -1 ? this.currentResource.uri.toString() : undefined,
      previewIndex: this.previewURI ? uris.indexOf(this.previewURI.toString()) : -1,
    };
  }

  isCodeEditorMode() {
    return this.currentOpenType && this.currentOpenType.type === 'code';
  }

  isDiffEditorMode() {
    return this.currentOpenType && this.currentOpenType.type === 'diff';
  }

  isComponentMode() {
    return this.currentOpenType && this.currentOpenType.type === 'component';
  }

  async restoreState(state: IEditorGroupState) {
    this.previewURI = state.uris[state.previewIndex] ? null : new URI(state.uris[state.previewIndex]);
    for (const uri of state.uris) {
      await this.doOpen(new URI(uri), { disableNavigate: true, backend: true, preview: false });
    }
    if (state.current) {
      await this.open(new URI(state.current));
    } else {
      if (state.uris.length > 0) {
        this.open(new URI(state.uris[state.uris.length - 1]!));
      }
    }
  }

  async saveAll(includeUntitled?: boolean, reason?: SaveReason) {
    for (const r of this.resources) {
      // 不保存无标题文件
      if (!includeUntitled && r.uri.scheme === Schemas.untitled) {
        return;
      }
      const docRef = this.documentModelManager.getModelReference(r.uri);
      if (docRef) {
        if (docRef.instance.dirty) {
          await docRef.instance.save(undefined, reason);
        }
        docRef.dispose();
      }
    }
  }

  hasDirty(): boolean {
    for (const r of this.resources) {
      const docRef = this.documentModelManager.getModelReference(r.uri);
      if (docRef) {
        const isDirty = docRef.instance.dirty;
        docRef.dispose();
        if (isDirty) { return true; }
      }
    }
    return false;
  }

  /**
   * 防止作为参数被抛入插件进程时出错
   */
  toJSON() {
    return {
      name: this.name,
    };
  }
}

function findSuitableOpenType(currentAvailable: IEditorOpenType[], prev: IEditorOpenType | undefined, forceOpenType?: IEditorOpenType) {
  if (forceOpenType) {
    return currentAvailable.find((p) => {
      return openTypeSimilar(p, forceOpenType);
    }) || currentAvailable[0];
  } else if (prev) {
    return currentAvailable.find((p) => {
      return openTypeSimilar(p, prev);
    }) || currentAvailable[0];
  }
  return currentAvailable[0];
}

function openTypeSimilar(a: IEditorOpenType, b: IEditorOpenType) {
  return a.type === b.type && (a.type !== 'component' || a.componentId === b.componentId);
}

function getSplitActionFromDragDrop(position: DragOverPosition): EditorGroupSplitAction {
  return {
    [DragOverPosition.LEFT]: EditorGroupSplitAction.Left,
    [DragOverPosition.RIGHT]: EditorGroupSplitAction.Right,
    [DragOverPosition.BOTTOM]: EditorGroupSplitAction.Bottom,
    [DragOverPosition.TOP]: EditorGroupSplitAction.Top,
  }[position];
}
