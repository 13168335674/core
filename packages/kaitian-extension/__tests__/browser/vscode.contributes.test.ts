import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import * as os from 'os';
import { Injector } from '@ali/common-di';
import { VSCodeContributeRunner } from '../../src/browser/vscode/contributes';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { mockExtensionProps } from '../__mock__/extensions';
import { CommandRegistry, CommandRegistryImpl, CommandService, CommandServiceImpl, EventBusImpl, IEventBus, ILogger, ILoggerManagerClient, Uri } from '@ali/ide-core-common';
import { ExtensionWillContributeEvent } from '@ali/ide-kaitian-extension/lib/browser/types';
import { ISchemaRegistry } from '@ali/ide-monaco';
import { SchemaRegistry, SchemaStore } from '@ali/ide-monaco/lib/browser/schema-registry';
import { IExtensionStoragePathServer } from '@ali/ide-extension-storage';
import { IPreferenceSettingsService, ISchemaStore, PreferenceService } from '@ali/ide-core-browser';
import { MockPreferenceService } from '../../../terminal-next/__tests__/browser/mock.service';
import { MockLoggerManageClient } from '@ali/ide-core-browser/lib/mocks/logger';
import { ExtensionNodeServiceServerPath, ExtensionService } from '@ali/ide-kaitian-extension/lib/common';
import { ExtensionServiceImpl } from '@ali/ide-kaitian-extension/lib/browser/extension.service';
import { MockExtNodeClientService } from '../__mock__/extension.service.client';
import { IIconService, IThemeService } from '@ali/ide-theme';
import { IconService } from '@ali/ide-theme/lib/browser';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { PreferenceSettingsService } from '@ali/ide-preferences/lib/browser/preference.service';
import { TextmateService } from '@ali/ide-monaco/lib/browser/textmate.service';
import { MonacoService } from '@ali/ide-core-browser/lib/monaco';

const extension = {
  ...mockExtensionProps,
  uri: Uri.file(mockExtensionProps.realPath),
  packageJSON: {
    ...mockExtensionProps.packageJSON,
    contributes: {
      localizations: [
        {
          'languageId': 'zh-cn',
          'languageName': 'Chinese Simplified',
          'localizedLanguageName': '中文（简体）',
          'translations': [
            {
              'id': 'vscode',
              'path': './translations/main.i18n.json',
            },
          ],
        },
      ],
      commands: [
        {
          command: 'test-command',
          title: '测试命令',
          category: 'Test',
        },
      ],
      themes: [
        {
          'id': 'ide-dark',
          'label': 'IDE Dark',
          'uiTheme': 'vs-dark',
          'path': './themes/dark/plus.json',
        },
      ],
      'languages': [
        {
          'id': 'javascript',
          'extensions': [
            '.js',
          ],
          'aliases': [
            'js',
            'JavaScript',
          ],
          'configuration': './language-configuration.json',
        },
      ],
    },
  },
};

describe('VSCodeContributeRunner', () => {
  let injector: Injector;
  let runner: VSCodeContributeRunner;
  let eventBus: IEventBus;

  beforeAll((done) => {
    injector = new Injector([]);
    injector.addProviders(...[
      {
        token: IEventBus,
        useClass: EventBusImpl,
      },
      {
        token: ISchemaStore,
        useClass: SchemaStore,
      },
      {
        token: ISchemaRegistry,
        useClass: SchemaRegistry,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
      {
        token: MonacoService,
        useValue: {
          monacoLoaded: Promise.resolve(),
        },
      },
      {
        token: IFileServiceClient,
        useValue: {
          resolveContent: (uri) => ({
            content: '',
          }),
        },
      },
      {
        token: ILogger,
        useValue: {
          error: () => {},
          warn: () => {},
          info: () => {},
        },
      },
      {
        token: TextmateService,
        useClass: TextmateService,
      },
      {
        token: IIconService,
        useClass: IconService,
      },
      {
        token: ExtensionService,
        useClass: ExtensionServiceImpl,
      },
      {
        token: IThemeService,
        useClass: WorkbenchThemeService,
      },
      {
        token: IPreferenceSettingsService,
        useClass: PreferenceSettingsService,
      },
      {
        token: CommandService,
        useClass: CommandServiceImpl,
      },
      {
        token: CommandRegistry,
        useClass: CommandRegistryImpl,
      },
      {
        token: PreferenceService,
        useValue: new MockPreferenceService(),
      },
      {
        token: ExtensionNodeServiceServerPath,
        useClass: MockExtNodeClientService,
      },
      {
        token: IExtensionStoragePathServer,
        useValue: {
          getLastStoragePath() {
            return os.tmpdir();
          },
        },
      },
    ]);
    runner = injector.get(VSCodeContributeRunner, [extension]);
    eventBus = injector.get(IEventBus);
    done();
  });

  it('ExtensionWillContributeEvent', async (done) => {
    eventBus.on(ExtensionWillContributeEvent, (target) => {
      expect(target.payload.packageJSON.name).toBe(mockExtensionProps.packageJSON.name);
      done();
    });
    runner.run();
  });

  it('register localization contribution', async (done) => {
    await runner.run();
    expect(process.env['TEST_KAITIAN_LANGUAGE_ID']?.toLowerCase()).toBe('zh-cn');
    done();
  });

  it('register command contribution', async (done) => {
    const commandRegistry = injector.get(CommandRegistry);
    await runner.run();
    const command = commandRegistry.getCommand('test-command');
    expect(command).toBeDefined();
    expect(command?.label).toBe('测试命令');
    expect(command?.category).toBe('Test');
    done();
  });

  it('register theme contribution', async (done) => {
    await runner.run();
    const themeService = injector.get(IThemeService);
    const availableThemes = themeService.getAvailableThemeInfos();
    expect(availableThemes.length).toBe(1);
    done();
  });

  it('register language contribution', async (done) => {
    await runner.run();
    const languages = monaco.languages.getLanguages();
    expect(languages.map((l) => l.id)).toContain('javascript');
    done();
  });
});
