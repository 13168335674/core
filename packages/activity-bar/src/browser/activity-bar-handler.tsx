import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Title, Widget, BoxPanel } from '@phosphor/widgets';
import { AppConfig, ConfigProvider, SlotRenderer, SlotLocation, IContextKeyService } from '@ali/ide-core-browser';
import { Event, Emitter, CommandService, IEventBus } from '@ali/ide-core-common';
import { View, ITabbarWidget, Side, VisibleChangedEvent, VisibleChangedPayload, AccordionWidget } from '@ali/ide-core-browser/lib/layout';
import { Injectable, Autowired } from '@ali/common-di';
import { ActivityPanelToolbar } from '@ali/ide-core-browser/lib/layout/view-container-toolbar';
import { ViewContainerRegistry } from '@ali/ide-core-browser/lib/layout/view-container.registry';

@Injectable({multiple: true})
export class ActivityBarHandler {

  private widget: BoxPanel = this.title.owner as BoxPanel;
  private titleWidget?: ActivityPanelToolbar;
  private accordion?: AccordionWidget;

  protected readonly onActivateEmitter = new Emitter<void>();
  readonly onActivate: Event<void> = this.onActivateEmitter.event;

  protected readonly onInActivateEmitter = new Emitter<void>();
  readonly onInActivate: Event<void> = this.onInActivateEmitter.event;

  protected readonly onCollapseEmitter = new Emitter<void>();
  readonly onCollapse: Event<void> = this.onCollapseEmitter.event;

  public isVisible: boolean = false;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(AppConfig)
  private configContext: AppConfig;

  @Autowired(IEventBus)
  private eventBus: IEventBus;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired()
  private viewContainerRegistry: ViewContainerRegistry;

  constructor(
    private containerId,
    private title: Title<Widget>,
    private activityTabBar: ITabbarWidget,
    private side: Side) {
    this.activityTabBar.currentChanged.connect((tabbar, args) => {
      const { currentWidget, previousWidget } = args;
      if (currentWidget === this.widget) {
        // 底部面板兼容
        if (this.side === 'bottom' && !this.contextKeyService.match('bottomPanelVisible')) {
          return;
        }
        this.onActivateEmitter.fire();
        this.isVisible = true;
      } else if (previousWidget === this.widget) {
        this.onInActivateEmitter.fire();
        this.isVisible = false;
      }
    });
    this.activityTabBar.onCollapse.connect((tabbar, title) => {
      if (this.widget.title === title) {
        this.onCollapseEmitter.fire();
      }
    });
    if (this.side === 'bottom') {
      // 底部面板展开时，做额外的激活处理
      this.eventBus.on(VisibleChangedEvent, (e: VisibleChangedEvent) => {
        if (e.payload.slotLocation !== SlotLocation.bottom) { return; }
        if (e.payload.isVisible === true) {
          if (this.activityTabBar.currentWidget === this.widget) {
            this.onActivateEmitter.fire();
          }
        } else {
          this.onInActivateEmitter.fire();
        }
      });
    }
    this.titleWidget = this.viewContainerRegistry.getTitleBar(this.containerId);
    this.accordion = this.viewContainerRegistry.getAccordion(this.containerId);
  }

  dispose() {
    this.activityTabBar.tabBar.removeTab(this.title);
  }

  disposeView(viewId: string) {
    if (this.accordion) {
      this.accordion.removeWidget(viewId);
    }
  }

  activate(fromKeybinding?: boolean) {
    // 底部的显示隐藏为slot能力，不受Tabbar控制
    if (this.side === 'bottom') {
      if (fromKeybinding) {
        this.commandService.executeCommand('main-layout.bottom-panel.is-visible').then((isVisible) => {
          if (isVisible) {
            if (this.isActivated()) {
              this.commandService.executeCommand('main-layout.bottom-panel.hide');
            }
          } else {
            this.commandService.executeCommand('main-layout.bottom-panel.show');
          }
          this.activityTabBar.currentWidget = this.widget;
        });
      } else {
        this.commandService.executeCommand('main-layout.bottom-panel.show');
      }
    } else {
      this.activityTabBar.currentWidget = this.widget;
    }
  }

  isActivated() {
    return this.activityTabBar.currentWidget === this.widget;
  }

  show() {
    this.commandService.executeCommand(`activity.bar.toggle.${this.containerId}`, true);
  }

  hide() {
    this.commandService.executeCommand(`activity.bar.toggle.${this.containerId}`, false);
  }

  // 设定container整个组件
  setComponent(Fc: React.FunctionComponent | React.FunctionComponent[]) {
    ReactDOM.render(
      <ConfigProvider value={this.configContext} >
        <SlotRenderer Component={Fc} />
      </ConfigProvider>
    , this.widget.node);
  }

  // 设定title自定义组件，注意设置高度
  setTitleComponent(Fc: React.FunctionComponent, size?: number) {
    if (this.titleWidget) {
      this.titleWidget.setComponent(Fc, size);
    }
    this.title.owner.update();
  }

  // TODO 底部待实现
  setSize(size: number) {
    this.activityTabBar.showPanel(size);
  }
  // TODO 底部待实现
  setBadge(badge: string) {
    // @ts-ignore
    this.title.badge = badge;
    this.activityTabBar.tabBar.update();
  }

  setIconClass(iconClass: string) {
    this.title.iconClass = iconClass;
  }

  isCollapsed(viewId: string) {
    if (!this.accordion) {
      return;
    }
    const section = this.accordion.sections.get(viewId);
    if (!section) {
      console.error('没有找到对应的view!');
    } else {
      return section.collapsed;
    }
  }

  // 有多个视图请一次性注册，否则会影响到视图展开状态！
  toggleViews(viewIds: string[], show: boolean) {
    if (!this.accordion) {
      return;
    }
    for (const viewId of viewIds) {
      const section = this.accordion.sections.get(viewId);
      if (!section) {
        console.warn(`没有找到${viewId}对应的视图，跳过`);
        continue;
      }
      section.setHidden(!show);
    }
    this.accordion.updateTitleVisibility();
  }

  updateViewTitle(viewId: string, title: string) {
    if (!this.accordion) {
      return;
    }
    const section = this.accordion.sections.get(viewId);
    if (!section) {
      console.warn(`没有找到${viewId}对应的视图，跳过`);
      return;
    }
    section.titleLabel = title;
  }

  // 刷新 title
  refreshTitle() {
    if (this.titleWidget) {
      let viewId: string | undefined;
      if (this.accordion) {
        const visibleViews = this.accordion.getVisibleSections();
        if (visibleViews.length === 1) {
          viewId = visibleViews[0].view.id;
        }
      }
      this.titleWidget.updateToolbar(viewId);
    }
    if (this.side !== 'bottom') {
      if (this.accordion) {
        this.accordion.sections.forEach((section) => {
          section.update();
        });
      }
    }
  }

  // 更新 title
  updateTitle(label: string) {
    if (!this.titleWidget) {
      return;
    }
    this.titleWidget.title.label = label;
    this.titleWidget.toolbarTitle = this.titleWidget.title;
  }
}
