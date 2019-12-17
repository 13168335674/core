import { ILogger, Disposable, combinedDisposable, CommandRegistry, IDisposable, Event, Emitter, Command, ContributionProvider, MaybeNull } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';

import { MenuId } from './menu-id';

export const NextMenuContribution = Symbol('NextMenuContribution');
export interface NextMenuContribution {
  registerNextMenus(menus: IMenuRegistry): void;
}

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface MenuCommandDesc {
  id: string;
  label: string;
}

export interface IMenuItem {
  command: string | MenuCommandDesc;
  /**
   * 决定是否在视图层展示
   */
  when?: string | monaco.contextkey.ContextKeyExpr;
  /**
   * 决定 toggled 状态, 主要表现为文字左侧有一个 ✅
   */
  toggledWhen?: string | monaco.contextkey.ContextKeyExpr;
  /**
   * 决定 disabled 状态，主要表现为 menu item 颜色变灰
   */
  enabledWhen?: string | monaco.contextkey.ContextKeyExpr;
  group?: 'navigation' | string;
  order?: number;
  nativeRole?: string; // electron native 菜单使用
}

export interface ISubmenuItem {
  label: string;
  submenu: MenuId | string;
  /**
   * 决定是否在视图层展示
   */
  when?: string | monaco.contextkey.ContextKeyExpr;
  group?: 'navigation' | string;
  order?: number;
  nativeRole?: string; // electron native 菜单使用
}

export type ICommandsMap = Map<string, Command>;

export abstract class IMenuRegistry {
  readonly onDidChangeMenubar: Event<string>;
  abstract registerMenubarItem(menuId: string, item: PartialBy<IExtendMenubarItem, 'id'>): IDisposable;
  abstract removeMenubarItem(menuId: string): void;
  abstract getMenubarItem(menuId: string): IExtendMenubarItem | undefined;
  abstract getMenubarItems(): Array<IExtendMenubarItem>;

  readonly onDidChangeMenu: Event<string>;
  abstract getMenuCommand(command: string | MenuCommandDesc): PartialBy<MenuCommandDesc, 'label'>;
  abstract registerMenuItem(menuId: MenuId | string, item: IMenuItem | ISubmenuItem): IDisposable;
  abstract registerMenuItems(menuId: MenuId | string, items: Array<IMenuItem | ISubmenuItem>): IDisposable;
  abstract getMenuItems(menuId: MenuId | string): Array<IMenuItem | ISubmenuItem>;
}

export interface IMenubarItem {
  label: string;
  order?: number;
}

export interface IExtendMenubarItem extends IMenubarItem {
  id: string;
}

@Injectable()
export class CoreMenuRegistryImpl implements IMenuRegistry {
  private readonly _menubarItems = new Map<string, IExtendMenubarItem>();
  private readonly _onDidChangeMenubar = new Emitter<string>();

  readonly onDidChangeMenubar: Event<string> = this._onDidChangeMenubar.event;

  private readonly _menuItems = new Map<string, Array<IMenuItem | ISubmenuItem>>();
  private readonly _onDidChangeMenu = new Emitter<string>();

  readonly onDidChangeMenu: Event<string> = this._onDidChangeMenu.event;

  @Autowired(NextMenuContribution)
  protected readonly contributions: ContributionProvider<NextMenuContribution>;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  /**
   * 这里的注册只允许注册一次
   */
  registerMenubarItem(menuId: string, item: PartialBy<IExtendMenubarItem, 'id'>): IDisposable {
    // 将 menuId 存到结构中去
    const menubarItem = { ...item, id: menuId } as IExtendMenubarItem;
    const existedItem = this._menuItems.get(menuId);
    if (existedItem) {
      this.logger.warn(`this menuId ${menuId} already existed`);
      return Disposable.None;
    }

    this._menubarItems.set(menuId, menubarItem);
    this._onDidChangeMenubar.fire(menuId);
    return {
      dispose: () => {
        this.removeMenubarItem(menuId);
      },
    };
  }

  removeMenubarItem(menuId: string) {
    const item = this._menubarItems.get(menuId);
    if (item) {
      this._menubarItems.delete(menuId);
      this._onDidChangeMenubar.fire(menuId);
    }
  }

  getMenubarItem(menuId: string): IExtendMenubarItem | undefined {
    return this._menubarItems.get(menuId);
  }

  getMenubarItems(): IExtendMenubarItem[] {
    const menubarIds = Array.from(this._menubarItems.keys());
    return menubarIds.reduce((prev, menubarId) => {
      const menubarItem = this._menubarItems.get(menubarId);
      if (menubarItem) {
        prev.push(menubarItem);
      }
      return prev;
    }, [] as IExtendMenubarItem[]);
  }

