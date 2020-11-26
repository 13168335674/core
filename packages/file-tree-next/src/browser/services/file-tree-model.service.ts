import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { DecorationsManager, Decoration, TreeNodeType, RenamePromptHandle, NewPromptHandle, PromptValidateMessage, PROMPT_VALIDATE_TYPE, TreeNodeEvent, IRecycleTreeError, TreeModel, IRecycleTreeFilterHandle } from '@ali/ide-components';
import { FileTreeService } from '../file-tree.service';
import { FileTreeModel } from '../file-tree-model';
import { Directory, File } from '../../common/file-tree-node.define';
import { CorePreferences, IContextKey, URI, trim, rtrim, localize, coalesce, formatLocalize, isValidBasename, DisposableCollection, StorageProvider, STORAGE_NAMESPACE, IStorage, Event, ThrottledDelayer, Emitter, ILogger, Deferred } from '@ali/ide-core-browser';
import { FileContextKey } from '../file-contextkey';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { Path } from '@ali/ide-core-common/lib/path';
import { IFileTreeAPI, IFileTreeService, PasteTypes } from '../../common';
import { DragAndDropService } from './file-tree-dnd.service';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import * as styles from '../file-tree-node.module.less';
import { FileStat, FileChangeType } from '@ali/ide-file-service';
import { ISerializableState, TreeStateWatcher } from '@ali/ide-components/lib/recycle-tree/tree/model/treeState';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { isWindows } from '@ali/ide-components/lib/utils';

export interface IParseStore {
  files: (File | Directory)[];
  type: PasteTypes;
}

export interface IFileTreeHandle extends IRecycleTreeFilterHandle {
  hasDirectFocus: () => boolean;
}

export interface FileTreeValidateMessage extends PromptValidateMessage {
  value: string;
}

@Injectable()
export class FileTreeModelService {

