import { Injectable, Autowired, Optional } from '@ali/common-di';
import { IDisposable, dispose } from '@ali/ide-core-common/lib/disposable';
import { ISplice } from '@ali/ide-core-common/lib/sequence';
import { IContextKeyService } from '@ali/ide-core-browser';
import { AbstractMenuService, IMenu, MenuId, MenuNode, TupleMenuNodeResult, AbstractContextMenuService } from '@ali/ide-core-browser/lib/menu/next';

import { ISCMProvider, ISCMResource, ISCMResourceGroup } from '../common';
import { getSCMResourceContextKey } from './scm-util';

interface ISCMResourceGroupMenuEntry extends IDisposable {
  readonly group: ISCMResourceGroup;
}

interface ISCMMenus {
  readonly resourceGroupMenu: IMenu;
  readonly resourceMenu: IMenu;
}

@Injectable({ multiple: true })
export class SCMMenus implements IDisposable {
  private titleMenu: IMenu;

  private readonly resourceGroupMenuEntries: ISCMResourceGroupMenuEntry[] = [];
  private readonly resourceGroupMenus = new Map<ISCMResourceGroup, ISCMMenus>();

  private readonly disposables: IDisposable[] = [];

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  // internal scoped ctx key service
  private readonly scopedCtxKeyService: IContextKeyService;

  constructor(@Optional() provider?: ISCMProvider) {
    this.scopedCtxKeyService = this.contextKeyService.createScoped();
    const scmProviderKey = this.scopedCtxKeyService.createKey<string | undefined>('scmProvider', undefined);

    if (provider) {
      scmProviderKey.set(provider.contextValue);
      this.onDidSpliceGroups({ start: 0, deleteCount: 0, toInsert: provider.groups.elements });
      provider.groups.onDidSplice(this.onDidSpliceGroups, this, this.disposables);
    } else {
      scmProviderKey.set('');
    }

    this.titleMenu = this.menuService.createMenu(MenuId.SCMTitle, this.scopedCtxKeyService);
    this.disposables.push(this.titleMenu);
  }

  /**
   * scm/title toolbar
   */
  getTitleMenu() {
    return this.titleMenu;
  }

  /**
   * scm resource group 中的 ctx-menu
   */
  getResourceGroupContextActions(group: ISCMResourceGroup): MenuNode[] {
    return this.getCtxMenuNodes(MenuId.SCMResourceGroupContext, group);
  }

  /**
   * scm resource 中的 ctx-menu
   */
  getResourceContextActions(resource: ISCMResource): MenuNode[] {
    return this.getCtxMenuNodes(MenuId.SCMResourceContext, resource);
  }

  /**
   * 获取 scm 文件列表中的 ctx-menu
   */
  private getCtxMenuNodes(menuId: MenuId, resource: ISCMResourceGroup | ISCMResource): MenuNode[] {
    const contextKeyService = this.scopedCtxKeyService.createScoped();
    contextKeyService.createKey('scmResourceGroup', getSCMResourceContextKey(resource));

    const menus = this.contextMenuService.createMenu({
      id: menuId,
      contextKeyService,
      config: { separator: 'inline' },
    });
    const result = menus.getGroupedMenuNodes();

    menus.dispose();
    contextKeyService.dispose();

    return result[1];
  }

  /**
   * 获取 resource group 的 inline actions
   */
  getResourceGroupInlineActions(group: ISCMResourceGroup): IMenu | undefined {
    if (!this.resourceGroupMenus.has(group)) {
      return;
    }

    return this.resourceGroupMenus.get(group)!.resourceGroupMenu;
  }

  /**
   * 获取 resource 的 inline actions
   */
  getResourceInlineActions(group: ISCMResourceGroup): IMenu | undefined {
    if (!this.resourceGroupMenus.has(group)) {
      return;
    }

    return this.resourceGroupMenus.get(group)!.resourceMenu;
  }

  // 监听 scm group 的 slice 事件并创建 resource 和 group 的 inline actions
  private onDidSpliceGroups({ start, deleteCount, toInsert }: ISplice<ISCMResourceGroup>): void {
    const menuEntriesToInsert = toInsert.map<ISCMResourceGroupMenuEntry>((group) => {
      const contextKeyService = this.scopedCtxKeyService.createScoped();
      contextKeyService.createKey('scmProvider', group.provider.contextValue);
      contextKeyService.createKey('scmResourceGroup', getSCMResourceContextKey(group));

      const resourceGroupMenu = this.menuService.createMenu(MenuId.SCMResourceGroupContext, contextKeyService);
      const resourceMenu = this.menuService.createMenu(MenuId.SCMResourceContext, contextKeyService);

      this.resourceGroupMenus.set(group, { resourceGroupMenu, resourceMenu });

      return {
        group,
        dispose() {
          contextKeyService.dispose();
          resourceGroupMenu.dispose();
          resourceMenu.dispose();
        },
      };
    });

    const deleted = this.resourceGroupMenuEntries.splice(start, deleteCount, ...menuEntriesToInsert);

    for (const entry of deleted) {
      this.resourceGroupMenus.delete(entry.group);
      entry.dispose();
    }
  }

  dispose(): void {
    dispose(this.disposables);
    dispose(this.resourceGroupMenuEntries);
    this.resourceGroupMenus.clear();
  }
}
