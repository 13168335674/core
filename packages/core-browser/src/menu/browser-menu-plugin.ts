/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Injectable, Autowired } from '@ali/common-di';
import { MenuBar as MenuBarWidget, Menu as MenuWidget, Widget } from '@phosphor/widgets';
import { CommandRegistry as PhosphorCommandRegistry } from '@phosphor/commands';
import {
    CommandRegistry, ActionMenuNode, CompositeMenuNode,
    MenuModelRegistry, MAIN_MENU_BAR, MenuPath, CommandService,
} from '@ali/ide-core-common';
import { Anchor } from './context-menu-renderer';
import { IContextKeyService } from '../context-key';
import * as strings from '@ali/ide-core-common/lib/utils/strings';
import { KeybindingRegistry, ResolvedKeybinding } from '../keybinding';
import { getIcon } from '../style/icon/icon';

/**
 * @deprecated
 */
@Injectable()
export class BrowserMainMenuFactory {

    @Autowired(CommandRegistry) protected readonly commandRegistry: CommandRegistry;
    @Autowired(MenuModelRegistry) protected readonly menuProvider: MenuModelRegistry;

    @Autowired(CommandService) protected readonly commandService: CommandService;

    @Autowired(KeybindingRegistry) protected readonly keybindings: KeybindingRegistry;

    @Autowired(IContextKeyService)
    protected readonly contextKeyService: IContextKeyService;

    constructor() {
        MenuWidget.Renderer.prototype.formatShortcut = (data) => {
            if (data.item && data.item.command) {
                const keybinding = this.keybindings.getKeybindingsForCommand(data.item.command) as ResolvedKeybinding[];
                if (keybinding.length > 0) {
                    return keybinding[0]!.resolved![0].toString();
                }
            }
            return '';
        };
        const superCreateClass = MenuWidget.Renderer.prototype.createIconClass;
        MenuWidget.Renderer.prototype.createIconClass = (data) => {
          const className = superCreateClass(data);
          if (data.item.isToggled) {
            return 'menu-icon' + ' ' + getIcon('check');
          }
          return className;
        };
    }

    createMenuBar(): MenuBarWidget {
        const menuBar = new DynamicMenuBarWidget();
        menuBar.id = 'theia:menubar';
        this.fillMenuBar(menuBar);
        return menuBar;
    }

    protected fillMenuBar(menuBar: MenuBarWidget): void {
        const menuModel = this.menuProvider.getMenu(MAIN_MENU_BAR);
        const phosphorCommands = this.createPhosphorCommands(menuModel);
        // for the main menu we want all items to be visible.
        // phosphorCommands.isVisible = () => true;

        for (const menu of menuModel.children) {
            if (menu instanceof CompositeMenuNode) {
                if (menu.when) {
                    if (!this.contextKeyService.match(menu.when)) {
                        continue;
                    }
                }
                const menuWidget = new DynamicMenuWidget(menu, { commands: phosphorCommands }, this.contextKeyService);
                menuBar.addMenu(menuWidget);
            }
        }
    }

    createContextMenu(path: MenuPath, args?: any, contextKeyService?: IContextKeyService): MenuWidget {
        const menuModel = this.menuProvider.getMenu(path);
        const phosphorCommands = this.createPhosphorCommands(menuModel, args);

        const contextMenu = new DynamicMenuWidget(menuModel, { commands: phosphorCommands }, contextKeyService || this.contextKeyService);
        return contextMenu;
    }

    protected createPhosphorCommands(menu: CompositeMenuNode, args?: any): PhosphorCommandRegistry {
        const commands = new PhosphorCommandRegistry();
        this.addPhosphorCommands(commands, menu, args);
        return commands;
    }

    protected addPhosphorCommands(commands: PhosphorCommandRegistry, menu: CompositeMenuNode, args?: any): void {
        for (const child of menu.children) {
            if (child instanceof ActionMenuNode) {
                this.addPhosphorCommand(commands, child, args);
            } else if (child instanceof CompositeMenuNode) {
                this.addPhosphorCommands(commands, child, args);
            }
        }
    }

