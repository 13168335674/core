import { Injectable, Autowired } from '@ali/common-di';
import { QuickOpenMode, QuickOpenService, QuickOpenItem, QuickOpenGroupItem, QuickOpenItemOptions, QuickPickService, QuickPickOptions, QuickPickItem, HideReason } from '@ali/ide-core-browser/lib/quick-open';
import { getIcon, getIconClass, getExternalIcon } from '@ali/ide-core-browser';
import { QuickTitleBar } from './quick-title-bar';
import { Emitter, Event } from '@ali/ide-core-common';

@Injectable()
export class QuickPickServiceImpl implements QuickPickService {

  @Autowired(QuickTitleBar)
  protected readonly quickTitleBar: QuickTitleBar;

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  show(elements: string[], options?: QuickPickOptions): Promise<string | undefined>;
  show<T>(elements: QuickPickItem<T>[], options?: QuickPickOptions): Promise<T | undefined>;
  async show<T>(elements: (string | QuickPickItem<T>)[], options?: QuickPickOptions): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve) => {
      const items = this.toItems(elements, resolve);
      if (items.length === 0) {
        resolve(undefined);
        return;
      }
      if (options && this.quickOpenService.widgetNode && this.quickTitleBar.shouldShowTitleBar(options.title, options.step)) {
        this.quickTitleBar.attachTitleBar(this.quickOpenService.widgetNode, options.title, options.step, options.totalSteps, options.buttons);
      }
      const prefix = options && options.value ? options.value : '';
      this.quickOpenService.open({
        onType: (_, acceptor) => {
          acceptor(items);
          this.onDidChangeActiveItemsEmitter.fire(items);
        },
      }, Object.assign({
        onClose: () => {
          resolve(undefined);
          this.quickTitleBar.hide();
        },
        fuzzyMatchLabel: true,
        fuzzyMatchDescription: true,
        prefix,
      }, options));
    });
  }

  hide(reason?: HideReason): void {
    this.quickOpenService.hide(reason);
  }

  protected toItems<T>(elements: (string | QuickPickItem<T>)[], resolve: (element: T | string) => void): QuickOpenItem[] {
    const items: QuickOpenItem[] = [];
    let groupLabel: string | undefined;
    for (const element of elements) {
      const options = this.toItemOptions(element, resolve);
      if (groupLabel) {
        items.push(new QuickOpenGroupItem(Object.assign(options, { groupLabel, showBorder: true })));
        groupLabel = undefined;
      } else {
        items.push(new QuickOpenItem(options));
      }
    }
    return items;
  }
  protected toItemOptions<T>(element: string | QuickPickItem<T>, resolve: (element: T | string) => void): QuickOpenItemOptions {
    let label = typeof element === 'string' ? element : element.label;
    let iconClass = typeof element === 'string' ? undefined : element.iconClass;
    const value = typeof element === 'string' ? element : element.value;
    const description = typeof element === 'string' ? undefined : element.description;
    const detail = typeof element === 'string' ? undefined : element.detail;
    const [icon, text] = getIconClass(label);

    if (icon) {
      iconClass = getIcon(icon) || getExternalIcon(icon); // FIXME: 内部不应使用外部图标，避免更新导致问题
      label = ` ${text}`;
    }
    return {
      label,
      description,
      detail,
      iconClass,
      run: (mode) => {
        if (mode !== QuickOpenMode.OPEN) {
          return false;
        }
        resolve(value);
        this.onDidAcceptEmitter.fire(undefined);
        return true;
      },
    };
  }

  private readonly onDidAcceptEmitter: Emitter<void> = new Emitter();
  readonly onDidAccept: Event<void> = this.onDidAcceptEmitter.event;

  private readonly onDidChangeActiveItemsEmitter: Emitter<QuickOpenItem<QuickOpenItemOptions>[]> = new Emitter<QuickOpenItem<QuickOpenItemOptions>[]>();
  readonly onDidChangeActiveItems: Event<QuickOpenItem<QuickOpenItemOptions>[]> = this.onDidChangeActiveItemsEmitter.event;

}
