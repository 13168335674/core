import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TreeModel, DecorationsManager, Decoration, IRecycleTreeHandle, TreeNodeType, WatchEvent, TreeNode } from '@ali/ide-components';
import { URI, DisposableCollection, Emitter, IContextKeyService, EDITOR_COMMANDS, CommandService, ThrottledDelayer, Deferred, Event } from '@ali/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { OpenedEditorService } from './opened-editor-tree.service';
import { OpenedEditorModel } from './opened-editor-model';
import { EditorFile, EditorFileGroup } from '../opened-editor-node.define';
import { OpenedEditorDecorationService } from './opened-editor-decoration.service';
import pSeries = require('p-series');

import * as styles from '../opened-editor-node.module.less';
import { Path } from '@ali/ide-core-common/lib/path';
import { OpenedEditorEventService } from './opened-editor-event.service';
import { WorkbenchEditorService, IEditorGroup, IResource } from '@ali/ide-editor/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';

export interface IEditorTreeHandle extends IRecycleTreeHandle {
  hasDirectFocus: () => boolean;
}

@Injectable()
export class OpenedEditorModelService {
  private static DEFAULT_FLUSH_FILE_EVENT_DELAY = 100;
  private static DEFAULT_LOCATION_FLUSH_DELAY = 200;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(OpenedEditorService)
  private readonly openedEditorService: OpenedEditorService;

  @Autowired(LabelService)
  public readonly labelService: LabelService;

  @Autowired(OpenedEditorDecorationService)
  public readonly decorationService: OpenedEditorDecorationService;

  @Autowired(OpenedEditorEventService)
  public readonly openedEditorEventService: OpenedEditorEventService;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(CommandService)
  public readonly commandService: CommandService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  private _treeModel: TreeModel;
  private _whenReady: Promise<void>;

  private _decorations: DecorationsManager;
  private _openedEditorTreeHandle: IEditorTreeHandle;

  public flushEventQueueDeferred: Deferred<void> | null;
  private _eventFlushTimeout: number;
  private _changeEventDispatchQueue: string[] = [];

  // 装饰器
  private selectedDecoration: Decoration = new Decoration(styles.mod_selected); // 选中态
  private focusedDecoration: Decoration = new Decoration(styles.mod_focused); // 焦点态
  private dirtyDecoration: Decoration = new Decoration(styles.mod_dirty); // 修改态
  // 即使选中态也是焦点态的节点
  private _focusedFile: EditorFileGroup | EditorFile | undefined;
  // 选中态的节点
  private _selectedFiles: (EditorFileGroup | EditorFile)[] = [];

  private preContextMenuFocusedFile: EditorFileGroup | EditorFile | null;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  private onDidRefreshedEmitter: Emitter<void> = new Emitter();
  private locationDelayer = new ThrottledDelayer<void>(OpenedEditorModelService.DEFAULT_LOCATION_FLUSH_DELAY);

  // 右键菜单局部ContextKeyService
  private _contextMenuContextKeyService: IContextKeyService;
  private _currentDirtyNodes: EditorFile[] = [];

  private ignoreRefreshAndActiveTimes: number;

  constructor() {
    this._whenReady = this.initTreeModel();
  }

  get flushEventQueuePromise() {
    return this.flushEventQueueDeferred && this.flushEventQueueDeferred.promise;
  }

  get contextMenuContextKeyService() {
    if (!this._contextMenuContextKeyService) {
      this._contextMenuContextKeyService = this.contextKeyService.createScoped();
    }
    return this._contextMenuContextKeyService;
  }

  get editorTreeHandle() {
    return this._openedEditorTreeHandle;
  }

  get decorations() {
    return this._decorations;
  }

