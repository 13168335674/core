import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './file-tree-node.module.less';
import { TreeNode, CompositeTreeNode, INodeRendererProps, ClasslistComposite, PromptHandle, TreeNodeType, RenamePromptHandle, NewPromptHandle } from '@ali/ide-components';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { getIcon, URI } from '@ali/ide-core-browser';
import { Directory, File } from './file-tree-nodes';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';
import { DragAndDropService } from './services/file-tree-dnd.service';
import { Loading } from '@ali/ide-core-browser/lib/components/loading';
import { Path } from '@ali/ide-core-common/lib/path';

export interface IFileTreeNodeProps {
  item: any;
  defaultLeftPadding?: number;
  leftPadding?: number;
  decorationService: FileTreeDecorationService;
  labelService: LabelService;
  decorations?: ClasslistComposite;
  dndService: DragAndDropService;
  onTwistierClick?: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType) => void;
  onClick: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType, activeUri?: URI) => void;
  onContextMenu: (ev: React.MouseEvent, item: TreeNode | CompositeTreeNode, type: TreeNodeType, activeUri?: URI) => void;
  template?: React.JSXElementConstructor<any>;
  // 是否为纯净模式，纯净模式下文件图标会与父目录小箭头对齐
  hasFolderIcons?: boolean;
}

export type FileTreeNodeRenderedProps = IFileTreeNodeProps & INodeRendererProps;

