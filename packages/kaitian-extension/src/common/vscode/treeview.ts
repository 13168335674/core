import type * as vscode from 'vscode';
import {
  UriComponents,
  ICommand,
} from './models';
import { Event, IDisposable } from '@ali/ide-core-common';
import { TreeItemCollapsibleState } from './ext-types';
import { ThemeType } from '@ali/ide-theme';

export interface ITreeViewRevealOptions {
  select?: boolean;
  focus?: boolean;
  expand?: boolean | number;
}
export interface IMainThreadTreeView {
  $unregisterTreeDataProvider(treeViewId: string): void;
  $registerTreeDataProvider<T>(treeViewId: string, options: TreeViewBaseOptions): void;
  $refresh<T>(treeViewId: string, itemsToRefresh?: T | null): void;
  $refresh(treeViewId: string, itemsToRefresh?: TreeViewItem): void;
  $reveal(treeViewId: string, treeItemId: string, options?: ITreeViewRevealOptions): Promise<any>;
  // $setMessage(treeViewId: string, message: string | IMarkdownString): void;
}

export interface IExtHostTreeView {
  createTreeView<T>(treeViewId: string, options: { treeDataProvider: vscode.TreeDataProvider<T> }): TreeView<T>;
  registerTreeDataProvider<T>(treeViewId: string, treeDataProvider: vscode.TreeDataProvider<T>): IDisposable;
  $getChildren(treeViewId: string, treeItemId?: string): Promise<TreeViewItem[] | undefined>;
  $setExpanded(treeViewId: string, treeItemId: string, expanded: boolean): Promise<any>;
  $setSelection(treeViewId: string, treeItemHandles: string[]): void;
  $setVisible(treeViewId: string, visible: boolean): void;
}

// TreeView API Interface dependencies

export type IconUrl = string | { [index in ThemeType]: string };

export class TreeViewItem {

  id: string;

  label: string;

  icon?: string;

  description?: string;

  iconUrl?: IconUrl;

  themeIconId?: 'folder' | 'file';

  resourceUri?: UriComponents;

  tooltip?: string;

  collapsibleState?: TreeItemCollapsibleState;

  contextValue?: string;

  command?: ICommand;

}

export interface TreeView<T> extends IDisposable {
  /**
   * 当节点展开时触发的事件
   */
  readonly onDidExpandElement: Event<vscode.TreeViewExpansionEvent<T>>;
  /**
   * 当节点折叠状态变化时触发的事件
   */
  readonly onDidCollapseElement: Event<vscode.TreeViewExpansionEvent<T>>;
  /**
   * 当节点可见性变化时触发的事件
   */
  readonly onDidChangeVisibility: Event<vscode.TreeViewVisibilityChangeEvent>;
  /**
   * 当节点选中时触发的事件
   */
  readonly onDidChangeSelection: Event<vscode.TreeViewSelectionChangeEvent<T>>;
  /**
   * 当TreeView视图可见时为 true，否则为false
   */
  readonly visible: boolean;
  /**
   * 当前选中的节点
   */
  readonly selection: ReadonlyArray<T>;
  /**
   * 展示节点，默认情况下展示的节点为选中状态
   *
   * 当希望显示的节点不带选中状态时，可以设置options内的select属性为false
   *
   * **NOTE:** 需要在实现TreeDataProvider.getParent接口情况下该接口才可用.
   */
  reveal(element: T, options?: { select?: boolean, focus?: boolean, expand?: boolean | number }): PromiseLike<void>;
}

export interface TreeViewBaseOptions {
  /**
   * 是否展示折叠所有功能（panel上功能）
   */
  showCollapseAll?: boolean;

  /**
   * Tree是否支持复选操作
   * 当值为true且命令在Tree上被执行时，第一个参数是选中执行的节点，第二个参数为所有选中的Tree节点数组

   */
  canSelectMany?: boolean;
}

export interface TreeViewOptions<T> extends TreeViewBaseOptions {
  treeDataProvider: vscode.TreeDataProvider<T>;
}

export interface TreeViewSelection {
  treeViewId: string;
  treeItemId: string;
}
export namespace TreeViewSelection {
  export function is(arg: any): arg is TreeViewSelection {
    return !!arg && typeof arg === 'object' && 'treeViewId' in arg && 'treeItemId' in arg;
  }
}
