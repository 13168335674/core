import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WithEventBus, View, ViewContainerOptions, ContributionProvider, SlotLocation, IContextKeyService, ExtensionActivateEvent, AppConfig, ComponentRegistry, Logger } from '@ali/ide-core-browser';
import { MainLayoutContribution, IMainLayoutService } from '../common';
import { TabBarHandler } from './tabbar-handler';
import { TabbarService } from './tabbar/tabbar.service';
import { IMenuRegistry, AbstractContextMenuService, MenuId, AbstractMenuService, IContextMenu } from '@ali/ide-core-browser/lib/menu/next';
import { LayoutState, LAYOUT_STATE } from '@ali/ide-core-browser/lib/layout/layout-state';
import { AccordionService } from './accordion/accordion.service';
import debounce = require('lodash.debounce');
import { Deferred } from '@ali/ide-core-common/lib';

@Injectable()
export class LayoutService extends WithEventBus implements IMainLayoutService {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(MainLayoutContribution)
  private readonly contributions: ContributionProvider<MainLayoutContribution>;

  @Autowired(IMenuRegistry)
  menus: IMenuRegistry;

  @Autowired()
  private layoutState: LayoutState;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(ComponentRegistry)
  private componentRegistry: ComponentRegistry;

  @Autowired(Logger)
  private logger: Logger;

  private handleMap: Map<string, TabBarHandler> = new Map();

  private services: Map<string, TabbarService> = new Map();

  private accordionServices: Map<string, AccordionService> = new Map();

  private pendingViewsMap: Map<string, {view: View, props?: any}[]> = new Map();

  private viewToContainerMap: Map<string, string> = new Map();

  private state: {[location: string]: {
    currentId?: string;
    size?: number;
  }} = {};

  private customViews = new Map<string, View>();

  @Autowired(AbstractMenuService)
  protected menuService: AbstractMenuService;

  @Autowired(AbstractContextMenuService)
  protected contextmenuService: AbstractContextMenuService;

  public viewReady: Deferred<void> = new Deferred();

  constructor() {
    super();
  }

  didMount() {
    for (const [containerId, views] of this.pendingViewsMap.entries()) {
      views.forEach(({view, props}) => {
        this.collectViewComponent(view, containerId, props);
      });
    }
    for (const contribution of this.contributions.getContributions()) {
      if (contribution.onDidRender) {
        contribution.onDidRender();
      }
    }
    this.restoreState();
    this.viewReady.resolve();
  }

  setFloatSize(size: number) {}

  storeState(service: TabbarService, currentId: string) {
    this.state[service.location] = {
      currentId,
      size: service.prevSize,
    };
    this.layoutState.setState(LAYOUT_STATE.MAIN, this.state);
  }

  restoreState() {
    this.state = this.layoutState.getState(LAYOUT_STATE.MAIN, {
      [SlotLocation.left]: {
        currentId: undefined,
        size: undefined,
      },
      [SlotLocation.right]: {
        currentId: '',
        size: undefined,
      },
      [SlotLocation.bottom]: {
        currentId: undefined,
        size: undefined,
      },
    });
    for (const service of this.services.values()) {
      const {currentId, size} = this.state[service.location] || {};
      service.prevSize = size;
      let defaultContainer = service.visibleContainers[0] && service.visibleContainers[0].options!.containerId;
      const defaultPanels = this.appConfig.defaultPanels;
      const restorePanel = defaultPanels && defaultPanels[service.location];
      if (defaultPanels && restorePanel !== undefined) {
        if (restorePanel) {
          if (service.containersMap.has(restorePanel)) {
            defaultContainer = restorePanel;
          } else {
            const componentInfo = this.componentRegistry.getComponentRegistryInfo(restorePanel);
            if (componentInfo && this.appConfig.layoutConfig[service.location]?.modules && ~this.appConfig.layoutConfig[service.location].modules.indexOf(restorePanel)) {
              defaultContainer = componentInfo.options!.containerId;
            } else {
              this.logger.warn(`[defaultPanels] 没有找到${restorePanel}对应的视图!`);
            }
          }
        } else {
          defaultContainer = '';
        }
      }
      if (currentId === undefined) {
        service.currentContainerId = defaultContainer;
      } else {
        service.currentContainerId = currentId ? (service.containersMap.has(currentId) ? currentId : defaultContainer) : '';
      }
    }
  }