  get treeModel() {
    return this._treeModel;
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

  get onDidRefreshed(): Event<void> {
    return this.onDidRefreshedEmitter.event;
  }
  async initTreeModel() {
    // 根据是否为多工作区创建不同根节点
    const root = (await this.openedEditorService.resolveChildren())[0];
    if (!root) {
      return;
    }
    this._treeModel = this.injector.get<any>(OpenedEditorModel, [root]);

    this.initDecorations(root);

    this.disposableCollection.push(this.openedEditorService.onDirtyNodesChange((nodes) => {
      for (const node of nodes) {
        if (!this.dirtyDecoration.hasTarget(node as EditorFile)) {
          this.dirtyDecoration.addTarget(node as EditorFile);
        }
      }
      this._currentDirtyNodes = this._currentDirtyNodes.concat(nodes);
      this.setExplorerTabBarBadge();
      this.treeModel.dispatchChange();
    }));

    this.disposableCollection.push(this.labelService.onDidChange(() => {
      this._currentDirtyNodes = [];
      // 当labelService注册的对应节点图标变化时，通知视图更新
      this.refresh();
    }));

    this.disposableCollection.push(this.editorService.onActiveResourceChange(() => {
      if (this.ignoreRefreshAndActiveTimes > 0 && this.ignoreRefreshAndActiveTimes--) {
        return;
      }
      this._currentDirtyNodes = [];
      this.refresh();
    }));

    this.disposableCollection.push(this.openedEditorEventService.onDidDecorationChange((payload) => {
      let shouldUpdate = false;
      if (!payload) {
        return;
      }
      for (let index = 0; index < this.treeModel.root.branchSize; index ++) {
        const node = this.treeModel.root.getTreeNodeAtIndex(index);
        if (!!node && !EditorFileGroup.is(node as EditorFileGroup)) {
          if ((node as EditorFile).uri.isEqual(payload.uri)) {
            if (payload.decoration.dirty) {
              this.dirtyDecoration.addTarget(node as EditorFile);
            } else {
              this.dirtyDecoration.removeTarget(node as EditorFile);
            }
            shouldUpdate = true;
          }
        }
      }
      if (shouldUpdate) {
        this.setExplorerTabBarBadge();
        this.treeModel.dispatchChange();
      }
    }));

    this.disposableCollection.push(this.onDidRefreshed(() => {
      this.dirtyDecoration.appliedTargets.clear();
      // 更新dirty节点，节点可能已更新
      for (const target of this._currentDirtyNodes) {
        this.dirtyDecoration.addTarget(target as TreeNode);
      }
      const currentResource = this.editorService.currentResource;
      const currentGroup = this.editorService.currentEditorGroup;
      if (currentResource) {
        this.location(currentResource, currentGroup);
      }
      this.setExplorerTabBarBadge();
    }));
  }

  initDecorations(root) {
    this._decorations = new DecorationsManager(root as any);
    this._decorations.addDecoration(this.selectedDecoration);
    this._decorations.addDecoration(this.focusedDecoration);
    this._decorations.addDecoration(this.dirtyDecoration);
  }

  // 清空所有节点选中态
  clearFileSelectedDecoration = () => {
    this._selectedFiles.forEach((file) => {
      this.selectedDecoration.removeTarget(file);
    });
    this._selectedFiles = [];
  }

  // 清空其他选中/焦点态节点，更新当前焦点节点
  activeFileDecoration = (target: EditorFileGroup | EditorFile) => {
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

      // 通知视图更新
      this.treeModel.dispatchChange();
    }
  }

