import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { Badge } from '@ali/ide-components';
import { ComponentRegistryInfo, useInjectable } from '@ali/ide-core-browser';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';
import { observer } from 'mobx-react-lite';
import { TabbarConfig } from './renderer.view';
import { getIcon } from '@ali/ide-core-browser';
import { IMainLayoutService } from '../../common';
import { InlineMenuBar } from '@ali/ide-core-browser/lib/components/actions';

function splitVisibleTabs(containers: ComponentRegistryInfo[], tabSize: number, availableSize: number) {
  const visibleCount = Math.floor(availableSize / tabSize);
  if (visibleCount >= containers.length) {
    return [containers, []];
  }
  if (visibleCount <= 1) {
    return [[], containers];
  }
  return [containers.slice(0, visibleCount - 1), containers.slice(visibleCount - 1)];
}

export const TabbarViewBase: React.FC<{
  TabView: React.FC<{component: ComponentRegistryInfo}>,
  forbidCollapse?: boolean;
  // tabbar的尺寸（横向为宽，纵向高），tab折叠后为改尺寸加上panelBorderSize
  barSize?: number;
  // 包含tab的内外边距的总尺寸，用于控制溢出隐藏逻辑
  tabSize: number;
  MoreTabView: React.FC,
  panelBorderSize?: number;
  tabClassName?: string;
  className?: string;
  // tab上预留的位置，用来控制tab过多的显示效果
  margin?: number;
}> = observer(({ TabView, MoreTabView, forbidCollapse, barSize = 48, panelBorderSize = 0, tabClassName, className, margin, tabSize }) => {
  const { side, direction, fullSize } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  React.useEffect(() => {
    // 内部只关注总的宽度
    tabbarService.barSize = barSize + panelBorderSize;
  }, []);
  const { currentContainerId, handleTabClick } = tabbarService;
  const [visibleContainers, hideContainers] = splitVisibleTabs(tabbarService.visibleContainers, tabSize, fullSize - (margin || 0));
  hideContainers.forEach((componentInfo) => {
    tabbarService.updateTabInMoreKey(componentInfo.options!.containerId, true);
  });

  return (
    <div className={clsx([styles.tab_bar, className])}>
      <div className={styles.bar_content} style={{flexDirection: Layout.getTabbarDirection(direction)}}>
        {visibleContainers.map((component) => {
          const containerId = component.options!.containerId;
          tabbarService.updateTabInMoreKey(containerId, false);
          let ref: HTMLLIElement | null;
          return (
            <li
              draggable={true}
              onDragStart={(e) => {
                if (ref) {
                  const dragImage = ref.cloneNode(true) as HTMLLIElement;
                  dragImage.classList.add(styles.dragging);
                  if (tabClassName) {
                    dragImage.classList.add(tabClassName);
                  }
                  document.body.appendChild(dragImage);
                  e.dataTransfer.setDragImage(dragImage, 0, 0);
                  setTimeout(() => document.body.removeChild(dragImage), 0);
                }
                tabbarService.handleDragStart(e, containerId);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (ref) {
                  ref.classList.add('on-drag-over');
                }
              }}
              onDragLeave={() => {
                if (ref) {
                  ref.classList.remove('on-drag-over');
                }
              }}
              onDrop={(e) => {
                if (ref) {
                  ref.classList.remove('on-drag-over');
                }
                tabbarService.handleDrop(e, containerId);
              }}
              key={containerId}
              id={containerId}
              onContextMenu={(e) => tabbarService.handleContextMenu(e, containerId)}
              onClick={(e) => handleTabClick(e, forbidCollapse)}
              ref={(el) => ref = el}
              className={clsx({active: currentContainerId === containerId}, tabClassName)}>
              <TabView component={component} />
            </li>
          );
        })}
        {
          hideContainers.length ? <li
            key='tab-more'
            onClick={(e) => tabbarService.showMoreMenu(e, visibleContainers[visibleContainers.length - 1] && visibleContainers[visibleContainers.length - 1].options!.containerId)}
            className={tabClassName}>
            <MoreTabView />
          </li> : null
        }
      </div>
    </div>
  );
});

export const IconTabView: React.FC<{component: ComponentRegistryInfo}> = observer(({ component }) => {
  return <div className={styles.icon_tab}>
    <div className={clsx(component.options!.iconClass, 'activity-icon')} title={component.options!.title}></div>
    {component.options!.badge && <Badge className={styles.tab_badge}>{component.options!.badge}</Badge>}
  </div>;
});

export const TextTabView: React.FC<{component: ComponentRegistryInfo}> = observer(({ component }) => {
  return <div className={styles.text_tab}>
    <div className={styles.bottom_tab_title}>{component.options!.title}</div>
    {component.options!.badge && <Badge className={styles.tab_badge}>{component.options!.badge}</Badge>}
  </div>;
});

export const IconElipses: React.FC = () => {
  return <div className={styles.icon_tab}>
    {/* i18n */}
    <div className={clsx(getIcon('ellipsis'), 'activity-icon')} title='extra tabs'></div>
  </div>;
};

export const TextElipses: React.FC = () => {
  return <div className={styles.text_tab}>
    <div className={styles.bottom_tab_title}><i className={getIcon('doubleright')}></i></div>
  </div>;
};

export const RightTabbarRenderer: React.FC = () => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  return (<div className={styles.right_tab_bar} onContextMenu={tabbarService.handleContextMenu}>
    <TabbarViewBase
      tabSize={44}
      MoreTabView={IconElipses}
      tabClassName={styles.kt_right_tab}
      TabView={IconTabView}
      barSize={40}
      panelBorderSize={1}/>
  </div>);
};

export const LeftTabbarRenderer: React.FC = () => {
  const { side } = React.useContext(TabbarConfig);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  return (<div className={styles.left_tab_bar} onContextMenu={tabbarService.handleContextMenu}>
    <TabbarViewBase
      tabSize={48}
      MoreTabView={IconElipses}
      className={styles.left_tab_content}
      tabClassName={styles.kt_left_tab}
      TabView={IconTabView}
      barSize={48}
      // FIXME
      margin={90}
      panelBorderSize={1}/>
    <InlineMenuBar className={styles.vertical_icons} menus={layoutService.getExtraMenu()} />
  </div>);
};

// @deprecated
export const BottomTabbarRenderer: React.FC = () => {
  return (
    <div className={styles.bottom_bar_container}>
      <TabbarViewBase
        tabSize={40}
        MoreTabView={TextElipses}
        forbidCollapse={true}
        TabView={TextTabView}
        barSize={0} />
    </div>
  );
};

export const NextBottomTabbarRenderer: React.FC = () => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  return (
    <div onContextMenu={tabbarService.handleContextMenu} className={clsx(styles.bottom_bar_container, 'next_bottom_bar')}>
      <TabbarViewBase
        // TODO: 暂时通过预估值来计算是否超出可视范围，实际上需要通过dom尺寸的计算
        tabSize={80}
        MoreTabView={TextElipses}
        tabClassName={styles.kt_bottom_tab}
        TabView={TextTabView}
        barSize={28}
        panelBorderSize={1} />
    </div>
  );
};
