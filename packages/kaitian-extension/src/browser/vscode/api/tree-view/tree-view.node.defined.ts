import { TreeNode, CompositeTreeNode, ITree } from '@ali/ide-components';
import { TreeViewDataProvider } from '../main.thread.treeview';
import { ICommand } from '../../../../common/vscode/ext-types';

export class ExtensionTreeRoot extends CompositeTreeNode {

  public static is(node: any): node is ExtensionTreeRoot {
    return !!node && 'children' in node && !node.parent;
  }

  private _displayName: string;

  constructor(
    private treeViewDataProvider: TreeViewDataProvider,
    public treeViewId: string = '',
  ) {
    super(treeViewDataProvider as ITree, undefined);
  }

  get treeItemId() {
    return `TreeViewRoot_${this.treeViewId}`;
  }

  get name() {
    return `TreeViewRoot_${this.id}`;
  }

  get expanded() {
    return true;
  }

  get displayName() {
    return this._displayName || this.name;
  }

  getTreeNodeByTreeItemId(treeItemId: string) {
    return this.treeViewDataProvider.getNodeByTreeItemId(treeItemId);
  }

  dispose() {
    super.dispose();
  }
}

export class ExtensionCompositeTreeNode extends CompositeTreeNode {

  private _displayName: string;
  private _whenReady: Promise<void>;

  constructor(
    tree: TreeViewDataProvider,
    public readonly parent: ExtensionCompositeTreeNode | undefined,
    public name: string = '',
    public description: string = '',
    public icon: string = '',
    public tooltip: string = '',
    public command: ICommand | undefined,
    public contextValue: string = '',
    public treeItemId: string = '',
    expanded?: boolean,
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name }, { disableCache: false });
    if (expanded) {
      this._whenReady = this.setExpanded();
    }
    this._uid = id || this._uid;
    // 每个节点应该拥有自己独立的路径，不存在重复性
    // displayName 作为展示用的字段
    this.name = String(this._uid);
    if (!!name) {
      this._displayName = name;
      TreeNode.setTreeNode(this._uid, this.path, this);
    } else {
      TreeNode.setTreeNode(this._uid, this.path, this);
    }
  }

  get displayName() {
    return this._displayName;
  }

  get whenReady() {
    return this._whenReady;
  }

  dispose() {
    super.dispose();
  }
}

export class ExtensionTreeNode extends TreeNode {
  private _displayName: string;

  constructor(
    tree: TreeViewDataProvider,
    public readonly parent: ExtensionCompositeTreeNode | undefined,
    public name: string = '',
    public description: string = '',
    public icon: string = '',
    public tooltip: string = '',
    public command: ICommand | undefined,
    public contextValue: string = '',
    public treeItemId: string = '',
    id?: number,
  ) {
    super(tree as ITree, parent, undefined, { name }, { disableCache: false });
    this._uid = id || this._uid;
    if (!!name) {
      this._displayName = name;
      TreeNode.setTreeNode(this._uid, this.path, this);
    } else {
      this.name = String(this._uid);
      TreeNode.setTreeNode(this._uid, this.path, this);
    }
  }

  get displayName() {
    return this._displayName;
  }

  dispose() {
    super.dispose();
  }
}
