import { Autowired, Injectable } from '@ali/common-di';

import {
  ClientAppContribution,
  InMemoryResourceResolver,
  PreferenceSchemaProvider,
  URI,
  Domain,
  CommandContribution,
  CommandRegistry,
  COMMON_COMMANDS,
  KeybindingContribution,
  KeybindingRegistry,
  PreferenceScope,
  PreferenceProvider,
  WithEventBus,
  MaybePromise,
  localize,
  MenuContribution,
  CommandService,
  EDITOR_COMMANDS,
  MenuModelRegistry,
  ISchemaStore,
  JsonSchemaContribution,
  ISchemaRegistry,
  IPreferenceSettingsService,
} from '@ali/ide-core-browser';
import { USER_PREFERENCE_URI } from './user-preference-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ResourceService, IResourceProvider, IResource } from '@ali/ide-editor';
import { PREF_SCHEME } from '../common';
import { PreferenceView } from './preferences.view';
import { getIcon } from '@ali/ide-core-browser';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

const PREF_PREVIEW_COMPONENT_ID = 'pref-preview';

@Injectable()
export class PrefResourceProvider extends WithEventBus implements IResourceProvider {

  readonly scheme: string = PREF_SCHEME;

  constructor() {
    super();
  }

  provideResource(uri: URI): MaybePromise<IResource<any>> {
    // 获取文件类型 getFileType: (path: string) => string
    return {
      name: localize('preference.tab.name'),
      icon: getIcon('setting'),
      uri,
    };
  }

  provideResourceSubname(resource: IResource, groupResources: IResource[]): string | null {
    return null;
  }

  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    return true;
  }
}

export namespace PreferenceContextMenu {
  // 1_, 2_用于菜单排序，这样能保证分组顺序顺序
  export const OPEN = '1_open';
}

@Domain(CommandContribution, KeybindingContribution, ClientAppContribution, BrowserEditorContribution, NextMenuContribution, JsonSchemaContribution)
export class PreferenceContribution implements CommandContribution, KeybindingContribution, ClientAppContribution, BrowserEditorContribution, NextMenuContribution, JsonSchemaContribution {

  @Autowired(PreferenceSchemaProvider)
  private readonly schemaProvider: PreferenceSchemaProvider;

  @Autowired(PreferenceProvider, { tag: PreferenceScope.Workspace })
  protected readonly workspacePreferenceProvider: WorkspacePreferenceProvider;

  @Autowired(IFileServiceClient)
  protected readonly filesystem: IFileServiceClient;

  @Autowired(PrefResourceProvider)
  prefResourceProvider: PrefResourceProvider;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(ISchemaRegistry)
  schemaRegistry: ISchemaRegistry;

  @Autowired(IPreferenceSettingsService)
  preferenceService: IPreferenceSettingsService;

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(COMMON_COMMANDS.OPEN_PREFERENCES, {
      isEnabled: () => true,
      execute: async () => {
        await this.openPreferences();
        // this.preferenceService.setCurrentGroup('terminal');
      },
    });
  }

  registerNextMenus(menus: IMenuRegistry) {
    menus.registerMenuItem(MenuId.SettingsIconMenu, {
      command: COMMON_COMMANDS.OPEN_PREFERENCES.id,
      group: PreferenceContextMenu.OPEN,
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: COMMON_COMMANDS.OPEN_PREFERENCES.id,
      keybinding: 'ctrlcmd+,',
    });
  }

  openPreferences() {
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI().withScheme(PREF_SCHEME));
  }

  initialize() {
    this.schemaProvider.onDidPreferenceSchemaChanged(() => {
      this.registerSchema(this.schemaRegistry);
    });
  }

  registerSchema(registry: ISchemaRegistry) {
    registry.registerSchema('vscode://schemas/settings/user', this.schemaProvider.getCombinedSchema(), ['settings.json', USER_PREFERENCE_URI.toString()]);
  }

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(this.prefResourceProvider);
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {

    editorComponentRegistry.registerEditorComponent({
      component: PreferenceView,
      uid: PREF_PREVIEW_COMPONENT_ID,
      scheme: PREF_SCHEME,
    });

    editorComponentRegistry.registerEditorComponentResolver(PREF_SCHEME, (_, __, resolve) => {

      resolve!([
        {
          type: 'component',
          componentId: PREF_PREVIEW_COMPONENT_ID,
        },
      ]);

    });
  }
}