  registerMenuItem(menuId: MenuId | string, item: IMenuItem | ISubmenuItem): IDisposable {
    let array = this._menuItems.get(menuId);
    if (!array) {
      array = [item];
      this._menuItems.set(menuId, array);
    } else {
      array.push(item);
    }

    this._onDidChangeMenu.fire(menuId);
    return {
      dispose: () => {
        const idx = array!.indexOf(item);
        if (idx >= 0) {
          array!.splice(idx, 1);
          this._onDidChangeMenu.fire(menuId);
        }
      },
    };
  }

  registerMenuItems(menuId: string, items: (IMenuItem | ISubmenuItem)[]): IDisposable {
    const disposables = [] as IDisposable[];
    items.forEach((item) => {
      disposables.push(this.registerMenuItem(menuId, item));
    });

    return combinedDisposable(disposables);
  }

  getMenuItems(id: MenuId | string): Array<IMenuItem | ISubmenuItem> {
    const result = (this._menuItems.get(id) || []).slice(0);

    if (id === MenuId.CommandPalette) {
      // CommandPalette 特殊处理, 默认展示所有的 command
      // CommandPalette 负责添加 when 条件
      this.appendImplicitMenuItems(result);
    }

    return result;
  }

  getMenuCommand(command: string | MenuCommandDesc) {
    if (typeof command === 'string') {
      return { id: command };
    }

    return command;
  }

  private appendImplicitMenuItems(result: Array<IMenuItem | ISubmenuItem>) {
    // 只保留 MenuItem
    const temp = result.filter((item) => isIMenuItem(item)) as IMenuItem[];
    const set = new Set<string>(temp.map((n) => this.getMenuCommand(n.command).id));

    const allCommands = this.commandRegistry.getCommands();
    // 将 commandRegistry 中 "其他" command 加进去
    allCommands.forEach((command) => {
      if (!set.has(command.id)) {
        result.push({ command: command.id });
      }
    });
  }
}

@Injectable()
export class MenuRegistryImpl extends CoreMenuRegistryImpl {
  @Autowired(NextMenuContribution)
  protected readonly contributions: ContributionProvider<NextMenuContribution>;

  // MenuContribution
  onStart() {
    for (const contrib of this.contributions.getContributions()) {
      contrib.registerNextMenus(this);
    }
  }
}

export function isIMenuItem(item: IMenuItem | ISubmenuItem): item is IMenuItem {
  return (item as IMenuItem).command !== undefined;
}

export function isISubmenuItem(item: IMenuItem | ISubmenuItem): item is ISubmenuItem {
  return (item as ISubmenuItem).submenu !== undefined;
}

export interface IMenuAction {
  readonly id: string; // command id
  label: string;
  icon: string; // 标准的 vscode icon 是分两种主题的
  execute(event?: any): any;
  tooltip?: string;
  className?: string;
  keybinding?: string; // 快捷键描述
  isKeyCombination?: boolean; // 是否为组合键
  disabled?: boolean; // disable 状态的 menu
  checked?: boolean; // checked 状态 通过 toggledWhen 实现
  nativeRole?: string; // eletron menu 使用
}

export class MenuNode implements IMenuAction {
  readonly id: string;
  label: string;
  tooltip: string;
  className: string | undefined ;
  icon: string;
  keybinding?: string;
  rawKeybinding?: MaybeNull<string>;
  isKeyCombination: boolean;
  disabled: boolean;
  checked: boolean;
  nativeRole: string;
  children: MenuNode[] = [];

  readonly _actionCallback?: (event?: any) => any;

  constructor(
    commandId: string,
    icon: string = '',
    label: string = '',
    checked = false,
    disabled = false,
    nativeRole: string = '',
    keybinding: string = '',
    rawKeybinding?: string,
    isKeyCombination: boolean = false,
    className: string = '',
    actionCallback?: (event?: any) => any,
  ) {
    this.id = commandId;
    this.label = label;
    this.className = className;
    this.icon = icon;
    this.keybinding = keybinding;
    this.rawKeybinding = rawKeybinding;
    this.isKeyCombination = isKeyCombination;
    this.disabled = disabled;
    this.checked = checked;
    this.nativeRole = nativeRole;
    this._actionCallback = actionCallback;
  }

  execute(event?: any): Promise<any> {
    if (this._actionCallback) {
      return this._actionCallback(event);
    }

    return Promise.resolve(true);
  }
}
