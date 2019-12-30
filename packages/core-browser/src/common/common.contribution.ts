import { Autowired } from '@ali/common-di';
import { FILE_COMMANDS, COMMON_COMMANDS, EDITOR_COMMANDS } from './common.command';
import { corePreferenceSchema } from '../core-preferences';
import { CommandContribution, CommandService, PreferenceSchema, CommandRegistry, localize, Domain, Event, isElectronRenderer, replaceLocalizePlaceholder, isOSX } from '@ali/ide-core-common';
import { PreferenceContribution } from '../preferences';
import { ClientAppContribution } from './common.define';
import { IContextKeyService, IContextKey } from '../context-key';
import { trackFocus } from '../dom';
import { AppConfig } from '../react-providers/config-provider';
import { NextMenuContribution, IMenuRegistry, MenuId } from '../menu/next';

export const inputFocusedContextKey = 'inputFocus';

@Domain(CommandContribution, ClientAppContribution, PreferenceContribution, NextMenuContribution)
export class ClientCommonContribution implements CommandContribution, PreferenceContribution, ClientAppContribution, NextMenuContribution {
  @Autowired(CommandService)
  protected commandService: CommandService;

  schema: PreferenceSchema = corePreferenceSchema;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  private inputFocusedContext: IContextKey<boolean>;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  onStart() {
    this.inputFocusedContext = this.contextKeyService.createKey(inputFocusedContextKey, false);
    window.addEventListener('focusin', this.updateInputContextKeys.bind(this));
  }

  onStop() {
    window.removeEventListener('focusin', this.updateInputContextKeys.bind(this));
  }

  private activeElementIsInput(): boolean {
    return !!document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
  }

  private updateInputContextKeys(): void {
    const isInputFocused = this.activeElementIsInput();

    this.inputFocusedContext.set(isInputFocused);

    if (isInputFocused) {
      const tracker = trackFocus(document.activeElement as HTMLElement);
      Event.once(tracker.onDidBlur)(() => {
        this.inputFocusedContext.set(this.activeElementIsInput());
        tracker.dispose();
      });
    }
  }

  registerCommands(command: CommandRegistry) {
    command.registerCommand(EDITOR_COMMANDS.UNDO);
    command.registerCommand(EDITOR_COMMANDS.REDO);
    command.registerCommand(COMMON_COMMANDS.ABOUT_COMMAND, {
      execute: () => {
        alert(replaceLocalizePlaceholder(this.appConfig.appName) || 'Kaitian IDE Framework'); // todo
      },
    });
  }

  registerNextMenus(menus: IMenuRegistry): void {
    // 注册 Menubar
    if (isElectronRenderer()) {
      menus.registerMenubarItem(MenuId.MenubarAppMenu, { label: localize('app.name', 'Kaitian Electron'), order: 0});
    }
    menus.registerMenubarItem(MenuId.MenubarFileMenu, { label: localize('menu-bar.title.file'), order: 1 });
    menus.registerMenubarItem(MenuId.MenubarEditMenu, { label: localize('menu-bar.title.edit'), order: 2 });
    menus.registerMenubarItem(MenuId.MenubarSelectionMenu, { label: localize('menu-bar.title.selection'), order: 3 });
    menus.registerMenubarItem(MenuId.MenubarViewMenu, { label: localize('menu-bar.title.view'), order: 4 });
    menus.registerMenubarItem(MenuId.MenubarHelpMenu, { label: localize('menu-bar.title.help'), order: 999 });

    /* ---- test for submenu ---- */
    // if (process.env.NODE_ENV !== 'production') {
    //   const testSubmenuId = 'greatmenu';
    //   menus.registerMenuItem(MenuId.SCMResourceGroupContext, {
    //     label: 'kaitian submenu',
    //     submenu: testSubmenuId,
    //   });

    //   menus.registerMenuItems(testSubmenuId, [{
    //     command: FILE_COMMANDS.NEW_FILE.id,
    //     group: '1_new',
    //   }]);

    //   menus.registerMenuItem(testSubmenuId, {
    //     label: 'kaitian sub_submenu',
    //     submenu: 'sub_submenu',
    //   });

    //   menus.registerMenuItems(testSubmenuId, [{
    //     command: FILE_COMMANDS.NEW_FOLDER.id,
    //     group: '1_new',
    //   }]);

    //   menus.registerMenuItem('sub_submenu', {
    //     command: COMMON_COMMANDS.ABOUT_COMMAND.id,
    //     group: '1_new',
    //   });
    // }

    /* ---- end for submenu ---- */

    // File 菜单
    menus.registerMenuItems(MenuId.MenubarFileMenu, [{
      command: FILE_COMMANDS.OPEN_FOLDER.id,
      group: '1_open',
      when: 'config.application.supportsOpenFolder',
    }, {
      command: EDITOR_COMMANDS.NEW_UNTITLED_FILE.id,
      group: '2_new',
    }, {
      command: FILE_COMMANDS.NEW_FOLDER.id,
      group: '2_new',
    }, {
      command: {
        id: EDITOR_COMMANDS.SAVE_CURRENT.id,
        label: localize('file.save'),
      },
      group: '3_save',
    }, {
      command: {
        id: EDITOR_COMMANDS.SAVE_ALL.id,
        label: localize('file.saveAll'),
      },
      group: '3_save',
    }]);

    // Edit 菜单
    if (isElectronRenderer()) {
      menus.registerMenuItems(MenuId.MenubarEditMenu, [{
        command: {
          id: 'electron.undo',
          label: localize('editor.undo'),
        },
        nativeRole: 'undo',
        group: '1_undo',
      }, {
        command: {
          id: 'electron.redo',
          label: localize('editor.redo'),
        },
        group: '1_undo',
        nativeRole: 'redo',
      }, {
        command: {
          label: localize('edit.cut'),
          id: 'electron.cut',
        },
        nativeRole: 'cut',
        group: '2_clipboard',
      }, {
        command: {
          label: localize('edit.copy'),
          id: 'electron.copy',
        },
        nativeRole: 'copy',
        group: '2_clipboard',
      }, {
        command: {
          label: localize('edit.paste'),
          id: 'electron.paste',
        },
        nativeRole: 'paste',
        group: '2_clipboard',
      }, {
        command: {
          label: localize('edit.selectAll'),
          id: 'electron.selectAll',
        },
        nativeRole: 'selectAll',
        group: '2_clipboard',
      }]);
      menus.registerMenuItems(MenuId.MenubarFileMenu, [{
        command: {
          id: 'electron.quit',
          label: localize('app.quit'),
        },
        nativeRole: 'quit',
        group: '4_quit',
      }]);
    } else {
      menus.registerMenuItems(MenuId.MenubarEditMenu, [{
        command: EDITOR_COMMANDS.REDO.id,
        group: '1_undo',
      }, {
        command: EDITOR_COMMANDS.UNDO.id,
        group: '1_undo',
      }]);
      // 帮助菜单
      menus.registerMenuItem(MenuId.MenubarHelpMenu, {
        command: {
          id: COMMON_COMMANDS.ABOUT_COMMAND.id,
          label: localize('common.about'),
        },
        nativeRole: 'about',
        group: '0_about',
      });
    }
  }
}
