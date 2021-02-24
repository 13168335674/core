import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { ContextMenuController } from '@ali/monaco-editor-core/esm/vs/editor/contrib/contextmenu/contextmenu';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { Disposable, Domain, IContextKeyService } from '@ali/ide-core-browser';
import { AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { EditorOption } from '@ali/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { IAnchor } from '@ali/monaco-editor-core/esm/vs/base/browser/ui/contextview/contextview';
import * as dom from '@ali/monaco-editor-core/esm/vs/base/browser/dom';

import { IEditor } from '../../common';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '../types';

@Injectable({ multiple: true })
export class EditorContextMenuController extends Disposable {

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  @Autowired(ICtxMenuRenderer)
  private readonly contextMenuRenderer: ICtxMenuRenderer;

  private readonly contextKeyService: IContextKeyService;

  constructor(private _editor: IEditor) {
    super();
    this.contextKeyService = this.registerDispose(this.globalContextKeyService.createScoped((this._editor.monacoEditor as any)._contextKeyService));
    this.overrideContextmenuContribution(_editor);
  }

  overrideContextmenuContribution(editor: IEditor) {
    // https://github.com/Microsoft/monaco-editor/issues/1058#issuecomment-468681208
    const contextmenu = editor.monacoEditor.getContribution(ContextMenuController.ID);

    const _this = this;
    const originMethod = contextmenu['showContextMenu'];
    // https://github.com/microsoft/vscode/blob/master/src/vs/editor/contrib/contextmenu/contextmenu.ts#L124
    contextmenu['showContextMenu'] = function(anchor?: IAnchor | null): void {
      if (!this['_editor'].getOption(EditorOption.contextmenu)) {
        return; // Context menu is turned off through configuration
      }
      if (!this['_editor'].hasModel()) {
        return;
      }

      if (!this['_contextMenuService']) {
        this['_editor'].focus();
        return;	// We need the context menu service to function
      }

      // Find actions available for menu
      const menuNodes = _this.getMenuNodes();
      // Show menu if we have actions to show
      if (menuNodes.length > 0) {
        _this._doShowContextMenu(menuNodes, anchor);
      }
    };

    this.addDispose({
      dispose: () => {
        contextmenu['_onContextMenu'] = function() {
          originMethod.apply(contextmenu, arguments);
        };
      },
    });
  }

  private _doShowContextMenu(menuNodes: any[], anchor?: IAnchor | null) {
    const editor = this._editor.monacoEditor;
    // https://github.com/microsoft/vscode/blob/master/src/vs/editor/contrib/contextmenu/contextmenu.ts#L196
    if (!editor.hasModel()) {
      return;
    }

    // Disable hover
    const oldHoverSetting = this._editor.monacoEditor.getOption(monaco.editor.EditorOption.hover);
    this._editor.monacoEditor.updateOptions({
      hover: {
        enabled: false,
      },
    });

    if (!anchor) {
      // Ensure selection is visible
      editor.revealPosition(editor.getPosition(), monaco.editor.ScrollType.Immediate);

      editor.render();
      const cursorCoords = editor.getScrolledVisiblePosition(editor.getPosition());

      // Translate to absolute editor position
      const editorCoords = dom.getDomNodePagePosition(editor.getDomNode());
      const posx = editorCoords.left + cursorCoords.left;
      const posy = editorCoords.top + cursorCoords.top + cursorCoords.height;

      anchor = { x: posx, y: posy };
    }

    // Show the context menu
    this.contextMenuRenderer.show({
      anchor,
      menuNodes,
      args: [this._editor.currentUri],
      onHide: (canceled) => {
        if (!canceled) {
          this._editor.monacoEditor.focus();
          this._editor.monacoEditor.updateOptions({
            hover: oldHoverSetting,
          });
        }
      },
    });
  }

  private getMenuNodes() {
    const contextMenu = this.contextMenuService.createMenu({
      id: MenuId.EditorContext,
      contextKeyService: this.contextKeyService,
    });
    const menuNodes = contextMenu.getMergedMenuNodes();
    contextMenu.dispose();
    return menuNodes;
  }
}

@Domain(BrowserEditorContribution)
export class EditorContextMenuBrowserEditorContribution implements BrowserEditorContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        return this.injector.get(EditorContextMenuController, [editor]);
      },
    });
  }

}
