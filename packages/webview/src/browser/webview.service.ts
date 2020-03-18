import { IWebviewService, IPlainWebviewConstructionOptions, IPlainWebview, IWebview, IWebviewContentOptions, IWebviewThemeData, IEditorWebviewComponent, EDITOR_WEBVIEW_SCHEME, IEditorWebviewMetaData, IPlainWebviewComponentHandle, IPlainWebviewWindow } from './types';
import { isElectronRenderer, getDebugLogger, localize, URI, IEventBus, Disposable, MaybeNull } from '@ali/ide-core-browser';
import { ElectronPlainWebview, IframePlainWebview } from './plain-webview';
import { Injectable, Injector, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { IFrameWebviewPanel } from './iframe-webview';
import { ITheme } from '@ali/ide-theme';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { getColorRegistry } from '@ali/ide-theme/lib/common/color-registry';
import { IEditorGroup, WorkbenchEditorService, ResourceNeedUpdateEvent, IResource } from '@ali/ide-editor';
import { EditorComponentRegistry, EditorComponentRenderMode } from '@ali/ide-editor/lib/browser';
import { EditorWebviewComponentView } from './editor-webview';
import { ElectronWebviewWebviewPanel } from './electron-webview-webview';
import { ElectronPlainWebviewWindow } from './webview-window';

@Injectable()
export class WebviewServiceImpl implements IWebviewService {

  private webviewIdCount = 0;

  private editorWebviewIdCount = 0;

  public readonly editorWebviewComponents = new Map<string, EditorWebviewComponent<IWebview | IPlainWebview>>();

  public readonly plainWebviewsComponents = new Map<string, IPlainWebviewComponentHandle>();

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  constructor() {

  }

  createPlainWebview(options: IPlainWebviewConstructionOptions = {}): IPlainWebview {

    if (isElectronRenderer()) {
      if (options.preferredImpl && options.preferredImpl === 'iframe') {
        return new IframePlainWebview();
      }
      return new ElectronPlainWebview();
    } else {
      if (options.preferredImpl && options.preferredImpl === 'webview') {
        getDebugLogger().warn(localize('webview.webviewTagUnavailable', '无法在非Electron环境使用Webview标签。回退至使用iframe。'));
      }
      return new IframePlainWebview();
    }

  }

  createWebview(options?: IWebviewContentOptions): IWebview {
    if (isElectronRenderer()) {
      return this.injector.get(ElectronWebviewWebviewPanel, [(this.webviewIdCount ++).toString(), options]);
    } else {
      return this.injector.get(IFrameWebviewPanel, [(this.webviewIdCount ++).toString(), options]);
    }
  }

  createEditorWebviewComponent(options?: IWebviewContentOptions): IEditorWebviewComponent<IWebview> {
    const id = (this.editorWebviewIdCount++).toString();
    const component = this.injector.get(EditorWebviewComponent, [id, () => this.createWebview(options)]) as EditorWebviewComponent<IWebview>;
    this.editorWebviewComponents.set(id, component);
    return component;
  }

  createEditorPlainWebviewComponent(options: IPlainWebviewConstructionOptions = {}, id: string): IEditorWebviewComponent<IPlainWebview> {
    id = id || (this.editorWebviewIdCount++).toString();
    if (this.editorWebviewComponents.has(id)) {
      return this.editorWebviewComponents.get(id) as IEditorWebviewComponent<IPlainWebview>;
    }
    const component = this.injector.get(EditorWebviewComponent, [id, () => this.createPlainWebview(options)]) as EditorWebviewComponent<IPlainWebview>;
    this.editorWebviewComponents.set(id, component);
    return component;
  }

  getWebviewThemeData(theme: ITheme): IWebviewThemeData {
    const editorFontFamily = this.corePreferences['editor.fontFamily'];
    const editorFontWeight = this.corePreferences['editor.fontFamily'];
    const editorFontSize = this.corePreferences['editor.fontSize'];

    const exportedColors = getColorRegistry().getColors().reduce((colors, entry) => {
      const color = theme.getColor(entry.id);
      if (color) {
        colors['vscode-' + entry.id.replace('.', '-')] = color.toString();
      }
      return colors;
    }, {} as { [key: string]: string });

    const styles = {
      'vscode-font-family': '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", ans-serif',
      'vscode-font-weight': 'normal',
      'vscode-font-size': '13px',
      'vscode-editor-font-family': editorFontFamily,
      'vscode-editor-font-weight': editorFontWeight,
      'vscode-editor-font-size': editorFontSize,
      ...exportedColors,
    };

    const activeTheme = ApiThemeClassName.fromTheme(theme);
    return { styles, activeTheme };
  }

  getOrCreatePlainWebviewComponent(id: string, options?: IPlainWebviewConstructionOptions | undefined): IPlainWebviewComponentHandle {
    if (!this.plainWebviewsComponents.has(id)) {
      const webview = this.createPlainWebview(options);
      const component = this.injector.get(PlainWebviewComponent, [id, webview]);
      this.plainWebviewsComponents.set(id, component);
      component.onDispose(() => {
        this.plainWebviewsComponents.delete(id);
      });
    }
    return this.plainWebviewsComponents.get(id)!;
  }

  getEditorPlainWebviewComponent(id: string): IEditorWebviewComponent<IPlainWebview> | undefined {
    const component = this.editorWebviewComponents.get(id);
    if (component && (component.webview as IPlainWebview).loadURL) {
      return component as IEditorWebviewComponent<IPlainWebview>;
    }
  }
  getPlainWebviewComponent(id: string): IPlainWebviewComponentHandle | undefined {
    return this.plainWebviewsComponents.get(id);
  }

  createWebviewWindow(options?: Electron.BrowserWindowConstructorOptions, env?: {[key: string]: string}): IPlainWebviewWindow {
    if (isElectronRenderer()) {
      return this.injector.get(ElectronPlainWebviewWindow, [options,  env]);
    }
    throw new Error('not supported!');
  }
}

enum ApiThemeClassName {
  light = 'vscode-light',
  dark = 'vscode-dark',
  highContrast = 'vscode-high-contrast',
}

namespace ApiThemeClassName {
  export function fromTheme(theme: ITheme): ApiThemeClassName {
    if (theme.type === 'light') {
      return ApiThemeClassName.light;
    } else if (theme.type === 'dark') {
      return ApiThemeClassName.dark;
    } else {
      return ApiThemeClassName.highContrast;
    }
  }
}

@Injectable({multiple: true})
export class EditorWebviewComponent<T extends IWebview | IPlainWebview> extends Disposable implements IEditorWebviewComponent<T> {

  group: IEditorGroup;

  @Autowired()
  workbenchEditorService: WorkbenchEditorService;

  @Autowired()
  editorComponentRegistry: EditorComponentRegistry;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private _webview: MaybeNull<T>;

  open(options: { groupIndex?: number, relativeGroupIndex?: number}) {
    return this.workbenchEditorService.open(this.webviewUri, {...options, preview: false});
  }

  close() {
    this.workbenchEditorService.closeAll(this.webviewUri);
  }

  private _title: string = 'Webview';

  private _icon: string = '';

  get icon() {
    return this._icon;
  }

  set icon(icon: string) {
    this._icon = icon;
    this.eventBus.fire(new ResourceNeedUpdateEvent(this.webviewUri));
  }

  get title() {
    return this._title;
  }

  set title(title: string) {
    this._title = title;
    this.eventBus.fire(new ResourceNeedUpdateEvent(this.webviewUri));
  }

  get webview() {
    if (!this._webview) {
      this.createWebview();
    }
    return this._webview!;
  }

  get resource(): IResource<IEditorWebviewMetaData> {
    return {
      icon: this.icon,
      name: this.title,
      uri: this.webviewUri,
      metadata: {
        editorWebview: this,
      },
    };
  }

  get webviewUri(): URI {
    return URI.from({
      scheme: EDITOR_WEBVIEW_SCHEME,
      path: this.id,
    });
  }

  get editorGroup(): IEditorGroup | undefined {
    const uri = this.webviewUri;
    return this.workbenchEditorService.editorGroups.find((g) => {
      return g.resources.findIndex((r) => r.uri.isEqual(uri)) !== -1;
    });
  }

  constructor(public readonly id: string, public webviewFactory: () =>  T) {
    super();
    const componentId = EDITOR_WEBVIEW_SCHEME + '_' + this.id;
    this.addDispose(this.editorComponentRegistry.registerEditorComponent<{editorWebview: IEditorWebviewComponent<IWebview | IPlainWebview>}>({
      scheme: EDITOR_WEBVIEW_SCHEME,
      uid: componentId,
      component: EditorWebviewComponentView,
      renderMode: EditorComponentRenderMode.ONE_PER_WORKBENCH,
    }));
    this.addDispose(this.editorComponentRegistry.registerEditorComponentResolver<{editorWebview: IEditorWebviewComponent<IWebview | IPlainWebview>}>(EDITOR_WEBVIEW_SCHEME, (resource, results) => {
      if (resource.uri.path.toString() === this.id) {
        results.push({
          type: 'component',
          componentId,
        });
      }
    }));
    this.addDispose({
      dispose: () => {
        this.workbenchEditorService.closeAll(this.webviewUri, true);
      },
    });

  }

  createWebview(): T {
    this._webview = this.webviewFactory();
    this.addDispose(this._webview!);
    if ((this._webview as IWebview).onDidFocus) {
      this.addDispose((this._webview as IWebview).onDidFocus(() => {
        if (this.editorGroup) {
          (this.editorGroup as any).gainFocus();
        }
      }));
    }
    return this._webview;
  }

  clear() {
    const componentId = EDITOR_WEBVIEW_SCHEME + '_' + this.id;
    this.editorComponentRegistry.clearPerWorkbenchComponentCache(componentId);
    this.webview.remove();
  }

}

@Injectable({multiple: true})
export class PlainWebviewComponent extends Disposable implements IPlainWebviewComponentHandle {

  constructor(public readonly id: string, public readonly webview) {
    super();
    this.addDispose(this.webview);
  }

}
