import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import type { ICodeEditor as IMonacoCodeEditor } from '@ali/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { StaticServices } from '@ali/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import { CodeEditorServiceImpl } from '@ali/monaco-editor-core/esm/vs/editor/browser/services/codeEditorServiceImpl';
import { SimpleLayoutService } from '@ali/monaco-editor-core/esm/vs/editor/standalone/browser/simpleServices';
import { ContextViewService } from '@ali/monaco-editor-core/esm/vs/platform/contextview/browser/contextViewService';

/* istanbul ignore file */
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { WorkbenchEditorService } from '../common';
import { URI, IRange } from '@ali/ide-core-common';
import { Autowired, Injectable } from '@ali/common-di';
import { IMonacoImplEditor, BrowserCodeEditor } from './editor-collection.service';

@Injectable()
export class MonacoCodeService extends CodeEditorServiceImpl {

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  constructor() {
    super(StaticServices.standaloneThemeService.get());
  }

  // FIXME - Monaco 20 - ESM
  getActiveCodeEditor(): IMonacoCodeEditor | null {
    if (this.workbenchEditorService.currentEditor) {
      // Note: 这里 monaco.editor.ICodeEditor 与 CodeEditorServiceImpl 中引用的 ICodeEditor 类型冲突，所以使用 assertion
      return (this.workbenchEditorService.currentEditor as IMonacoImplEditor).monacoEditor as unknown as IMonacoCodeEditor;
    }
    return null;
  }

  /**
   * TODO 拆分状态的兼容
   * 判断model是否已存在，在当前editor打开该model
   * @param input 输入的目标文件信息
   * @param source 触发的来源Editor，与grid关联使用
   * @param sideBySide ？
   */
  // @ts-ignore
  async openCodeEditor(input: monaco.editor.IResourceInput, source?: monaco.editor.ICodeEditor,
                       sideBySide?: boolean): Promise<monaco.editor.IStandaloneCodeEditor | undefined> {
    const resourceUri = new URI(input.resource.toString());
    let editorGroup = this.workbenchEditorService.currentEditorGroup;
    let index: number | undefined;
    if (source) {
      editorGroup = this.workbenchEditorService.editorGroups.find((g) => g.currentEditor && (g.currentEditor as IMonacoImplEditor).monacoEditor === source) || editorGroup;
      index = editorGroup.resources.findIndex((r) => editorGroup.currentResource && r.uri === editorGroup.currentResource.uri);
      if (index >= 0) {
        index ++;
      }
    }
    const selection = input.options ? input.options.selection : null;
    let range;
    if (selection) {
      if (typeof selection.endLineNumber === 'number' && typeof selection.endColumn === 'number') {
        range = selection;
      } else {
        range = new monaco.Range(selection.startLineNumber!, selection.startColumn!, selection.startLineNumber!, selection.startColumn!);
      }
    }
    await editorGroup.open(resourceUri, {index, range: range as IRange, focus: true});
    return (editorGroup.codeEditor as BrowserCodeEditor).monacoEditor;
  }

}

@Injectable()
export class MonacoContextViewService extends ContextViewService {

  private menuContainer: HTMLDivElement;

  constructor() {
    super(new SimpleLayoutService(document.body));
  }

  setContainer(container) {
    if (!this.menuContainer) {
      this.menuContainer = document.createElement('div');
      this.menuContainer.className = container.className;
      this.menuContainer.style.left = '0';
      this.menuContainer.style.top = '0';
      this.menuContainer.style.position = 'fixed';
      this.menuContainer.style.zIndex = '10';
      document.body.append(this.menuContainer);
    }
    super.setContainer(this.menuContainer);
  }
}
