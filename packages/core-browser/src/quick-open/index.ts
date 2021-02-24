import { Mode } from '@ali/monaco-editor-core/esm/vs/base/parts/quickopen/common/quickOpen';
import { HideReason } from '@ali/monaco-editor-core/esm/vs/base/parts/quickopen/browser/quickOpenWidget';

import { URI, MessageType, MaybePromise, IDisposable, Event } from '@ali/ide-core-common';

import { Keybinding } from '../keybinding';

/**
 * 高亮显示的范围
 */
export interface Highlight {
  start: number;
  end: number;
}

/**
 * QuickOpen 执行的模式
 * @deprecated
 * 该类型使用 monaco-editor-core/esm 中导入的版本
 */
export { Mode as QuickOpenMode };

/**
 * 隐藏原因
 * * 元素选择 ELEMENT_SELECTED 0
 * * 失去焦点 FOCUS_LOST 1
 * * 取消输入 CANCELED 2
 */
export { HideReason };

export interface QuickTitleButton {
  icon: string; // a background image coming from a url
  iconClass?: string; // a class such as one coming from font awesome
  tooltip?: string | undefined;
  side: QuickTitleButtonSide;
}

/**
 * QuickOpen Item 参数
 */
export interface QuickOpenItemOptions {
  /**
   * 屏幕阅读器字段，对应 vscode
   */
  tooltip?: string;
  /**
   * 标签文案
   */
  label?: string;
  /**
   * 高亮标签的范围
   */
  labelHighlights?: Highlight[];
  /**
   * 显示描述
   */
  description?: string;
  /**
   * 高亮描述的范围
   */
  descriptionHighlights?: Highlight[];
  /**
   * 显示详情
   */
  detail?: string;
  /**
   * 描述高亮范围
   */
  detailHighlights?: Highlight[];
  /**
   * 是否隐藏
   */
  hidden?: boolean;
  /**
   * 打开资源，对应 vscode getResource
   */
  uri?: URI;
  /**
   * 图标
   */
  iconClass?: string;
  /**
   * 对应绑定的快捷键
   */
  keybinding?: Keybinding;
  /**
   * 点击 QuickOpen 要执行的方法
   * @param mode
   */
  run?(mode: Mode): boolean;
}
/**
 * QuickOpen 分组
 */
export interface QuickOpenGroupItemOptions extends QuickOpenItemOptions {
  /**
   * 分组文案
   */
  groupLabel?: string;
  /**
   * 是否显示 border
   */
  showBorder?: boolean;
}

export class QuickOpenItem<T extends QuickOpenItemOptions = QuickOpenItemOptions> {

  constructor(
    protected options: T = {} as T,
  ) { }

  getTooltip(): string | undefined {
    return this.options.tooltip || this.getLabel();
  }
  getLabel(): string | undefined {
    return this.options.label;
  }
  getLabelHighlights(): Highlight[] {
    return this.options.labelHighlights || [];
  }
  getDescription(): string | undefined {
    return this.options.description;
  }
  getDescriptionHighlights(): Highlight[] | undefined {
    return this.options.descriptionHighlights;
  }
  getDetail(): string | undefined {
    return this.options.detail;
  }
  getDetailHighlights(): Highlight[] | undefined {
    return this.options.detailHighlights;
  }
  isHidden(): boolean {
    return this.options.hidden || false;
  }
  getUri(): URI | undefined {
    return this.options.uri;
  }
  getIconClass(): string | undefined {
    return this.options.iconClass;
  }
  getKeybinding(): Keybinding | undefined {
    return this.options.keybinding;
  }
  run(mode: Mode): boolean {
    if (!this.options.run) {
      return false;
    }
    return this.options.run(mode);
  }
}

export class QuickOpenGroupItem<T extends QuickOpenGroupItemOptions = QuickOpenGroupItemOptions> extends QuickOpenItem<T> {

  getGroupLabel(): string | undefined {
    return this.options.groupLabel;
  }
  showBorder(): boolean {
    return this.options.showBorder || false;
  }
}

export interface QuickOpenModel {
  onType(lookFor: string, acceptor: (items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider) => void): void;
}

export const QuickOpenService = Symbol('QuickOpenService');

export interface QuickOpenService {
  open(model: QuickOpenModel, options?: QuickOpenOptions): void;
  hide(reason?: HideReason): void;
  showDecoration(type: MessageType): void;
  hideDecoration(): void;
  refresh(): void;
  /**
   * Dom node of the QuickOpenWidget
   */
  widgetNode: HTMLElement;
}

