import * as path from 'path';
import { Emitter as EventEmitter, Disposable, ILoggerManagerClient, StorageProvider, Uri, IFileServiceClient } from '@ali/ide-core-common';
import { RPCProtocol } from '@ali/ide-connection';
import { ITerminalApiService, ITerminalClientFactory, ITerminalController, ITerminalGroupViewService, ITerminalInternalService, ITerminalService, ITerminalTheme } from '@ali/ide-terminal-next';
import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '../../../../src/common/vscode';
import { ExtHostTerminal } from '../../../../src/hosted/api/vscode/ext.host.terminal';
import { MainThreadTerminal } from '../../../../src/browser/vscode/api/main.thread.terminal';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { ExtHostTasks } from '../../../../src/hosted/api/vscode/tasks/ext.host.tasks';
import { MainthreadTasks } from '../../../../src/browser/vscode/api/main.thread.tasks';
import { ExtensionDocumentDataManagerImpl } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/doc';
import { ExtHostMessage } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.message';
import { ExtHostWorkspace } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.workspace';
import { mockExtensionProps } from '../../../__mock__/extensions';
import { ITaskService, ITaskSystem } from '@ali/ide-task/lib/common';
import { MockLoggerManageClient } from '@ali/ide-core-browser/lib/mocks/logger';
import { IWorkspaceService } from '@ali/ide-workspace/lib/common/workspace-defination';
import { TaskService } from '@ali/ide-task/lib/browser/task.service';
import { IEditorDocumentModelService, WorkbenchEditorService } from '@ali/ide-editor/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout/lib/common/main-layout.defination';
import { MockMainLayoutService, MockSocketService, MockTerminalThemeService } from '../../../../../terminal-next/__tests__/browser/mock.service';
import { OutputPreferences } from '@ali/ide-output/lib/browser/output-preference';
import { TerminalTaskSystem } from '@ali/ide-task/lib/browser/terminal-task-system';
import { MockedStorageProvider } from '@ali/ide-core-browser/lib/mocks/storage';
import { ITaskDefinitionRegistry, TaskDefinitionRegistryImpl } from '@ali/ide-core-common/lib/task-definition';
import { IVariableResolverService } from '@ali/ide-variable';
import { VariableResolverService } from '@ali/ide-variable/lib/browser/variable-resolver.service';
import { TerminalGroupViewService } from '@ali/ide-terminal-next/lib/browser/terminal.view';
import { TerminalClientFactory } from '@ali/ide-terminal-next/lib/browser/terminal.client';
import { TerminalController } from '@ali/ide-terminal-next/lib/browser/terminal.controller';
import { TerminalInternalService } from '@ali/ide-terminal-next/lib/browser/terminal.service';
import { TerminalPreference } from '@ali/ide-terminal-next/lib/browser/terminal.preference';
import { ITerminalPreference } from '@ali/ide-terminal-next/lib/common/preference';
import { MockFileServiceClient } from '@ali/ide-file-service/lib/common/mocks';
import { CustomBuildTaskProvider } from './__mock__/taskProvider';
import { IDisposable } from 'kaitian';

const extension = mockExtensionProps;

const emitterA = new EventEmitter<any>();
const emitterB = new EventEmitter<any>();

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

let extHostTask: ExtHostTasks;
let extHostTerminal: ExtHostTerminal;
let mainThreadTerminal: MainThreadTerminal;
let mainThreadTask: MainthreadTasks;

