import { ConstructorOf, ILoggerManagerClient } from '@ali/ide-core-common';
import { Injector, Injectable } from '@ali/common-di';
import { BrowserModule, ClientApp } from '@ali/ide-core-browser';
import { NodeModule } from '@ali/ide-core-node';
import { MockInjector } from './mock-injector';
import { MainLayout } from './mock-main';

@Injectable()
class MockMainLayout extends BrowserModule {
  component = MainLayout;
}

export interface MockClientApp extends ClientApp {
  injector: MockInjector;
}

export async function createBrowserApp(modules: Array<ConstructorOf<BrowserModule>>, inj?: MockInjector): Promise<MockClientApp> {
  const injector = inj || new MockInjector();
  // 需要依赖前后端模块
  injector.addProviders({
    token: ILoggerManagerClient,
    useValue: {
      getLogger() {},
    },
  });
  const app = new ClientApp({ modules: [MockMainLayout, ...modules], injector, layoutConfig: {} } as any) as MockClientApp;
  await app.start(document.getElementById('main')!);
  return app;
}

export function createBrowserInjector(modules: Array<ConstructorOf<BrowserModule>>, inj?: Injector): MockInjector {
  const injector = inj || new MockInjector();
  // TODO mock支持新版的引入
  const app = new ClientApp({ modules, injector } as any);

  return app.injector as MockInjector;
}

export function createNodeInjector(constructors: Array<ConstructorOf<NodeModule>>, inj?: MockInjector) {
  // TODO: 等 Node 这边的加载器写好之后，再把这里改一下
  const injector = inj || new MockInjector();

  for (const item of constructors) {
    const instance = injector.get(item);
    if (instance.providers) {
      injector.addProviders(...instance.providers);
    }
  }

  return injector;
}