  isVisible(location: string) {
    const tabbarService = this.getTabbarService(location);
    return !!tabbarService.currentContainerId;
  }

  toggleSlot(location: string, show?: boolean | undefined, size?: number | undefined): void {
    const tabbarService = this.getTabbarService(location);
    if (!tabbarService) {
      // tslint:disable-next-line no-console
      console.error(`没有找到${location}对应位置的TabbarService，无法切换面板`);
      return;
    }
    if (show === true) {
      tabbarService.currentContainerId = tabbarService.currentContainerId || tabbarService.previousContainerId || tabbarService.containersMap.keys().next().value;
    } else if (show === false) {
      tabbarService.currentContainerId = '';
    } else {
      tabbarService.currentContainerId = tabbarService.currentContainerId ? '' : tabbarService.previousContainerId || tabbarService.containersMap.keys().next().value;
    }
    if (tabbarService.currentContainerId && size) {
      tabbarService.resizeHandle.setSize(size);
    }
  }

  // TODO: noAccordion应该由视图决定，service不需要关心
  getTabbarService(location: string, noAccordion?: boolean) {
    const service = this.services.get(location) || this.injector.get(TabbarService, [location, noAccordion]);
    if (!this.services.get(location)) {
      service.onCurrentChange(({currentId}) => {
        this.storeState(service, currentId);
        if (currentId && !service.noAccordion) {
          const accordionService = this.getAccordionService(currentId);
          accordionService.expandedViews.forEach((view) => {
            this.eventBus.fire(new ExtensionActivateEvent({ topic: 'onView', data: view.id }));
          });
        }
      });
      service.onSizeChange(() => debounce(() => this.storeState(service, service.currentContainerId), 200)());
      this.services.set(location, service);
    }
    return service;
  }

  getAccordionService(containerId: string, noRestore?: boolean) {
    let service = this.accordionServices.get(containerId);
    if (!service) {
      service = this.injector.get(AccordionService, [containerId, noRestore]);
      this.accordionServices.set(containerId, service);
    }
    return service;
  }

  getTabbarHandler(viewOrContainerId: string): TabBarHandler | undefined {
    let handler = this.doGetTabbarHandler(viewOrContainerId);
    if (!handler) {
      const containerId = this.viewToContainerMap.get(viewOrContainerId);
      if (!containerId) {
        // tslint:disable-next-line no-console
        console.warn(`没有找到${viewOrContainerId}对应的tabbar！`);
      }
      handler = this.doGetTabbarHandler(containerId || '');
    }
    return handler;
  }

  getExtraMenu(): IContextMenu {
    return this.contextmenuService.createMenu({
      id: MenuId.ActivityBarExtra,
    });
  }

  protected doGetTabbarHandler(containerId: string) {
    let activityHandler = this.handleMap.get(containerId);
    if (!activityHandler) {
      let location: string | undefined;
      for (const service of this.services.values()) {
        if (service.getContainer(containerId)) {
          location = service.location;
          break;
        }
      }
      if (location) {
        activityHandler = this.injector.get(TabBarHandler, [containerId, this.getTabbarService(location)]);
        this.handleMap.set(containerId, activityHandler);
      }
    }
    return activityHandler;
  }

