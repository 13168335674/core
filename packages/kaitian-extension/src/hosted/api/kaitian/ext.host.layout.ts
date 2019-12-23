import { IExtHostCommands } from '../../../common/vscode';

export function createLayoutAPIFactory(
  extHostCommands: IExtHostCommands,
) {
  return {
    toggleBottomPanel: async () => {
      return await extHostCommands.executeCommand('main-layout.bottom-panel.toggle');
    },
    toggleLeftPanel: async () => {
      return await extHostCommands.executeCommand('activity-bar.left.toggle');
    },
    toggleRightPanel: async () => {
      return await extHostCommands.executeCommand('activity-bar.right.toggle');
    },
    showRightPanel: async () => {
      return await extHostCommands.executeCommand('activity-bar.right.toggle', true);
    },
    hideRightPanel: async () => {
      return await extHostCommands.executeCommand('activity-bar.right.toggle', false);
    },
    activatePanel: async (id) => {
      return await extHostCommands.executeCommand(`activity.panel.activate.${id}`);
    },
    isBottomPanelVisible: async () => {
      return await extHostCommands.executeCommand('main-layout.bottom-panel.is-visible');
    },
    isLeftPanelVisible: async () => {
      return await extHostCommands.executeCommand('main-layout.left-panel.is-visible');
    },
    isRightPanelVisible: async () => {
      return await extHostCommands.executeCommand('main-layout.right-panel.is-visible');
    },
  };
}
