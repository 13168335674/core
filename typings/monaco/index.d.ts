/* tslint:disable */

/// <reference types='monaco-editor-core/monaco'/>
declare module monaco.instantiation {
    export interface IInstantiationService {
    }
}

declare module monaco.editor {

    export interface ICodeEditor {
        readonly _commandService: monaco.commands.ICommandService;
        readonly cursor: ICursor;
    }

    export interface IBulkEditResult {
        ariaSummary: string;
    }

    export interface IBulkEditService {
        apply(edit: monaco.languages.WorkspaceEdit): PromiseLike<IBulkEditResult>;
    }

    export interface IDiffNavigator {
        readonly ranges: IDiffRange[];
        readonly nextIdx: number;
        readonly revealFirst: boolean;
        _initIdx(fwd: boolean): void;
    }

    export interface IDiffRange {
        readonly range: Range;
    }

    export interface IStandaloneCodeEditor extends CommonCodeEditor {
        setDecorations(decorationTypeKey: string, ranges: IDecorationOptions[]): void;
        setDecorationsFast(decorationTypeKey: string, ranges: IRange[]): void;
    }

    export interface CommonCodeEditor {
        readonly _commandService: monaco.commands.ICommandService;
        readonly _instantiationService: monaco.instantiation.IInstantiationService;
        readonly _contributions: {
            'editor.controller.quickOpenController': monaco.quickOpen.QuickOpenController
            'editor.contrib.referencesController': monaco.referenceSearch.ReferencesController
        }
        readonly cursor: ICursor;
    }

    export interface ICursor {
        trigger(source: string, handlerId: string, payload: any): void;
    }

    export interface IEditorOverrideServices {
        codeEditorService?: ICodeEditorService;
        textModelService?: ITextModelService;
        contextMenuService?: IContextMenuService;
        commandService?: monaco.commands.ICommandService;
        IWorkspaceEditService?: IBulkEditService;
        contextKeyService?: monaco.contextKeyService.IContextKeyService;
    }

    export interface IResourceInput {
        resource: monaco.Uri;
        options?: IResourceInputOptions;
    }

    export interface IResourceInputOptions {
        /**
         * Tells the editor to not receive keyboard focus when the editor is being opened. By default,
         * the editor will receive keyboard focus on open.
         */
        preserveFocus?: boolean;

        /**
         * Will reveal the editor if it is already opened and visible in any of the opened editor groups.
         */
        revealIfVisible?: boolean;

        /**
         * Text editor selection.
         */
        selection?: Partial<monaco.IRange>;
    }

    export interface IEditorReference {
        getControl(): monaco.editor.CommonCodeEditor;
    }

    export interface IEditorInput {
    }

    export interface IEditorOptions {
    }

    export interface ICodeEditorService {
        getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined;
        openCodeEditor(input: monaco.editor.IResourceInput, source?: monaco.editor.ICodeEditor, sideBySide?: boolean): monaco.Promise<monaco.editor.CommonCodeEditor | undefined>;
        registerDecorationType(key: string, options: IDecorationRenderOptions, parentTypeKey?: string): void;
        removeDecorationType(key: string): void;
        resolveDecorationOptions(typeKey: string, writable: boolean): IModelDecorationOptions;
    }

    export interface IReference<T> extends monaco.IDisposable {
        readonly object: T;
    }

    export interface ITextModelService {
        /**
         * Provided a resource URI, it will return a model reference
         * which should be disposed once not needed anymore.
         */
        createModelReference(resource: monaco.Uri): PromiseLike<IReference<ITextEditorModel>>;

        /**
         * Registers a specific `scheme` content provider.
         */
        registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): monaco.IDisposable;
    }

    export interface ITextModelContentProvider {
        /**
         * Given a resource, return the content of the resource as IModel.
         */
        provideTextContent(resource: monaco.Uri): monaco.Promise<monaco.editor.IModel>;
    }

    export interface ITextEditorModel {
        onDispose: monaco.IEvent<void>;
        /**
         * Loads the model.
         */
        load(): monaco.Promise<ITextEditorModel>;

        /**
         * Dispose associated resources
         */
        dispose(): void;
        /**
         * Provides access to the underlying IModel.
         */
        textEditorModel: monaco.editor.IModel;
    }

    export interface IContextMenuDelegate {
        /**
         * Returns with an HTML element or the client coordinates as the anchor of the context menu to open.
         */
        getAnchor(): HTMLElement | { x: number; y: number; };

        /**
         * Returns the actions for the menu
         */
        getActions(): monaco.Promise<IAction[]>

        /**
         * Needs to be called with the context menu closes again.
         */
        onHide(wasCancelled: boolean): void
    }

    export interface IAction {
        id: string;
        label: string;
        tooltip: string;
        class: string;
        enabled: boolean;
        checked: boolean;
        radio: boolean;
        run(event?: any): monaco.Promise<any>;
    }

    export interface IContextMenuService {
        /**
         * Shows the native Monaco context menu in the editor.
         */
        showContextMenu(delegate: IContextMenuDelegate): void;
    }

    export interface IDecorationOptions {
        range: IRange;
        hoverMessage?: IMarkdownString | IMarkdownString[];
        renderOptions?: IDecorationInstanceRenderOptions;
    }

    export interface IThemeDecorationInstanceRenderOptions {
        before?: IContentDecorationRenderOptions;
        after?: IContentDecorationRenderOptions;
    }

    export interface IDecorationInstanceRenderOptions extends IThemeDecorationInstanceRenderOptions {
        light?: IThemeDecorationInstanceRenderOptions;
        dark?: IThemeDecorationInstanceRenderOptions;
    }

    export interface IContentDecorationRenderOptions {
        contentText?: string;
        contentIconPath?: string | UriComponents;

        border?: string;
        borderColor?: string | ThemeColor;
        fontStyle?: string;
        fontWeight?: string;
        textDecoration?: string;
        color?: string | ThemeColor;
        opacity?: string;
        backgroundColor?: string | ThemeColor;

        margin?: string;
        width?: string;
        height?: string;
    }

    export interface IDecorationRenderOptions extends IThemeDecorationRenderOptions {
        isWholeLine?: boolean;
        rangeBehavior?: TrackedRangeStickiness;
        overviewRulerLane?: OverviewRulerLane;

        light?: IThemeDecorationRenderOptions;
        dark?: IThemeDecorationRenderOptions;
    }

    export interface IThemeDecorationRenderOptions {
        backgroundColor?: string | ThemeColor;

        outline?: string;
        outlineColor?: string | ThemeColor;
        outlineStyle?: string;
        outlineWidth?: string;

        border?: string;
        borderColor?: string | ThemeColor;
        borderRadius?: string;
        borderSpacing?: string;
        borderStyle?: string;
        borderWidth?: string;

        fontStyle?: string;
        fontWeight?: string;
        textDecoration?: string;
        cursor?: string;
        color?: string | ThemeColor;
        opacity?: number;
        letterSpacing?: string;

        gutterIconPath?: string | UriComponents;
        gutterIconSize?: string;

        overviewRulerColor?: string | ThemeColor;

        before?: IContentDecorationRenderOptions;
        after?: IContentDecorationRenderOptions;
    }

}

