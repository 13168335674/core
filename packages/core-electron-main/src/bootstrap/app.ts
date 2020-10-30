import { ElectronAppConfig, ElectronMainApiRegistry, ElectronMainContribution, IElectronMainApp, IElectronMainApiProvider, IParsedArgs } from './types';
import { CodeWindow } from './window';
import { Injector, ConstructorOf } from '@ali/common-di';
import { app, BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { ElectronMainApiRegistryImpl } from './api';
import { createContributionProvider, ContributionProvider, URI, ExtensionCandiDate, IEventBus, EventBusImpl, asExtensionCandidate } from '@ali/ide-core-common';
import { serviceProviders } from './services';
import { ICodeWindowOptions } from './types';
import { ElectronMainModule } from '../electron-main-module';
import { argv } from 'yargs';
import { WindowDestroyedEvent, WindowCreatedEvent } from './services/events';

export interface IWindowOpenOptions {
  windowId: number;
  // @deprecated
  replace?: boolean;
}

export class ElectronMainApp {

  private codeWindows: Map<number, CodeWindow> = new Map();

  private injector = new Injector();

  private modules: ElectronMainModule[] = [];

  private parsedArgs: IParsedArgs = {
    extensionDir: argv.extensionDir as string | undefined,
    extensionCandidate: argv.extensionCandidate ? ((Array.isArray(argv.extensionCandidate) ? argv.extensionCandidate : [argv.extensionCandidate])) : [],
    extensionDevelopmentPath: argv.extensionDevelopmentPath as string | undefined,
  };

  constructor(private config: ElectronAppConfig) {
    config.extensionDir =  this.parsedArgs.extensionDir ? this.parsedArgs.extensionDir : config.extensionDir || '';
    config.extensionCandidate = [
      ...config.extensionCandidate,
      ...this.parsedArgs.extensionCandidate.map((e) => asExtensionCandidate(e, false)),
    ];

    if (this.parsedArgs.extensionDevelopmentPath) {
      config.extensionCandidate = config.extensionCandidate.concat(
        Array.isArray(this.parsedArgs.extensionDevelopmentPath) ?
        this.parsedArgs.extensionDevelopmentPath.map((e) => asExtensionCandidate(e, true)) :
        [asExtensionCandidate(this.parsedArgs.extensionDevelopmentPath, true)]);
    }

    config.extensionDevelopmentHost = !!this.parsedArgs.extensionDevelopmentPath;

    this.injector.addProviders({
      token: IEventBus,
      useClass: EventBusImpl,
    }, {
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
    this.onBeforeReadyContribution();
    this.registerMainApis();
  }

  async init() {
    // TODO scheme start
    await app.whenReady().then(() => {
      this.onStartContribution();
    });
  }

  registerMainApis() {
    for (const contribution of this.contributions) {
      if (contribution.registerMainApi) {
        contribution.registerMainApi(this.injector.get(ElectronMainApiRegistry));
      }
    }
  }

  onStartContribution() {
    for (const contribution of this.contributions ) {
      if (contribution.onStart) {
        contribution.onStart();
      }
    }
  }

  onBeforeReadyContribution() {
    for (const contribution of this.contributions ) {
      if (contribution.beforeAppReady) {
        contribution.beforeAppReady();
      }
    }
  }

  loadWorkspace(workspace?: string, metadata: any = {}, options: BrowserWindowConstructorOptions & ICodeWindowOptions = {}, openOptions?: IWindowOpenOptions): CodeWindow {
    if (workspace && !URI.isUriString(workspace)) {
      workspace = URI.file(workspace).toString();
    }
    if (openOptions && openOptions.windowId) {
      const lastWindow = this.getCodeWindowByElectronBrowserWindowId(openOptions.windowId);
      if (lastWindow) {
        lastWindow.setWorkspace(workspace!);
        lastWindow.metadata = metadata;
        lastWindow.reload();
        return lastWindow;
      }
    }
    const window = this.injector.get(CodeWindow, [workspace, metadata, options]);
    window.start();
    if (options.show !== false) {
      window.getBrowserWindow().show();
    }
    const windowId = window.getBrowserWindow().id;
    this.codeWindows.set(windowId, window);
    window.addDispose({
      dispose: () => {
        this.injector.get(IEventBus).fire(new WindowDestroyedEvent(window));
        this.codeWindows.delete(windowId);
      },
    });
    this.injector.get(IEventBus).fire(new WindowCreatedEvent(window));

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
      if (!codeWindow) {
        window.close();
        return;
      }

      if (codeWindow.isReloading) {
        codeWindow.isReloading = false;
        codeWindow.startNode().then(() => {
          window.webContents.reload();
        });
      } else {
        codeWindow.clear().finally(() => {
          window.close();
        });
      }
    }
  }

  reloadWindow(windowId: number) {
    const codeWindow = this.app.getCodeWindowByElectronBrowserWindowId(windowId);
    if (codeWindow) {
      codeWindow.reload();
    }
  }

  setExtensionDir(extensionDir: string, windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      const codeWindow = this.app.getCodeWindowByElectronBrowserWindowId(windowId);
      if (codeWindow) {
        codeWindow.setExtensionDir(extensionDir);
      }
    }
  }

  setExtensionCandidate(candidate: ExtensionCandiDate[], windowId: number) {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      const codeWindow = this.app.getCodeWindowByElectronBrowserWindowId(windowId);
      if (codeWindow) {
        codeWindow.setExtensionCandidate(candidate);
      }
    }
  }
}
