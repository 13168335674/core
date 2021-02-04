import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { Disposable, IEventBus, EventBusImpl, StorageProvider, URI } from '@ali/ide-core-common';
import { IDebugSessionManager } from '@ali/ide-debug';
import { PreferenceService } from '@ali/ide-core-browser';
import { DebugViewModel } from '@ali/ide-debug/lib/browser/view/debug-view-model';
import { IWorkspaceService } from '@ali/ide-workspace';
import { MockInjector } from '@ali/ide-dev-tool/src/mock-injector';
import { DebugConfigurationService } from '@ali/ide-debug/lib/browser/view/configuration/debug-configuration.service';
import { DebugConsoleService } from '@ali/ide-debug/lib/browser/view/console/debug-console.service';
import { DebugConfigurationManager } from '@ali/ide-debug/lib/browser/debug-configuration-manager';
import { DEFAULT_CONFIGURATION_NAME_SEPARATOR } from '@ali/ide-debug';

describe('Debug Configuration Service', () => {
  const mockInjector = createBrowserInjector([], new MockInjector([
    {
      token: IEventBus,
      useClass: EventBusImpl,
    },
  ]));
  let debugConfigurationService: DebugConfigurationService;

  const mockDebugSessionManager = {
    onDidDestroyDebugSession: jest.fn(() => Disposable.create(() => { })),
    onDidChangeActiveDebugSession: jest.fn(() => Disposable.create(() => { })),
    start: jest.fn(),
  };

  const mockDebugViewModel = {
    onDidChange: jest.fn(),
  };

  const mockWorkspaceService = {
    roots: [],
    onWorkspaceChanged: jest.fn(),
    isMultiRootWorkspaceEnabled: true,
    tryGetRoots: () => ([]),
  };

  const mockDebugConfigurationManager = {
    all: [],
    find: jest.fn(() => ({
      configuration: {
        name: 'test',
      },
      workspaceFolderUri: URI.file('home/workspace').toString(),
      index: 0,
    })),
    onDidChange: jest.fn(),
    current: {
      configuration: {
        name: 'test',
      },
      workspaceFolderUri: URI.file('home/workspace').toString(),
      index: 0,
    },
    addConfiguration: jest.fn(),
    openConfiguration: jest.fn(),
  };

  const mockPreferenceService = {
    onPreferenceChanged: jest.fn(),
    get: jest.fn(() => true),
  };

  const mockDebugConsoleService = {
    activate: jest.fn(),
  };

  const mockStorage = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockStorageProvider = () => mockStorage;

  beforeAll(async (done) => {
    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: mockDebugSessionManager,
    });
    mockInjector.addProviders({
      token: DebugConfigurationManager,
      useValue: mockDebugConfigurationManager,
    });
    mockInjector.overrideProviders({
      token: DebugConsoleService,
      useValue: mockDebugConsoleService,
    });
    mockInjector.overrideProviders({
      token: StorageProvider,
      useValue: mockStorageProvider,
    });
    mockInjector.overrideProviders({
      token: IWorkspaceService,
      useValue: mockWorkspaceService,
    });
    mockInjector.overrideProviders({
      token: DebugViewModel,
      useValue: mockDebugViewModel,
    });
    mockInjector.overrideProviders({
      token: PreferenceService,
      useValue: mockPreferenceService,
    });
    mockInjector.overrideProviders({
      token: DebugConfigurationService,
      useClass: DebugConfigurationService,
    });
    debugConfigurationService = mockInjector.get(DebugConfigurationService);
    await debugConfigurationService.whenReady;
    done();
  });

  it('should have enough API', () => {
    expect(typeof debugConfigurationService.init).toBe('function');
    expect(debugConfigurationService.currentValue).toBe(`test${DEFAULT_CONFIGURATION_NAME_SEPARATOR}file:///home/workspace__INDEX__0`);
    expect(debugConfigurationService.float).toBeTruthy();
    expect(debugConfigurationService.configurationOptions).toEqual(mockDebugConfigurationManager.all);
    expect(typeof debugConfigurationService.updateCurrentValue).toBe('function');
    expect(typeof debugConfigurationService.updateConfigurationOptions).toBe('function');
    expect(typeof debugConfigurationService.start).toBe('function');
    expect(typeof debugConfigurationService.openConfiguration).toBe('function');
    expect(typeof debugConfigurationService.openDebugConsole).toBe('function');
    expect(typeof debugConfigurationService.addConfiguration).toBe('function');
    expect(typeof debugConfigurationService.updateConfiguration).toBe('function');
    expect(typeof debugConfigurationService.toValue).toBe('function');
    expect(typeof debugConfigurationService.toName).toBe('function');
    expect(typeof debugConfigurationService.getCurrentConfiguration).toBe('function');
    expect(typeof debugConfigurationService.setCurrentConfiguration).toBe('function');
  });

  it('should init success', () => {
    expect(mockDebugConfigurationManager.onDidChange).toBeCalledTimes(1);
    expect(mockPreferenceService.onPreferenceChanged).toBeCalledTimes(1);
    expect(mockPreferenceService.get).toBeCalledTimes(1);
  });

  it('updateCurrentValue method should be work', () => {
    const value = 'test';
    debugConfigurationService.updateCurrentValue(value);
    expect(debugConfigurationService.currentValue).toBe(value);
  });

  it('updateConfigurationOptions method should be work', () => {
    debugConfigurationService.updateConfigurationOptions();
    expect(debugConfigurationService.currentValue).toBe(`test${DEFAULT_CONFIGURATION_NAME_SEPARATOR}file:///home/workspace__INDEX__0`);
  });

  it('start method should be work', () => {
    debugConfigurationService.start();
    expect(mockDebugSessionManager.start).toBeCalledTimes(1);
    mockDebugConfigurationManager.current = undefined as any;
    debugConfigurationService.start();
    expect(mockDebugConfigurationManager.addConfiguration).toBeCalledTimes(1);
    mockDebugConfigurationManager.current = {
      configuration: {
        name: 'test',
      },
      workspaceFolderUri: URI.file('home/workspace').toString(),
      index: 0,
    };
  });

  it('openConfiguration method should be work', () => {
    debugConfigurationService.openConfiguration();
    expect(mockDebugConfigurationManager.openConfiguration).toBeCalledTimes(1);
  });

  it('openDebugConsole method should be work', () => {
    debugConfigurationService.openDebugConsole();
    expect(mockDebugConsoleService.activate).toBeCalledTimes(1);
  });

  it('addConfiguration method should be work', () => {
    debugConfigurationService.addConfiguration();
    expect(mockDebugConfigurationManager.addConfiguration).toBeCalledTimes(2);
  });

  it('toValue method should be work', () => {
    let value = debugConfigurationService.toValue({configuration: {name: 'test'}, workspaceFolderUri: URI.file('home/workspace').toString(), index: 1} as any);
    expect(value).toBe(`test${DEFAULT_CONFIGURATION_NAME_SEPARATOR}file:///home/workspace__INDEX__1`);
    value = debugConfigurationService.toValue({configuration: {name: 'test'}, workspaceFolderUri: URI.file('home/workspace').toString()} as any);
    expect(mockDebugConfigurationManager.find).toBeCalledTimes(1);
    expect(value).toBe(`test${DEFAULT_CONFIGURATION_NAME_SEPARATOR}file:///home/workspace__INDEX__0`);
  });

  it('toName method should be work', () => {
    let value = debugConfigurationService.toName({configuration: {name: 'test'}, workspaceFolderUri: URI.file('home/workspace').toString()} as any);
    expect(value).toBe('test (workspace)');
    value = debugConfigurationService.toName({configuration: {name: 'test'}} as any);
    expect(value).toBe('test');
  });

  it('getCurrentConfiguration method should be work', async (done) => {
    mockStorage.get.mockClear();
    await debugConfigurationService.getCurrentConfiguration();
    expect(mockStorage.get).toBeCalledTimes(1);
    done();
  });

  it('setCurrentConfiguration method should be work', async (done) => {
    mockStorage.set.mockClear();
    await debugConfigurationService.setCurrentConfiguration('test');
    expect(mockStorage.set).toBeCalledTimes(1);
    done();
  });
});
