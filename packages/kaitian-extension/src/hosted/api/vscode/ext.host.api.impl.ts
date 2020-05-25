
import { IRPCProtocol } from '@ali/ide-connection';
import { IExtHostConnectionService, IExtHostDebugService, ExtHostAPIIdentifier, TextEditorCursorStyle, TextEditorSelectionChangeKind, VSCodeExtensionService } from '../../../common/vscode'; // '../../common';
import { IExtensionHostService} from '../../../common';
import { createWindowApiFactory, ExtHostWindow } from './ext.host.window.api.impl';
import { ExtensionDocumentDataManagerImpl } from './doc';
import * as extTypes from '../../../common/vscode/ext-types';
import * as fileSystemTypes from '../../../common/vscode/file-system-types';
import { ViewColumn } from '../../../common/vscode/enums';
import { ExtHostCommands, createCommandsApiFactory } from './ext.host.command';
import { ExtHostWorkspace, createWorkspaceApiFactory } from './ext.host.workspace';
import { ExtensionHostEditorService } from './editor/editor.host';
import {
  Hover,
  Uri,
  IndentAction,
  CodeLens,
  Disposable,
  CompletionItem,
  SnippetString,
  MarkdownString,
  CompletionItemKind,
  Location,
  Position,
  ColorPresentation,
  Range,
  Color,
  FoldingRangeKind,
  FoldingRange,
  DocumentHighlightKind,
  DocumentHighlight,
  DocumentLink,
  ProgressLocation,
  CodeActionKind,
  Selection,
  CodeAction,
  SignatureHelpTriggerKind,
  SignatureHelp,
  ColorInformation,
  SelectionRange,
  QuickInputButtons,
} from '../../../common/vscode/ext-types';
import { CancellationTokenSource, Emitter, Event } from '@ali/ide-core-common';
import { ExtHostPreference } from './ext.host.preference';
import { createExtensionsApiFactory } from './ext.host.extensions';
import { createEnvApiFactory, ExtHostEnv } from './ext.host.env';
import { createLanguagesApiFactory, ExtHostLanguages } from './ext.host.language';
import { ExtHostFileSystem } from './ext.host.file-system';
import { OverviewRulerLane } from '@ali/ide-editor';
import { ExtHostMessage } from './ext.host.message';
import { ExtHostTreeViews } from './ext.host.treeview';
import { ExtHostWebviewService } from './ext.host.api.webview';
import { ExtHostSCM } from './ext.host.scm';
import { ExtHostWindowState } from './ext.host.window-state';
import { IExtension } from '../../../common';
import { ExtHostDecorations } from './ext.host.decoration';
import { ExtHostQuickOpen } from './ext.host.quickopen';
import { ExtHostOutput } from './ext.host.output';
import { ExtHostStatusBar } from './ext.statusbar.host';
import { ExtHostDebug, createDebugApiFactory } from './debug';
import { ExtHostConnection } from './ext.host.connection';
import { ExtHostTerminal } from './ext.host.terminal';
import { ExtHostProgress } from './ext.host.progress';
import { ExtHostAppConfig } from '../../ext.process-base';
import { ExtHostTasks, createTaskApiFactory } from './tasks/ext.host.tasks';
import { ExtHostComments, createCommentsApiFactory } from './ext.host.comments';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionHostService,
  mainThreadExtensionService: VSCodeExtensionService,
  appConfig: ExtHostAppConfig,
) {
  const builtinCommands = appConfig.builtinCommands;
  const extHostDocs = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDocuments, new ExtensionDocumentDataManagerImpl(rpcProtocol));
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);

  const extHostCommands = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCommands, new ExtHostCommands(rpcProtocol, builtinCommands)) as ExtHostCommands;
  const extHostEditors = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostEditors, new ExtensionHostEditorService(rpcProtocol, extHostDocs)) as ExtensionHostEditorService;
  const extHostEnv = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostEnv, new ExtHostEnv(rpcProtocol));
  const extHostLanguages = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostLanguages, new ExtHostLanguages(rpcProtocol, extHostDocs, extHostCommands));
  const extHostFileSystem = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostFileSystem, new ExtHostFileSystem(rpcProtocol));
  const extHostMessage = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostMessage, new ExtHostMessage(rpcProtocol));
  const extHostWorkspace = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWorkspace, new ExtHostWorkspace(rpcProtocol, extHostMessage, extHostDocs)) as ExtHostWorkspace;
  const extHostPreference = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostPreference, new ExtHostPreference(rpcProtocol, extHostWorkspace)) as ExtHostPreference;
  const extHostTreeView = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostTreeView, new ExtHostTreeViews(rpcProtocol, extHostCommands));
  const extHostWebview = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWebivew, new ExtHostWebviewService(rpcProtocol)) as ExtHostWebviewService;
  const extHostSCM = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostSCM, new ExtHostSCM(rpcProtocol, extHostCommands)) as ExtHostSCM;
  const extHostWindowState = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWindowState, new ExtHostWindowState(rpcProtocol));
  const extHostDecorations = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDecorations, new ExtHostDecorations(rpcProtocol));
  const extHostStatusBar = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol));
  const extHostQuickOpen = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostQuickOpen, new ExtHostQuickOpen(rpcProtocol));
  const extHostOutput = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostOutput, new ExtHostOutput(rpcProtocol));
  const extHostWindow = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostWindow, new ExtHostWindow(rpcProtocol)) as ExtHostWindow;
  const extHostConnection = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostConnection, new ExtHostConnection(rpcProtocol)) as IExtHostConnectionService;
  const extHostDebug = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDebug, new ExtHostDebug(rpcProtocol, extHostConnection, extHostCommands)) as IExtHostDebugService;
  const extHostTerminal = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostTerminal, new ExtHostTerminal(rpcProtocol));
  const extHostProgress = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostProgress, new ExtHostProgress(rpcProtocol)) as ExtHostProgress;

  const extHostTasks = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostTasks, new ExtHostTasks(rpcProtocol, extHostTerminal, extHostWorkspace));
  const extHostComments = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostComments, new ExtHostComments(rpcProtocol, extHostCommands, extHostDocs)) as ExtHostComments;
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostStorage, extensionService.storage);

  return (extension: IExtension) => {
    return {
      commands: createCommandsApiFactory(extHostCommands, extHostEditors, extension),
      window: createWindowApiFactory(
        extension, extHostEditors, extHostMessage, extHostWebview,
        extHostTreeView, extHostWindowState, extHostDecorations, extHostStatusBar,
        extHostQuickOpen, extHostOutput, extHostTerminal, extHostWindow, extHostProgress,
      ),
      languages: createLanguagesApiFactory(extHostLanguages, extension),
      workspace: createWorkspaceApiFactory(extHostWorkspace, extHostPreference, extHostDocs, extHostFileSystem, extHostTasks, extension),
      env: createEnvApiFactory(rpcProtocol, extensionService, extHostEnv),
      debug: createDebugApiFactory(extHostDebug),
      version: '1.37.0',
      comment: createCommentsApiFactory(extension, extHostComments),
      languageServer: {},
      extensions: createExtensionsApiFactory(rpcProtocol, extensionService, mainThreadExtensionService),
      tasks: createTaskApiFactory(rpcProtocol, extensionService, extHostTasks, extension),
      scm: {
        get inputBox() {
          return extHostSCM.getLastInputBox(extension)!; // Strict null override - Deprecated api
        },
        createSourceControl(id: string, label: string, rootUri?: Uri) {
          return extHostSCM.createSourceControl(extension, id, label, rootUri);
        },
      },
      // 类型定义
      ...extTypes,
      ...fileSystemTypes,
      Hover,
      CompletionItem,
      CompletionItemKind,
      SnippetString,
      MarkdownString,
      Location,
      Position,
      Uri,
      CancellationTokenSource,
      IndentAction,
      CodeLens,
      Disposable,
      EventEmitter: Emitter,
      Event,
      ColorPresentation,
      Range,
      Color,
      FoldingRange,
      FoldingRangeKind,
      DocumentHighlight,
      DocumentHighlightKind,
      DocumentLink,
      ProgressLocation,
      CodeActionKind,
      ViewColumn,
      OverviewRulerLane,
      Selection,
      SelectionRange,
      QuickInputButtons,
      CodeAction,
      SignatureHelpTriggerKind,
      SignatureHelp,
      TextEditorCursorStyle,
      TextEditorSelectionChangeKind,
      ColorInformation,
    };
  };
}
