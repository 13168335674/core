import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, localize, PreferenceSchema } from '@ali/ide-core-common';
import { getIcon, PreferenceContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry, TabBarToolbarContribution, ToolbarRegistry } from '@ali/ide-core-browser/lib/layout';

import { Output, ChannelSelector } from './output.view';
import { OutputService } from './output.service';
import { outputPreferenceSchema } from './output-preference';

const OUTPUT_CLEAR: Command = {
  id: 'output.channel.clear',
  iconClass: getIcon('clear'),
  label: localize('output.channel.clear', '清理日志'),
};
const OUTPUT_CONTAINER_ID = 'ide-output';
@Domain(CommandContribution, ComponentContribution, TabBarToolbarContribution, PreferenceContribution)
export class OutputContribution implements CommandContribution, ComponentContribution, TabBarToolbarContribution, PreferenceContribution {

  @Autowired()
  private readonly outputService: OutputService;

  schema: PreferenceSchema = outputPreferenceSchema;

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: 'output.clear.action',
      command: OUTPUT_CLEAR.id,
      viewId: OUTPUT_CONTAINER_ID,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(OUTPUT_CLEAR, {
      execute: () => this.outputService.selectedChannel.clear(),
      // FIXME 默认为output面板时，无法直接刷新按钮可用状态，需要给出事件 @CC
      isEnabled: () => !!this.outputService.selectedChannel,
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-output', {
      id: OUTPUT_CONTAINER_ID,
      component: Output,
    }, {
      title: localize('output.tabbar.title', '输出'),
      priority: 9,
      containerId: OUTPUT_CONTAINER_ID,
      activateKeyBinding: 'ctrlcmd+shift+u',
      titleComponent: ChannelSelector,
    });
  }
}
