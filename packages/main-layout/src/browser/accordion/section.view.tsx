import * as React from 'react';
import * as cls from 'classnames';
import * as styles from './styles.module.less';
import { getIcon } from '@ali/ide-core-browser';
import { Layout, PanelContext } from '@ali/ide-core-browser/lib/components';
import { useInjectable, ViewUiStateManager } from '@ali/ide-core-browser';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { IMenu } from '@ali/ide-core-browser/lib/menu/next';

export interface CollapsePanelProps extends React.PropsWithChildren<any> {
  // panel 头部标题
  header: string;
  // 头部样式名
  headerClass?: string;
  // panel 点击事件监听
  onItemClick?: any;
  onContextMenuHandler: any;
  // 计算宽度时的优先级
  weight?: number;
  // 排序优先级
  priority?: number;
  // panel宽高
  size?: {
    width: number;
    height: number;
  };
  headerSize?: number;
  viewId: string;
  alignment?: Layout.alignment;
  index: number;
  initialProps?: any;
  noHeader?: boolean;
  titleMenu: IMenu;
}

export const AccordionSection = (
  {
    header,
    headerClass,
    onItemClick,
    noHeader,
    children,
    expanded,
    onResize,
    size,
    headerSize,
    viewId,
    index,
    alignment = 'vertical',
    initialProps,
    titleMenu,
    titleMenuContext,
    onContextMenuHandler,
  }: CollapsePanelProps,
) => {
  const viewStateManager = useInjectable<ViewUiStateManager>(ViewUiStateManager);
  const contentRef = React.useRef<HTMLDivElement | null>();
  React.useEffect(() => {
    if (contentRef.current) {
      const ResizeObserver = (window as any).ResizeObserver;
      let lastFrame: number | null;
      const resizeObserver = new ResizeObserver((entries) => {
        if (lastFrame) {
          window.cancelAnimationFrame(lastFrame);
        }
        lastFrame = window.requestAnimationFrame(() => {
          viewStateManager.updateSize(viewId, entries[0].contentRect.height, entries[0].contentRect.width);
        });
      });
      resizeObserver.observe(contentRef.current);
      return () => {
        resizeObserver.unobserve(contentRef.current);
      };
    }
  }, [contentRef]);

  const [headerFocused, setHeaderFocused] = React.useState(false);

  const { getSize, setSize } = React.useContext(PanelContext);

  const clickHandler = () => {
    const currentSize = getSize(false);
    onItemClick((targetSize) => setSize(targetSize, false), currentSize);
  };

  const attrs = {
    tabIndex: 0,
  };

  React.useEffect(() => {
    if (onResize) {
      onResize(size);
    }
  }, [size]);

  const headerFocusHandler = () => {
    setHeaderFocused(true);
  };

  const headerBlurHandler = () => {
    setHeaderFocused(false);
  };

  const viewState = viewStateManager.getState(viewId);

  const bodyStyle = {
    overflow : expanded ? 'auto' : 'hidden',
  } as React.CSSProperties;
  const Component: any = children;
  return  (
    <div className={ styles.kt_split_panel } >
      {!noHeader && <div
      onFocus={ headerFocusHandler }
      onBlur={ headerBlurHandler }
      {...attrs}
      className={ cls(styles.kt_split_panel_header, headerFocused ? styles.kt_panel_focused : '', headerClass)}
      onClick={clickHandler}
      onContextMenu={(e) => onContextMenuHandler(e, viewId)}
      style={{height: headerSize + 'px', lineHeight: headerSize + 'px'}}
      >
        <div className={styles.label_wrap}>
          <i className={cls(getIcon('arrow-down'), styles.arrow_icon, expanded ? '' : styles.kt_mod_collapsed)}></i>
          <div className={styles.section_label}>{header}</div>
        </div>
        {expanded && <div className={styles.actions_wrap}>
          <InlineActionBar menus={titleMenu} context={titleMenuContext} />
        </div>}
      </div>}
      <div
        className={ cls([styles.kt_split_panel_body, {[styles.hide]: !expanded}]) }
        style={ bodyStyle }
        ref={(ele) =>  contentRef.current = ele}
      >
        <Component {...initialProps} viewState={viewState} />
      </div>
    </div>
  );
};