export type QuickOpenOptions = Partial<QuickOpenOptions.Resolved>;
export namespace QuickOpenOptions {
  export interface FuzzyMatchOptions {
    /**
     * 是否开启分离式模糊搜索
     * 比如 `13` 会匹配到 `123`
     * 默认: `false`
     */
    enableSeparateSubstringMatching?: boolean;
  }
  export interface Resolved {

    /**
     * 启用状态
     */
    readonly enabled: boolean;

    /**
     * 显示前缀
     */
    readonly prefix: string;
    /**
     * 占位符
     */
    readonly placeholder: string;
    readonly valueSelection: Readonly<[number, number]>;
    /**
     * 关闭回调
     * @param canceled 是否是取消关闭
     */
    onClose(canceled: boolean): void;
    /**
     * 是否模糊匹配标签
     * 使用 vscode filter matchesFuzzy 方法
     */
    readonly fuzzyMatchLabel: boolean | FuzzyMatchOptions;
    /**
     * 是否模糊匹配详情
     * 使用 vscode filter matchesFuzzy 方法
     */
    readonly fuzzyMatchDetail: boolean | FuzzyMatchOptions;
    /**
     * 是否模糊匹配描述
     * 使用 vscode filter matchesFuzzy 方法
     */
    readonly fuzzyMatchDescription: boolean | FuzzyMatchOptions;
    /**
     * 是否模糊排序
     * 使用 vscode filter compareEntries 方法
     */
    readonly fuzzySort: boolean;
    /**
     * 前缀的截取长度
     */
    readonly skipPrefix: number;

    /**
     * 点击空白处是否收起 QuickOpen
     */
    readonly ignoreFocusOut: boolean;
    /**
    * 如果为 true，则输入内容会隐藏
    */
    readonly password: boolean;

    /**
     * 如果没有高亮也显示 item
     */
    readonly showItemsWithoutHighlight: boolean;

    selectIndex(lookFor: string): number;
  }
  export const defaultOptions: Resolved = Object.freeze({
    enabled: true,
    prefix: '',
    placeholder: '',
    onClose: () => { /* no-op*/ },
    valueSelection: [-1, -1] as Readonly<[number, number]>,
    fuzzyMatchLabel: false,
    fuzzyMatchDetail: false,
    fuzzyMatchDescription: false,
    fuzzySort: false,
    skipPrefix: 0,
    ignoreFocusOut: false,
    password: false,
    showItemsWithoutHighlight: false,
    selectIndex: () => -1,
    title: '',
  });
  export function resolve(options: QuickOpenOptions = {}, source: Resolved = defaultOptions): Resolved {
    return Object.assign({}, source, options);
  }
}

export interface QuickOpenGroupItemOptions extends QuickOpenItemOptions {
  groupLabel?: string;
  showBorder?: boolean;
}

export interface QuickPickItem<T> {
  label: string;
  value: T;
  description?: string;
  detail?: string;
  iconClass?: string;
}

// tslint:disable-next-line: no-empty-interface
export interface QuickPickOptions extends QuickOpenOptions {
  placeholder?: string;
  /**
   * default: true
   */
  fuzzyMatchLabel?: boolean;
  /**
   * default: true
   */
  fuzzyMatchDescription?: boolean;

  /**
   * Current step count
   */
  step?: number | undefined;

  /**
   * The title of the input
   */
  title?: string | undefined;

  /**
   * Total number of steps
   */
  totalSteps?: number | undefined;

  /**
   * Buttons that are displayed on the title panel
   */
  buttons?: ReadonlyArray<QuickTitleButton>;

  /**
   * Set to `true` to keep the input box open when focus moves to another part of the editor or to another window.
   */
  ignoreFocusOut?: boolean;

  /**
   * The prefill value.
   */
  value?: string;
}

export const QuickPickService = Symbol('QuickPickService');

export interface QuickPickService {
  show(elements: string[], options?: QuickPickOptions): Promise<string | undefined>;
  show<T>(elements: QuickPickItem<T>[], options?: QuickPickOptions): Promise<T | undefined>;
  show<T>(elements: (string | QuickPickItem<T>)[], options?: QuickPickOptions): Promise<T | string | undefined>;
  hide(reason?: HideReason): void;
  readonly onDidAccept: Event<void>;
  readonly onDidChangeActiveItems: Event<QuickOpenItem<QuickOpenItemOptions>[]>;
}

