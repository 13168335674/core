import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { observer } from 'mobx-react-lite';
import { ViewState } from '@ali/ide-core-browser';
import { localize } from '@ali/ide-core-browser';
import { RecycleTree, IRecycleTreeHandle, INodeRendererWrapProps, TreeNodeType } from '@ali/ide-components';
import * as styles from './outline.module.less';
import { OutlineCompositeTreeNode, OutlineTreeNode } from './outline-node.define';
import { OutlineModelService } from './services/outline-model.service';
import { OUTLINE_TREE_NODE_HEIGHT, OutlineNode } from './outline-node';
import { OutlineTreeModel } from './services/outline-model';

export const OutlinePanel = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>) => {
  const [model, setModel] = React.useState<OutlineTreeModel>();

  const { width, height } = viewState;

  const wrapperRef: React.RefObject<HTMLDivElement> = React.createRef();

  const outlineModelService = useInjectable<OutlineModelService>(OutlineModelService);
  const { decorationService, commandService } = outlineModelService;

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    outlineModelService.handleTreeHandler({
      ...handle,
      getModel: () => outlineModelService.treeModel,
      hasDirectFocus: () => wrapperRef.current === document.activeElement,
    });
  };

  const handleItemClicked = (ev: React.MouseEvent, item: OutlineTreeNode | OutlineCompositeTreeNode, type: TreeNodeType) => {
    // 阻止点击事件冒泡
    ev.stopPropagation();

    const { handleItemClick } = outlineModelService;
    if (!item) {
      return;
    }
    handleItemClick(item, type);
  };

  const handleTwistierClicked = (ev: React.MouseEvent, item: OutlineTreeNode | OutlineCompositeTreeNode, type: TreeNodeType) => {
      // 阻止点击事件冒泡
      ev.stopPropagation();

      const { toggleDirectory } = outlineModelService;
      if (!item) {
        return;
      }
      toggleDirectory(item as OutlineCompositeTreeNode);
  };

  const handleOuterClick = (ev: React.MouseEvent) => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = outlineModelService;
    enactiveNodeDecoration();
  };

  React.useEffect(() => {
    outlineModelService.onDidUpdateTreeModel(async (model: OutlineTreeModel) => {
      if (model) {
        await outlineModelService.treeModel!.root.ensureLoaded();
      }
      setModel(model);
    });
  }, []);

  React.useEffect(() => {
    const handleBlur = () => {
      outlineModelService.handleTreeBlur();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);
    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      outlineModelService.handleTreeBlur();
    };
  }, [wrapperRef.current]);

  const renderContent = () => {
    if (!model) {
      return <span className={styles.outline_empty_text}>{localize('outline.noinfo')}</span>;
    } else {
      return <RecycleTree
        height={height}
        width={width}
        itemHeight={OUTLINE_TREE_NODE_HEIGHT}
        onReady={handleTreeReady}
        model={outlineModelService.treeModel}
        placeholder={() => {
          return <span className={styles.outline_empty_text}>{localize('outline.noinfo')}</span>;
        }}
      >
        {(props: INodeRendererWrapProps) => <OutlineNode
            item={props.item}
            itemType={props.itemType}
            decorationService={decorationService}
            commandService={commandService}
            decorations={outlineModelService.decorations.getDecorations(props.item as any)}
            onClick={handleItemClicked}
            onTwistierClick={handleTwistierClicked}
            defaultLeftPadding={8}
            leftPadding={8}
          />}
      </RecycleTree>;
    }
  };

  return <div
    className={styles.outline_container}
    tabIndex={-1}
    ref={wrapperRef}
    onClick={handleOuterClick}
  >
    { renderContent() }
  </div>;
});
