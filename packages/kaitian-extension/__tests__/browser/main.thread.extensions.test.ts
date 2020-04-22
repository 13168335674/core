import * as ideCoreCommon from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { OutputPreferences } from '@ali/ide-output/lib/browser/output-preference';
import * as types from '../../src/common/vscode/ext-types';
import { createExtensionsApiFactory } from '../../src/hosted/api/vscode/ext.host.extensions';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import ExtensionHostServiceImpl from '../../src/hosted/ext.host';
import { ExtensionService, ExtensionNodeServiceServerPath } from '../../src/common';
import { ExtensionServiceImpl } from '../../src/browser/extension.service';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '../../src/common/vscode';
import { MainThreadStorage } from '../../src/browser/vscode/api/main.thread.storage';
import { MainThreadExtensionLogIdentifier } from '../../src/common/extension-log';
import { MainThreadExtensionLog } from '../../src/browser/extension-log';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { IContextKeyService, AppConfig } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { GlobalStorageServerPath } from '@ali/ide-storage';
import { MainThreadWebview } from '../../src/browser/vscode/api/main.thread.api.webview';

import { MockExtNodeClientService } from '../__mock__/extension.service.client';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { MockWorkbenchEditorService } from '../../../editor/src/common/mocks/workbench-editor.service';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MockedStorageProvider } from '@ali/ide-core-browser/lib/mocks/storage';
import { FileSearchServicePath } from '@ali/ide-file-search';
import { IWorkspaceService } from '@ali/ide-workspace';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { IThemeService, IIconService } from '@ali/ide-theme';
import { IconService } from '@ali/ide-theme/lib/browser';
import { MockFileServiceClient } from '@ali/ide-file-service/lib/common/mocks';
import { WorkspacePreferences } from '@ali/ide-workspace/lib/browser/workspace-preferences';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';

@Injectable()
class MockLoggerManagerClient {
  getLogger = () => {
    return {
      log() { },
      debug() { },
      error() { },
      verbose() { },
      warn() {},
    };
  }
}

@Injectable()
class MockStaticResourceService {
  resolveStaticResource(uri: ideCoreCommon.URI) {
    return uri.toString();
  }
  resourceRoots: [] = [];
}

const emitterA = new ideCoreCommon.Emitter<any>();
const emitterB = new ideCoreCommon.Emitter<any>();

const mockClientA = {
  send: (msg) => emitterB.fire(msg),
  onMessage: emitterA.event,
};
const mockClientB = {
  send: (msg) => emitterA.fire(msg),
  onMessage: emitterB.event,
};

const rpcProtocolExt = new RPCProtocol(mockClientA);

const rpcProtocolMain = new RPCProtocol(mockClientB);

describe('MainThreadExtensions Test Suites', () => {
  const injector = createBrowserInjector([], new MockInjector([{
      token: OutputPreferences,
      useValue: {
        'output.logWhenNoPanel': true,
      },
    },  {
      token: AppConfig,
      useValue: {
        noExtHost: false,
      },
    }, {
      token: WorkbenchEditorService,
      useClass: MockWorkbenchEditorService,
    }, {
      token: IContextKeyService,
      useClass: MockContextKeyService,
    }, {
      token: ExtensionNodeServiceServerPath,
      useClass: MockExtNodeClientService,
    }, {
      token: ExtensionService,
      useClass: ExtensionServiceImpl,
    }, {
      token: IExtensionStorageService,
      useValue: {
        whenReady: Promise.resolve(true),
        extensionStoragePath: {},
        set() { },
        get() { },
        getAll() { },
        reConnectInit() { },
      },
    }, {
      token: IWorkspaceService,
      useClass: WorkspaceService,
    }, {
      token: FileSearchServicePath,
      useValue: {
        find: () => Promise.resolve([]),
      },
    }, {
      token: ideCoreCommon.StorageProvider,
      useValue: MockedStorageProvider,
    }, {
      token: StaticResourceService,
      useClass: MockStaticResourceService,
    }, {
      token: IThemeService,
      useValue: {
        applyTheme: () => {
        },
      },
    }, {
      token: GlobalStorageServerPath,
      useValue: {
        getItems() {
          return JSON.stringify({ language: 'zh_CN' });
        },
        init() {
          return Promise.resolve();
        },
        get() {
          return '';
        },
      },
    }, {
      token: IIconService,
      useClass: IconService,
    }, {
      token: ideCoreCommon.ILoggerManagerClient,
      useClass: MockLoggerManagerClient,
    }, {
      token: ideCoreCommon.IFileServiceClient,
      useClass: MockFileServiceClient,
    }, {
      token: WorkspacePreferences,
      useValue: {
        onPreferenceChanged: () => {},
      },
    }]));
  let extHostExtension: ReturnType<typeof createExtensionsApiFactory>;
  let mainthreadService: ExtensionServiceImpl;
  let extensionHostService: ExtensionHostServiceImpl;
  const disposables: types.OutputChannel[] = [];

  afterAll(() => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  });

  beforeAll(async (done) => {
    injector.get(WorkbenchEditorService);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadWebview, injector.get(MainThreadWebview, [rpcProtocolMain]));
    extensionHostService = new ExtensionHostServiceImpl(rpcProtocolExt, new MockLoggerManagerClient().getLogger());
    mainthreadService = injector.get(ExtensionService);
    rpcProtocolMain.set(MainThreadExtensionLogIdentifier, injector.get(MainThreadExtensionLog, []));
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadStorage, injector.get(MainThreadStorage, [rpcProtocolMain]));
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadExtensionService, mainthreadService);
    rpcProtocolMain.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionHostService);
    await mainthreadService.activate();
    await extensionHostService.init();
    await extensionHostService.$initExtensions();
    extHostExtension = createExtensionsApiFactory(rpcProtocolExt, extensionHostService, mainthreadService);
    done();
  });

  it('should get all extension by extHostExtensionApi', (done) => {
    expect(extHostExtension.all.length).toBe(1);
    done();
  });

  it('should get a extension by extHostExtensionApi', async (done) => {
    const extension = extHostExtension.getExtension('test.kaitian-extension');
    expect(extension).toBeDefined();
    expect(extension?.isActive).toBeFalsy();
    done();
  });

  it('should receive onDidChangeEvent when extension has changed', async (done) => {
    extHostExtension.onDidChange(() => {
      done();
    });

    extensionHostService.$fireChangeEvent();
  });
});
