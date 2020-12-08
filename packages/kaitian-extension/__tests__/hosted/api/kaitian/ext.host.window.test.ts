import { IRPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { MainThreadKaitianAPIIdentifier } from '../../../../src/common/kaitian';
import { MainThreadAPIIdentifier } from '../../../../src/common/vscode';
import { ExtHostCommands } from '../../../../src/hosted/api/vscode/ext.host.command';
import { ExtHostIDEWindow } from '@ali/ide-kaitian-extension/lib/hosted/api/kaitian/ext.host.window';
import { createBrowserInjector } from '../../../../../debug/node_modules/@ali/ide-dev-tool/src/injector-helper';
import { createWindowApiFactory } from '@ali/ide-kaitian-extension/lib/hosted/api/kaitian/ext.host.window';

const mockMainThreadIDEWindowProxy = {
  $createWebviewWindow: jest.fn(),
  $show: jest.fn(),
  $hide: jest.fn(),
  $postMessage: jest.fn(),
  $loadURL: jest.fn(),
  $setSize: jest.fn(),
  $destroy: jest.fn(),
  $setAlwaysOnTop: jest.fn(),
};

const mockMainThreadCommandProxy = {
  $executeCommand: jest.fn(() => new Promise(() => ({}))),
};

const map = new Map();

const rpcProtocol: IRPCProtocol = {
  getProxy: (key) => {
    return map.get(key);
  },
  set: (key, value) => {
    map.set(key, value);
    return value;
  },
  get: (r) => map.get(r),
};

describe('packages/kaitian-extension/__tests__/hosted/api/kaitian/ext.host.window.test.ts', () => {
  let extHostIDEWindow: ExtHostIDEWindow;
  let extHostCommands: ExtHostCommands;
  let windowAPI;

  const injector = createBrowserInjector([]);

  beforeAll(() => {
    rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadIDEWindow, mockMainThreadIDEWindowProxy as any);
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, mockMainThreadCommandProxy as any);

    extHostIDEWindow = injector.get(ExtHostIDEWindow, [rpcProtocol]);
    extHostCommands = injector.get(ExtHostCommands, [rpcProtocol]);
    windowAPI = createWindowApiFactory(extHostCommands, extHostIDEWindow);
  });

  it('reloadWindow should be work', () => {
    windowAPI.reloadWindow();
    expect(mockMainThreadCommandProxy.$executeCommand).toBeCalledTimes(1);
  });

  describe('createWebviewWindow should be work', () => {
    const webviewId = 'TestView';
    let window;

    beforeAll(async (done) => {
      window = await windowAPI.createWebviewWindow(webviewId, {}, {});
      done();
    });

    it ('message event can be received', async (done) => {
      expect(window).toBeDefined();
      const testMessage = 'message';
      window.onMessage((message)  => {
        expect(message).toBe(testMessage);
        done();
      });
      extHostIDEWindow.$postMessage(webviewId, testMessage);
    });

    it ('closed event can be received', async (done) => {
      window.onClosed(()  => {
        done();
      });
      extHostIDEWindow.$dispatchClosed(webviewId);
    });

    it ('show method should be work', () => {
      window.show();
      expect(mockMainThreadIDEWindowProxy.$show).toBeCalledTimes(1);
    });

    it ('hide method should be work', () => {
      window.hide();
      expect(mockMainThreadIDEWindowProxy.$hide).toBeCalledTimes(1);
    });

    it ('postMessage method should be work', () => {
      window.postMessage('message');
      expect(mockMainThreadIDEWindowProxy.$postMessage).toBeCalledTimes(1);
    });

    it ('loadUrl method should be work', () => {
      window.loadUrl('http://kaitian.com');
      expect(mockMainThreadIDEWindowProxy.$loadURL).toBeCalledTimes(1);
    });

    it ('setSize method should be work', () => {
      window.setSize({width: 100, height: 200});
      expect(mockMainThreadIDEWindowProxy.$setSize).toBeCalledTimes(1);
    });

    it ('setAlwaysOnTop method should be work', () => {
      window.setAlwaysOnTop(true);
      expect(mockMainThreadIDEWindowProxy.$setSize).toBeCalledTimes(1);
    });

    it ('dispose method should be work', () => {
      window.dispose();
      expect(mockMainThreadIDEWindowProxy.$destroy).toBeCalledTimes(1);
    });
  });
});
