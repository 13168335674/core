import { ElectronAppConfig, ElectronMainApiRegistry, ElectronMainContribution, IElectronMainApp, IElectronMainApiProvider } from './types';
import { CodeWindow } from './window';
import { Injector, ConstructorOf } from '@ali/common-di';
import { app, BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { ElectronMainApiRegistryImpl } from './api';
import { createContributionProvider, ContributionProvider, URI, uuid } from '@ali/ide-core-common';
import { serviceProviders } from './services';
import { ICodeWindowOptions } from './types';
import { ElectronMainModule } from '../electron-main-module';

export interface IWindowOpenOptions {
  windowId: string;
  replace?: boolean;
}

export class ElectronMainApp {

  private codeWindows: Map<string, CodeWindow> = new Map();

  private injector = new Injector();

  private modules: ElectronMainModule[] = [];

  constructor(private config: ElectronAppConfig) {

    config.extensionDir = config.extensionDir || '';
    config.extenionCandidate = config.extenionCandidate || [];

    this.injector.addProviders({
      token: ElectronAppConfig,
      useValue: config,
    }, {
      token: IElectronMainApp,
      useValue: this,
    }, {
      token: ElectronMainApiRegistry,
      useClass: ElectronMainApiRegistryImpl,
    }, ...serviceProviders);
    this.injectLifecycleApi();
    createContributionProvider(this.injector, ElectronMainContribution);
    this.createElectronMainModules(this.config.modules);

    this.registerMainApis();
  }

  async init() {
    // TODO scheme start
    if (!app.isReady()) {
      await new Promise((resolve) => {
        app.on('ready', resolve);
      });
    }
  }

  registerMainApis() {
    for (const contribution of this.contributions ) {
      if (contribution.registerMainApi) {
        contribution.registerMainApi(this.injector.get(ElectronMainApiRegistry));
      }
    }
  }

  loadWorkspace(workspace?: string, metadata: any = {}, options: BrowserWindowConstructorOptions & ICodeWindowOptions = {}, openOptions?: IWindowOpenOptions): CodeWindow {
    if (workspace && !URI.isUriString(workspace)) {
      workspace = URI.file(workspace).toString();
    }
    if (openOptions && openOptions.replace) {
      let replaceWindow = this.codeWindows.get(openOptions.windowId);
      if (!replaceWindow && this.codeWindows.size > 0) {
        replaceWindow = Array.from(this.codeWindows.values())[0];
      }
      if (replaceWindow) {
        replaceWindow.close();
      }
    }
    const window = this.injector.get(CodeWindow, [workspace, metadata, options]);
    const windowId = openOptions ? openOptions.windowId : uuid();
    this.codeWindows.set(windowId, window);
    window.start();
    if (options.show !== false) {
      window.getBrowserWindow().show();
    }
    window.onDispose(() => {
      this.codeWindows.delete(windowId);
    });

    return window;
  }

  get contributions() {
    return (this.injector.get(ElectronMainContribution) as ContributionProvider<ElectronMainContribution>).getContributions();
  }

  getCodeWindows() {
    return Array.from(this.codeWindows.values());
  }

  getCodeWindowByElectronBrowserWindowId(id: number) {
    for (const window of this.getCodeWindows()) {
      if (window.getBrowserWindow() && window.getBrowserWindow().id === id ) {
        return window;
      }
    }
  }

  private createElectronMainModules(Constructors: Array<ConstructorOf<ElectronMainModule>> = []) {

    for (const Constructor of Constructors) {
      this.modules.push(this.injector.get(Constructor));
    }
    for (const instance of this.modules) {
      if (instance.providers) {
        this.injector.addProviders(...instance.providers);
      }

      if (instance.contributionProvider) {
        if (Array.isArray(instance.contributionProvider)) {
          for (const contributionProvider of instance.contributionProvider) {
            createContributionProvider(this.injector, contributionProvider);
          }
        } else {
          createContributionProvider(this.injector, instance.contributionProvider);
        }
      }
    }

  }

  private injectLifecycleApi() {
    const registry: ElectronMainApiRegistry = this.injector.get(ElectronMainApiRegistry);
    registry.registerMainApi('lifecycle', new ElectronMainLifeCycleApi(this));
  }

}

class ElectronMainLifeCycleApi implements IElectronMainApiProvider<void> {

  eventEmitter: undefined;

  constructor(private app: ElectronMainApp) {

  }

  openWorkspace(workspace: string, openOptions: IWindowOpenOptions) {
    if (workspace) {
      for (const window of this.app.getCodeWindows()) {
        if (window.workspace && window.workspace.toString() === workspace) {
          window.getBrowserWindow().show();
          return;
        }
      }
    }
    this.app.loadWorkspace(workspace, {}, {}, openOptions);
  }

  minimizeWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      window.minimize();
    }
  }

  fullscreenWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      window.setFullScreen(true);
    }
  }
  maximizeWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      window.maximize();
    }
  }

  unmaximizeWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      window.unmaximize();
    }
  }
  closeWindow(windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      const codeWindow = this.app.getCodeWindowByElectronBrowserWindowId(windowId);
      if (codeWindow && codeWindow.isReloading) {
        codeWindow.isReloading = false;
        codeWindow.startNode().then(() => {
          window.webContents.reload();
        });
      } else {
        window.close();
      }
    }
  }

  reloadWindow(windowId: number) {
    const codeWindow = this.app.getCodeWindowByElectronBrowserWindowId(windowId);
    if (codeWindow) {
      codeWindow.reload();
    }
  }

}
