import * as React from 'react';
import * as clsx from 'classnames';
import * as styles from './styles.module.less';
import { ComponentRegistryInfo, useInjectable, ComponentRenderer, ConfigProvider, AppConfig, View } from '@ali/ide-core-browser';
import { TabbarService, TabbarServiceFactory } from './tabbar.service';
import { observer } from 'mobx-react-lite';
import { AccordionManager } from '@ali/ide-core-browser/lib/layout/accordion/accordion.manager';
import { Widget } from '@phosphor/widgets';
import { TabbarConfig } from './renderer.view';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { ActivityPanelToolbar } from '@ali/ide-core-browser/lib/layout/view-container-toolbar';
import { AccordionContainer } from '../accordion/accordion.view';
import { AccordionServiceFactory, AccordionService } from '../accordion/accordion.service';

export const BaseTabPanelView: React.FC<{
  PanelView: React.FC<{ component: ComponentRegistryInfo, side: string }>;
}> = observer(({ PanelView }) => {
  const { side } = React.useContext(TabbarConfig);
  const tabbarService: TabbarService = useInjectable(TabbarServiceFactory)(side);
  const { currentContainerId } = tabbarService;
  const panelVisible = { zIndex: 1, display: 'block' };
  const panelInVisible = { zIndex: -1, display: 'none' };
  const components: ComponentRegistryInfo[] = [];
  tabbarService.containersMap.forEach((component) => {
    components.push(component);
  });
  return (
    <div className='tab-panel'>
      {components.map((component) => {
        const containerId = component.options!.containerId;
        return <div key={containerId} className={clsx(styles.panel_wrap)} style={currentContainerId === containerId ? panelVisible : panelInVisible}>
          <PanelView side={side} component={component} />
        </div>;
      })}
    </div>
  );
});

const ContainerView: React.FC<{
  component: ComponentRegistryInfo;
  side: string;
}> = (({ component, side }) => {
  const ref = React.useRef<HTMLElement | null>();
  const titleRef = React.useRef<HTMLElement | null>();
  const configContext = useInjectable<AppConfig>(AppConfig);
  const { containerId, title, titleComponent, component: CustomComponent } = component.options!;
  const accordionService: AccordionService = useInjectable(AccordionServiceFactory)(containerId);
  const injector = useInjectable<Injector>(INJECTOR_TOKEN);
  React.useEffect(() => {
    if (!CustomComponent && ref.current) {
      for (const view of component.views) {
        accordionService.appendView(view);
      }
    }
  }, [ref]);
  React.useEffect(() => {
    if (!CustomComponent && titleRef.current) {
      const titleBar = injector.get(ActivityPanelToolbar, [side as any, containerId]);
      Widget.attach(titleBar, titleRef.current);
      titleBar.toolbarTitle = title || '';
    }
  }, [titleRef]);
  return (
    <div className={styles.view_container}>
      <div className={styles.panel_titlebar}>
        <div className={styles.title_wrap} ref={(ele) => titleRef.current = ele}></div>
        {titleComponent && <div className={styles.panel_component}>
          <ConfigProvider value={configContext} >
            <ComponentRenderer Component={titleComponent} />
          </ConfigProvider>
        </div>}
      </div>
      <div className={styles.container_wrap} ref={(ele) => ref.current = ele}>
        {CustomComponent ? <ConfigProvider value={configContext} >
          <ComponentRenderer Component={CustomComponent} />
        </ConfigProvider> : <AccordionContainer state={accordionService.state} views={accordionService.views} containerId={component.options!.containerId} />}
      </div>
    </div>
  );
});

const PanelView: React.FC<{
  component: ComponentRegistryInfo;
  side: string;
}> = (({ component, side }) => {
  // TODO 底部支持多个view
  return (
    <div className={styles.panel_container}>
      <ComponentRenderer Component={component.views[0].component!} />
    </div>
  );
});

export const RightTabPanelRenderer: React.FC = () => <BaseTabPanelView PanelView={ContainerView} />;

export const LeftTabPanelRenderer: React.FC = () => <BaseTabPanelView PanelView={ContainerView} />;

export const BottomTabPanelRenderer: React.FC = () => <BaseTabPanelView PanelView={PanelView} />;
