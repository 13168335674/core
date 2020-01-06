import * as React from 'react';
import { RecycleTree, ValidateMessage } from '@ali/ide-core-browser/lib/components';
import { IFileTreeItem } from '../common';
import * as cls from 'classnames';
import * as styles from './index.module.less';
import { MenuPath, Event, FileDecorationsProvider, ThemeProvider } from '@ali/ide-core-common';
import { IFileTreeServiceProps } from './file-tree.service';
import { useDebounce } from '@ali/ide-core-browser/lib/utils';
import { Directory, File } from './file-tree-item';

export interface IFileTreeItemRendered extends IFileTreeItem {
  selected?: boolean;
  expanded?: boolean;
  focused?: boolean;
}
export interface FileTreeProps extends IFileTreeServiceProps {
  width?: number;
  height?: number;
  treeNodeHeight?: number;
  position?: {
    y?: number | undefined,
    x?: number | undefined,
  };
  files: IFileTreeItem[];
  draggable: boolean;
  editable: boolean;
  multiSelectable: boolean;
  // 是否可搜索
  searchable?: boolean;
  // 搜索文本
  search?: string;
  /**
 * 文件装饰器函数
 */
  fileDecorationProvider?: FileDecorationsProvider;
  /**
   * 主题颜色函数
   */
  themeProvider?: ThemeProvider;
  /**
   * 文件装饰器变化事件
   */
  notifyFileDecorationsChange?: Event<FileDecorationsProvider>;

  /**
   * 主题颜色变化事件
   */
  notifyThemeChange?: Event<ThemeProvider>;
  /**
   * 编辑校验函数
  */
  validate?: (item: Directory | File, value: string ) => ValidateMessage | null;
  /**
   * 文件树缩进
   */
  leftPadding?: number;
  /**
   * 文件树基础缩进
   */
  defaultLeftPadding?: number;
}

export const CONTEXT_MENU: MenuPath = ['filetree-context-menu'];

export const FileTree = ({
  width,
  height,
  treeNodeHeight,
  files,
  position,
  draggable,
  editable,
  multiSelectable,
  onSelect,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onBlur,
  onFocus,
  onChange,
  onContextMenu,
  searchable,
  search,
  fileDecorationProvider,
  themeProvider,
  notifyFileDecorationsChange,
  notifyThemeChange,
  onTwistieClick,
  validate,
  leftPadding,
  defaultLeftPadding,
}: FileTreeProps) => {
  const FILETREE_LINE_HEIGHT = treeNodeHeight || 22;
  const fileTreeRef = React.createRef<HTMLDivElement>();
  const containerHeight = height && height > 0 ? height : (fileTreeRef.current && fileTreeRef.current.clientHeight) || 0;
  const [scrollTop, setScrollTop] = React.useState(0);
  const [cacheScrollTop, setCacheScrollTop] = React.useState(0);
  const shouldShowNumbers = containerHeight && Math.ceil(containerHeight / FILETREE_LINE_HEIGHT) || 0;
  const preRenderNumber = shouldShowNumbers;
  const debouncedPostion = useDebounce(position, 200);

  const nodes = React.useMemo(() => {
    return files;
  }, [files]);
  const FileTreeStyle = {
    position: 'absolute',
    overflow: 'hidden',
    top: 0,
    bottom: 0,
    left: 0,
    width,
    height,
  } as React.CSSProperties;

  const scrollContainerStyle = {
    width: '100%',
    height: containerHeight,
  };

  React.useEffect(() => {
    if (position && typeof position.y === 'number') {
      const locationIndex = position.y;
      let newRenderStart;
      let scrollTop;
      // 当需要更新的数量为0时，直接返回
      if (!shouldShowNumbers) {
        return;
      }
      // 保证定位元素在滚动区域正中或可视区域
      // location 功能下对应的Preload节点上下节点数为preRenderNumber/2
      if (locationIndex + Math.ceil(shouldShowNumbers / 2) <= files.length) {
        newRenderStart = locationIndex - Math.ceil((shouldShowNumbers + preRenderNumber) / 2);
        scrollTop = (newRenderStart + preRenderNumber / 2) * FILETREE_LINE_HEIGHT;
      } else {
        // 避免极端情况下，如定位节点为一个满屏列表的最后一个时，上面部分渲染不完整情况
        if (shouldShowNumbers >= files.length) {
          scrollTop = 0;
        } else {
          scrollTop = (files.length - shouldShowNumbers) * FILETREE_LINE_HEIGHT;
        }
      }
      if (newRenderStart < 0) {
        newRenderStart = 0;
        scrollTop = 0;
      }
      if (cacheScrollTop === scrollTop) {
        // 防止滚动条不同步
        scrollTop += .1;
      }
      setScrollTop(scrollTop);
      setCacheScrollTop(scrollTop);
    }
  }, [debouncedPostion]);

  const fileTreeAttrs = {
    ref: fileTreeRef,
  };

  return (
    <div className={cls(styles.filetree)} style={FileTreeStyle}>
      <div className={styles.filetree_container} {...fileTreeAttrs} >
        <RecycleTree
          nodes={nodes}
          scrollTop={scrollTop}
          scrollContainerStyle={scrollContainerStyle}
          containerHeight={containerHeight}
          onSelect={onSelect}
          onBlur={onBlur}
          onFocus={onFocus}
          onTwistieClick={onTwistieClick}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onChange={onChange}
          onDrop={onDrop}
          onContextMenu={onContextMenu}
          contentNumber={shouldShowNumbers}
          prerenderNumber={preRenderNumber}
          itemLineHeight={FILETREE_LINE_HEIGHT}
          multiSelectable={multiSelectable}
          draggable={draggable}
          editable={editable}
          searchable={searchable}
          search={search}
          fileDecorationProvider={fileDecorationProvider}
          themeProvider={themeProvider}
          notifyFileDecorationsChange={notifyFileDecorationsChange}
          notifyThemeChange={notifyThemeChange}
          validate={validate}
          leftPadding={leftPadding}
          defaultLeftPadding={defaultLeftPadding}
        ></RecycleTree>
      </div>
    </div>
  );
};
