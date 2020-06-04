import { TreeModel, TreeNodeEvent, CompositeTreeNode } from '@ali/ide-components';
import { Injectable, Optional, Autowired} from '@ali/common-di';
import { ThrottledDelayer } from '@ali/ide-core-browser';
import { OpenedEditorDecorationService } from './opened-editor-decoration.service';
import { EditorFileGroup } from '../opened-editor-node.define';

@Injectable({multiple: true})
export class OpenedEditorModel extends TreeModel {

  static DEFAULT_FLUSH_DELAY = 100;

  @Autowired(OpenedEditorDecorationService)
  public readonly decorationService: OpenedEditorDecorationService;

  private flushDispatchChangeDelayer =  new ThrottledDelayer<void>(OpenedEditorModel.DEFAULT_FLUSH_DELAY);

  constructor(@Optional() root: EditorFileGroup) {
    super();
    this.init(root);
  }

  init(root: CompositeTreeNode) {
    this.root = root;
    // 分支更新时通知树刷新, 不是立即更新，而是延迟更新，待树稳定后再更新
    // 100ms的延迟并不能保证树稳定，特别是在node_modules展开的情况下
    // 但在普通使用上已经足够可用，即不会有渲染闪烁问题
    this.root.watcher.on(TreeNodeEvent.BranchDidUpdate, () => {
      if (!this.flushDispatchChangeDelayer.isTriggered()) {
        this.flushDispatchChangeDelayer.cancel();
      }
      this.flushDispatchChangeDelayer.trigger(async () => {
        this.dispatchChange();
      });
    });
    // this.root.watcher.on(TreeNodeEvent.BranchDidUpdate, this.dispatchChange);
    // 主题或装饰器更新时，更新树
    this.decorationService.onDidChange(this.dispatchChange);
  }
}