declare module monaco.commands {

    export interface ICommandEvent {
        commandId: string;
    }

    export interface ICommandService {
        readonly _onWillExecuteCommand: monaco.Emitter<ICommandEvent>;
        executeCommand<T>(commandId: string, ...args: any[]): monaco.Promise<T>;
        executeCommand(commandId: string, ...args: any[]): monaco.Promise<any>;
    }

}

declare module monaco.commons {
  export interface IDiffComputationResult {
    identical: boolean;
    changes: monaco.editor.ILineChange[];
  }

  /**
   * @internal
   */
  export interface IInplaceReplaceSupportResult {
    value: string;
    range: IRange;
  }

  export interface IEditorWorkerService {
    canComputeDiff(original: Uri, modified: Uri): boolean;
    computeDiff(original: Uri, modified: Uri, ignoreTrimWhitespace: boolean): Promise<IDiffComputationResult | null>;

    computeDirtyDiff(original: Uri, modified: Uri, ignoreTrimWhitespace: boolean): Promise<monaco.editor.IChange[] | null>;

    computeMoreMinimalEdits(resource: Uri, edits: monaco.languages.TextEdit[] | null | undefined): Promise<monaco.languages.TextEdit[] | undefined>;

    canComputeWordRanges(resource: Uri): boolean;
    computeWordRanges(resource: Uri, range: IRange): Promise<{ [word: string]: IRange[] } | null>;

    canNavigateValueSet(resource: Uri): boolean;
    navigateValueSet(resource: Uri, range: IRange, up: boolean): Promise<IInplaceReplaceSupportResult | null>;
  }
}

declare module monaco.textModel {
  export class ModelDecorationOptions implements monaco.editor.IModelDecorationOptions {
    static createDynamic(options: monaco.editor.IModelDecorationOptions): ModelDecorationOptions {
      return new ModelDecorationOptions(options);
    }

    constructor(options: monaco.editor.IModelDecorationOptions);
  }
}

declare module monaco.actions {

    export class MenuId {
        /**
         * The unique ID of the editor's context menu.
         */
        public static readonly EditorContext: MenuId;
    }

    export interface ICommandAction {
        id: string;
        title: string
        category?: string;
        iconClass?: string;
    }

    export interface IMenuItem {
        command: ICommandAction;
        when?: any;
        group?: 'navigation' | string;
        order?: number
    }

    export interface IMenuRegistry {
        /**
         * Retrieves all the registered menu items for the given menu.
         */
        getMenuItems(menuId: MenuId | { id: string }): IMenuItem[];

        appendMenuItem(id: MenuId, item: IMenuItem): IDisposable;
    }

    /**
     * The shared menu registry singleton.
     */
    export const MenuRegistry: IMenuRegistry;

}

declare module monaco.platform {
    export const enum OperatingSystem {
        Windows = 1,
        Macintosh = 2,
        Linux = 3
    }
    export const OS: OperatingSystem;
}

declare module monaco.keybindings {

    export class KeybindingResolver {
        static contextMatchesRules(context: monaco.contextKeyService.IContext, rules: monaco.contextkey.ContextKeyExpr | undefined): boolean;
    }

    export const enum KeybindingType {
        Simple = 1,
        Chord = 2
    }

    export class SimpleKeybinding {
        public readonly type: KeybindingType;

        public readonly ctrlKey: boolean;
        public readonly shiftKey: boolean;
        public readonly altKey: boolean;
        public readonly metaKey: boolean;
        public readonly keyCode: KeyCode;

        constructor(ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean, keyCode: KeyCode);
    }

    export class ChordKeybinding {
        public readonly type: KeybindingType;

        public readonly firstPart: SimpleKeybinding;
        public readonly chordPart: SimpleKeybinding;

        constructor(firstPart: SimpleKeybinding, chordPart: SimpleKeybinding);
    }

    export type Keybinding = SimpleKeybinding | ChordKeybinding;

    export interface IKeybindingItem {
        keybinding: {
            parts: SimpleKeybinding[]
        };
        command: string;
        when?: monaco.contextkey.ContextKeyExpr;
    }