    protected addPhosphorCommand(commands: PhosphorCommandRegistry, menu: ActionMenuNode, args?: any): void {
        const command = this.commandRegistry.getCommand(menu.action.commandId);
        // if (!command) {
        //     return;
        // }
        if (commands.hasCommand(menu.action.commandId)) {
            // several menu items can be registered for the same command in different contexts
            return;
        }
        commands.addCommand(menu.action.commandId, {
            execute: () => this.commandService.executeCommand(menu.action.commandId, args),
            label: cleanMnemonic(menu.label || ''),
            icon: menu.icon,
            isEnabled: () => !this.commandRegistry.getCommand(menu.action.commandId) || (this.commandRegistry.isEnabled(menu.action.commandId, args) && (!menu.enableWhen || this.contextKeyService.match(menu.enableWhen))),
            isVisible: () => !this.commandRegistry.getCommand(menu.action.commandId) || this.commandRegistry.isVisible(menu.action.commandId, args),
            isToggled: () => this.commandRegistry.isToggled(menu.action.commandId),
        });
    }
}

class DynamicMenuBarWidget extends MenuBarWidget {

    constructor() {
        super();
        const openChildMenuKey = '_openChildMenu';
        // HACK we need to hook in on private method _openChildMenu. Don't do this at home!
        DynamicMenuBarWidget.prototype[openChildMenuKey] = () => {
            if (this.activeMenu instanceof DynamicMenuWidget) {
                this.activeMenu.aboutToShow();
            }
            super[openChildMenuKey]();
        };
    }

}
/**
 * A menu widget that would recompute its items on update
 */
class DynamicMenuWidget extends MenuWidget {

    constructor(
        protected menu: CompositeMenuNode,
        protected options: MenuWidget.IOptions,
        protected contextKeyService: IContextKeyService,
    ) {
        super(options);
        if (menu.label) {
            this.title.label = cleanMnemonic(menu.label);
        }
        this.updateSubMenus(this, this.menu, this.options.commands);
    }

    public aboutToShow(): void {
        this.clearItems();
        this.updateSubMenus(this, this.menu, this.options.commands);
    }

    public open(x: number, y: number, options?: MenuWidget.IOpenOptions): void {
        // we want to restore the focus after the menu closes.
        const previouslyActive = window.document.activeElement as HTMLElement;
        const cb = () => {
            previouslyActive.focus();
            this.aboutToClose.disconnect(cb);
        };
        this.aboutToClose.connect(cb);
        super.open(x, y, options);
    }

    private updateSubMenus(
        parent: MenuWidget,
        menu: CompositeMenuNode,
        commands: PhosphorCommandRegistry,
    ): void {
        const items = this.buildSubMenus([], menu, commands);
        for (const item of items) {
            super.addItem(item);
        }
    }

    private buildSubMenus(
        items: MenuWidget.IItemOptions[],
        menu: CompositeMenuNode,
        commands: PhosphorCommandRegistry,
    ): MenuWidget.IItemOptions[] {
        for (const item of menu.children) {
            if (item instanceof CompositeMenuNode) {
                if (item.children.length > 0) {
                    // do not render empty nodes
                    if (item.when) {
                        if (!this.contextKeyService.match(item.when)) {
                            continue;
                        }
                    }

                    if (item.isSubmenu) { // submenu node

                        const submenu = new DynamicMenuWidget(item, this.options, this.contextKeyService);
                        if (submenu.items.length === 0) {
                            continue;
                        }

                        items.push({
                            type: 'submenu',
                            submenu,
                        });

                    } else { // group node

                        const submenu = this.buildSubMenus([], item, commands);
                        if (submenu.length === 0) {
                            continue;
                        }

                        if (items.length > 0) {
                            // do not put a separator above the first group

                            items.push({
                                type: 'separator',
                            });
                        }

                        // render children
                        items.push(...submenu);
                    }
                }

            } else if (item instanceof ActionMenuNode) {

              const { when: when } = item.action;
              if (when && !this.contextKeyService.match(when)) {
                  continue;
              }

              if (commands.hasCommand(item.action.commandId) && !(commands.isVisible(item.action.commandId))) {
                  continue;
              }

              items.push({
                  command: item.action.commandId,
                  type: 'command',
              } as any);
            }
        }
        return items;
    }
}

function createMenuMnemonicRegExp() {
  try {
    return /\(\&\&([^\s])\)/;
  } catch (err) {
    return new RegExp('\uFFFF'); // never match please
  }
}
export const MENU_MNEMONIC_REGEX = createMenuMnemonicRegExp();
export function cleanMnemonic(label: string): string {
  const regex = MENU_MNEMONIC_REGEX;

  const matches = regex.exec(label);
  if (!matches) {
    return label;
  }
  const quickKeys = matches[1];
  return label.replace(regex, '').trim();

}
