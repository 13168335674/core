import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IWorkspaceService } from '@ali/ide-workspace';
import { URI, IFileServiceClient, StorageProvider } from '@ali/ide-core-common';
import { PreferenceService, CorePreferences, FILES_DEFAULTS, IClientApp } from '@ali/ide-core-browser';
import { WorkspaceModule } from '../../src/browser';
import { FileStat } from '@ali/ide-file-service';
import { WorkspacePreferences } from '../../src/browser/workspace-preferences';
import { MockedStorageProvider } from '@ali/ide-core-browser/lib/mocks/storage';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { IWindowService } from '@ali/ide-window';

describe('WorkspaceService should be work while workspace was a single directory', () => {
  let workspaceService: WorkspaceService;
  let injector: MockInjector;
  const workspaceUri = new URI('file://userhome/');
  const workspaceStat = {
    uri: workspaceUri.toString(),
    lastModification: new Date().getTime(),
    isDirectory: true,
  } as FileStat;
  const mockFileSystem = {
    onFilesChanged: jest.fn(),
    watchFileChanges: jest.fn(() => ({
      dispose: () => {},
    })),
    setWatchFileExcludes: jest.fn(),
    setFilesExcludes: jest.fn(),
    getFileStat: jest.fn((uriStr) => {
      return {
        uri: uriStr,
        lastModification: new Date().getTime(),
        isDirectory: true,
      } as FileStat;
    }),
    exists: jest.fn(() => true),
    getCurrentUserHome: jest.fn(() => {
      return workspaceStat;
    }),
    setContent: jest.fn((stat) => {
      return stat;
    }),
    resolveContent: jest.fn(),
    createFile: jest.fn(),
  };
  const mockCorePreferences = {
    onPreferenceChanged: jest.fn(),
    'files.watcherExclude': FILES_DEFAULTS.filesWatcherExclude,
    'files.exclude': FILES_DEFAULTS.filesExclude,
  };
  const mockWorkspacePreferences = {
    onPreferenceChanged: jest.fn(),
    'workspace.supportMultiRootWorkspace': true,
  };
  let mockStorage = {};
  const mockRecentStorage = {
    get: jest.fn((name) => {
      return mockStorage[name] || [];
    }),
    set: jest.fn((name, value) => {
      mockStorage[name] = value;
    }),
  };
  const mockClientApp = {
    fireOnReload: jest.fn(),
  };
  const mockWindowService = {
    openNewWindow: jest.fn(),
  };
  const mockPreferenceService = {
    inspect: jest.fn(),
  };
  beforeEach(async (done) => {
    injector = createBrowserInjector([
      WorkspaceModule,
    ]);

    injector.overrideProviders(
      {
        token: PreferenceService,
        useValue: mockPreferenceService,
      },
      {
        token: IFileServiceClient,
        useValue: mockFileSystem,
      },
      {
        token: CorePreferences,
        useValue: mockCorePreferences,
      },
      {
        token: StorageProvider,
        useValue: MockedStorageProvider,
      },
      {
        token: WorkspacePreferences,
        useValue: mockWorkspacePreferences,
      },
      {
        token: IClientApp,
        useValue: mockClientApp,
      },
      {
        token: IWindowService,
        useValue: mockWindowService,
      },
    );
    mockFileSystem.watchFileChanges.mockResolvedValue({dispose: () => {}});
    workspaceService = injector.get(IWorkspaceService);
    await workspaceService.whenReady;
    done();
  });

  afterEach(() => {
    mockFileSystem.onFilesChanged.mockReset();
    mockFileSystem.watchFileChanges.mockReset();
    mockFileSystem.setWatchFileExcludes.mockReset();
    mockFileSystem.setFilesExcludes.mockReset();
    mockFileSystem.getFileStat.mockReset();
    mockFileSystem.getCurrentUserHome.mockReset();
    mockFileSystem.setContent.mockReset();
    mockFileSystem.exists.mockReset();
    mockFileSystem.createFile.mockReset();
    mockFileSystem.resolveContent.mockReset();
    mockCorePreferences.onPreferenceChanged.mockReset();
    mockRecentStorage.get.mockReset();
    mockRecentStorage.set.mockReset();
    mockClientApp.fireOnReload.mockReset();
    mockWindowService.openNewWindow.mockReset();
    mockStorage = {};
    injector.disposeOne(IWorkspaceService);
  });

  it('should have enough API', async (done) => {
    expect(workspaceService.workspace).toBeDefined();
    expect(mockFileSystem.watchFileChanges).toBeCalledWith(new URI(workspaceService.workspace!.uri));
    expect(mockFileSystem.onFilesChanged).toBeCalledTimes(1);
    expect(mockFileSystem.setFilesExcludes).toBeCalledTimes(1);
    expect(mockFileSystem.setWatchFileExcludes).toBeCalledTimes(1);
    expect((await workspaceService.roots).length).toBe(1);
    expect(workspaceService.workspace).toBeDefined();
    expect(workspaceService.opened).toBeTruthy();
    expect(workspaceService.isMultiRootWorkspaceEnabled).toBeTruthy();
    expect(workspaceService.isMultiRootWorkspaceOpened).toBeFalsy();
    done();
  });

  it('tryGetRoots method should be work', () => {
    expect(workspaceService.tryGetRoots()).toBeDefined();
  });

  it('event method should be exist', () => {
    expect(workspaceService.onWorkspaceChanged).toBeDefined();
    expect(workspaceService.onWorkspaceLocationChanged).toBeDefined();
  });

  it('getMostRecentlyUsedWorkspace/setMostRecentlyUsedWorkspace method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.parent.resolve('new_folder');
    await workspaceService.setMostRecentlyUsedWorkspace(newWorkspaceUri.toString());
    const recent = await workspaceService.getMostRecentlyUsedWorkspace();
    expect(recent).toBe(newWorkspaceUri.toString());
    done();
  });

  it('getMostRecentlyUsedCommands/setMostRecentlyUsedCommand method should be work', async (done) => {
    const command = 'command';
    await workspaceService.setMostRecentlyUsedCommand(command);
    const recent = await workspaceService.getMostRecentlyUsedCommands();
    expect(recent).toStrictEqual([command]);
    done();
  });

  it('open method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.parent.resolve('new_folder');
    mockFileSystem.getFileStat.mockResolvedValue({
      uri: newWorkspaceUri.toString(),
      isDirectory: true,
      lastModification: new Date().getTime(),
    });
    await workspaceService.open(newWorkspaceUri, {preserveWindow: true});
    expect(mockClientApp.fireOnReload).toBeCalledWith(true);
    await workspaceService.open(newWorkspaceUri);
    expect(mockWindowService.openNewWindow).toBeCalledTimes(1);
    done();
  });

  it('addRoot method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.resolve('new_folder');
    // re-set _workspace cause the workspace would be undefined in some cases
    injector.mock(IWorkspaceService, '_workspace', {
      uri: workspaceUri.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    } as FileStat);
    mockFileSystem.getCurrentUserHome.mockResolvedValue({
      uri: workspaceUri.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    } as FileStat);
    mockFileSystem.getFileStat.mockImplementation((uriStr) => {
      return {
        uri: uriStr,
        lastModification: new Date().getTime(),
        isDirectory: true,
      } as FileStat;
    });
    mockFileSystem.resolveContent.mockResolvedValue({
      stat: {},
      content: JSON.stringify({
        folders: [],
        settings: {},
      }),
    });
    mockFileSystem.setContent.mockImplementation((stat) => {
      return stat;
    });
    await workspaceService.addRoot(newWorkspaceUri);
    expect(mockFileSystem.setContent).toBeCalledTimes(2);
    done();
  });

  it('removeRoots method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.resolve('new_folder');
    // re-set _workspace cause the workspace would be undefined in some cases
    injector.mock(IWorkspaceService, '_workspace', {
      uri: workspaceUri.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    } as FileStat);
    mockFileSystem.resolveContent.mockResolvedValue({
      stat: {},
      content: JSON.stringify({
        folders: [workspaceUri.toString()],
        settings: {},
      }),
    });
    injector.mock(IFileServiceClient, 'exists', jest.fn(() => true));
    await workspaceService.removeRoots([newWorkspaceUri]);
    expect(mockFileSystem.setContent).toBeCalledTimes(1);
    done();
  });

  it('containsSome method should be work', async (done) => {
    injector.mock(IWorkspaceService, 'roots', [
      workspaceStat,
    ]);
    injector.mock(IWorkspaceService, '_roots', [
      workspaceStat,
    ]);
    injector.mock(IWorkspaceService, 'opened', true);
    mockFileSystem.exists.mockResolvedValue(true);
    const result = await workspaceService.containsSome(['test.js']);
    // always return true
    expect(result).toBeTruthy();
    done();
  });

  it('getWorkspaceRootUri method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.resolve('new_folder');
    injector.mock(IWorkspaceService, '_roots', [
      workspaceStat,
    ]);
    const result = workspaceService.getWorkspaceRootUri(newWorkspaceUri);
    expect(result?.toString()).toBe(workspaceUri.toString());
    done();
  });

  it('asRelativePath method should be work', async (done) => {
    const newWorkspaceUri = workspaceUri.resolve('new_folder');
    injector.mock(IWorkspaceService, 'roots', [
      workspaceStat,
    ]);
    const result = await workspaceService.asRelativePath(newWorkspaceUri);
    expect(result).toBe('new_folder');
    done();
  });
});
