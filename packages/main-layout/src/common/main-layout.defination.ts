import { BasicEvent, SlotLocation } from '@ali/ide-core-browser';
import { ViewContainerOptions, View, SideStateManager } from '@ali/ide-core-browser/lib/layout';
import { TabBarHandler } from '../browser/tabbar-handler';
import { TabbarService } from '../browser/tabbar/tabbar.service';
import { AccordionService } from '../browser/accordion/accordion.service';

export interface ComponentCollection {
  views?: View[];
  options: ViewContainerOptions;
}
export interface ViewToContainerMapData {
  [key: string ]: string | number;
}

export const IMainLayoutService = Symbol('IMainLayoutService');
export interface IMainLayoutService {
  toggleSlot(location: SlotLocation, show?: boolean, size?: number): void;
  restoreState(): void;
  getTabbarHandler(handlerId: string): TabBarHandler;
  registerTabbarViewToContainerMap(map: ViewToContainerMapData): void;
  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string, Fc?: React.FunctionComponent): string;
  collectViewComponent(view: View, containerId: string, props?: any): string;
  expandBottom(expand: boolean): void;
  bottomExpanded: boolean;
  // @deprecated
  setFloatSize(size: number): void;
  handleSetting(event: React.MouseEvent<HTMLElement>): void;
  getTabbarService(location: string): TabbarService;
  getAccordionService(containerId: string): AccordionService;
  isVisible(location: string): boolean;
}

export const MainLayoutContribution = Symbol('MainLayoutContribution');

export interface MainLayoutContribution {

  // 将LayoutConfig渲染到各Slot后调用
  onDidUseConfig?(): void;

  provideDefaultState?(): SideStateManager;

}
