import { Injectable, Autowired } from '@ali/common-di';
import { Command, Emitter, CommandRegistry, CommandHandler, ILogger, EDITOR_COMMANDS, CommandService, IReporterService, REPORT_NAME, MonacoService, ServiceNames, memoize } from '@ali/ide-core-browser';

import ICommandEvent = monaco.commands.ICommandEvent;
import ICommandService = monaco.commands.ICommandService;
import { WorkbenchEditorService, EditorCollectionService } from '@ali/ide-editor';

/**
 * vscode 会有一些别名 command，如果直接执行这些别名 command 会报错，做一个转换
 */
const MonacoCommandAlias = {
  'editor.action.smartSelect.grow': 'editor.action.smartSelect.expand',
  'cursorWordPartStartLeft': 'cursorWordPartLeft',
  'cursorWordPartStartLeftSelect': 'cursorWordPartLeftSelect',
  'editor.action.previewDeclaration': 'editor.action.peekDefinition',
  'editor.action.openDeclarationToTheSide': 'editor.action.revealDefinitionAside',
  'editor.action.goToDeclaration': 'editor.action.revealDefinition',
};

/**
 * monaco 命令分两种
 *  一种命令不需要带参数，是封装过的命令，即为 action
 * 一种是正常命令，执行可以带参数
 */
export enum MonacoCommandType {
  ACTION,
  COMMAND,
}

export type MonacoCommand = Command & { type: MonacoCommandType };

/**
 * monaco 处理函数
 */
export interface MonacoEditorCommandHandler {
  execute(editor: monaco.editor.ICodeEditor, ...args: any[]): any;
  isEnabled?(editor: monaco.editor.ICodeEditor, ...args: any[]): boolean;
}

@Injectable()
export class MonacoCommandService implements ICommandService {
  private delegate: ICommandService;
  /**
   * 事件触发器，在执行命令的时候会触发
   * @type {monaco.Emitter<ICommandEvent>}
   * @memberof MonacoCommandService
   */
  _onWillExecuteCommand: monaco.Emitter<ICommandEvent> = new Emitter<ICommandEvent>();

  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(IReporterService)
  reporterService: IReporterService;

  /**
   * 设置委托对象
   * @param delegate 真正要执行 monaco 内部 command 的 commandSerice
   */
  setDelegate(delegate: ICommandService) {
    this.delegate = delegate;
  }

  get onWillExecuteCommand(): monaco.IEvent<ICommandEvent> {
    return this._onWillExecuteCommand.event;
  }