export const FileTreeNode: React.FC<FileTreeNodeRenderedProps> = ({
  item,
  onClick,
  onContextMenu,
  dndService,
  itemType,
  decorationService,
  labelService,
  leftPadding = 8,
  onTwistierClick,
  decorations,
  defaultLeftPadding = 8,
  template: Template,
  hasFolderIcons,
}: FileTreeNodeRenderedProps) => {
  const [activeIndex, setActiveIndex] = React.useState<number>();

  const isRenamePrompt = itemType === TreeNodeType.RenamePrompt;
  const isNewPrompt = itemType === TreeNodeType.NewPrompt;
  const isPrompt = isRenamePrompt || isNewPrompt;
  const isCompactName = !isPrompt && item.name.indexOf(Path.separator) >= 0;

  const decoration = isPrompt ? null : decorationService.getDecoration(item.uri, Directory.is(item));

  React.useEffect(() => {
    if (isCompactName) {
      setActiveIndex(item.name.split(Path.separator).length - 1);
    }
  }, [item]);
  const handleClick = (ev: React.MouseEvent) => {
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      if (isCompactName) {
        setActiveIndex(item.name.split(Path.separator).length - 1);
      }
      onClick(ev, item as File, itemType);
    }
  };

  const handlerTwistierClick = (ev: React.MouseEvent) => {
    if (itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      if (onTwistierClick) {
        onTwistierClick(ev, item as File, itemType);
      } else {
        onClick(ev, item as File, itemType);
      }
    }
  };

  const handleContextMenu = (ev: React.MouseEvent) => {
    if (ev.nativeEvent.which === 0) {
        return;
    }
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      onContextMenu(ev, item as TreeNode, itemType);
    }
  };

  const handleDragStart = (ev: React.DragEvent) => {
    const { handleDragStart } = dndService;
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragStart(ev, item);
    }
  };

  const handleDragEnd = (ev: React.DragEvent) => {
    const { handleDragEnd } = dndService;
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragEnd(ev, item);
    }
  };

  const handleDragLeave = (ev: React.DragEvent) => {
    const { handleDragLeave } = dndService;

    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragLeave(ev, item);
    }
  };

  const handleDragEnter = (ev: React.DragEvent) => {
    const { handleDragEnter } = dndService;
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragEnter(ev, item);
    }
  };

  const handleDrop = (ev: React.DragEvent) => {
    const { handleDrop } = dndService;

    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDrop(ev, item);
    }
  };

  const handleDragOver = (ev: React.DragEvent) => {
    const { handleDragOver } = dndService;
    if (itemType ===  TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode) {
      handleDragOver(ev, item);
    }
  };

  let isDirectory = itemType === TreeNodeType.CompositeTreeNode;
  let paddingLeft;
  if (isPrompt) {
    if (isNewPrompt) {
      isDirectory = (item as NewPromptHandle).type === TreeNodeType.CompositeTreeNode;
      paddingLeft = `${defaultLeftPadding + ((item as NewPromptHandle).parent.depth + 1 || 0) * (leftPadding || 0) + (isDirectory ? 0 : hasFolderIcons ? 20 : 0 )}px`;
    } else {
      isDirectory = (item as RenamePromptHandle).target.type === TreeNodeType.CompositeTreeNode;
      paddingLeft = `${defaultLeftPadding + ((item as RenamePromptHandle).target.depth || 0) * (leftPadding || 0) + (isDirectory ? 0 : hasFolderIcons ? 20 : 0 )}px`;
    }
  } else {
    paddingLeft = `${defaultLeftPadding + (item.depth || 0) * (leftPadding || 0) + (isDirectory ? 0 : hasFolderIcons ? 20 : 0 )}px`;
  }
  const fileTreeNodeStyle = {
    color: decoration ? decoration.color : '',
    height: FILE_TREE_NODE_HEIGHT,
    lineHeight: `${FILE_TREE_NODE_HEIGHT}px`,
    paddingLeft,
  } as React.CSSProperties;

  const renderFolderToggle = (node: Directory | PromptHandle, clickHandler: any) => {
    if (decorations && decorations?.classlist.indexOf(styles.mod_loading) > -1) {
      return <Loading />;
    }
    if (isPrompt && node instanceof PromptHandle) {
      let isDirectory: boolean = false;
      if (isRenamePrompt) {
        isDirectory = ((node as RenamePromptHandle).target).type === TreeNodeType.CompositeTreeNode;
      } else {
        isDirectory = (node as NewPromptHandle).type === TreeNodeType.CompositeTreeNode;
      }
      if (isDirectory) {
        return <div
          className={cls(
            styles.file_tree_node_segment,
            styles.expansion_toggle,
            getIcon('arrow-right'),
            { [`${styles.mod_collapsed}`]:
              isNewPrompt || !(isRenamePrompt &&
              ((node as RenamePromptHandle).target).type === TreeNodeType.CompositeTreeNode &&
              ((node as RenamePromptHandle).target as Directory).expanded)},
          )}
        />;
      }
    } else {
      return <div
        onClick={clickHandler}
        className={cls(
          styles.file_tree_node_segment,
          styles.expansion_toggle,
          getIcon('arrow-right'),
          { [`${styles.mod_collapsed}`]: !(node as Directory).expanded },
        )}
      />;
    }

  };

  const renderIcon = (node: Directory | File) => {
    let nodeUri: URI;
    let isDirectory: boolean;
    if (isPrompt && node instanceof PromptHandle) {
      if (node instanceof RenamePromptHandle) {
        nodeUri = ((node as RenamePromptHandle).target! as (File | Directory)).uri.resolve(node.$.value);
        isDirectory = Directory.is((node as RenamePromptHandle).target);
      } else {
        nodeUri = (node.parent! as Directory).uri.resolve(node.$.value);
        isDirectory = node.type === TreeNodeType.CompositeTreeNode;
      }
    } else {
      nodeUri = node.uri;
      isDirectory = node.filestat.isDirectory;
    }
    const iconClass = labelService.getIcon(nodeUri, {isDirectory, isOpenedDirectory: isDirectory && (node as Directory).expanded});
    if (isDirectory && !hasFolderIcons) {
      return null;
    }
    return <div className={cls(styles.file_icon, iconClass, {expanded: isDirectory && (node as Directory).expanded})} style={{ height: FILE_TREE_NODE_HEIGHT, lineHeight: `${FILE_TREE_NODE_HEIGHT}px`}}>
    </div>;
  };

  const renderDisplayName = (node: Directory | File) => {
    if (Template) {
      return <Template />;
    }
    if (isPrompt && node instanceof PromptHandle) {
      return <div
          className={cls(styles.file_tree_node_segment, styles.file_tree_node_inputbox)}
        >
          <div className={cls('input-box', styles.file_tree_node_prompt_box)}>
            <node.ProxiedInput  wrapperStyle={{height: FILE_TREE_NODE_HEIGHT, padding: '0 5px'}}/>
          </div>
        </div>;
    }
    if (isCompactName) {
      const paths = node.name.split(Path.separator);
      const nameBlock = paths.map((path, index) => {
        const localPath = paths.slice(0, index + 1).join(Path.separator);
        const clickHandler = (event: React.MouseEvent) => {
          event.stopPropagation();
          setActiveIndex(index);
          const activeUri: URI = item.parent.uri.resolve(paths.slice(0, index + 1).join(Path.separator));
          onClick(event, item as File, itemType, activeUri!);
        };
        const contextMenuHandler = (event: React.MouseEvent) => {
          event.stopPropagation();
          setActiveIndex(index);
          const activeUri: URI = item.parent.uri.resolve(paths.slice(0, index + 1).join(Path.separator));
          onContextMenu(event, item as File, itemType, activeUri!);
        };
        return <span key={localPath}>
          <a className={cls(activeIndex === index && styles.active, styles.compact_name)} onContextMenu={contextMenuHandler} onClick={clickHandler}>{path}</a>
          {
            index !== paths.length - 1 ? <span className={styles.compact_name_separator}>{Path.separator}</span> : null
          }
        </span>;
      });

      return <div
        className={cls(styles.file_tree_node_segment, styles.file_tree_node_displayname)}
      >
        {nameBlock}
      </div>;
    }
    return <div
        className={cls(styles.file_tree_node_segment, styles.file_tree_node_displayname)}
      >
        { labelService.getName(node.uri) || node.name }
      </div>;
  };

  const renderStatusTail = () => {
    return <div className={cls(styles.file_tree_node_segment, styles.file_tree_node_tail)}>
      {renderBadge()}
    </div>;
  };

  const renderBadge = () => {
    if (!decoration) {
      return null;
    }
    return <div className={styles.file_tree_node_status}>
      {decoration.badge.slice()}
    </div>;
  };

  const renderTwice = (item) => {
    if (isDirectory) {
      return renderFolderToggle(item, handlerTwistierClick);
    } else if (isPrompt) {
      return renderFolderToggle(item, () => {});
    }
  };

  const getItemTooltip = () => {
    let tooltip = item.tooltip;
    if (decoration && decoration.badge) {
      tooltip += ` • ${decoration.tooltip}`;
    }
    return tooltip;
  };

  return (
    <div
        key={item.id}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title={getItemTooltip()}
        className={cls(
          styles.file_tree_node,
          decorations ? decorations.classlist : null,
        )}
        style={fileTreeNodeStyle}
        draggable={itemType === TreeNodeType.TreeNode || itemType === TreeNodeType.CompositeTreeNode}
        data-id={item.id}
      >
        <div className={cls(styles.file_tree_node_content)}>
          {renderTwice(item)}
          {renderIcon(item)}
          <div
            className={isPrompt ? styles.file_tree_node_prompt_wrap : styles.file_tree_node_overflow_wrap}
          >
            {renderDisplayName(item)}
          </div>
          {renderStatusTail()}
        </div>
      </div>
  );
};

export const FILE_TREE_NODE_HEIGHT = 22;
export const FILE_TREE_BADGE_LIMIT = 99;