export const PrefixQuickOpenService = Symbol('PrefixQuickOpenService');
export interface PrefixQuickOpenService {
  open(prefix: string): void;
}

export const IQuickInputService = Symbol('IQuickInputService');
export interface IQuickInputService {
  open(options?: QuickInputOptions): Promise<string | undefined>;
  hide(): void;
}

export interface QuickInputOptions {

  /**
   * Show the progress indicator if true
   */
  busy?: boolean;

  /**
   * Allow user input
   */
  enabled?: boolean;

  /**
   * Current step count
   */
  step?: number | undefined;

  /**
   * The title of the input
   */
  title?: string | undefined;

  /**
   * Total number of steps
   */
  totalSteps?: number | undefined;

  /**
   * Buttons that are displayed on the title panel
   */
  buttons?: ReadonlyArray<QuickTitleButton>;

  /**
   * Text for when there is a problem with the current input value
   */
  validationMessage?: string | undefined;

  /**
   * The prefill value.
   */
  value?: string;

  /**
   * The text to display under the input box.
   */
  prompt?: string;

  /**
   * The place holder in the input box to guide the user what to type.
   */
  placeHolder?: string;

  /**
   * Set to `true` to show a password prompt that will not show the typed value.
   */
  password?: boolean;

  /**
   * Set to `true` to keep the input box open when focus moves to another part of the editor or to another window.
   */
  ignoreFocusOut?: boolean;

  /**
   * Selection of the prefilled [`value`](#InputBoxOptions.value). Defined as tuple of two number where the
   * first is the inclusive start index and the second the exclusive end index. When `undefined` the whole
   * word will be selected, when empty (start equals end) only the cursor will be set,
   * otherwise the defined range will be selected.
   */
  valueSelection?: [number, number];

  /**
   * An optional function that will be called to validate input and to give a hint
   * to the user.
   *
   * @param value The current value of the input box.
   * @return Return `undefined`, or the empty string when 'value' is valid.
   */
  validateInput?(value: string): MaybePromise<string | null | undefined>;
}

export interface QuickOpenActionProvider {
  hasActions(item: QuickOpenItem): boolean;
  getActions(item: QuickOpenItem): QuickOpenAction[];
  getValidateInput?(lookFor: string): string;
}

export interface QuickOpenActionOptions {
  id: string;
  label?: string;
  tooltip?: string;
  class?: string | undefined;
  enabled?: boolean;
  checked?: boolean;
  radio?: boolean;
}

export interface QuickOpenAction extends QuickOpenActionOptions, IDisposable {
  run(item?: QuickOpenItem): Promise<void>;
}

export enum QuickTitleButtonSide {
  LEFT = 0,
  RIGHT = 1,
}

export class ThemeIcon {

  static readonly File: ThemeIcon = new ThemeIcon('file');

  static readonly Folder: ThemeIcon = new ThemeIcon('folder');

  private constructor(public id: string) {
  }

}

export interface QuickTitleButton {
  iconPath: URI | { light: string | URI; dark: string | URI } | ThemeIcon;
  icon: string; // a background image coming from a url
  iconClass?: string; // a class such as one coming from font awesome
  tooltip?: string | undefined;
  side: QuickTitleButtonSide;
}

export const QuickOpenContribution = Symbol('QuickOpenContribution');

export interface QuickOpenContribution {
  registerQuickOpenHandlers(handlers: IQuickOpenHandlerRegistry): void;
}

export interface QuickOpenHandler {
  /** 是否是默认的面板处理函数 */
  default?: boolean;
  /**
   * 命令面板中的处理函数
   */
  prefix: string;
  /**
   * 在帮助面板中显示的描述
   */
  description: string;
  /**
   * 初始化函数，一般做展示数据的收集
   */
  init?(): MaybePromise<void>;
  /**
   * 获取 QuickOpenModel，用于提供 Items
   */
  getModel(): QuickOpenModel;
  /**
   * 获取面板的参数，用于额外设置 QuickOpen
   */
  getOptions(): QuickOpenOptions;
  /** quick-open 内部切换不会执行，最终关闭才会执行 */
  onClose?: (canceled: boolean) => void;
}

export interface IQuickOpenHandlerRegistry {
  registerHandler(handler: QuickOpenHandler): IDisposable;
}

export * from './recent-files';