  // 清空其他选中/焦点态节点，更新当前选中节点
  selectFileDecoration = (target: EditorFileGroup | EditorFile) => {
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

      // 通知视图更新
      this.treeModel.dispatchChange();
    }
  }

  // 清空其他焦点态节点，更新当前焦点节点，
  // removePreFocusedDecoration 表示更新焦点节点时如果此前已存在焦点节点，之前的节点装饰器将会被移除
  activeFileFocusedDecoration = (target: EditorFileGroup | EditorFile, removePreFocusedDecoration: boolean = false) => {
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
      }
    }
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 选中当前指定节点，添加装饰器属性
  activeFileSelectedDecoration = (target: EditorFileGroup | EditorFile) => {
    if (this._selectedFiles.indexOf(target) > -1) {
      return;
    }
    if (this.selectedFiles.length > 0) {
      this.selectedFiles.forEach((file) => {
        this.selectedDecoration.removeTarget(file);
      });
    }
    this._selectedFiles = [target];
    this.selectedDecoration.addTarget(target);
    // 通知视图更新
    this.treeModel.dispatchChange();
  }

  // 取消选中节点焦点
  enactiveFileDecoration = () => {
    if (this.focusedFile) {
      this.focusedDecoration.removeTarget(this.focusedFile);
      this.treeModel.dispatchChange();
    }
    this._focusedFile = undefined;
  }

  removeFileDecoration() {
    if (!this.decorations) {
      return;
    }
    this.decorations.removeDecoration(this.selectedDecoration);
    this.decorations.removeDecoration(this.focusedDecoration);
  }

  handleContextMenu = (ev: React.MouseEvent, file?: EditorFileGroup | EditorFile) => {
    ev.stopPropagation();
    ev.preventDefault();

    const { x, y } = ev.nativeEvent;

    if (file) {
      this.activeFileFocusedDecoration(file, true);
    } else {
      this.enactiveFileDecoration();
    }
    let node: EditorFileGroup | EditorFile;

    if (!file) {
      // 空白区域右键菜单
      node = this.treeModel.root as EditorFileGroup;
    } else {
      node = file;
    }

    const menus = this.contextMenuService.createMenu({
      id: MenuId.OpenEditorsContext,
      contextKeyService: this.contextMenuContextKeyService,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();
    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [node],
    });
  }

  handleTreeHandler(handle: IEditorTreeHandle) {
    this._openedEditorTreeHandle = handle;
  }

  handleTreeBlur = () => {
    // 清空焦点状态
    this.enactiveFileDecoration();
  }

  handleItemClick = (item: EditorFileGroup | EditorFile, type: TreeNodeType) => {
    // 单选操作默认先更新选中状态
    this.activeFileDecoration(item);

    if (type === TreeNodeType.TreeNode) {
      this.openFile(item as EditorFile);
    }
  }

  /**
   * 刷新指定下的所有子节点
   */
  async refresh(node: EditorFileGroup = this.treeModel.root as EditorFileGroup) {
    if (!EditorFileGroup.is(node) && (node as EditorFileGroup).parent) {
      node = (node as EditorFileGroup).parent as EditorFileGroup;
    }
    // 这里也可以直接调用node.forceReloadChildrenQuiet，但由于文件树刷新事件可能会较多
    // 队列化刷新动作减少更新成本
    this.queueChangeEvent(node.path, () => {
      this.onDidRefreshedEmitter.fire();
    });
  }

  // 队列化Changed事件
  private queueChangeEvent(path: string, callback: any) {
    if (!this.flushEventQueueDeferred) {
      this.flushEventQueueDeferred = new Deferred<void>();
      clearTimeout(this._eventFlushTimeout);
      this._eventFlushTimeout = setTimeout(async () => {
        await this.flushEventQueue()!;
        this.flushEventQueueDeferred?.resolve();
        this.flushEventQueueDeferred = null;
        callback();
      }, OpenedEditorModelService.DEFAULT_FLUSH_FILE_EVENT_DELAY) as any;
    }
    if (this._changeEventDispatchQueue.indexOf(path) === -1) {
      this._changeEventDispatchQueue.push(path);
    }
  }

  public flushEventQueue = () => {
    let promise: Promise<any>;
    if (!this._changeEventDispatchQueue || this._changeEventDispatchQueue.length === 0) {
      return;
    }
    this._changeEventDispatchQueue.sort((pathA, pathB) => {
      const pathADepth = Path.pathDepth(pathA);
      const pathBDepth = Path.pathDepth(pathB);
      return pathADepth - pathBDepth;
    });
    const roots = [this._changeEventDispatchQueue[0]];
    for (const path of this._changeEventDispatchQueue) {
      if (roots.some((root) => path.indexOf(root) === 0)) {
        continue;
      } else {
        roots.push(path);
      }
    }
    promise = pSeries(roots.map((path) => async () => {
      const watcher = this.treeModel.root?.watchEvents.get(path);
      if (watcher && typeof watcher.callback === 'function') {
        await watcher.callback({ type: WatchEvent.Changed, path });
      }
      return null;
    }));
    // 重置更新队列
    this._changeEventDispatchQueue = [];
    return promise;
  }

  public location = async (resource: IResource | URI, group?: IEditorGroup) => {
    this.locationDelayer.trigger(async () => {
      await this.flushEventQueuePromise;
      let node = this.openedEditorService.getEditorNodeByUri(resource, group);
      if (!node) {
        return;
      }
      node = await this.editorTreeHandle.ensureVisible(node) as EditorFile;
      if (node) {
        this.selectFileDecoration(node);
      }
    });
  }

  public openFile = (node: EditorFile) => {
    // 手动打开文件时，屏蔽刷新及激活实际，防闪烁
    this.ignoreRefreshAndActiveTimes = 1;
    let groupIndex = 0;
    if (node.parent && EditorFileGroup.is(node.parent as EditorFileGroup)) {
      groupIndex = (node.parent as EditorFileGroup).group.index;
    }
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, node.uri, { groupIndex, preserveFocus: true });
  }

  public closeFile = (node: EditorFile) => {
    this.commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id, node.uri);
  }

  public closeAllByGroup = (node: EditorFileGroup) => {
    const group = node.group as IEditorGroup;
    if (group) {
      group.closeAll();
    }
  }

  public saveAllByGroup = (node: EditorFileGroup) => {
    const group = node.group as IEditorGroup;
    if (group) {
      group.saveAll();
    }
  }

  private setExplorerTabBarBadge() {
    const targetSets = new Set();
    for (const target of this.dirtyDecoration.appliedTargets.keys()) {
      targetSets.add((target as EditorFile).uri.toString());
    }
    const dirtyCount = targetSets.size;
    const handler = this.layoutService.getTabbarHandler(ExplorerContainerId);
    if (handler) {
      handler.setBadge(dirtyCount > 0 ? dirtyCount.toString() : '');
    }
  }
}