    export enum ContextKeyExprType {
        Defined = 1,
        Not = 2,
        Equals = 3,
        NotEquals = 4,
        And = 5,
        Regex = 6
    }

    export interface IKeybindingsRegistry {
        /**
         * Returns with all the default, static keybindings.
         */
        getDefaultKeybindings(): IKeybindingItem[];
    }

    export const KeybindingsRegistry: IKeybindingsRegistry;

    export namespace KeyCodeUtils {
        export function toString(key: any): string;
    }

    export class ResolvedKeybindingPart {
        readonly ctrlKey: boolean;
        readonly shiftKey: boolean;
        readonly altKey: boolean;
        readonly metaKey: boolean;

        readonly keyLabel: string;
        readonly keyAriaLabel: string;

        constructor(ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean, kbLabel: string, kbAriaLabel: string);
    }

    export abstract class ResolvedKeybinding {
         /**
         * This prints the binding in a format suitable for displaying in the UI.
         */
        public abstract getLabel(): string | null;
        /**
         * This prints the binding in a format suitable for ARIA.
         */
        public abstract getAriaLabel(): string | null;
        /**
         * This prints the binding in a format suitable for electron's accelerators.
         * See https://github.com/electron/electron/blob/master/docs/api/accelerator.md
         */
        public abstract getElectronAccelerator(): string | null;
        /**
         * This prints the binding in a format suitable for user settings.
         */
        public abstract getUserSettingsLabel(): string | null;
        /**
         * Is the user settings label reflecting the label?
         */
        public abstract isWYSIWYG(): boolean;
        /**
         * Is the binding a chord?
         */
        public abstract isChord(): boolean;
        /**
         * Returns the firstPart, chordPart that should be used for dispatching.
         */
        public abstract getDispatchParts(): (string | null)[];
        /**
         * Returns the firstPart, chordPart of the keybinding.
         * For simple keybindings, the second element will be null.
         */
        public abstract getParts(): ResolvedKeybindingPart[];
    }

    export class USLayoutResolvedKeybinding extends ResolvedKeybinding {
        constructor(actual: Keybinding, OS: monaco.platform.OperatingSystem);

        public getLabel(): string;
        public getAriaLabel(): string;
        public getElectronAccelerator(): string;
        public getUserSettingsLabel(): string;
        public isWYSIWYG(): boolean;
        public isChord(): boolean;
        public getDispatchParts(): [string, string];
        public getParts(): [ResolvedKeybindingPart, ResolvedKeybindingPart];

        public static getDispatchStr(keybinding: SimpleKeybinding): string;
    }

    export interface Modifiers {
        readonly ctrlKey: boolean;
        readonly shiftKey: boolean;
        readonly altKey: boolean;
        readonly metaKey: boolean;
    }

    export interface ModifierLabels {
        readonly ctrlKey: string;
        readonly shiftKey: string;
        readonly altKey: string;
        readonly metaKey: string;
        readonly separator: string;
    }


    export interface KeyLabelProvider<T extends Modifiers> {
        (keybinding: T): string | null;
    }


    export class ModifierLabelProvider {

        public readonly modifierLabels: ModifierLabels[];

        constructor(mac: ModifierLabels, windows: ModifierLabels, linux?: ModifierLabels);

        public toLabel<T extends Modifiers>(OS: monaco.platform.OperatingSystem, parts: T[], keyLabelProvider: KeyLabelProvider<T>): string | null;
    }

    export const UILabelProvider: ModifierLabelProvider;
    export const AriaLabelProvider: ModifierLabelProvider;
    export const ElectronAcceleratorLabelProvider: ModifierLabelProvider;
    export const UserSettingsLabelProvider: ModifierLabelProvider;

}

declare module monaco.services {

    export const ICodeEditorService: any;
    export const IConfigurationService: any;

    export class SimpleLayoutService {
        constructor(dom: HTMLElement);
    }

    export interface Configuration {
        getValue(section: string, overrides: any, workspace: any): any;
    }

    export class ConfigurationChangeEvent {
        change(keys: string[]): ConfigurationChangeEvent;
    }

    export interface IConfigurationService {
        _onDidChangeConfiguration: monaco.Emitter<ConfigurationChangeEvent>;
        _configuration: Configuration;
    }

    export abstract class CodeEditorServiceImpl implements monaco.editor.ICodeEditorService {
        constructor(themeService: IStandaloneThemeService);
        abstract getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined;
        abstract openCodeEditor(input: monaco.editor.IResourceInput, source?: monaco.editor.ICodeEditor,
            sideBySide?: boolean): monaco.Promise<monaco.editor.CommonCodeEditor | undefined>;
        registerDecorationType: monaco.editor.ICodeEditorService['registerDecorationType'];
        removeDecorationType: monaco.editor.ICodeEditorService['removeDecorationType'];
        resolveDecorationOptions: monaco.editor.ICodeEditorService['resolveDecorationOptions'];
    }

    export abstract class ContextViewService {
        constructor(
            layoutService: any
        );
    }

    export class StandaloneCommandService implements monaco.commands.ICommandService {
        constructor(instantiationService: monaco.instantiation.IInstantiationService);
        readonly _onWillExecuteCommand: monaco.Emitter<monaco.commands.ICommandEvent>;
        executeCommand<T>(commandId: string, ...args: any[]): monaco.Promise<T>;
        executeCommand(commandId: string, ...args: any[]): monaco.Promise<any>;
    }

    export class LazyStaticService<T> {
        get(overrides?: monaco.editor.IEditorOverrideServices): T;
    }

    export interface IStandaloneThemeService extends monaco.theme.IThemeService {
        getTheme(): IStandaloneTheme;
    }