describe('ExtHostTask API', () => {
  const injector = createBrowserInjector([]);

  injector.addProviders({
    token: ITerminalApiService,
    useValue: mockService({
      terminals: [],
      onDidChangeActiveTerminal: () => Disposable.NULL,
      onDidCloseTerminal: () => Disposable.NULL,
      onDidOpenTerminal: () => Disposable.NULL,
      createTerminal: (options) => {
        return {
          id: options.name,
        };
      },
    }),
  },
  {
    token: ITerminalService,
    useValue: new MockSocketService(),
  },
  {
    token: ITerminalInternalService,
    useClass: TerminalInternalService,
  }, {
    token: StorageProvider,
    useValue: MockedStorageProvider,
  }, {
    token: ITaskService,
    useClass: TaskService,
  }, {
    token: ITaskSystem,
    useClass: TerminalTaskSystem,
  }, {
    token: ILoggerManagerClient,
    useClass: MockLoggerManageClient,
  },
  {
    token: ITerminalClientFactory,
    useFactory: (injector) => (widget, options = {}) => {
      return TerminalClientFactory.createClient(injector, widget, options);
    },
  },
  {
    token: IVariableResolverService,
    useClass: VariableResolverService,
  },
  {
    token: ITerminalGroupViewService,
    useClass: TerminalGroupViewService,
  },
  {
    token: OutputPreferences,
    useValue: {
      'output.logWhenNoPanel': true,
    },
  }, {
    token: IWorkspaceService,
    useValue: {
      tryGetRoots: () => ([{ uri: __dirname }]),
      getWorkspaceName: () => 'Test Workspace',
      getWorkspaceFolder: (uri) => {
        return { uri, name: 'Test Workspace' };
      },
    },
  },
  {
    token: ITaskDefinitionRegistry,
    useClass: TaskDefinitionRegistryImpl,
  },
  {
    token: WorkbenchEditorService,
    useValue: {},
  },
  {
    token: IFileServiceClient,
    useClass: MockFileServiceClient,
  },
  {
    token: ITerminalTheme,
    useValue:  new MockTerminalThemeService(),
  },
  {
    token: ITerminalPreference,
    useClass: TerminalPreference,
  },
  {
    token: ITerminalController,
    useClass: TerminalController,
  },
  {
    token: IEditorDocumentModelService,
    useValue: {
      getModelReference: jest.fn(() => ({
        instance: {
          dirty: false,
        },
        dispose: () => {},
      })),
      createModelReference: (uri) => {
        return Promise.resolve({
          instance: {
            uri,
            getMonacoModel: () => {
              return {
                onDidChangeContent: new EventEmitter().event,
                uri,
                setValue: () => {},
              };
            },
          },
          dispose: jest.fn(),
        });
      },
    },
  }, {
    token: IMainLayoutService,
    useValue: new MockMainLayoutService(),
  });

  const extHostMessage = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocolExt));
  const extHostDocs = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostDocuments, injector.get(ExtensionDocumentDataManagerImpl, [rpcProtocolExt]));
  const extHostWorkspace = new ExtHostWorkspace(rpcProtocolExt, extHostMessage, extHostDocs);

  extHostTerminal = new ExtHostTerminal(rpcProtocolExt);
  rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostTerminal, extHostTerminal);
  extHostTask = new ExtHostTasks(rpcProtocolExt, extHostTerminal, extHostWorkspace);
  mainThreadTerminal = injector.get(MainThreadTerminal, [rpcProtocolMain]);
  mainThreadTask = injector.get(MainthreadTasks, [rpcProtocolMain]);

  rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostTasks, extHostTask);
  rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadTerminal, mainThreadTerminal);
  rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadTasks, mainThreadTask);
  extHostTask.registerTaskProvider('custombuildscript', new CustomBuildTaskProvider(path.join(__dirname, 'test')), extension);

  const taskService: ITaskService = injector.get(ITaskService);
  const taskDefinition: ITaskDefinitionRegistry = injector.get(ITaskDefinitionRegistry);
  taskDefinition.register('custombuildscript', {
    extensionId: extension.id,
    taskType: 'custombuildscript',
    required: [],
    properties: {},
  });

  extHostWorkspace['folders'] = [{ uri: Uri.file(__dirname), name: 'Test Workspace', index: 0 }];

  it('register custombuildscript taskProvider', async (done) => {
    expect(mainThreadTask['providers'].size).toBe(1);
    const taskHandler = mainThreadTask['providers'].get(1);
    expect(taskHandler).toBeDefined();
    done();
  });

  it('provide tasks', async (done) => {
    const taskHandler = mainThreadTask['providers'].get(1);
    const taskSet = await taskHandler?.provider.provideTasks({ 'custombuildscript': true });
    expect(taskSet).toBeDefined();
    expect(taskSet?.type).toBe('custombuildscript');
    expect(taskSet?.tasks.length).toBe(6);
    done();
  });

  // TODO: 需要 mock 的太多, 只能测到这里了
  it('run custombuild task', async (done) => {
    const taskSet = await taskService['getGroupedTasks']();
    taskService.run(taskSet[0].tasks[0]);
    extHostTask.onDidStartTask((e) => {
      expect(e.execution.task.definition.type).toBe('custombuildscript');
      expect(e.execution.task.name).toBe('32 watch incremental');
      done();
    });
  }, 5000);
});
