import { Injectable, Autowired } from '@ali/common-di';
// import { StatusBar } from '@ali/ide-status-bar/lib/browser/status-bar.service';

import { StatusBarAlignment, IStatusBarService} from '@ali/ide-core-browser/lib/services';
import { WorkbenchEditorService, IEditor, CursorStatus, ILanguageService } from '../common';
import { localize, WithEventBus, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { EditorDocumentModelOptionChangedEvent } from './doc-model/types';

@Injectable()
export class EditorStatusBarService extends WithEventBus {

  @Autowired(IStatusBarService)
  statusBar: IStatusBarService;

  @Autowired()
  workbenchEditorService: WorkbenchEditorService;

  @Autowired(ILanguageService)
  languageService: ILanguageService;

  setListener() {
    this.workbenchEditorService.onActiveResourceChange(() => {
      this.updateLanguageStatus(this.workbenchEditorService.currentEditor);
    });
    this.workbenchEditorService.onCursorChange((cursorStatus) => {
      this.updateCursorStatus(cursorStatus);
    });
    this.eventBus.on(EditorDocumentModelOptionChangedEvent, (e) => {
      const currentEditor = this.workbenchEditorService.currentEditor;
      if (currentEditor && currentEditor.currentUri && currentEditor.currentUri.isEqual(e.payload.uri)) {
        this.updateLanguageStatus(this.workbenchEditorService.currentEditor);
      }
    });
  }

  protected updateCursorStatus(cursorStatus: CursorStatus) {
    const {position, selectionLength} = cursorStatus;
    if (!position) {
      this.statusBar.removeElement('editor-status-cursor');
      return;
    }
    const lineLabel = '%status-bar.label.line%';
    const colLabel = '%status-bar.label.column%';
    const selectedLabel = '%status-bar.label.selected%';
    this.statusBar.addElement('editor-status-cursor', {
      text: `${lineLabel}${position.lineNumber}，${colLabel}${position.column}${selectionLength ? `（${selectedLabel}${selectionLength}）` : ''}`,
      priority: 4,
      alignment: StatusBarAlignment.RIGHT,
    });
  }

  // TODO 更新 Language 状态
  protected updateLanguageStatus(editor: IEditor | null): void {
    if (!editor) {
      this.statusBar.removeElement('editor-status-language');
      this.statusBar.removeElement('editor-status-encoding');
      this.statusBar.removeElement('editor-status-eol');
      this.statusBar.removeElement('editor-status-space');
      return;
    }
    let languageId = '';
    let encoding = '';
    let eol = '';
    let insertSpaces: boolean = false;
    let tabSize = 2;
    const documentModel = editor.currentDocumentModel;
    if (documentModel) {
      languageId = documentModel.languageId!;
      encoding = documentModel.encoding;
      eol = documentModel.eol;
      insertSpaces = documentModel.getMonacoModel()!.getOptions().insertSpaces;
      tabSize = documentModel.getMonacoModel()!.getOptions().tabSize;
    }
    const eolText = eol === '\n' ? 'LF' : 'CRLF';
    const language = this.languageService.getLanguage(languageId);
    const languageName = language ? language.name : '';
    this.statusBar.addElement('editor-status-language', {
      text: languageName,
      alignment: StatusBarAlignment.RIGHT,
      priority: 1,
      command: EDITOR_COMMANDS.CHANGE_LANGUAGE.id,
    });
    // TODO 语言的配置能力
    this.statusBar.addElement('editor-status-encoding', {
      text: encoding.toUpperCase(),
      alignment: StatusBarAlignment.RIGHT,
      priority: 2,
      command: EDITOR_COMMANDS.CHANGE_ENCODING.id,
    });
    this.statusBar.addElement('editor-status-eol', {
      text: eolText,
      alignment: StatusBarAlignment.RIGHT,
      priority: 3,
      command: EDITOR_COMMANDS.CHANGE_EOL.id,
    });
    this.statusBar.addElement('editor-status-space', {
      text: (insertSpaces ? localize('status-bar.label.tabType.space') : localize('status-bar.label.tabType.tab')) + ': ' + tabSize,
      alignment: StatusBarAlignment.RIGHT,
      priority: 4,
      // TODO 添加快捷设置Tab能力
      command: undefined,
    });
  }

}