    export interface IStandaloneTheme {
        tokenTheme: TokenTheme;
    }

    export interface TokenTheme {
        match(languageId: string | undefined, scope: string): number;
        getColorMap(): Color[];
    }

    export interface Color {
        rgba: RGBA;
    }

    export interface RGBA {
        r: number;
        g: number;
        b: number;
        a: number;
    }

    export enum LanguageId {
        Null = 0,
        PlainText = 1
    }

    export class LanguageIdentifier {
        /**
         * A string identifier. Unique across languages. e.g. 'javascript'.
         */
        readonly language: string;

        /**
         * A numeric identifier. Unique across languages. e.g. 5
         * Will vary at runtime based on registration order, etc.
         */
        readonly id: LanguageId;
    }

    export interface IModeService {
        getOrCreateModeByFilenameOrFirstLine(filename: string, firstLine?: string): monaco.Promise<IMode>;
    }

    export interface IMode {

        getId(): string;

        getLanguageIdentifier(): LanguageIdentifier;

    }

    export interface ServiceCollection {
        set<T>(id: any, instanceOrDescriptor: T): T;
    }

    export module StaticServices {
        export function init(overrides: monaco.editor.IEditorOverrideServices): [ServiceCollection, monaco.instantiation.IInstantiationService];
        export const standaloneThemeService: LazyStaticService<IStandaloneThemeService>;
        export const modeService: LazyStaticService<IModeService>;
        export const codeEditorService: LazyStaticService<monaco.editor.ICodeEditorService>;
        export const configurationService: LazyStaticService<IConfigurationService>;
        export const telemetryService: LazyStaticService<any>;
        export const logService: LazyStaticService<any>;
        export const modelService: LazyStaticService<any>;
        export const instantiationService: LazyStaticService<monaco.instantiation.IInstantiationService>;
        export const editorWorkerService: LazyStaticService<monaco.commons.IEditorWorkerService>;
    }
}

declare module monaco.theme {
    export interface ITheme { }
    export interface IThemeService {
        onThemeChange: monaco.IEvent<ITheme>;
    }
    export interface IThemable { }
    export function attachQuickOpenStyler(widget: IThemable, themeService: IThemeService): monaco.IDisposable;
}

declare module monaco.referenceSearch {

    export interface Location {
        uri: Uri,
        range: IRange
    }

    export interface OneReference { }

    export interface ReferencesModel {
        references: OneReference[]
    }

    export interface RequestOptions {
        getMetaTitle(model: ReferencesModel): string;
    }

    export interface ReferenceWidget {
        hide(): void;
        show(range: IRange): void;
        focus(): void;
    }

    export interface ReferencesController {
        _widget: ReferenceWidget
        _model: ReferencesModel | undefined
        _ignoreModelChangeEvent: boolean;
        _editorService: monaco.editor.ICodeEditorService;
        closeWidget(): void;
        _gotoReference(ref: Location): void
        toggleWidget(range: IRange, modelPromise: Promise<ReferencesModel> & { cancel: () => void }, options: RequestOptions): void;
    }

}

declare module monaco.quickOpen {

    export interface IMessage {
        content: string;
        formatContent?: boolean; // defaults to false
        type?: 1 /* INFO */ | 2  /* WARNING */ | 3 /* ERROR */;
    }

    export class InputBox {
        inputElement: HTMLInputElement;
        setPlaceHolder(placeHolder: string): void;
        showMessage(message: IMessage): void;
        hideMessage(): void;
    }

    export class QuickOpenWidget implements IDisposable {
        inputBox?: InputBox;
        constructor(container: HTMLElement, callbacks: IQuickOpenCallbacks, options: IQuickOpenOptions, usageLogger?: IQuickOpenUsageLogger);
        dispose(): void;
        create(): HTMLElement;
        setInput(input: IModel<any>, autoFocus: IAutoFocus, ariaLabel?: string): void;
        layout(dimension: monaco.editor.IDimension): void;
        show(prefix: string, options?: IShowOptions): void;
        hide(reason?: any): void;
    }

    export interface IQuickOpenCallbacks {
        onOk: () => void;
        onCancel: () => void;
        onType: (lookFor?: string) => void;
        onShow?: () => void;
        onHide?: (reason: any) => void;
        onFocusLost?: () => boolean /* veto close */;
    }
    export interface IQuickOpenOptions /* extends IQuickOpenStyles */ {
        minItemsToShow?: number;
        maxItemsToShow?: number;
        inputPlaceHolder?: string;
        inputAriaLabel?: string;
        // actionProvider?: IActionProvider;
        keyboardSupport?: boolean;
    }
    export interface IQuickOpenUsageLogger {
        publicLog(eventName: string, data?: any): void;
    }

    export interface IShowOptions {
        quickNavigateConfiguration?: IQuickNavigateConfiguration;
        autoFocus?: IAutoFocus;
        inputSelection?: IRange;
    }

    export interface IQuickNavigateConfiguration {
        keybindings: monaco.keybindings.ResolvedKeybinding[];
    }
    export interface IAutoFocus {

        /**
         * The index of the element to focus in the result list.
         */
        autoFocusIndex?: number;

        /**
         * If set to true, will automatically select the first entry from the result list.
         */
        autoFocusFirstEntry?: boolean;

        /**
         * If set to true, will automatically select the second entry from the result list.
         */
        autoFocusSecondEntry?: boolean;

        /**
         * If set to true, will automatically select the last entry from the result list.
         */
        autoFocusLastEntry?: boolean;

        /**
         * If set to true, will automatically select any entry whose label starts with the search
         * value. Since some entries to the top might match the query but not on the prefix, this
         * allows to select the most accurate match (matching the prefix) while still showing other
         * elements.
         */
        autoFocusPrefixMatch?: string;
    }