  private holdTabbarComponent = new Map<string, {views: View[], options: ViewContainerOptions, side: string}>();

  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string, Fc?: any): string {
    if (Fc) {
      // tslint:disable-next-line no-console
      console.warn('collectTabbarComponent api warning: Please move react component into options.component!');
    }
    if (options.hideIfEmpty && !views.length && !options.component) {
      this.holdTabbarComponent.set(options.containerId, { views, options, side });
      if (this.tabbarUpdateSet.has(options.containerId)) {
        this.tryUpdateTabbar(options.containerId);
      }
      return options.containerId;
    }
    const tabbarService = this.getTabbarService(side);
    tabbarService.registerContainer(options.containerId, {views, options});
    views.forEach((view) => {
      this.viewToContainerMap.set(view.id, options.containerId);
    });
    return options.containerId;
  }

  collectViewComponent(view: View, containerId: string, props: any = {}, isReplace?: boolean): string {
    this.customViews.set(view.id, view);
    this.viewToContainerMap.set(view.id, containerId);
    const accordionService: AccordionService = this.getAccordionService(containerId);
    if (props) {
      view.initialProps = props;
    }
    accordionService.appendView(view, isReplace);
    // 如果之前没有views信息，且为hideIfEmpty类型视图则需要刷新
    if (accordionService.views.length === 1) {
      this.tabbarUpdateSet.add(containerId);
      this.tryUpdateTabbar(containerId);
    }
    return containerId;
  }

  private tabbarUpdateSet: Set<string> = new Set();

  // 由于注册container和view的时序不能保障，注册时需要互相触发
  private tryUpdateTabbar(containerId: string) {
    const holdInfo = this.holdTabbarComponent.get(containerId);
    if (holdInfo) {
      const tabbarService = this.getTabbarService(holdInfo.side);
      tabbarService.registerContainer(containerId, {views: holdInfo.views, options: holdInfo.options});
      this.tabbarUpdateSet.delete(containerId);
      this.holdTabbarComponent.delete(containerId);
    }
  }

  replaceViewComponent(view: View, props?: any) {
    const containerId = this.viewToContainerMap.get(view.id);
    if (!containerId) {
      // tslint:disable-next-line no-console
      console.warn(`没有找到${view.id}对应的容器，请检查传入参数!`);
      return;
    }
    const contributedView = this.customViews.get(view.id);
    if (contributedView) {
      view = Object.assign(contributedView, view);
    }

    this.collectViewComponent(view, containerId!, props, true);
  }

  disposeViewComponent(viewId: string) {
    const containerId = this.viewToContainerMap.get(viewId);
    if (!containerId) {
      // tslint:disable-next-line no-console
      console.warn(`没有找到${viewId}对应的容器，请检查传入参数!`);
      return;
    }
    const accordionService: AccordionService = this.getAccordionService(containerId);
    accordionService.disposeView(viewId);
  }

  revealView(viewId: string) {
    const containerId = this.viewToContainerMap.get(viewId);
    if (!containerId) {
      // tslint:disable-next-line no-console
      console.warn(`没有找到${viewId}对应的容器，请检查传入参数!`);
      return;
    }
    const accordionService: AccordionService = this.getAccordionService(containerId);
    accordionService.revealView(viewId);
  }

  disposeContainer(containerId: string) {
    let location: string | undefined;
    for (const service of this.services.values()) {
      if (service.getContainer(containerId)) {
        location = service.location;
        break;
      }
    }
    if (location) {
      const tabbarService = this.getTabbarService(location);
      tabbarService.disposeContainer(containerId);
    } else {
      // tslint:disable-next-line no-console
      console.warn('没有找到containerId所属Tabbar!');
    }
  }

  // TODO 这样很耦合，不能做到tab renderer自由拆分
  expandBottom(expand: boolean): void {
    const tabbarService = this.getTabbarService(SlotLocation.bottom);
    tabbarService.doExpand(expand);
    this.contextKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
  }

  get bottomExpanded(): boolean {
    const tabbarService = this.getTabbarService(SlotLocation.bottom);
    this.contextKeyService.createKey('bottomFullExpanded', tabbarService.isExpanded);
    return tabbarService.isExpanded;
  }

}
