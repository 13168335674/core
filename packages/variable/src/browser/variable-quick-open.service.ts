import { Mode } from '@ali/monaco-editor-core/esm/vs/base/parts/quickopen/common/quickOpen';
import { Autowired, Injectable } from '@ali/common-di';
import { QuickOpenService, QuickOpenModel, QuickOpenItem } from '@ali/ide-quick-open';
import { VariableRegistry, localize } from '@ali/ide-core-browser';

@Injectable()
export class VariableQuickOpenService implements QuickOpenModel {

  protected items: QuickOpenItem[];

  @Autowired(VariableRegistry)
  protected readonly variableRegistry: VariableRegistry;

  @Autowired(QuickOpenService)
  protected readonly quickOpenService: QuickOpenService;

  open(): void {
    this.items = this.variableRegistry.getVariables().map(
      (v) => new VariableQuickOpenItem(v.name, v.description),
    );

    this.quickOpenService.open(this, {
      placeholder: localize('variable.registered.variables'),
      fuzzyMatchLabel: true,
      fuzzyMatchDescription: true,
      // FIXME: quickOpenService 当前暂不支持
      // fuzzySort: true,
    });
  }

  onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
    acceptor(this.items);
  }
}

export class VariableQuickOpenItem extends QuickOpenItem {

  constructor(
    protected readonly name: string,
    protected readonly description?: string,
  ) {
    super();
  }

  getLabel(): string {
    return '${' + this.name + '}';
  }

  getDetail(): string {
    return this.description || '';
  }

  run(mode: Mode): boolean {
    return false;
  }
}
