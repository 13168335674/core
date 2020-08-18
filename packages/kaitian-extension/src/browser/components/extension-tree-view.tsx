import * as React from 'react';
import * as styles from './extension-tree-view.module.less';
import { isOSX } from '@ali/ide-core-browser';
import { Injector } from '@ali/common-di';
import { observer } from 'mobx-react-lite';
import { ViewState } from '@ali/ide-core-browser';
import { TitleActionList } from '@ali/ide-core-browser/lib/components/actions';

import { TreeViewBaseOptions } from '../../common/vscode';
import { ExtensionTreeViewModel } from '../vscode/api/tree-view/tree-view.model.service';
import { RecycleTree, INodeRendererProps, IRecycleTreeHandle, TreeNodeType } from '@ali/ide-components';
import { TREE_VIEW_NODE_HEIGHT, TreeViewNode } from './extension-tree-view-node';
import { ExtensionCompositeTreeNode, ExtensionTreeNode } from '../vscode/api/tree-view/tree-view.node.defined';
import { ExtensionLoadingView } from './extension-loading-view';

export interface ExtensionTabBarTreeViewProps {
  injector: Injector;
  options: TreeViewBaseOptions;
  viewState: ViewState;
  model: ExtensionTreeViewModel;
}

export const ExtensionTabBarTreeView = observer(({
  options,
  viewState,
  model,
}: React.PropsWithChildren<ExtensionTabBarTreeViewProps>) => {
  const [isReady, setIsReady] = React.useState<boolean>(false);

  const { width, height } = viewState;
  const { canSelectMany, showCollapseAll } = options || {};
  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    model.handleTreeHandler({
      ...handle,
      getModel: () => model.treeModel,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleTwistierClick = (ev: React.MouseEvent, item: ExtensionCompositeTreeNode) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { toggleDirectory } = model;

    toggleDirectory(item);

  };

  const hasShiftMask = (event): boolean => {
    // Ctrl/Cmd 权重更高
    if (hasCtrlCmdMask(event)) {
      return false;
    }
    return event.shiftKey;
  };

  const hasCtrlCmdMask = (event): boolean => {
    const { metaKey, ctrlKey } = event;
    return (isOSX && metaKey) || ctrlKey;
  };

  const handleItemClicked = (ev: React.MouseEvent, item: ExtensionTreeNode | ExtensionCompositeTreeNode, type: TreeNodeType) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { handleItemClick, handleItemToggleClick, handleItemRangeClick } = model;
    if (!item) {
      return;
    }
    const shiftMask = hasShiftMask(event);
    const ctrlCmdMask = hasCtrlCmdMask(event);
    if (canSelectMany) {
      if (shiftMask) {
        handleItemRangeClick(item, type);
      } else if (ctrlCmdMask) {
        handleItemToggleClick(item, type);
      }
    } else {
      handleItemClick(item, type);
    }
  };

  const handlerContextMenu = (ev: React.MouseEvent, node: ExtensionTreeNode | ExtensionCompositeTreeNode) => {
    const { handleContextMenu } = model;
    handleContextMenu(ev, node);
  };

  const ensureIsReady = async () => {
    if (!model) {
      return ;
    }
    await model.whenReady;
    if (!!model.treeModel) {
      // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
      // 这里需要重新取一下treeModel的值确保为最新的TreeModel
      await model.treeModel.root.ensureLoaded();
    }
    setIsReady(true);
  };

  React.useEffect(() => {
    ensureIsReady();
    if (showCollapseAll) {
      model.registerCollapseAllCommand();
    }
    return () => {
      model.removeNodeDecoration();
    };
  }, [model]);

  const renderTreeView = () => {
    if (isReady) {
      if (model.treeModel) {
        return <RecycleTree
          height={height}
          width={width}
          itemHeight={TREE_VIEW_NODE_HEIGHT}
          onReady={handleTreeReady}
          model={model.treeModel}
        >
          {(props: INodeRendererProps) => {
            const inlineActions = model.getInlineMenuNodes((props.item as ExtensionTreeNode).contextValue);
            const actions = () => {
              return <TitleActionList
                className={styles.inlineMenu}
                context={[{treeViewId: model.treeViewId, treeItemId: (props.item as ExtensionTreeNode).treeItemId}]}
                nav={inlineActions}
              />;
            };
            return <TreeViewNode
              item={props.item}
              itemType={props.itemType}
              decorations={model.decorations.getDecorations(props.item as any)}
              onClick={handleItemClicked}
              onTwistierClick={handleTwistierClick}
              onContextMenu={handlerContextMenu}
              defaultLeftPadding={8}
              leftPadding={8}
              actions={actions}
            />;
          }}
        </RecycleTree>;
      } else {
        return <ExtensionLoadingView />;

      }

    } else {
      return <ExtensionLoadingView />;
    }
  };

  return <div className={styles.kt_extension_view} ref={wrapperRef}>
    {renderTreeView()}
  </div>;
});
