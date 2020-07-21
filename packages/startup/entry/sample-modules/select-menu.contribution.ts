
import { Autowired } from '@ali/common-di';
import { COMMON_COMMANDS, FILE_COMMANDS, getIcon } from '@ali/ide-core-browser';
import { IMenuRegistry, ISubmenuItem, MenuId, NextMenuContribution } from '@ali/ide-core-browser/lib/menu/next';
import { CommandContribution, CommandRegistry, CommandService } from '@ali/ide-core-common';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { ISCMProvider } from '@ali/ide-scm';

@Domain(CommandContribution, NextMenuContribution)
export class SelectMenuContribution implements CommandContribution, NextMenuContribution {
  @Autowired(CommandService)
  private readonly commandService: CommandService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand({
      id: 'gitCommitAndPush',
    }, {
      execute: async (provider: ISCMProvider) => {
        // 强依赖了 git 插件的命令
        const mergeChanges = provider.groups.elements.filter((n) => n.id === 'merge');
        if (mergeChanges.length > 0) {
          // console.log('有冲突尚未解决，请先解决');
          return;
        }
        await this.commandService.executeCommand('git.stageAll', provider);
        await this.commandService.executeCommand('git.commit', provider);
        await this.commandService.executeCommand('git.push', provider);
      },
    });
  }

  registerNextMenus(menuRegistry: IMenuRegistry) {
    const testSubmenuId = 'test/select/menu';
    const testSubmenuDesc = {
      submenu: testSubmenuId,
      label: '测试 select menu',
      group: 'navigation',
      order: 0,
      iconClass: getIcon('setting'),
      type: 'default',
    } as ISubmenuItem;

    menuRegistry.registerMenuItem(MenuId.EditorTitle, testSubmenuDesc);

    menuRegistry.registerMenuItem(MenuId.SCMTitle, testSubmenuDesc);

    menuRegistry.registerMenuItem(testSubmenuId, {
      command: FILE_COMMANDS.NEW_FILE.id,
      group: 'navigation',
      type: 'primary',
    });

    menuRegistry.registerMenuItem(testSubmenuId, {
      command: {
        id: 'editor.action.quickCommand',
        label: '打开 quick open',
      },
      group: 'navigation',
      type: 'primary',
    });

    /* ---- test for submenu ---- */
    const testSubContextMenuId = 'test/sub_context_menu_id';
    menuRegistry.registerMenuItem(MenuId.SCMResourceContext, {
      label: 'kaitian submenu',
      submenu: testSubContextMenuId,
    });

    menuRegistry.registerMenuItems(testSubContextMenuId, [{
      command: FILE_COMMANDS.NEW_FILE.id,
      group: '1_new',
    }]);

    menuRegistry.registerMenuItem(testSubContextMenuId, {
      label: 'kaitian sub_submenu',
      submenu: 'sub_submenu',
    });

    menuRegistry.registerMenuItems(testSubContextMenuId, [{
      command: FILE_COMMANDS.NEW_FOLDER.id,
      group: '1_new',
    }]);

    menuRegistry.registerMenuItem('sub_submenu', {
      command: COMMON_COMMANDS.ABOUT_COMMAND.id,
      group: '1_new',
    });

    /* ---- end for submenu ---- */
  }
}
