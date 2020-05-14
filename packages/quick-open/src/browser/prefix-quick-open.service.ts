import { localize, QuickOpenActionProvider } from '@ali/ide-core-browser';
import { MaybePromise, DisposableCollection, IDisposable, Disposable, ILogger } from '@ali/ide-core-common';
import { QuickOpenModel, QuickOpenOptions, QuickOpenService, QuickOpenItem, PrefixQuickOpenService } from './quick-open.model';
import { Injectable, Autowired } from '@ali/common-di';

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

@Injectable()
export class QuickOpenHandlerRegistry extends Disposable implements IQuickOpenHandlerRegistry {
  protected readonly handlers: Map<string, QuickOpenHandler> = new Map();
  protected defaultHandler: QuickOpenHandler | undefined;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  registerHandler(handler: QuickOpenHandler): IDisposable {
    if (this.handlers.has(handler.prefix)) {
      this.logger.warn(`前缀是 ${handler.prefix} 的处理函数已经存在`);
      return Disposable.NULL;
    }
    this.handlers.set(handler.prefix, handler);
    const disposable = {
      dispose: () => this.handlers.delete(handler.prefix),
    };
    this.addDispose(disposable);

    if (handler.default) {
      this.defaultHandler = handler;
    }
    return disposable;
  }

  getDefaultHandler(): QuickOpenHandler | undefined {
    return this.defaultHandler;
  }

  isDefaultHandler(handler: QuickOpenHandler): boolean {
    return handler === this.getDefaultHandler();
  }

  getHandlers(): QuickOpenHandler[] {
    return [...this.handlers.values()];
  }

  getHandlerOrDefault(text: string): QuickOpenHandler | undefined {
    for (const handler of this.handlers.values()) {
      if (text.startsWith(handler.prefix)) {
        return handler;
      }
    }
    return this.getDefaultHandler();
  }
}

@Injectable()
export class PrefixQuickOpenServiceImpl implements PrefixQuickOpenService {

  @Autowired(QuickOpenHandlerRegistry)
  protected readonly handlers: QuickOpenHandlerRegistry;

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  open(prefix: string): void {
    const handler = this.handlers.getHandlerOrDefault(prefix);
    this.setCurrentHandler(prefix, handler);
  }

  protected toDisposeCurrent = new DisposableCollection();
  protected currentHandler: QuickOpenHandler | undefined;

  protected async setCurrentHandler(prefix: string, handler: QuickOpenHandler | undefined): Promise<void> {
    if (handler !== this.currentHandler) {
      this.toDisposeCurrent.dispose();
      this.currentHandler = handler;
      this.toDisposeCurrent.push(Disposable.create(() => {
        const closingHandler = handler && handler.getOptions().onClose;
        if (closingHandler) {
          closingHandler(true);
        }
      }));
    }
    if (!handler) {
      this.doOpen();
      return;
    }
    if (handler.init) {
      await handler.init();
    }
    let optionsPrefix = prefix;
    if (this.handlers.isDefaultHandler(handler) && prefix.startsWith(handler.prefix)) {
      optionsPrefix = prefix.substr(handler.prefix.length);
    }
    const skipPrefix = this.handlers.isDefaultHandler(handler) ? 0 : handler.prefix.length;
    const handlerOptions = handler.getOptions();
    this.doOpen({
      prefix: optionsPrefix,
      skipPrefix,
      ...handlerOptions,
      onClose: (canceled: boolean) => {
        if (handlerOptions.onClose) {
          handlerOptions.onClose(canceled);
        }
        // 最后 prefix-quick 执行
        if (handler.onClose) {
          handler.onClose(canceled);
        }
      },
    });
  }

  protected doOpen(options?: QuickOpenOptions): void {
    this.quickOpenService.open({
      onType: (lookFor, acceptor) => this.onType(lookFor, acceptor),
    });
  }

  protected onType(lookFor: string, acceptor: (items: QuickOpenItem[], actionProvider?: QuickOpenActionProvider) => void): void {
    const handler = this.handlers.getHandlerOrDefault(lookFor);
    if (handler === undefined) {
        const items: QuickOpenItem[] = [];
        items.push(new QuickOpenItem({
            label: localize('quickopen.command.nohandler'),
        }));
        acceptor(items);
    } else if (handler !== this.currentHandler) {
        this.setCurrentHandler(lookFor, handler);
    } else {
        const handlerModel = handler.getModel();
        const searchValue = this.handlers.isDefaultHandler(handler) ? lookFor : lookFor.substr(handler.prefix.length);
        handlerModel.onType(searchValue, (items, actionProvider) => acceptor(items, actionProvider));
    }
  }
}