    export interface IEntryRunContext {
        event: any;
        keymods: number[];
        quickNavigateConfiguration: IQuickNavigateConfiguration;
    }
    export interface IDataSource<T> {
        getId(entry: T): string;
        getLabel(entry: T): string;
    }
    /**
     * See vs/base/parts/tree/browser/tree.ts - IRenderer
     */
    export interface IRenderer<T> {
        getHeight(entry: T): number;
        getTemplateId(entry: T): string;
        renderTemplate(templateId: string, container: HTMLElement, styles: any): any;
        renderElement(entry: T, templateId: string, templateData: any, styles: any): void;
        disposeTemplate(templateId: string, templateData: any): void;
    }
    export interface IFilter<T> {
        isVisible(entry: T): boolean;
    }
    export interface IAccessiblityProvider<T> {
        getAriaLabel(entry: T): string;
    }
    export interface IRunner<T> {
        run(entry: T, mode: any, context: IEntryRunContext): boolean;
    }
    export interface IModel<T> {
        entries: T[];
        dataSource: IDataSource<T>;
        renderer: IRenderer<T>;
        runner: IRunner<T>;
        filter?: IFilter<T>;
        accessibilityProvider?: IAccessiblityProvider<T>;
    }

    export interface IHighlight {
        start: number;
        end: number;
    }
    export interface IIconLabelOptions {
        title?: string;
        extraClasses?: string[];
        italic?: boolean;
        matches?: monaco.filters.IMatch[];
    }
    export class QuickOpenEntry {
        constructor(highlights?: IHighlight[]);
        getLabel(): string | undefined;
        getLabelOptions(): IIconLabelOptions | undefined;
        getAriaLabel(): string | undefined;
        getDetail(): string | undefined;
        getIcon(): string | undefined;
        getDescription(): string | undefined;
        getKeybinding(): monaco.keybindings.ResolvedKeybinding | undefined;
        getResource(): Uri | undefined;
        isHidden(): boolean;
        setHidden(hidden: boolean): void;
        setHighlights(labelHighlights: IHighlight[], descriptionHighlights?: IHighlight[], detailHighlights?: IHighlight[]): void;
        getHighlights(): [IHighlight[] /* Label */, IHighlight[] /* Description */, IHighlight[] /* Detail */];
        run(mode: any, context: IEntryRunContext): boolean;
    }

    export function compareEntries(elementA: QuickOpenEntry, elementB: QuickOpenEntry, lookFor: string): number;

    export class QuickOpenEntryGroup extends QuickOpenEntry {
        constructor(entry?: QuickOpenEntry, groupLabel?: string, withBorder?: boolean);
        getGroupLabel(): string;
        setGroupLabel(groupLabel: string): void;
        showBorder(): boolean;
        setShowBorder(showBorder: boolean): void;
        entry: QuickOpenEntry | undefined;
    }

    export interface IAction extends IDisposable {
        id: string;
        label: string;
        tooltip: string;
        class: string | undefined;
        enabled: boolean;
        checked: boolean;
        radio: boolean;
        run(event?: any): PromiseLike<any>;
    }

    export interface IActionProvider {
        hasActions(element: any, item: any): boolean;
        getActions(element: any, item: any): ReadonlyArray<IAction> | null;
    }

    export class QuickOpenModel implements IModel<QuickOpenEntry>, IDataSource<QuickOpenEntry>, IFilter<QuickOpenEntry>, IRunner<QuickOpenEntry> {
        constructor(entries?: QuickOpenEntry[], actionProvider?: IActionProvider);
        addEntries(entries: QuickOpenEntry[]): void;
        entries: QuickOpenEntry[];
        dataSource: IDataSource<QuickOpenEntry>;
        renderer: IRenderer<QuickOpenEntry>;
        runner: IRunner<QuickOpenEntry>;
        filter?: IFilter<QuickOpenEntry>;
        accessibilityProvider?: IAccessiblityProvider<QuickOpenEntry>;
        getId(entry: QuickOpenEntry): string;
        getLabel(entry: QuickOpenEntry): string;
        isVisible(entry: QuickOpenEntry): boolean;
        run(entry: QuickOpenEntry, mode: any, context: IEntryRunContext): boolean;
    }

    export interface IQuickOpenControllerOpts {
        readonly inputAriaLabel: string;
        getModel(lookFor: string): QuickOpenModel;
        getAutoFocus(lookFor: string): IAutoFocus;
    }
    export interface QuickOpenController extends IDisposable {
        getId(): string;
        run(opts: IQuickOpenControllerOpts): void;
        decorateLine(range: Range, editor: monaco.editor.ICodeEditor): void;
        clearDecorations(): void;
    }

}

declare module monaco.filters {
    export interface IMatch {
        start: number;
        end: number;
    }
    export function matchesFuzzy(word: string, wordToMatchAgainst: string, enableSeparateSubstringMatching?: boolean): IMatch[] | undefined;
}

declare module monaco.editorExtensions {

    export interface EditorAction {
        id: string;
        label: string;
        alias: string;
    }

    export module EditorExtensionsRegistry {
        export function getEditorActions(): EditorAction[];
    }
}
declare module monaco.modes {

    export class TokenMetadata {

        public static getLanguageId(metadata: number): number;

        public static getFontStyle(metadata: number): number;

        public static getForeground(metadata: number): number;

        public static getBackground(metadata: number): number;

        public static getClassNameFromMetadata(metadata: number): string;

        public static getInlineStyleFromMetadata(metadata: number, colorMap: string[]): string;
    }