  static FILE_TREE_SNAPSHOT_KEY = 'FILE_TREE_SNAPSHOT';
  static DEFAULT_REFRESHED_ACTION_DELAY = 500;
  static DEFAULT_LOCATION_FLUSH_DELAY = 200;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IFileTreeService)
  private readonly fileTreeService: FileTreeService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(IFileTreeAPI)
  private readonly fileTreeAPI: IFileTreeAPI;

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(FileContextKey)
  private readonly fileTreeContextKey: FileContextKey;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private _treeModel: FileTreeModel;
  private _dndService: DragAndDropService;

  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _fileTreeHandle: IFileTreeHandle;

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private loadingDecoration: Decoration = new Decoration(styles.mod_loading); // 加载态
  private cutDecoration: Decoration = new Decoration(styles.mod_cut); // 剪切态
  // 即使选中态也是焦点态的节点，全局仅会有一个
  private _focusedFile: File | Directory | undefined;
  // 选中态的节点，会可能有多个
  private _selectedFiles: (File | Directory)[] = [];
  // 当前焦点的文件路径URI
  private _activeUri: URI | null;

  private clickTimes: number;
  private clickTimer: any;
  private preContextMenuFocusedFile: File | Directory | null;
  private _nextLocationTarget: URI | undefined;

  // 右键菜单ContextKey，相对独立
  // TODO：后续需支持通过DOM获取context，这样无需耦合contextMenuService
  private _currentRelativeUriContextKey: IContextKey<string>;
  private _currentContextUriContextKey: IContextKey<string>;
  private _contextMenuResourceContext: ResourceContextKey;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private validateMessage: FileTreeValidateMessage | undefined;
  private _pasteStore: IParseStore;
  private _isMutiSelected: boolean = false;

  private _loadSnapshotReady: Promise<void>;

  private _explorerStorage: IStorage;

  private locationDelayer = new ThrottledDelayer<void>(FileTreeModelService.DEFAULT_LOCATION_FLUSH_DELAY);
  private refreshedActionDelayer = new ThrottledDelayer<void>(FileTreeModelService.DEFAULT_REFRESHED_ACTION_DELAY);
  private onDidFocusedFileChangeEmitter: Emitter<URI | void> = new Emitter();
  private onDidSelectedFileChangeEmitter: Emitter<URI[]> = new Emitter();
  private onFileTreeModelChangeEmitter: Emitter<TreeModel> = new Emitter();

  private locationDeferred: Deferred<void> | null;
  private collapsedAllDeferred: Deferred<void> | null;

  private treeStateWatcher: TreeStateWatcher;

  constructor() {
    this._whenReady = this.initTreeModel();
  }

  get onDidFocusedFileChange(): Event<URI | void> {
    return this.onDidFocusedFileChangeEmitter.event;
  }

  get onDidSelectedFileChange(): Event<URI[]> {
    return this.onDidSelectedFileChangeEmitter.event;
  }

  get onFileTreeModelChange(): Event<TreeModel> {
    return this.onFileTreeModelChangeEmitter.event;
  }

  get fileTreeHandle() {
    return this._fileTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._treeModel;
  }

  get dndService() {
    return this._dndService;
  }

  get whenReady() {
    return this._whenReady;
  }

  // 既是选中态，也是焦点态节点
  get focusedFile() {
    return this._focusedFile;
  }
  // 是选中态，非焦点态节点
  get selectedFiles() {
    return this._selectedFiles;
  }
  // 获取当前激活的文件URI，仅在压缩目录模式下可用
  get activeUri() {
    return this._activeUri;
  }

  get pasteStore() {
    return this._pasteStore;
  }

  get explorerStorage() {
    return this._explorerStorage;
  }

  get currentRelativeUriContextKey(): IContextKey<string> {
    if (!this._currentRelativeUriContextKey) {
      this._currentRelativeUriContextKey = this.fileTreeService.contextMenuContextKeyService.createKey('filetreeContextRelativeUri', '');
    }
    return this._currentRelativeUriContextKey;
  }

  get currentContextUriContextKey(): IContextKey<string> {
    if (!this._currentContextUriContextKey) {
      this._currentContextUriContextKey = this.fileTreeService.contextMenuContextKeyService.createKey('filetreeContextUri', '');
    }
    return this._currentContextUriContextKey;
  }

  get contextMenuResourceContext(): ResourceContextKey {
    if (!this._contextMenuResourceContext) {
      this._contextMenuResourceContext = new ResourceContextKey(this.fileTreeService.contextMenuContextKeyService);
    }
    return this._contextMenuResourceContext;
  }

  async initTreeModel() {
    // 根据是否为多工作区创建不同根节点
    const root = (await this.fileTreeService.resolveChildren())[0];
    if (!root) {
      return;
    }
    this._treeModel = this.injector.get<any>(FileTreeModel, [root]);
    this._explorerStorage = await this.storageProvider(STORAGE_NAMESPACE.EXPLORER);
    // 获取上次文件树的状态
    const snapshot = this.explorerStorage.get<ISerializableState>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
    if (snapshot) {
      // 初始化时。以右侧编辑器打开的文件进行定位
      this._loadSnapshotReady = this.loadFileTreeSnapshot(snapshot);
    }
    this.initDecorations(root);
    // _dndService依赖装饰器逻辑加载
    this._dndService = this.injector.get<any>(DragAndDropService, [this]);
    // 等待初次加载完成后再初始化当前的treeStateWatcher, 只加载可见的节点
    this.treeStateWatcher = this._treeModel.getTreeStateWatcher(true);
    this.disposableCollection.push(this.treeStateWatcher.onDidChange(() => {
      const snapshot = this.explorerStorage.get<any>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
      const currentTreeSnapshot = this.treeStateWatcher.snapshot();
      this.explorerStorage.set(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY, {
        ...snapshot,
        ...currentTreeSnapshot,
      });
    }));
    this.disposableCollection.push(this.fileTreeService.onNodeRefreshed((node) => {
      this.refreshedActionDelayer.trigger(async () => {
        // 当无选中节点时，选中编辑器中激活的节点
        if (Directory.isRoot(node) && this.selectedFiles.length === 0) {
          const currentEditor = this.editorService.currentEditor;
          if (currentEditor && currentEditor.currentUri) {
            this.location(currentEditor.currentUri);
          }
        }
        if (!this.fileTreeService.isCompactMode) {
          this._activeUri = null;
        }
      });
    }));
    this.disposableCollection.push(this.fileTreeService.onWorkspaceChange((workspace: Directory) => {
      this.disposableCollection.dispose();
      this.initTreeModel();
    }));
    this.disposableCollection.push(this.treeModel!.onWillUpdate(() => {
      // 更新树前更新下选中节点
      if (!!this.focusedFile) {
        const node = this.treeModel?.root.getTreeNodeByPath(this.focusedFile.path);
        if (node) {
          this.activeFileDecoration(node as File, false);
        }
      } else if (this.selectedFiles.length !== 0) {
        // 仅处理一下单选情况
        const node = this.treeModel?.root.getTreeNodeByPath(this.selectedFiles[0].path);
        if (node) {
          this.selectFileDecoration(node as File, false);
        }
      }
    }));
    // 确保文件树响应刷新操作时无正在操作的CollapsedAll和Location
    this.disposableCollection.push(this.fileTreeService.requestFlushEventSignalEvent(this.canHandleRefreshEvent));
    this.disposableCollection.push(this.labelService.onDidChange(() => {
      // 当labelService注册的对应节点图标变化时，通知视图更新
      this.fileTreeService.refresh();
    }));
    this.disposableCollection.push(this.treeModel.root.watcher.on(TreeNodeEvent.WillResolveChildren, (target) => {
      this.loadingDecoration.addTarget(target);
    }));
    this.disposableCollection.push(this.treeModel.root.watcher.on(TreeNodeEvent.DidResolveChildren, (target) => {
      this.loadingDecoration.removeTarget(target);
    }));
    await this._loadSnapshotReady;
    // 先加载快照后再监听文件变化，同时操作会出现Tree更新后节点无法对齐问题
    // 即找到插入节点位置为 0，导致重复问题
    this.fileTreeService.startWatchFileEvent();
    this.onFileTreeModelChangeEmitter.fire(this._treeModel);
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.cutDecoration);
    this._decorations.addDecoration(this.loadingDecoration);
  }

  // 确保文件树操作前没有额外的操作影响
  private async ensurePerformedEffect() {
    await this.fileTreeService.flushEventQueuePromise;
    this.refreshedActionDelayer.cancel();
  }

  /**
   * 多选情况下，焦点节点只要一个，选中节点有多个
   * 单选情况下，焦点节点与选中节点均只有一个
   * 在文件树空白区域邮件时，焦点元素为根节点
   * @param files 选中节点
   * @param file 焦点节点
   */
  private setFileTreeContextKey(file: Directory | File) {
    const isSingleFolder = !this.fileTreeService.isMutiWorkspace;
    this.fileTreeContextKey.explorerFolder.set((isSingleFolder && !file) || !!file && Directory.is(file));
    this.currentContextUriContextKey.set(file.uri.toString());
    this.currentRelativeUriContextKey.set(((this.treeModel.root as Directory).uri.relative(file.uri) || '').toString());
    this.contextMenuResourceContext.set(file.uri);
  }

  private async loadFileTreeSnapshot(snapshot: ISerializableState) {
    await this._treeModel.loadTreeState(snapshot);
  }

  async canHandleRefreshEvent() {
    if (this.collapsedAllDeferred) {
      await this.collapsedAllDeferred.promise;
    }
    if (this.locationDeferred) {
      await this.locationDeferred.promise;
    }
  }

  // 清空所有节点选中态
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
    this.onDidSelectedFileChangeEmitter.fire([]);
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeFileDecoration = (target: File | Directory, dispatchChange: boolean = true) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.preContextMenuFocusedFile) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.preContextMenuFocusedFile = null;
    }
    if (target) {
      if (this.selectedFiles.length > 0) {
        this.selectedFiles.forEach((file) => {
          this.selectedDecoration.removeTarget(file);
        });
      }
      if (this.focusedFile) {
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      this.selectedDecoration.addTarget(target);
      this.focusedDecoration.addTarget(target);
      this._focusedFile = target;
      this._selectedFiles = [target];
      // 选中及焦点文件变化
      this.onDidFocusedFileChangeEmitter.fire(target.uri);
      this.onDidSelectedFileChangeEmitter.fire([target.uri]);
      // 通知视图更新
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  }

  // 清空其他选中/焦点态节点，更新当前选中节点
  selectFileDecoration = (target: File | Directory, dispatchChange: boolean = true) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.preContextMenuFocusedFile) {
      this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this.preContextMenuFocusedFile = null;
    }
    if (target) {
      if (this.selectedFiles.length > 0) {
        this.selectedFiles.forEach((file) => {
          this.selectedDecoration.removeTarget(file);
        });
      }
      if (this.focusedFile) {
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      this.selectedDecoration.addTarget(target);
      this._selectedFiles = [target];
      // 选中及焦点文件变化
      this.onDidSelectedFileChangeEmitter.fire([target.uri]);
      // 通知视图更新
      if (dispatchChange) {
        this.treeModel.dispatchChange();
      }
    }
  }

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeFileFocusedDecoration = (target: File | Directory, removePreFocusedDecoration: boolean = false) => {
    if (target === this.treeModel.root) {
      // 根节点不能选中
      return;
    }

    if (this.focusedFile !== target) {
      if (removePreFocusedDecoration) {
        // 当存在上一次右键菜单激活的文件时，需要把焦点态的文件节点的装饰器全部移除
        if (this.preContextMenuFocusedFile) {
          this.focusedDecoration.removeTarget(this.preContextMenuFocusedFile);
          this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
        } else if (!!this.focusedFile) {
          // 多选情况下第一次切换焦点文件
          this.focusedDecoration.removeTarget(this.focusedFile);
        }
        this.preContextMenuFocusedFile = target;
      } else if (!!this.focusedFile) {
        this.preContextMenuFocusedFile = null;
        this.focusedDecoration.removeTarget(this.focusedFile);
      }
      if (target) {
        this.selectedDecoration.addTarget(target);
        this.focusedDecoration.addTarget(target);
        this._focusedFile = target;
        this._selectedFiles.push(target);
        // 事件通知状态变化
        this.onDidFocusedFileChangeEmitter.fire(target.uri);
        this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 选中当前指定节点，添加装饰器属性
  activeFileSelectedDecoration = (target: File | Directory) => {
    if (this._selectedFiles.indexOf(target) > -1) {
      return;
    }
    this._selectedFiles.push(target);
    this.selectedDecoration.addTarget(target);
    // 选中状态变化
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 选中范围内的所有节点
  activeFileDecorationByRange = (begin: number, end: number) => {
    this.clearFileSelectedDecoration();
    this.preContextMenuFocusedFile = null;
    for (; begin <= end; begin++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(begin);
      if (file) {
        this._selectedFiles.push(file as File);
        this.selectedDecoration.addTarget(file);
      }
    }
    // 选中状态变化
    this.onDidSelectedFileChangeEmitter.fire(this._selectedFiles.map((file) => file.uri));
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 取消选中节点焦点
  enactiveFileDecoration = () => {
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
      this.onDidFocusedFileChangeEmitter.fire();
      this.treeModel.dispatchChange();
    }
    this._focusedFile = undefined;
  }

  toggleDirectory = async (item: Directory) => {
    await this.ensurePerformedEffect();
    if (item.expanded) {
      this.fileTreeHandle.collapseNode(item);
    } else {
      this.fileTreeHandle.expandNode(item);
    }
  }

  removeFileDecoration() {
    if (!this.decorations) {
      return;
    }
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
  }

  handleContextMenu = (ev: React.MouseEvent, file?: File | Directory, activeUri?: URI) => {
    ev.stopPropagation();
    ev.preventDefault();

    const { x, y } = ev.nativeEvent;

    if (this.fileTreeService.isCompactMode && activeUri) {
      this._activeUri = activeUri;
    } else if (!activeUri) {
      this._activeUri = null;
    }

    if (file) {
      this.activeFileFocusedDecoration(file, true);
    } else {
      this.enactiveFileDecoration();
    }
    let nodes: (File | Directory)[];
    let node: File | Directory;

    if (!file) {
      // 空白区域右键菜单
      nodes = [this.treeModel.root as Directory];
      node = this.treeModel.root as Directory;
    } else {
      node = file;
      nodes = this._isMutiSelected ? this.selectedFiles : [node];
    }

    this.setFileTreeContextKey(node);

    const menus = this.contextMenuService.createMenu({
      id: MenuId.ExplorerContext,
      contextKeyService: this.fileTreeService.contextMenuContextKeyService,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();
    // 更新压缩节点对应的Contextkey
    this.setExplorerCompressedContextKey(node, activeUri);

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: activeUri ? [activeUri, [activeUri]] : [node.uri, nodes.map((node) => node.uri)],
    });
  }

  setExplorerCompressedContextKey(node?: File | Directory, activeUri?: URI) {
    if (node && activeUri) {
      this.fileTreeContextKey.explorerCompressedFocusContext.set(true);
      const compressedNamePath = new Path(node.name);
      if (compressedNamePath.name === activeUri.displayName) {
        // 压缩节点末尾位置选中
        this.fileTreeContextKey.explorerCompressedLastFocusContext.set(true);
        this.fileTreeContextKey.explorerCompressedFirstFocusContext.set(false);
      } else if (compressedNamePath.root && compressedNamePath.root.name === activeUri.displayName) {
        // 压缩节点开头位置选中
        this.fileTreeContextKey.explorerCompressedLastFocusContext.set(false);
        this.fileTreeContextKey.explorerCompressedFirstFocusContext.set(true);
      } else {
        // 压缩节点中间位置选中
        this.fileTreeContextKey.explorerCompressedLastFocusContext.set(false);
        this.fileTreeContextKey.explorerCompressedFirstFocusContext.set(false);
      }
    } else if (node) {
      // 默认情况下，如果一个节点为压缩节点，末尾位置选中
      if (node.name.indexOf(Path.separator) > 0) {
        this.fileTreeContextKey.explorerCompressedFocusContext.set(true);
        this.fileTreeContextKey.explorerCompressedFirstFocusContext.set(false);
        this.fileTreeContextKey.explorerCompressedLastFocusContext.set(true);
      } else {
        this.fileTreeContextKey.explorerCompressedFocusContext.set(false);
        this.fileTreeContextKey.explorerCompressedFirstFocusContext.set(false);
        this.fileTreeContextKey.explorerCompressedLastFocusContext.set(false);
      }
    } else {
      this.fileTreeContextKey.explorerCompressedFocusContext.set(false);
      this.fileTreeContextKey.explorerCompressedFirstFocusContext.set(false);
      this.fileTreeContextKey.explorerCompressedLastFocusContext.set(false);
    }
  }

  handleTreeHandler(handle: IFileTreeHandle) {
    this._fileTreeHandle = handle;
    this.disposableCollection.push(handle.onError((event: IRecycleTreeError) => {
      // 出错时，暴露当前错误状态，用于排查问题
      this.logger.warn(event.type, event.message);
      this.logger.warn(`Current render state branchSize: ${this.treeModel.root.branchSize} flattenBranch size: ${this.treeModel.root.flattenedBranch?.length}`);
      // 当渲染出错时，尝试刷新Tree
      this.fileTreeService.refresh();
    }));
  }

  handleTreeBlur = () => {
    this.fileTreeContextKey.filesExplorerFocused.set(false);
    // 失去焦点状态时，清理右键菜单的选中态
    if (this.preContextMenuFocusedFile) {
      this.selectedDecoration.removeTarget(this.preContextMenuFocusedFile);
      this._selectedFiles = this.selectedFiles.filter((file) => !file.uri.isEqual(this.preContextMenuFocusedFile!.uri));
    }
    // 清空焦点状态
    this.enactiveFileDecoration();
  }

  handleTreeFocus = () => {
    // 激活面板
    this.fileTreeContextKey.filesExplorerFocused.set(true);
  }

  handleItemRangeClick = (item: File | Directory, type: TreeNodeType) => {
    if (!this.focusedFile) {
      this.handleItemClick(item, type);
    } else if (this.focusedFile && this.focusedFile !== item) {
      this._isMutiSelected = true;
      const targetIndex = this.treeModel.root.getIndexAtTreeNode(item);
      const preFocusedFileIndex = this.treeModel.root.getIndexAtTreeNode(this.focusedFile);
      if (preFocusedFileIndex > targetIndex) {
        this.activeFileDecorationByRange(targetIndex, preFocusedFileIndex);
      } else if (preFocusedFileIndex < targetIndex) {
        this.activeFileDecorationByRange(preFocusedFileIndex, targetIndex);
      }
    }
  }

  handleItemToggleClick = (item: File | Directory, type: TreeNodeType) => {
    this._isMutiSelected = true;
    if (type !== TreeNodeType.CompositeTreeNode && type !== TreeNodeType.TreeNode) {
      return;
    }
    // 选中的节点不是选中状态时，默认先更新节点为选中状态
    // 后续点击切换焦点状态
    if (this.selectedFiles.indexOf(item) > -1) {
      if (this.focusedFile === item) {
        this.enactiveFileDecoration();
      } else {
        this.activeFileFocusedDecoration(item);
      }
    } else {
      this.activeFileSelectedDecoration(item);
    }
  }

  handleItemClick = (item: File | Directory, type: TreeNodeType, activeUri?: URI) => {
    // 更新压缩节点对应的Contextkey
    this.setExplorerCompressedContextKey(item, activeUri);

    this._isMutiSelected = false;
    this.clickTimes++;
    if (this.fileTreeService.isCompactMode && activeUri) {
      this._activeUri = activeUri;
    } else if (!activeUri) {
      this._activeUri = null;
    }
    // 单选操作默认先更新选中状态
    if (type === TreeNodeType.CompositeTreeNode || type === TreeNodeType.TreeNode && !activeUri) {
      this.activeFileDecoration(item);
    }
    // 如果为文件夹需展开
    // 如果为文件，则需要打开文件
    if (type === TreeNodeType.CompositeTreeNode) {
      if (this.corePreferences['workbench.list.openMode'] === 'singleClick') {
        this.toggleDirectory(item as Directory);
      }
    } else if (type === TreeNodeType.TreeNode) {
      this.fileTreeService.openFile(item.uri);
    }
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
    }
    this.clickTimer = setTimeout(() => {
      // 单击事件
      // 200ms内多次点击默认为双击事件
      if (this.clickTimes > 1) {
        if (type === TreeNodeType.TreeNode) {
          this.fileTreeService.openAndFixedFile(item.uri);
        } else {
          if (this.corePreferences['workbench.list.openMode'] === 'doubleClick') {
            this.toggleDirectory(item as Directory);
          }
        }
      }
      this.clickTimes = 0;
    }, 200);
  }

  // 命令调用
  async collapseAll() {
    await this.ensurePerformedEffect();
    this.collapsedAllDeferred = new Deferred();
    await this.treeModel.root.collapsedAll();
    const snapshot = this.explorerStorage.get<ISerializableState>(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY);
    if (snapshot) {
      // 折叠全部后确保将所有目录状态更新，防止立即刷新时状态异常
      this.explorerStorage.set(FileTreeModelService.FILE_TREE_SNAPSHOT_KEY, {
        ...snapshot,
        expandedDirectories: {
          atSurface: [],
          buried: [],
        },
      });
    }
    this.collapsedAllDeferred.resolve();
    this.collapsedAllDeferred = null;
  }

  // 展开所有缓存目录
  public expandAllCacheDirectory = async () => {
    await this.ensurePerformedEffect();
    const size = this.treeModel.root.branchSize;
    for (let index = 0; index < size; index++) {
      const file = this.treeModel.root.getTreeNodeAtIndex(index) as Directory;
      if (Directory.is(file) && !file.expanded && file.branchSize > 0) {
        await file.setExpanded();
      }
    }
  }

  async deleteFileByUris(uris: URI[]) {
    if (this.corePreferences['explorer.confirmDelete']) {
      const ok = localize('file.confirm.delete.ok');
      const cancel = localize('file.confirm.delete.cancel');
      const deleteFilesMessage = `[${uris.map((uri) => uri.displayName).join(',')}]`;
      const confirm = await this.dialogService.warning(formatLocalize('file.confirm.delete', deleteFilesMessage), [cancel, ok]);
      if (confirm !== ok) {
        return;
      } else {
        let preUri: URI = new URI('');
        for (const uri of uris) {
          const effectNode = this.fileTreeService.getNodeByPathOrUri(uri);
          this.loadingDecoration.addTarget(effectNode!);
        }
        // 通知视图更新
        this.treeModel.dispatchChange();
        // 移除文件
        for (const uri of uris) {
          if (!!preUri && preUri.isEqualOrParent(uri)) {
            // 当下个删除文件为上个删除文件的子文件时，只需要忽略即可
            continue;
          }
          await this.deleteFile(uri);
          preUri = uri;
        }
      }
    }
  }

  async deleteFile(uri: URI) {
    // 提前缓存文件路径
    let targetPath: string | URI | undefined;
    // 当存在activeUri时，即存在压缩目录的子路径被删除
    if (this.activeUri) {
      targetPath = uri;
    } else if (this.focusedFile) {
      // 使用path能更精确的定位新建文件位置，因为软连接情况下可能存在uri一致的情况
      targetPath = this.focusedFile.path;
    } else if (this.selectedFiles.length > 0) {
      targetPath = this.selectedFiles[this.selectedFiles.length - 1].path;
    } else {
      targetPath = uri;
    }
    const error = await this.fileTreeAPI.delete(uri);
    if (error) {
      this.messageService.error(error);
      return false;
    }
    const effectNode = this.fileTreeService.getNodeByPathOrUri(targetPath);
    if (effectNode && effectNode.uri.isEqual(uri)) {
      this.fileTreeService.deleteAffectedNodeByPath(effectNode.path);
    } else if (effectNode) {
      // 清空节点路径焦点态
      this.fileTreeContextKey.explorerCompressedFocusContext.set(false);
      this.fileTreeContextKey.explorerCompressedFirstFocusContext.set(false);
      this.fileTreeContextKey.explorerCompressedLastFocusContext.set(false);
      // 说明是异常情况或子路径删除
      this.fileTreeService.refresh((effectNode as File).parent as Directory);
    }
    this.loadingDecoration.removeTarget(effectNode!);
    return true;
  }

  private getWellFormedFileName(filename: string): string {
    if (!filename) {
      return filename;
    }

    // 去除空格
    filename = trim(filename, '\t');

    // 移除尾部的 . / \\
    filename = rtrim(filename, '.');
    filename = rtrim(filename, '/');
    filename = rtrim(filename, '\\');

    return filename;
  }

  private trimLongName(name: string): string {
    if (name && name.length > 255) {
      return `${name.substr(0, 255)}...`;
    }
    return name;
  }

  private validateFileName = (promptHandle: RenamePromptHandle | NewPromptHandle, name: string): FileTreeValidateMessage | null => {
    // 转换为合适的名称
    name = this.getWellFormedFileName(name);

    // 不存在文件名称
    if (!name || name.length === 0 || /^\s+$/.test(name)) {
      return {
        message: localize('validate.tree.emptyFileNameError'),
        type: PROMPT_VALIDATE_TYPE.ERROR,
        value: name,
      };
    }

    // 不允许开头为分隔符的名称
    if (name[0] === '/' || name[0] === '\\') {
      return {
        message: localize('validate.tree.fileNameStartsWithSlashError'),
        type: PROMPT_VALIDATE_TYPE.ERROR,
        value: name,
      };
    }

    // 当文件名称前后有空格时，提示用户
    if (name[0] === ' ' || name[name.length - 1] === ' ') {
      return {
        message: localize('validate.tree.fileNameFollowOrStartWithSpaceWarning'),
        type: PROMPT_VALIDATE_TYPE.WARNING,
        value: name,
      };
    }

    let parent: Directory;

    if ((promptHandle as RenamePromptHandle).target) {
      const target = (promptHandle as RenamePromptHandle).target as (File | Directory);
      if (name === target.name) {
        return null;
      }
      parent = target.parent as Directory;
    } else {
      parent = (promptHandle as NewPromptHandle).parent as Directory;
    }

    const names = coalesce(name.split(/[\\/]/));
    if (parent) {
      // 不允许覆盖已存在的文件
      const child = parent.children?.find((child) => child.name === name);
      if (child) {
        return {
          message: formatLocalize('validate.tree.fileNameExistsError', name),
          type: PROMPT_VALIDATE_TYPE.ERROR,
          value: name,
        };
      }
    }

    // 判断子路径是否合法
    if (names.some((folderName) => !isValidBasename(folderName))) {
      return {
        message: formatLocalize('validate.tree.invalidFileNameError', this.trimLongName(name)),
        type: PROMPT_VALIDATE_TYPE.ERROR,
        value: name,
      };
    }

    return null;
  }

  private proxyPrompt = (promptHandle: RenamePromptHandle | NewPromptHandle) => {
    let isCommit = false;
    const locationFileWhileFileExist = (pathOrUri: URI | string) => {
      // 文件树更新后尝试定位文件位置
      this.location(pathOrUri);
    };
    const commit = async (newName) => {
      this.validateMessage = undefined;
      if (promptHandle instanceof RenamePromptHandle) {
        const target = promptHandle.target as (File | Directory);
        let from = target.uri;
        const isCompactNode = target.name.indexOf(Path.separator) > 0;
        // 无变化，直接返回
        if ((isCompactNode && this.activeUri?.displayName === newName) || (!isCompactNode && newName === target.name)) {
          return true;
        }
        promptHandle.addAddonAfter('loading_indicator');
        if (isCompactNode) {
          // 查找正确的来源节点路径
          while (from.displayName !== promptHandle.originalFileName) {
            from = from.parent;
          }
        }
        // 压缩目录情况下，直接获取父节点的uri更稳妥
        const to = (target.parent as Directory).uri.resolve(newName);
        const error = await this.fileTreeAPI.mv(from, to, target.type === TreeNodeType.CompositeTreeNode);
        promptHandle.removeAddonAfter();
        if (!!error) {
          this.validateMessage = {
            type: PROMPT_VALIDATE_TYPE.ERROR,
            message: error,
            value: newName,
          };
          promptHandle.addValidateMessage(this.validateMessage);
          return false;
        }
        this.fileTreeService.moveNodeByPath(target.parent as Directory, target.path, new Path(target.parent!.path).join(newName).toString());
        // 由于节点移动时默认仅更新节点路径
        // 我们需要自己更新额外的参数，如uri, filestat等
        target.updateURI(to);
        target.updateFileStat({
          ...target.filestat,
          uri: to.toString(),
        });
        target.updateToolTip(this.fileTreeAPI.getReadableTooltip(to));
        // 当重命名文件为文件夹时，刷新文件夹更新子文件路径
        if (Directory.is(target)) {
          this.fileTreeService.refresh(target as Directory);
        }
        locationFileWhileFileExist(target.path);
      } else if (promptHandle instanceof NewPromptHandle) {
        const parent = promptHandle.parent as Directory;
        const newUri = parent.uri.resolve(newName);
        let error;
        const isEmptyDirectory = !parent.children || parent.children.length === 0;
        promptHandle.addAddonAfter('loading_indicator');
        await this.ensurePerformedEffect();
        if (promptHandle.type === TreeNodeType.CompositeTreeNode) {
          if (this.fileTreeService.isCompactMode && isEmptyDirectory && !Directory.isRoot(parent)) {
            this.fileTreeService.ignoreFileEvent(parent.uri, FileChangeType.UPDATED);
            if (isWindows) {
              // Windows环境下会多触发一个UPDATED事件
              this.fileTreeService.ignoreFileEvent(parent.uri.resolve(newName), FileChangeType.UPDATED);
            }
            this.fileTreeService.ignoreFileEvent(parent.uri.resolve(newName), FileChangeType.ADDED);
          }
          error = await this.fileTreeAPI.createDirectory(newUri);
        } else {
          error = await this.fileTreeAPI.createFile(newUri);
        }
        promptHandle.removeAddonAfter();
        if (!!error) {
          this.validateMessage = {
            type: PROMPT_VALIDATE_TYPE.ERROR,
            message: error,
            value: newName,
          };
          promptHandle.addValidateMessage(this.validateMessage);
          return false;
        }
        if (this.fileTreeService.isCompactMode && newName.indexOf(Path.separator) > 0 && !Directory.isRoot(parent)) {
          // 压缩模式下，检查是否有同名父目录存在，有则不需要生成临时目录，刷新对应父节点并定位节点
          const parentPath = new Path(parent.path).join(Path.splitPath(newName)[0]).toString();
          const parentNode = this.fileTreeService.getNodeByPathOrUri(parentPath) as Directory;
          if (parentNode) {
            if (!parentNode.expanded && !parentNode.children) {
              await parentNode.setExpanded(true);
              // 使用uri作为定位是不可靠的，需要检查一下该节点是否处于软链接目录内进行对应转换
              locationFileWhileFileExist(new Path(parent.path).join(newName).toString());
            } else {
              await this.fileTreeService.refresh(parentNode as Directory);
              locationFileWhileFileExist(new Path(parent.path).join(newName).toString());
            }
          } else {
            // 不存在同名目录的情况下
            if (promptHandle.type === TreeNodeType.CompositeTreeNode) {
              if (isEmptyDirectory) {
                const prePath = parent.path;
                // Re-cache TreeNode
                this.fileTreeService.removeNodeCacheByPath(prePath);
                parent.updateName(`${parent.name}${Path.separator}${newName}`);
                parent.updateURI(parent.uri.resolve(newName));
                parent.updateFileStat({
                  ...parent.filestat,
                  uri: parent.uri.resolve(newName).toString(),
                });
                parent.updateToolTip(this.fileTreeAPI.getReadableTooltip(parent.uri.resolve(newName)));
                // Re-cache TreeNode
                this.fileTreeService.reCacheNode(parent, prePath);
                locationFileWhileFileExist(parent.uri.resolve(newName));
              } else {
                const addNode = await this.fileTreeService.addNode(parent, newName, promptHandle.type);
                // 文件夹首次创建需要将焦点设到新建的文件夹上
                locationFileWhileFileExist(addNode.path);
              }
            } else if (promptHandle.type === TreeNodeType.TreeNode) {
              const namePieces = Path.splitPath(newName);
              const parentAddonPath = namePieces.slice(0, namePieces.length - 1).join(Path.separator);
              const fileName = namePieces.slice(-1)[0];
              const prePath = parent.path;
              // Remove TreeNode Cache
              this.fileTreeService.removeNodeCacheByPath(prePath);
              const parentUri = parent.uri.resolve(parentAddonPath);
              parent.updateName(`${parent.name}${Path.separator}${parentAddonPath}`);
              parent.updateURI(parentUri);
              parent.updateFileStat({
                ...parent.filestat,
                uri: parentUri.toString(),
              });
              parent.updateToolTip(this.fileTreeAPI.getReadableTooltip(parentUri));
              // Re-cache TreeNode
              this.fileTreeService.reCacheNode(parent, prePath);

              const addNode = await this.fileTreeService.addNode(parent, fileName, TreeNodeType.TreeNode) as File;
              locationFileWhileFileExist(addNode.path);
            }
          }
        } else {
          if (this.fileTreeService.isCompactMode && promptHandle.type === TreeNodeType.CompositeTreeNode && isEmptyDirectory && !Directory.isRoot(parent)) {
            // Remove TreeNode Cache
            const prePath = parent.path;
            this.fileTreeService.removeNodeCacheByPath(prePath);
            const parentUri = parent.uri.resolve(newName);
            parent.updateName(`${parent.name}${Path.separator}${newName}`);
            parent.updateURI(parentUri);
            parent.updateFileStat({
              ...parent.filestat,
              uri: parentUri.toString(),
            });
            parent.updateToolTip(this.fileTreeAPI.getReadableTooltip(parentUri));
            // Re-cache TreeNode
            this.fileTreeService.reCacheNode(parent, prePath);
            locationFileWhileFileExist(parent.uri.resolve(newName));
          } else {
            await this.fileTreeService.addNode(parent, newName, promptHandle.type);
            locationFileWhileFileExist(parent.uri.resolve(newName));
          }
        }
      }
      this.fileTreeContextKey.filesExplorerInputFocused.set(false);
      return true;
    };

    const blurCommit = async (newName) => {
      if (isCommit) {
        return false;
      }
      if (!!this.validateMessage && this.validateMessage.type === PROMPT_VALIDATE_TYPE.ERROR) {
        this.validateMessage = undefined;
        return true;
      }
      if (!newName) {
        // 清空节点路径焦点态
        this.fileTreeContextKey.explorerCompressedFocusContext.set(false);
        this.fileTreeContextKey.explorerCompressedFirstFocusContext.set(false);
        this.fileTreeContextKey.explorerCompressedLastFocusContext.set(false);
        if (this.fileTreeService.isCompactMode && promptHandle instanceof NewPromptHandle) {
          this.fileTreeService.refresh(promptHandle.parent as Directory);
        }
        return;
      }
      await commit(newName);
      return true;
    };
    const enterCommit = async (newName) => {
      isCommit = true;
      if (!!this.validateMessage && this.validateMessage.type === PROMPT_VALIDATE_TYPE.ERROR) {
        return false;
      }
      if (newName.trim() === '' || (!!this.validateMessage && this.validateMessage.type !== PROMPT_VALIDATE_TYPE.ERROR)) {
        this.validateMessage = undefined;
        return true;
      }
      const success = await commit(newName);
      isCommit = false;

      if (!success) {
        return false;
      }
      // 返回true时，输入框会隐藏
      return true;
    };
    const handleFocus = async () => {
      this.fileTreeContextKey.filesExplorerInputFocused.set(true);
    };
    const handleDestroy = () => {
      // 在焦点元素销毁时，electron与chrome web上处理焦点的方式略有不同
      // 这里需要明确将FileTree的explorerFocused设置为正确的false
      this.fileTreeContextKey.filesExplorerFocused.set(false);
      this.fileTreeContextKey.filesExplorerInputFocused.set(false);
    };
    const handleCancel = () => {
      if (this.fileTreeService.isCompactMode) {
        if (promptHandle instanceof NewPromptHandle) {
          this.fileTreeService.refresh(promptHandle.parent as Directory);
        }
      }
    };
    const handleChange = (currentValue) => {
      const validateMessage = this.validateFileName(promptHandle, currentValue);
      if (!!validateMessage) {
        this.validateMessage = validateMessage;
        promptHandle.addValidateMessage(validateMessage);
      } else if (!validateMessage && this.validateMessage && this.validateMessage.value !== currentValue) {
        this.validateMessage = undefined;
        promptHandle.removeValidateMessage();
      }
    };
    if (!promptHandle.destroyed) {
      promptHandle.onChange(handleChange);
      promptHandle.onCommit(enterCommit);
      promptHandle.onBlur(blurCommit);
      promptHandle.onFocus(handleFocus);
      promptHandle.onChange(handleChange);
      promptHandle.onDestroy(handleDestroy);
      promptHandle.onCancel(handleCancel);
    }
  }

  private async getPromptTarget(uri: URI) {
    await this.ensurePerformedEffect();
    let targetNode: File | Directory;
    // 使用path能更精确的定位新建文件位置，因为软连接情况下可能存在uri一致的情况
    if (uri.isEqual((this.treeModel.root as Directory).uri)) {
      // 可能为空白区域点击, 即选中的对象为根目录
      targetNode = await this.fileTreeService.getNodeByPathOrUri(uri)!;
    } else if (this.selectedFiles.length > 0) {
      const selectedNode = this.selectedFiles[this.selectedFiles.length - 1];
      if (!this.treeModel.root.isItemVisibleAtSurface(selectedNode)) {
        const targetNodePath = await this.fileTreeService.getFileTreeNodePathByUri(uri);
        targetNode = await this.treeModel.root.forceLoadTreeNodeAtPath(targetNodePath!) as File;
      } else {
        targetNode = selectedNode;
      }
    } else {
      targetNode = await this.fileTreeService.getNodeByPathOrUri(uri)!;
    }
    if (!targetNode) {
      targetNode = this.treeModel.root as Directory;
    }
    const namePieces = Path.splitPath(targetNode.name);
    if (Directory.isRoot(targetNode)) {
      return targetNode;
    } else if (targetNode.name !== uri.displayName && namePieces[namePieces.length - 1] !== uri.displayName) {
      // 说明当前在压缩节点的非末尾路径上触发的新建事件， 如 a/b 上右键 a 产生的新建事件
      const removePathName = uri.relative(targetNode.uri)?.toString();
      const relativeName = targetNode.name.replace(`${Path.separator}${removePathName}`, '');
      const newTargetUri = (targetNode.parent as Directory).uri.resolve(relativeName);
      if (!relativeName) {
        return;
      }
      const prePath = targetNode.path;
      // Re-cache TreeNode
      this.fileTreeService.removeNodeCacheByPath(prePath);
      // 更新目标节点信息
      targetNode.updateName(relativeName!.toString());
      targetNode.updateURI(newTargetUri);
      targetNode.updateToolTip(this.fileTreeAPI.getReadableTooltip(newTargetUri));
      targetNode.updateFileStat({
        ...targetNode.filestat,
        uri: newTargetUri.toString(),
      });
      this.fileTreeService.reCacheNode(targetNode, prePath);
      await (targetNode as Directory).forceReloadChildrenQuiet();
    }
    return targetNode;
  }

  async newFilePrompt(uri: URI) {
    const targetNode = await this.getPromptTarget(uri);
    if (targetNode) {
      this.proxyPrompt(await this.fileTreeHandle.promptNewTreeNode(targetNode as Directory));
    }
  }

  async newDirectoryPrompt(uri: URI) {
    const targetNode = await this.getPromptTarget(uri);
    if (targetNode) {
      this.proxyPrompt(await this.fileTreeHandle.promptNewCompositeTreeNode(targetNode as Directory));
    }
  }

  async renamePrompt(uri: URI) {
    await this.ensurePerformedEffect();
    let targetNode: File | Directory;
    // 使用path能更精确的定位新建文件位置，因为软连接情况下可能存在uri一致的情况
    if (this.focusedFile) {
      targetNode = this.focusedFile;
    } else if (this.selectedFiles.length > 0) {
      targetNode = this.selectedFiles[this.selectedFiles.length - 1];
    } else {
      targetNode = await this.fileTreeService.getNodeByPathOrUri(uri)!;
    }
    if (targetNode) {
      this.proxyPrompt(await this.fileTreeHandle.promptRename(targetNode, uri.displayName));
    }
  }

  public copyFile = async (from: URI[]) => {
    if (this.pasteStore && this.pasteStore.type === PasteTypes.CUT) {
      this._pasteStore.files.forEach((file) => {
        if (file) {
          this.cutDecoration.removeTarget(file as File);
        }
      });
      this.fileTreeContextKey.explorerResourceCut.set(false);
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
    const files: (File | Directory)[] = [];
    for (const uri of from) {
      const file = this.fileTreeService.getNodeByPathOrUri(uri);
      if (!!file) {
        files.push(file);
      }
    }
    this._pasteStore = {
      files: files as (File | Directory)[],
      type: PasteTypes.COPY,
    };
  }

  public pasteFile = async (to: URI) => {
    let parent = this.fileTreeService.getNodeByPathOrUri(to.toString());
    if (!parent || !this.pasteStore) {
      return;
    }
    if (!Directory.is(parent)) {
      parent = parent.parent as Directory;
    }
    if (this.pasteStore.type === PasteTypes.CUT) {
      for (const file of this.pasteStore.files) {
        if (file) {
          this.cutDecoration.removeTarget(file);
        }
        if (!(parent as Directory).expanded) {
          await (parent as Directory).setExpanded(true);
        }
      }
      const to = (parent as Directory).uri;
      const errors = await this.fileTreeAPI.mvFiles(this.pasteStore.files.map((file) => file.uri), to);
      if (errors && errors.length > 0) {
        errors.forEach((error) => {
          this.messageService.error(error);
        });
        this.fileTreeService.refresh();
      }
      this.fileTreeContextKey.explorerResourceCut.set(false);
      // 更新视图
      this.treeModel.dispatchChange();
      this._pasteStore = {
        files: [],
        type: PasteTypes.NONE,
      };
    } else if (this.pasteStore.type === PasteTypes.COPY) {
      for (const file of this.pasteStore.files) {
        const to = (parent as Directory).uri.resolve(file.uri.displayName);
        if (!(parent as Directory).expanded) {
          await (parent as Directory).setExpanded(true);
        }
        const res = await this.fileTreeAPI.copyFile(file.uri, to);
        if (res) {
          if ((res as FileStat).uri) {
            const copyUri = new URI((res as FileStat).uri);
            this.fileTreeService.addNode((parent as Directory), copyUri.displayName, Directory.is(file) ? TreeNodeType.CompositeTreeNode : TreeNodeType.TreeNode);
          } else {
            this.messageService.error(res);
          }
        }
      }
    }
  }

  public cutFile = async (from: URI[]) => {
    if (from.length > 0) {
      this.fileTreeContextKey.explorerResourceCut.set(true);
    }
    // 清理上一次剪切文件
    if (this._pasteStore && this._pasteStore.type === PasteTypes.CUT) {
      this._pasteStore.files.forEach((file) => {
        this.cutDecoration.removeTarget(file);
      });
    }
    const files: (File | Directory)[] = [];
    for (const uri of from) {
      const file = this.fileTreeService.getNodeByPathOrUri(uri);
      if (!!file) {
        files.push(file);
      }
    }
    this._pasteStore = {
      files,
      type: PasteTypes.CUT,
    };

    for (const file of files) {
      if (file) {
        this.cutDecoration.addTarget(file);
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  public location = async (pathOrUri: URI | string) => {
    // 筛选模式下，禁止使用定位功能
    if (this.fileTreeService.filterMode) {
      return;
    }
    if (this._loadSnapshotReady) {
      await this._loadSnapshotReady;
    }
    // 确保在刷新等动作执行完后进行定位
    await this.ensurePerformedEffect();
    return this.locationDelayer.trigger(async () => {
      this.locationDeferred = new Deferred();
      let path;
      if (typeof pathOrUri === 'string') {
        path = pathOrUri;
      } else {
        path = await this.fileTreeService.getFileTreeNodePathByUri(pathOrUri)!;
      }
      if (path) {
        if (!this.fileTreeHandle) {
          return;
        }
        const node = await this.fileTreeHandle.ensureVisible(path, 'center', true) as File;
        if (node) {
          this.selectFileDecoration(node);
        }
      }
      this.locationDeferred.resolve();
      this.locationDeferred = null;
    });
  }

  public locationOnShow = (uri: URI) => {
    this._nextLocationTarget = uri;
  }

  public performLocationOnHandleShow = async () => {
    if (this._nextLocationTarget) {
      await this.location(this._nextLocationTarget);
      this._nextLocationTarget = undefined;
    }
  }
}