  /**
   * 执行命令
   * 先去全局 commands 里找，若没有尝试执行 delegate 的 command
   * @param commandId
   * @param args
   */
  executeCommand(commandId: string, ...args: any[]) {
    this.logger.debug('command: ' + commandId);
    this._onWillExecuteCommand.fire({ commandId });
    const handler = this.commandRegistry.getActiveHandler(commandId, ...args);
    if (handler) {
      try {
        return this.commandService.executeCommand(commandId, ...args);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    if (this.delegate) {
      return this.delegate.executeCommand(MonacoCommandAlias[commandId] ? MonacoCommandAlias[commandId] : commandId, ...args);
    }
    this.reporterService.point(REPORT_NAME.NOT_FOUND_COMMAND, commandId);
    return Promise.reject(new Error(`command '${commandId}' not found`));
  }
}

@Injectable()
export class MonacoCommandRegistry {

  @Autowired(CommandRegistry)
  protected commands: CommandRegistry;

  @Autowired(WorkbenchEditorService)
  protected workbenchEditorService: WorkbenchEditorService;

  @Autowired(EditorCollectionService)
  editorCollectionService: EditorCollectionService;

  /**
   * 校验 command id 是否是 monaco id
   * @param command 要校验的 id
   * @returns 若找到则为转换过 monaco id，否则为 undefined
   */
  validate(command: string): string | undefined {
    return this.commands.getRawCommand(command)?.id;
  }

  /**
   * 注册 monaco 命令
   * 命令 id 会统一加入 manaco 前缀
   * monaco handler 会注入当前 editor 参数
   * @param command 注册的命令
   * @param handler 命令处理函数
   */
  registerCommand(command: Command, handler: MonacoEditorCommandHandler): void {
    this.commands.registerCommand(command, this.newHandler(handler));
  }

  /**
   * 注册处理函数函数
   * monaco handler 会注入当前 editor 参数
   * @param command 命令 id
   * @param handler 命令处理函数
   */
  registerHandler(commandID: string, handler: MonacoEditorCommandHandler): void {
    this.commands.registerHandler(commandID, this.newHandler(handler));
  }

  /**
   * 包装 monaco 命令处理函数为内部处理函数
   * @param monacoHandler 要处理的 monaco 命令处理函数
   */
  protected newHandler(monacoHandler: MonacoEditorCommandHandler): CommandHandler {
    return {
      execute: (...args) => this.execute(monacoHandler, ...args),
    };
  }

  /**
   * 给 monacoHandler 传递 editor 参数
   * @param monacoHandler 要处理的 monaco 命令函数
   * @param args 要透传的参数
   */
  protected execute(monacoHandler: MonacoEditorCommandHandler, ...args: any[]): any {
    const editor = this.getActiveCodeEditor();
    if (editor) {
      // editor.focus();
      return Promise.resolve(monacoHandler.execute(editor, ...args));
    }
    return Promise.resolve();
  }

  /**
   * 获取当前活动的编辑器
   * 此处的活动编辑器和 workbenchEditorService.currentEditor 的概念不同，对于diffEditor，需要获取确实的那个editor而不是modifiedEditor
   */
  protected getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined {
    // 先从editor-collection的焦点追踪，contextMenu追踪中取
    if (this.editorCollectionService.currentEditor) {
      return this.editorCollectionService.currentEditor.monacoEditor;
    }

    // 使用当前 editorGroup.editor 兜底
    const editorGroup = this.workbenchEditorService.currentEditorGroup;
    if (editorGroup) {
      const editor = editorGroup.currentFocusedEditor || editorGroup.currentEditor;
      if (editor) {
        return editor.monacoEditor;
      }
    }
  }
}

@Injectable()
export class MonacoActionRegistry {

  private static COMMON_ACTIONS = new Map<string, string>( [
    ['undo', EDITOR_COMMANDS.UNDO.id],
    ['redo', EDITOR_COMMANDS.REDO.id],
    ['editor.action.selectAll', EDITOR_COMMANDS.SELECT_ALL.id],
  ]);

  /**
   * 要排除注册的 Action
   *
   * @protected
   * @memberof MonacoActionModule
   */
  protected static readonly EXCLUDE_ACTIONS = [
    'setContext',
    'editor.action.quickCommand',
    'editor.action.toggleHighContrast',
  ];

  @Autowired()
  monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired(MonacoService)
  private readonly monacoService: MonacoService;

  @memoize
  get globalInstantiationService() {
    const codeEditorService = this.monacoService.getOverride(ServiceNames.CODE_EDITOR_SERVICE);
    const textModelService = this.monacoService.getOverride(ServiceNames.TEXT_MODEL_SERVICE);
    const contextKeyService = this.monacoService.getOverride(ServiceNames.CONTEXT_KEY_SERVICE);
    const [, globalInstantiationService] = monaco.services.StaticServices.init({
      codeEditorService,
      textModelService,
      contextKeyService,
    });
    return globalInstantiationService;
  }

  @memoize
  get monacoEditorRegistry() {
    return monaco.editorExtensions.EditorExtensionsRegistry;
  }

  @memoize
  get monacoCommands() {
    // TODO: 找不到 monaco.command 的 namespace
    return (monaco as any).commands.CommandsRegistry.getCommands();
  }

  registerMonacoActions() {
    const editorActions = new Map(this.monacoEditorRegistry.getEditorActions().map(({ id, label }) => [id, label]));

    for (const id of Object.keys(this.monacoCommands)) {
      if (MonacoActionRegistry.EXCLUDE_ACTIONS.includes(id)) {
        continue;
      }
      const label = editorActions.has(id) ? editorActions.get(id) : '';
      const handler = editorActions.has(id) ? this.newActionHandler(id) : this.newCommandHandler(id);
      this.monacoCommandRegistry.registerCommand({
        id,
        label,
      }, handler);
      // 将 monaco 命令处理函数代理到有 label 的空命令上
      const command = MonacoActionRegistry.COMMON_ACTIONS.get(id);
      if (command) {
        this.monacoCommandRegistry.registerHandler(command, handler);
      }
    }
  }

  /**
   * 调用 monaco 内部 _commandService 执行命令
   * 实际执行的就是 MonacoCommandService
   * @param commandId 命令名称
   */
  protected newCommandHandler(commandId: string): MonacoEditorCommandHandler {
    return {
      execute: (editor, ...args) => {
        if (!this.monacoEditorRegistry.getEditorCommand(commandId) || !editor) {
          return;
        }
        const editorCommand = !!this.monacoEditorRegistry.getEditorCommand(commandId) ||
          !(commandId.startsWith('_execute') || commandId === 'setContext' || MonacoActionRegistry.COMMON_ACTIONS.has(commandId));
        const instantiationService = editorCommand ? editor && editor['_instantiationService'] : this.globalInstantiationService;
        if (!instantiationService) {
          return;
        }
        return instantiationService.invokeFunction(
          this.monacoCommands[commandId].handler,
          ...args,
        );
      },
    };
  }

  /**
   * 包装 action 为命令处理函数
   * 调用 getAction 执行 run 命令
   * @param id action id
   */
  protected newActionHandler(id: string): MonacoEditorCommandHandler {
    return {
      execute: (editor) => {
        const action = editor.getAction(id);
        if (action && action.isSupported()) {
          this.runAction(id, editor);
        }
      },
    };
  }

  /**
   * 执行 action
   * @param id 要执行的 action
   * @param editor 执行 action 的 editor，默认为当前 editor
   */
  protected runAction(id: string, editor: monaco.editor.ICodeEditor): Promise<void> {
    if (editor) {
      const action = editor.getAction(id);
      if (action && action.isSupported()) {
        return action.run();
      }
    }

    return Promise.resolve();
  }

  /**
   * 生成键盘处理函数
   * @param action 对应 action
   */
  protected newKeyboardHandler(action: string): MonacoEditorCommandHandler {
    return {
        execute: (editor, ...args) => editor.trigger('keyboard', action, args),
    };
  }
}