    export type SuggestionType = 'method'
        | 'function'
        | 'constructor'
        | 'field'
        | 'variable'
        | 'class'
        | 'struct'
        | 'interface'
        | 'module'
        | 'property'
        | 'event'
        | 'operator'
        | 'unit'
        | 'value'
        | 'constant'
        | 'enum'
        | 'enum-member'
        | 'keyword'
        | 'snippet'
        | 'text'
        | 'color'
        | 'file'
        | 'reference'
        | 'customcolor'
        | 'folder'
        | 'type-parameter';

    export type SnippetType = 'internal' | 'textmate';

    export interface ISuggestion {
        label: string;
        insertText: string;
        type: SuggestionType;
        detail?: string;
        documentation?: string | IMarkdownString;
        filterText?: string;
        sortText?: string;
        preselect?: boolean;
        noAutoAccept?: boolean;
        commitCharacters?: string[];
        overwriteBefore?: number;
        overwriteAfter?: number;
        additionalTextEdits?: editor.ISingleEditOperation[];
        command?: monaco.languages.Command;
        snippetType?: SnippetType;
    }

    export interface ISuggestResult {
        suggestions: ISuggestion[];
        incomplete?: boolean;
        dispose?(): void;
    }

    export enum CompletionTriggerKind {
        Invoke = 0,
        TriggerCharacter = 1,
        TriggerForIncompleteCompletions = 2,
    }

    export interface IRelativePattern {
        base: string;
        pattern: string;
    }

    export interface LanguageFilter {
        language?: string;
        scheme?: string;
        pattern?: string | IRelativePattern;
        /**
         * This provider is implemented in the UI thread.
         */
        hasAccessToAllModels?: boolean;
        exclusive?: boolean;
    }

    export type LanguageSelector = string | LanguageFilter | (string | LanguageFilter)[];

    export interface LanguageFeatureRegistry<T> {
        has(model: monaco.editor.IReadOnlyModel): boolean;
        all(model: monaco.editor.IReadOnlyModel): T[];
        register(selector: LanguageSelector, provider: T): IDisposable;
        readonly onDidChange: monaco.IEvent<number>;
    }

    export const DocumentSymbolProviderRegistry: LanguageFeatureRegistry<monaco.languages.DocumentSymbolProvider>;

    export const SuggestRegistry: LanguageFeatureRegistry<ISuggestSupport>;

    export interface SuggestContext {
        triggerKind: CompletionTriggerKind;
        triggerCharacter?: string;
    }

    export interface ISuggestSupport {

        triggerCharacters?: string[];

        // tslint:disable-next-line:max-line-length
        provideCompletionItems(model: monaco.editor.ITextModel, position: Position, context: SuggestContext, token: CancellationToken): ISuggestResult | Thenable<ISuggestResult | undefined> | undefined;

        resolveCompletionItem?(model: monaco.editor.ITextModel, position: Position, item: ISuggestion, token: CancellationToken): ISuggestion | Thenable<ISuggestion>;
    }

    export interface CompletionItemProvider {

        triggerCharacters?: string[];
        /**
         * Provide completion items for the given position and document.
         */
        provideCompletionItems(model: monaco.editor.ITextModel, position: Position, context: monaco.languages.CompletionContext, token: CancellationToken): Thenable<monaco.languages.CompletionList>;

        /**
         * Given a completion item fill in more data, like [doc-comment](#CompletionItem.documentation)
         * or [details](#CompletionItem.detail).
         *
         * The editor will only resolve a completion item once.
         */
        resolveCompletionItem?(model: monaco.editor.ITextModel, position: Position, item: monaco.languages.CompletionItem, token: CancellationToken): Thenable<monaco.languages.CompletionItem>;
    }
}

declare module monaco.suggest {

    export type SnippetConfig = 'top' | 'bottom' | 'inline' | 'none';

    export interface ISuggestionItem {
        suggestion: monaco.modes.ISuggestion;
    }

    export function provideSuggestionItems(
        model: monaco.editor.ITextModel,
        position: Position,
        snippetConfig?: SnippetConfig,
        onlyFrom?: monaco.modes.ISuggestSupport[],
        context?: monaco.modes.SuggestContext,
        token?: monaco.CancellationToken
    ): Promise<ISuggestionItem[]>;

    export function setSnippetSuggestSupport(support: monaco.modes.CompletionItemProvider): monaco.modes.CompletionItemProvider;

}

declare module monaco.suggestController {

    export class SuggestWidget {
        suggestWidgetVisible: {
            get(): boolean;
        };
    }

    export class SuggestController {

        getId(): string;
        dispose(): void;

        /**
         * This is a hack. The widget has a `private` visibility in the VSCode source.
         */
        readonly _widget: SuggestWidget | undefined;

    }

}

declare module monaco.findController {

    export class CommonFindController {

        getId(): string;
        dispose(): void;

        /**
         * Hack for checking whether the find (and replace) widget is visible in code editor or not.
         */
        readonly _findWidgetVisible: {
            get(): boolean;
        };

    }

}

declare module monaco.rename {

    export class RenameController {

        getId(): string;
        dispose(): void;

        /**
         * Hack for checking whether the rename input HTML element is visible in the code editor or not. In VSCode source this is has `private` visibility.
         */
        readonly _renameInputVisible: {
            get(): boolean;
        };

    }

}

declare module monaco.snippetParser {
    export class SnippetParser {
        parse(value: string): TextmateSnippet;
    }
    export class TextmateSnippet {
    }
}

declare module monaco.contextKeyService {

    export interface IContextKey<T> {
        set(value: T | undefined): void;
        reset(): void;
        get(): T | undefined;
    }

