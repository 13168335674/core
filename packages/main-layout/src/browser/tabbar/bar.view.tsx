import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { Layout } from '@ali/ide-core-browser/lib/components/layout/layout';
import { ComponentRegistryInfo, useInjectable, ConfigProvider, ComponentRenderer, AppConfig, TabBarToolbar } from '@ali/ide-core-browser';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';
import { observer } from 'mobx-react-lite';
import { PanelContext } from '@ali/ide-core-browser/lib/components/layout/split-panel';
import { INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { TabbarConfig } from './renderer.view';
import { Widget } from '@phosphor/widgets';
import { getIcon } from '@ali/ide-core-browser';
import { IMainLayoutService } from '../../common';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { AccordionService, AccordionServiceFactory } from '../accordion/accordion.service';

export const TabbarViewBase: React.FC<{
  TabView: React.FC<{component: ComponentRegistryInfo}>,
  forbidCollapse?: boolean;
  hasToolBar?: boolean;
  barSize?: number;
}> = observer(({ TabView, forbidCollapse, hasToolBar, barSize = 50 }) => {
  const { setSize, getSize } = React.useContext(PanelContext);
  const { side, direction } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  React.useEffect(() => {
    tabbarService.registerResizeHandle(setSize, getSize, barSize);
  }, []);
  const { currentContainerId, handleTabClick } = tabbarService;
  const components: ComponentRegistryInfo[] = [];
  const configContext = useInjectable<AppConfig>(AppConfig);
  const injector = useInjectable<Injector>(INJECTOR_TOKEN);
  tabbarService.containersMap.forEach((component) => {
    components.push(component);
  });
  const currentComponent = tabbarService.getContainer(currentContainerId)!;
  const titleComponent = currentComponent && currentComponent.options && currentComponent.options.titleComponent;
  return (
    <div className='tab-bar'>
      <div className={styles.bar_content} style={{flexDirection: Layout.getTabbarDirection(direction)}}>
        {components.map((component) => {
          const containerId = component.options!.containerId;
          return (
            <li
              key={containerId}
              id={containerId}
              onClick={(e) => handleTabClick(e, forbidCollapse)}
              className={clsx({active: currentContainerId === containerId})}>
              <TabView component={component} />
            </li>
          );
        })}
      </div>
      {hasToolBar && titleComponent && <div className={styles.toolbar_container}>
        <ConfigProvider value={configContext} >
          <ComponentRenderer Component={titleComponent} />
        </ConfigProvider>
      </div>}
    </div>
  );
});

const IconTabView: React.FC<{component: ComponentRegistryInfo}> = (({ component }) => {
  return <div className='icon-tab'>
    <div className={clsx(component.options!.iconClass, 'activity-icon')} title={component.options!.title}></div>
    {component.options!.badge && <div className='tab-badge'>{component.options!.badge}</div>}
  </div>;
});

const TextTabView: React.FC<{component: ComponentRegistryInfo}> = (({ component }) => {
  return <div className={styles.text_tab}>
    <div className={styles.bottom_tab_title}>{component.options!.title}</div>
    {component.options!.badge && <div className='tab-badge'>{component.options!.badge}</div>}
  </div>;
});

export const RightTabbarRenderer: React.FC = () => <TabbarViewBase TabView={IconTabView} barSize={50} />;

export const LeftTabbarRenderer: React.FC = () => {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  return (<div className='left-tab-bar'>
    <TabbarViewBase TabView={IconTabView} barSize={50} />
    <div className='bottom-icon-container' onClick={layoutService.handleSetting}>
      <i className={`activity-icon ${getIcon('setting')}`}></i>
    </div>
  </div>);
};

export const BottomTabbarRenderer: React.FC = observer(() => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const { currentContainerId } = tabbarService;
  const accordionService: AccordionService = useInjectable(AccordionServiceFactory)(currentContainerId);
  const titleMenu = currentContainerId ? accordionService.getSectionToolbarMenu(currentContainerId) : null;
  return (
    <div className={styles.bottom_bar_container}>
      <TabbarViewBase hasToolBar={true} forbidCollapse={true} TabView={TextTabView} barSize={0} />
      <div className='toolbar_container'>
        {titleMenu && <InlineActionBar
          menus={titleMenu}
          seperator='navigation' />}
      </div>
    </div>
  );
});
