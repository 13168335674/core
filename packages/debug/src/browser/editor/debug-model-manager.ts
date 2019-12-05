import { Disposable, URI, Emitter, DisposableCollection } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorCollectionService, ICodeEditor } from '@ali/ide-editor';
import { DebugSessionManager } from '../debug-session-manager';
import { IDebugSessionManager, DebugModelFactory, IDebugModel } from '../../common';
import { BreakpointManager } from '../breakpoint';
import { DebugConfigurationManager } from '../debug-configuration-manager';

export enum DebugModelSupportedEventType {
  down = 'Down',
  move = 'Move',
  leave = 'Leave',
  contextMenu = 'contextMenu',
}

@Injectable()
export class DebugModelManager extends Disposable {
  private models: Map<string, IDebugModel[]>;
  protected readonly toDispose = new DisposableCollection();

  @Autowired(EditorCollectionService)
  private editorColletion: EditorCollectionService;

  @Autowired(DebugModelFactory)
  private debugModelFactory: DebugModelFactory;

  @Autowired(IDebugSessionManager)
  private debugSessionManager: DebugSessionManager;

  @Autowired(BreakpointManager)
  private breakpointManager: BreakpointManager;

  @Autowired(DebugConfigurationManager)
  private debugConfigurationManager: DebugConfigurationManager;

  private _onMouseDown = new Emitter<monaco.editor.IEditorMouseEvent>();
  private _onMouseMove = new Emitter<monaco.editor.IEditorMouseEvent>();
  private _onMouseLeave = new Emitter<monaco.editor.IPartialEditorMouseEvent>();
  private _onMouseUp = new Emitter<monaco.editor.IEditorMouseEvent>();

  public onMouseDown = this._onMouseDown;
  public onMouseMove = this._onMouseMove;
  public onMouseLeave = this._onMouseLeave;
  public onMouseUp = this._onMouseUp;

  constructor() {
    super();
    this.models = new Map();
  }

  dispose() {
    for (const model of this.models.values()) {
      this.toDispose.pushAll(model);
    }
    this.toDispose.dispose();
    this.models.clear();
  }

  init() {
    this.editorColletion.onCodeEditorCreate((codeEditor: ICodeEditor) => this.push(codeEditor));

    this.debugSessionManager.onDidChangeBreakpoints(({ session, uri }) => {
      if (!session || session === this.debugSessionManager.currentSession) {
        this.render(uri);
      }
    });
    this.breakpointManager.onDidChangeBreakpoints((event) => {
      // 移除breakpointWidget
    });
  }

  protected render(uri: URI): void {
    const models = this.models.get(uri.toString());
    if (!models) {
      return;
    }
    for (const model of models) {
      model.render();
    }
  }

  protected push(codeEditor: ICodeEditor): void {
    const monacoEditor = (codeEditor as any).monacoEditor as monaco.editor.ICodeEditor;
    console.log(codeEditor, 'codeEditor ==>');
    codeEditor.onRefOpen((ref) => {
      const uriString = ref.instance.uri.toString();
      const debugModel = this.models.get(uriString) || [];
      let isRendered = false;
      if (debugModel.length > 0) {
        for (const model of debugModel) {
          if ((model.editor as any)._id === (monacoEditor as any)._id) {
            model.render();
            isRendered = true;
            break;
          }
        }
      }
      if (!isRendered) {
        const monacoModel = ref.instance.getMonacoModel();
        const model = this.debugModelFactory(monacoEditor);
        debugModel.push(model);
        this.models.set(uriString, debugModel);
        monacoModel.onWillDispose(() => {
          model!.dispose();
          this.models.delete(uriString);
        });
      }
    });

    const handleMonacoModelEvent = (type: DebugModelSupportedEventType, event: monaco.editor.IPartialEditorMouseEvent) => {
      const model = monacoEditor.getModel();
      if (!model) {
        throw new Error('Not find model');
      }

      this.handleMouseEvent(new URI(model.uri.toString()),
        type, event as monaco.editor.IEditorMouseEvent, monacoEditor);
    };
    this.toDispose.push(
      monacoEditor.onMouseMove((event) => handleMonacoModelEvent(DebugModelSupportedEventType.move, event)));
    this.toDispose.push(
      monacoEditor.onMouseDown((event) => handleMonacoModelEvent(DebugModelSupportedEventType.down, event)));
    this.toDispose.push(
      monacoEditor.onMouseLeave((event) => handleMonacoModelEvent(DebugModelSupportedEventType.leave, event)));
    this.toDispose.push(
      monacoEditor.onContextMenu((event) => handleMonacoModelEvent(DebugModelSupportedEventType.contextMenu, event)));
  }

  resolve(uri: URI) {
    const model = this.models.get(uri.toString());
    if (!model) {
      return undefined;
    }
    return model;
  }

  handleMouseEvent(uri: URI, type: DebugModelSupportedEventType, event: monaco.editor.IEditorMouseEvent | monaco.editor.IPartialEditorMouseEvent, monacoEditor: monaco.editor.ICodeEditor) {
    const debugModel = this.models.get(uri.toString());
    if (!debugModel) {
      throw new Error('Not find debug model');
    }
    // 同一个uri可能对应多个打开的monacoEditor，这里只需要验证其中一个即可
    const canSetBreakpoints = this.debugConfigurationManager.canSetBreakpointsIn(debugModel[0].editor.getModel());
    if (!canSetBreakpoints) {
      return;
    }
    for (const model of debugModel) {
      if (type === DebugModelSupportedEventType.contextMenu) {
        model[`onContextMenu`](event);
      } else if ((model.editor as any)._id === (monacoEditor as any)._id) {
        model[`onMouse${type}`](event);
        break;
      }
    }
  }

}
