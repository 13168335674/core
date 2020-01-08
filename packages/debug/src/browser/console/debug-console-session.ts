import { IDebugConsoleSession, CompletionItemKind, IDebugSessionManager } from '../../common';
import { Autowired, Injectable } from '@ali/common-di';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DisposableCollection, Emitter, Event, MessageType, ILogger } from '@ali/ide-core-common';
import { ExpressionContainer, AnsiConsoleItem, ExpressionItem } from './debug-console-items';
import { DebugSession } from '../debug-session';
import throttle = require('lodash.throttle');

@Injectable()
export class DebugConsoleSession implements IDebugConsoleSession {

  @Autowired(IDebugSessionManager)
  protected readonly manager: DebugSessionManager;

  @Autowired(ILogger)
  logger: ILogger;

  // 缓冲未完成的append进来的内容
  protected uncompletedItemContent: string | undefined;

  protected readonly completionKinds = new Map<DebugProtocol.CompletionItemType | undefined, CompletionItemKind>();

  protected readonly toDispose = new DisposableCollection();

  protected fireDidChange: any = throttle(() => this.onDidChangeEmitter.fire(), 50);

  private nodes: any[];

  onDidChangeEmitter: Emitter<void> = new Emitter();

  constructor() {
    this.init();
  }

  async init() {
    this.toDispose.push(this.manager.onDidCreateDebugSession((session) => {
      if (this.manager.sessions.length === 1) {
        this.clear();
      }
      session.on('output', (event) => this.logOutput(session, event));
    }));
  }

  get onDidChange(): Event<void> {
    return this.onDidChangeEmitter.event;
  }

  getChildren(): any[] {
    return this.nodes;
  }

  clear(): void {
    this.nodes = [];
    this.fireDidChange();
  }

  protected async logOutput(session: DebugSession, event: DebugProtocol.OutputEvent): Promise<void> {
    const body = event.body;
    const { category, variablesReference, source, line } = body;
    const severity = category === 'stderr' ? MessageType.Error : event.body.category === 'console' ? MessageType.Warning : MessageType.Info;
    if (category === 'telemetry') {
      this.logger.debug(`telemetry/${event.body.output}`, event.body.data);
      return;
    }
    if (variablesReference) {
      const items = await new ExpressionContainer({ session, variablesReference, source, line }).getChildren();
      this.nodes.push(...items);
    } else if (typeof body.output === 'string') {
      for (const content of body.output.split('\n')) {
        this.nodes.push(new AnsiConsoleItem(content, severity, source, line));
      }
    }
    this.fireDidChange();
  }

  async execute(value: string): Promise<void> {
    this.nodes.push(new AnsiConsoleItem(value, MessageType.Info));
    const expression = new ExpressionItem(value, this.manager.currentSession);
    this.nodes.push(expression);
    await expression.evaluate();
    this.fireDidChange();
  }

  append(value: string): void {
    if (!value) {
      return;
    }

    const lastItem = this.nodes.slice(-1)[0];
    if (lastItem instanceof AnsiConsoleItem && lastItem.content === this.uncompletedItemContent) {
      this.nodes.pop();
      this.uncompletedItemContent += value;
    } else {
      this.uncompletedItemContent = value;
    }

    this.nodes.push(new AnsiConsoleItem(this.uncompletedItemContent, MessageType.Info));
    this.fireDidChange();
  }

  appendLine(value: string): void {
    this.nodes.push(new AnsiConsoleItem(value, MessageType.Info));
    this.fireDidChange();
  }
}
