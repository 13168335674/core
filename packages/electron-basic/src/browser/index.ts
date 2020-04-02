import { Provider, Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { BrowserModule, Domain, AppConfig, isOSX, ClientAppContribution, IElectronMainMenuService, localize, SlotLocation, IElectronNativeDialogService, CommandContribution, CommandRegistry, KeybindingContribution, KeybindingRegistry, isWindows, electronEnv, replaceLocalizePlaceholder, URI, ILogger, formatLocalize, IEventBus } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { ElectronHeaderBar } from './header';
import { WelcomeContribution } from './welcome/contribution';
import { ElectronNativeDialogService } from './dialog';
import { IMenuRegistry, NextMenuContribution, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { IElectronMenuBarService } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/electron';
import { IElectronMainLifeCycleService, IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { IMessageService } from '@ali/ide-overlay/lib/common';
import { EditorGroupFileDropEvent, DragOverPosition, getSplitActionFromDragDrop } from '@ali/ide-editor/lib/browser';
import { IResourceOpenOptions } from '@ali/ide-editor';

@Injectable()
export class ElectronBasicModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IElectronNativeDialogService,
      useClass: ElectronNativeDialogService,
    },
    ElectronBasicContribution,
    WelcomeContribution,
  ];
}

const nativeRoles = [
  {
    name: 'undo',
    key: 'ctrlcmd+z',
    when: '!editorFocus',
  },
  {
    name: 'redo',
    key: 'ctrlcmd+shift+z',
    when: '!editorFocus',
  },
  {
    name: 'copy',
    key: 'ctrlcmd+c',
    when: '!editorFocus',
  },
  {
    name: 'paste',
    key: 'ctrlcmd+v',
    when: '!editorFocus',
  },
  {
    name: 'selectAll',
    key: 'ctrlcmd+a',
    when: '!editorFocus',
  },
  {
    name: 'cut',
    key: 'ctrlcmd+x',
    when: '!editorFocus',
  },
  {
    name: 'toggleDevTools',
    key: 'alt+ctrlcmd+i',
    label: '%window.toggleDevTools%',
    alias: 'Toggle Developer Tools',
  },
];

@Domain(ComponentContribution, ClientAppContribution, NextMenuContribution, CommandContribution, KeybindingContribution)
export class ElectronBasicContribution implements KeybindingContribution, CommandContribution, ComponentContribution, ClientAppContribution, NextMenuContribution {
  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(IElectronMenuBarService)
  private electronMenuBarService: IElectronMenuBarService;

  @Autowired(IElectronMainMenuService)
  private electronMainMenuService: IElectronMainMenuService;

  @Autowired(IElectronMainLifeCycleService)
  private electronMainLifeCycleService: IElectronMainLifeCycleService;

  @Autowired(IElectronMainUIService)
  private electronMainUIService: IElectronMainUIService;

  @Autowired(IMessageService)
  private messageService: IMessageService;

  @Autowired(ILogger)
  logger: ILogger;