    export class Context implements monaco.contextkey.IContext {
      protected _parent: Context | null;
      protected _value: {
        [key: string]: any;
      };
      protected _id: number;
      constructor(id: number, parent: Context | null);
      setValue(key: string, value: any): boolean;
      removeValue(key: string): boolean;
      getValue<T>(key: string): T | undefined;
      collectAllValues(): {
        [key: string]: any;
      };
    }

    export abstract class AbstractContextKeyService implements monaco.contextkey.IContextKeyService {
      _serviceBrand: any;
      protected _isDisposed: boolean;
      protected _onDidChangeContext: any;
      _myContextId: number; // 类型原因先去掉了 protected
      constructor(myContextId: number);
      abstract dispose(): void;
      createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
      readonly onDidChangeContext: monaco.IEvent<monaco.contextkey.IContextKeyChangeEvent>;
      bufferChangeEvents(callback: Function): void;
      createScoped(domNode: monaco.contextkey.IContextKeyServiceTarget): monaco.contextkey.IContextKeyService;
      contextMatchesRules(rules: monaco.contextkey.ContextKeyExpr | undefined): boolean;
      getContextKeyValue<T>(key: string): T | undefined;
      setContext(key: string, value: any): void;
      removeContext(key: string): void;
      getContext(target: monaco.contextkey.IContextKeyServiceTarget | null): monaco.contextkey.IContext;
      abstract getContextValuesContainer(contextId: number): Context;
      abstract createChildContext(parentContextId?: number): number;
      abstract disposeContext(contextId: number): void;
    }

    export class ContextKeyService extends AbstractContextKeyService implements monaco.contextkey.IContextKeyService {
      private _lastContextId;
      private readonly _contexts;
      private readonly _toDispose;
      constructor(configurationService: monaco.services.IConfigurationService);
      dispose(): void;
      getContextValuesContainer(contextId: number): Context;
      createChildContext(parentContextId?: number): number;
      disposeContext(contextId: number): void;
    }

    // export class ContextKeyService implements IContextKeyService {
    //     _myContextId: number
    //     getContextValuesContainer(_myContextId: any): monaco.contextkey.IContext;
    //     constructor(configurationService: monaco.services.IConfigurationService);
    //     createScoped(target?: HTMLElement): ContextKeyService;
    //     getContext(target?: HTMLElement): monaco.contextkey.IContext;
    //     createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
    //     contextMatchesRules(rules: monaco.contextkey.ContextKeyExpr | undefined): boolean;
    //     onDidChangeContext(listener: (event: any) => void) :IDisposable;
    // }
}

declare module monaco.contextkey {

    export namespace EditorContextKeys{
        export const focus: RawContextKey<boolean>;
    }

