import { URI, IContextKeyService, Disposable } from '@ali/ide-core-browser';
import { DebugBreakpoint, BreakpointManager } from '@ali/ide-debug/lib/browser';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { DebugModel, DebugHoverWidget, DebugBreakpointWidget } from '../../../src/browser/editor';
import { ICtxMenuRenderer, AbstractMenuService } from '@ali/ide-core-browser/lib/menu/next';
import { IDebugModel, IDebugSessionManager } from '@ali/ide-debug';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { Injector } from '@ali/common-di';

describe('Debug Model', () => {
  const mockInjector = createBrowserInjector([]);
  let childInjector: Injector;
  let debugModel: IDebugModel;
  const testFileUri = URI.file('editor.js');
  const mockCtxMenuRenderer = {
    show: jest.fn(),
  } as any;

  const mockEditor = {
    getModel: jest.fn(() => ({
      uri: testFileUri,
      getDecorationRange: () => ({
        startLineNumber: 1,
        startColumn: 0,
        endLineNumber: 1,
        endColumn: 10,
      }),
      onDidLayoutChange: jest.fn(() => Disposable.create(() => {})),
      onDidChangeContent: jest.fn(() => Disposable.create(() => {})),
    })),
    onKeyDown: jest.fn(() => Disposable.create(() => {})),
    getPosition: jest.fn(() => ({lineNumber: 2, column: 1})),
    deltaDecorations: jest.fn(() => []),
    focus: jest.fn(),
  };

  const mockBreakpointManager = {
    onDidChange: jest.fn(() => Disposable.create(() => {})),
    delBreakpoint: jest.fn(() => Disposable.create(() => {})),
    addBreakpoint: jest.fn(() => Disposable.create(() => {})),
    updateBreakpoint: jest.fn(() => Disposable.create(() => {})),
    getBreakpoint: jest.fn(() => DebugBreakpoint.create(testFileUri, {line: 2})),
    getBreakpoints: jest.fn(() => [DebugBreakpoint.create(testFileUri, {line: 2})]),
  };

  const mockBreakpointWidget = {
    dispose: () => {},
    show: jest.fn(),
    hide: jest.fn(),
    position: {lineNumber: 1, column: 2},
    values: {
      condition: '',
      hitCondition: '',
      logMessage: '',
    },
  };

  const mockDebugHoverWidget = {
    getDomNode: jest.fn(),
    hide: jest.fn(),
    show: jest.fn(),
  };

  const mockMenuService = {
    createMenu: jest.fn(() => ({
      getMenuNodes: () => [],
    })),
  };

  beforeAll(() => {
    (global as any).monaco = createMockedMonaco() as any;

    mockInjector.overrideProviders({
      token: ICtxMenuRenderer,
      useValue: mockCtxMenuRenderer,
    });

    mockInjector.overrideProviders({
      token: BreakpointManager,
      useValue: mockBreakpointManager,
    });

    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: mockBreakpointManager,
    });

    mockInjector.overrideProviders({
      token: AbstractMenuService,
      useValue: mockMenuService,
    });

    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: {},
    });

    childInjector = DebugModel.createContainer(mockInjector, mockEditor as any);

    childInjector.overrideProviders({
      token: DebugHoverWidget,
      useValue: mockDebugHoverWidget,
    });

    childInjector.overrideProviders({
      token: DebugBreakpointWidget,
      useValue: mockBreakpointWidget,
    });
    debugModel = childInjector.get(IDebugModel);
  });

  afterAll(() => {

  });

  it('debugModel should be init success', () => {
    expect(mockEditor.onKeyDown).toBeCalledTimes(1);
    expect(mockEditor.getModel).toBeCalledTimes(1);
    expect(mockBreakpointManager.onDidChange).toBeCalledTimes(0);
  });

  it('should have enough API', () => {
    expect(typeof DebugModel.createContainer).toBe('function');
    expect(typeof DebugModel.createModel).toBe('function');

    expect(debugModel.uri).toBeDefined();
    expect(debugModel.position).toBeDefined();
    expect(debugModel.breakpoint).toBeDefined();

    expect(typeof debugModel.init).toBe('function');
    expect(typeof debugModel.dispose).toBe('function');
    expect(typeof debugModel.focusStackFrame).toBe('function');
    expect(typeof debugModel.render).toBe('function');
    expect(typeof debugModel.renderBreakpoints).toBe('function');
    expect(typeof debugModel.toggleBreakpoint).toBe('function');
    expect(typeof debugModel.openBreakpointView).toBe('function');
    expect(typeof debugModel.closeBreakpointView).toBe('function');
    expect(typeof debugModel.acceptBreakpoint).toBe('function');
  });

  it('focusStackFrame should be work', () => {
    mockEditor.deltaDecorations.mockClear();
    const mockFrame = {
      raw: {
        line: 1,
        column: 1,
      },
    };
    debugModel.focusStackFrame(mockFrame);
    expect(mockEditor.deltaDecorations).toBeCalledTimes(0);
  });

  it('renderBreakpoints should be work', () => {
    mockEditor.deltaDecorations.mockClear();
    debugModel.renderBreakpoints();
    expect(mockEditor.deltaDecorations).toBeCalledTimes(2);
  });

  it('render should be work', () => {
    mockEditor.deltaDecorations.mockClear();
    debugModel.render();
    expect(mockEditor.deltaDecorations).toBeCalledTimes(2);
  });

  it('toggleBreakpoint should be work', () => {
    debugModel.toggleBreakpoint({lineNumber: 1, column: 2});
    expect(mockBreakpointManager.getBreakpoint).toBeCalledTimes(2);
    expect(mockBreakpointManager.delBreakpoint).toBeCalledTimes(1);
    mockBreakpointManager.getBreakpoint.mockReturnValueOnce(null as any);
    debugModel.toggleBreakpoint({lineNumber: 1, column: 2});
    expect(mockBreakpointManager.addBreakpoint).toBeCalledTimes(1);
  });

  it('openBreakpointView should be work', () => {
    debugModel.openBreakpointView();
    expect(mockBreakpointWidget.show).toBeCalledTimes(1);
  });

  it('closeBreakpointView should be work', () => {
    debugModel.closeBreakpointView();
    expect(mockBreakpointWidget.hide).toBeCalledTimes(1);
  });

  it('acceptBreakpoint should be work', () => {
    debugModel.acceptBreakpoint();
    expect(mockBreakpointManager.updateBreakpoint).toBeCalledTimes(1);
    expect(mockBreakpointWidget.hide).toBeCalledTimes(2);
    mockBreakpointManager.getBreakpoint.mockReturnValueOnce(null as any);
    debugModel.acceptBreakpoint();
    expect(mockBreakpointManager.addBreakpoint).toBeCalledTimes(2);
    expect(mockBreakpointWidget.hide).toBeCalledTimes(3);
  });

  it('onContextMenu should be work', () => {
    const mockEvent = {
      target: {
        type: monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
        position: {
          lineNumber: 1,
        },
      },
      event: {
        browserEvent: {},
      },
    };
    debugModel.onContextMenu(mockEvent);
    expect(mockCtxMenuRenderer.show).toBeCalledTimes(1);
  });

  it('onMouseDown should be work', () => {
    const mockEvent = {
      target: {
        type: monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
        position: {
          lineNumber: 1,
        },
      },
      event: {
        browserEvent: {},
      },
    };
    debugModel.onMouseDown(mockEvent);
    expect(mockEditor.focus).toBeCalledTimes(1);
  });

  it('onMouseMove should be work', () => {
    debugModel.onMouseMove({
      target: {
        type: monaco.editor.MouseTargetType.CONTENT_TEXT,
        position: {
          lineNumber: 1,
        },
      },
    });
    expect(mockDebugHoverWidget.show).toBeCalledTimes(1);
    debugModel.onMouseMove({
      target: {
        type: monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
        position: {
          lineNumber: 1,
        },
      },
    });
    expect(mockDebugHoverWidget.hide).toBeCalledTimes(1);
  });

  it('onMouseLeave should be work', () => {
    const mockEvent = {
      target: {
        type: monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
        position: {
          lineNumber: 1,
        },
      },
      event: {
        posx: 2,
      },
    };
    const getBoundingClientRect = jest.fn(() => ({
      left: 10,
    }));
    mockDebugHoverWidget.getDomNode.mockReturnValueOnce({
      getBoundingClientRect,
    });
    debugModel.onMouseLeave(mockEvent);
    expect(getBoundingClientRect).toBeCalledTimes(1);
    expect(mockDebugHoverWidget.hide).toBeCalledTimes(2);
  });
});