  registerComponent(registry: ComponentRegistry) {
    const top = this.config.layoutConfig[SlotLocation.top];
    if ( top && top.modules  ) {
      const index = top.modules.indexOf('@ali/ide-menu-bar');
      if (index !== -1) {
        top.modules.splice(index, 1, 'electron-header');
      }
    }
    registry.register('electron-header', {
      id: 'electron-header',
      component: ElectronHeaderBar,
    }, {
      size: 27,
      containerId: 'electron-header',
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
    const menuId = MenuId.MenubarAppMenu;

    menuRegistry.registerMenuItem(menuId, {
      command: {
        id: 'electron.about',
        label: localize('about'),
      },
      group: '0_about',
      nativeRole: 'about',
    });

    menuRegistry.registerMenuItem(MenuId.MenubarHelpMenu, {
      command: {
        id: 'electron.toggleDevTools',
        label: localize('window.toggleDevTools'),
      },
      nativeRole: 'toggledevtools',
    });

    menuRegistry.registerMenuItem(MenuId.MenubarHelpMenu, {
      command: {
        id: 'electron.reload',
        label: localize('window.reload'),
      },
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: 'electron.revealInFinder',
      group: '12_electron',
      order: 3,
    });
    menuRegistry.registerMenuItem(MenuId.EditorTitleContext, {
      command: 'electron.revealInFinderTab',
      group: '2_open',
      order: 3,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    nativeRoles.forEach((role) => {
      commands.registerCommand({
        id: 'electron.' + role.name,
        label: replaceLocalizePlaceholder(role.label),
        alias: role.alias,
      }, {
        execute: () => {
          this.electronMainMenuService.runNativeRoleAction(role.name);
        },
      });
    });

    commands.registerCommand({
      id: 'electron.zoomIn',
      label: localize('view.zoomIn'),
      alias: 'View: Zoom In',
    }, {
      execute: () => {
        this.electronMainUIService.setZoomFactor(electronEnv.currentWebContentsId, {
          delta: 0.1,
        });
      },
    });

    commands.registerCommand({
      id: 'electron.zoomOut',
      label: localize('view.zoomOut'),
      alias: 'View: Zoom Out',
    }, {
      execute: () => {
        this.electronMainUIService.setZoomFactor(electronEnv.currentWebContentsId, {
          delta: -0.1,
        });
      },
    });

    commands.registerCommand({
      id: 'electron.zoomReset',
      label: localize('view.zoomReset'),
      alias: 'View: Zoom Reset',
    }, {
      execute: () => {
        this.electronMainUIService.setZoomFactor(electronEnv.currentWebContentsId, {
          value: 1,
        });
      },
    });

    commands.registerCommand({
      id: 'electron.reload',
      label: localize('window.reload'),
      alias: 'Reload Window',
    }, {
      execute: () => {
        this.electronMainLifeCycleService.reloadWindow(electronEnv.currentWindowId);
      },
    });

    commands.registerCommand({
      id: 'electron.revealInFinder',
      label: localize('explorer.electron.revealInFinder'),
    }, {
      execute: (uri: URI) => {
        if (uri && uri.scheme === 'file') {
          this.electronMainUIService.revealInFinder(uri.codeUri.fsPath);
        }
      },
    });

    commands.registerCommand({
      id: 'electron.revealInFinderTab',
      label: localize('explorer.electron.revealInFinder'),
    }, {
      execute: ({uri}: {uri?: URI} = {}) => {
        if (uri && uri.scheme === 'file') {
          this.electronMainUIService.revealInFinder(uri.codeUri.fsPath);
        }
      },
    });

    commands.registerCommand({
      id: 'electron.openInSystemTerminal',
      label: localize('explorer.electron.openInSystemTerminal'),
    }, {
      execute: (uri: URI) => {
        if (uri && uri.scheme === 'file') {
          try {
            this.electronMainUIService.revealInSystemTerminal(uri.codeUri.fsPath);
          } catch (e) {
            this.logger.error(e);
            this.messageService.error(formatLocalize('explorer.electron.openInSystemTerminal.error', uri.displayName, e.message));
          }
        }
      },
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry) {
    nativeRoles.forEach((role) => {
      if (role.key) {
        keybindings.registerKeybinding({
          command: 'electron.' + role.name,
          keybinding: role.key,
          when: role.when,
        });
      }
    });

    keybindings.registerKeybinding({
      command: 'electron.reload' ,
      keybinding: 'shift+ctrlcmd+r',
    });

    keybindings.registerKeybinding({
      command: 'electron.zoomIn' ,
      keybinding: isWindows ? 'alt+=' : 'ctrlcmd+=',
    });

    keybindings.registerKeybinding({
      command: 'electron.zoomOut' ,
      keybinding: isWindows ? 'alt+-' : 'ctrlcmd+-',
    });
  }

  onStart() {
    if (isOSX) {
      this.electronMenuBarService.start();
    }

    // 注册drag drop file的行为
    this.eventBus.on(EditorGroupFileDropEvent, async (event) => {
      const payload = event.payload;
      const filesToOpen: URI[] = [];
      // fileList 只能这样遍历
      // tslint:disable-next-line: prefer-for-of
      for (let i = 0; i < payload.files.length; i++) {
        const file = payload.files[0];
        if (file.path) {
          filesToOpen.push(URI.file(file.path));
        }
      }
      const group = event.payload.group;
      for (const fileURI of filesToOpen) {
        const options: IResourceOpenOptions = {
          index: event.payload.tabIndex !== -1 ? event.payload.tabIndex : undefined,
        };
        if (event.payload.position && event.payload.position !== DragOverPosition.CENTER) {
          options.split = getSplitActionFromDragDrop(event.payload.position);
        }
        await group.open(fileURI, options);
      }
    });
  }
}