    export const enum ContextKeyExprType {
        Defined = 1,
        Not = 2,
        Equals = 3,
        NotEquals = 4,
        And = 5,
        Regex = 6,
        NotRegex = 7,
        Or = 8
    }
    export interface IContextKeyExprMapper {
        mapDefined(key: string): ContextKeyDefinedExpr;
        mapNot(key: string): ContextKeyNotExpr;
        mapEquals(key: string, value: any): ContextKeyEqualsExpr;
        mapNotEquals(key: string, value: any): ContextKeyNotEqualsExpr;
        mapRegex(key: string, regexp: RegExp | null): ContextKeyRegexExpr;
    }
    export abstract class ContextKeyExpr {
        static has(key: string): ContextKeyExpr;
        static equals(key: string, value: any): ContextKeyExpr;
        static notEquals(key: string, value: any): ContextKeyExpr;
        static regex(key: string, value: RegExp): ContextKeyExpr;
        static not(key: string): ContextKeyExpr;
        static and(...expr: Array<ContextKeyExpr | undefined | null>): ContextKeyExpr | undefined;
        static or(...expr: Array<ContextKeyExpr | undefined | null>): ContextKeyExpr | undefined;
        static deserialize(serialized: string | null | undefined, strict?: boolean): ContextKeyExpr | undefined;
        private static _deserializeOrExpression;
        private static _deserializeAndExpression;
        private static _deserializeOne;
        private static _deserializeValue;
        private static _deserializeRegexValue;
        abstract getType(): ContextKeyExprType;
        abstract equals(other: ContextKeyExpr): boolean;
        abstract evaluate(context: IContext): boolean;
        abstract serialize(): string;
        abstract keys(): string[];
        abstract map(mapFnc: IContextKeyExprMapper): ContextKeyExpr;
        abstract negate(): ContextKeyExpr;
    }
    export class ContextKeyDefinedExpr implements ContextKeyExpr {
        protected key: string;
        static create(key: string): ContextKeyExpr;
        protected constructor(key: string);
        getType(): ContextKeyExprType;
        cmp(other: ContextKeyDefinedExpr): number;
        equals(other: ContextKeyExpr): boolean;
        evaluate(context: IContext): boolean;
        serialize(): string;
        keys(): string[];
        map(mapFnc: IContextKeyExprMapper): ContextKeyExpr;
        negate(): ContextKeyExpr;
    }
    export class ContextKeyEqualsExpr implements ContextKeyExpr {
        private readonly key;
        private readonly value;
        static create(key: string, value: any): ContextKeyExpr;
        private constructor();
        getType(): ContextKeyExprType;
        cmp(other: ContextKeyEqualsExpr): number;
        equals(other: ContextKeyExpr): boolean;
        evaluate(context: IContext): boolean;
        serialize(): string;
        keys(): string[];
        map(mapFnc: IContextKeyExprMapper): ContextKeyExpr;
        negate(): ContextKeyExpr;
    }
    export class ContextKeyNotEqualsExpr implements ContextKeyExpr {
        private key;
        private value;
        static create(key: string, value: any): ContextKeyExpr;
        private constructor();
        getType(): ContextKeyExprType;
        cmp(other: ContextKeyNotEqualsExpr): number;
        equals(other: ContextKeyExpr): boolean;
        evaluate(context: IContext): boolean;
        serialize(): string;
        keys(): string[];
        map(mapFnc: IContextKeyExprMapper): ContextKeyExpr;
        negate(): ContextKeyExpr;
    }
    export class ContextKeyNotExpr implements ContextKeyExpr {
        private key;
        static create(key: string): ContextKeyExpr;
        private constructor();
        getType(): ContextKeyExprType;
        cmp(other: ContextKeyNotExpr): number;
        equals(other: ContextKeyExpr): boolean;
        evaluate(context: IContext): boolean;
        serialize(): string;
        keys(): string[];
        map(mapFnc: IContextKeyExprMapper): ContextKeyExpr;
        negate(): ContextKeyExpr;
    }
    export class ContextKeyRegexExpr implements ContextKeyExpr {
        private key;
        private regexp;
        static create(key: string, regexp: RegExp | null): ContextKeyExpr;
        private constructor();
        getType(): ContextKeyExprType;
        cmp(other: ContextKeyRegexExpr): number;
        equals(other: ContextKeyExpr): boolean;
        evaluate(context: IContext): boolean;
        serialize(): string;
        keys(): string[];
        map(mapFnc: IContextKeyExprMapper): ContextKeyRegexExpr;
        negate(): ContextKeyExpr;
    }
    export class ContextKeyNotRegexExpr implements ContextKeyExpr {
        private readonly _actual;
        static create(actual: ContextKeyRegexExpr): ContextKeyExpr;
        private constructor();
        getType(): ContextKeyExprType;
        cmp(other: ContextKeyNotRegexExpr): number;
        equals(other: ContextKeyExpr): boolean;
        evaluate(context: IContext): boolean;
        serialize(): string;
        keys(): string[];
        map(mapFnc: IContextKeyExprMapper): ContextKeyExpr;
        negate(): ContextKeyExpr;
    }
    export class ContextKeyAndExpr implements ContextKeyExpr {
        readonly expr: ContextKeyExpr[];
        static create(_expr: Array<ContextKeyExpr | null | undefined>): ContextKeyExpr | undefined;
        private constructor();
        getType(): ContextKeyExprType;
        cmp(other: ContextKeyAndExpr): number;
        equals(other: ContextKeyExpr): boolean;
        evaluate(context: IContext): boolean;
        private static _normalizeArr;
        serialize(): string;
        keys(): string[];
        map(mapFnc: IContextKeyExprMapper): ContextKeyExpr;
        negate(): ContextKeyExpr;
    }
    export class ContextKeyOrExpr implements ContextKeyExpr {
        readonly expr: ContextKeyExpr[];
        static create(_expr: Array<ContextKeyExpr | null | undefined>): ContextKeyExpr | undefined;
        private constructor();
        getType(): ContextKeyExprType;
        equals(other: ContextKeyExpr): boolean;
        evaluate(context: IContext): boolean;
        private static _normalizeArr;
        serialize(): string;
        keys(): string[];
        map(mapFnc: IContextKeyExprMapper): ContextKeyExpr;
        negate(): ContextKeyExpr;
    }
    export class RawContextKey<T> extends ContextKeyDefinedExpr {
        private _defaultValue;
        constructor(key: string, defaultValue: T | undefined);
        bindTo(target: IContextKeyService): IContextKey<T>;
        getValue(target: IContextKeyService): T | undefined;
        toNegated(): ContextKeyExpr;
        isEqualTo(value: string): ContextKeyExpr;
        notEqualsTo(value: string): ContextKeyExpr;
    }
    export interface IContext {
        getValue<T>(key: string): T | undefined;
    }
    export interface IContextKey<T> {
        set(value: T): void;
        reset(): void;
        get(): T | undefined;
    }
    export interface IContextKeyServiceTarget {
        parentElement: IContextKeyServiceTarget | null;
        setAttribute(attr: string, value: string): void;
        removeAttribute(attr: string): void;
        hasAttribute(attr: string): boolean;
        getAttribute(attr: string): string | null;
    }
    export const IContextKeyService: any;
    export interface IReadableSet<T> {
        has(value: T): boolean;
    }
    export interface IContextKeyChangeEvent {
        affectsSome(keys: IReadableSet<string>): boolean;
    }
    export interface IContextKeyService {
        dispose(): void;
        onDidChangeContext: monaco.IEvent<IContextKeyChangeEvent>;
        bufferChangeEvents(callback: Function): void;
        createKey<T>(key: string, defaultValue: T | undefined): IContextKey<T>;
        contextMatchesRules(rules: ContextKeyExpr | undefined): boolean;
        getContextKeyValue<T>(key: string): T | undefined;
        createScoped(target?: IContextKeyServiceTarget): IContextKeyService;
        getContext(target: IContextKeyServiceTarget | null): IContext;
    }
    export const SET_CONTEXT_COMMAND_ID = "setContext";
}

declare module monaco.format {
    export class FormattingConflicts {
        static readonly _selectors : LinkedList<IFormattingEditProviderSelector>;
    }

    export interface IFormattingEditProviderSelector {
        <T extends (monaco.languages.DocumentFormattingEditProvider | monaco.languages.DocumentRangeFormattingEditProvider)>(formatter: T[], document: monaco.editor.ITextModel, mode: 1 | 2): Promise<T | undefined>;
    }

    export interface LinkedList<T> {
        unshift:(e: T) => {remove: () => any};
    }
}
