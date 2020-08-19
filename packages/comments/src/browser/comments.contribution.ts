import { Autowired } from '@ali/common-di';
import { Domain, ClientAppContribution, Disposable, localize, ContributionProvider, Event, ToolbarRegistry, CommandContribution, CommandRegistry, getIcon, TabBarToolbarContribution, IEventBus } from '@ali/ide-core-browser';
import { ICommentsService, CommentPanelId, CommentsContribution, ICommentsFeatureRegistry, CollapseId, CommentPanelCollapse, CloseThreadId, ICommentThreadTitle } from '../common';
import { IEditor } from '@ali/ide-editor';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '@ali/ide-editor/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IMenuRegistry, MenuId, NextMenuContribution } from '@ali/ide-core-browser/lib/menu/next';

@Domain(ClientAppContribution, BrowserEditorContribution, CommandContribution, TabBarToolbarContribution, NextMenuContribution)
export class CommentsBrowserContribution extends Disposable implements ClientAppContribution, BrowserEditorContribution, CommandContribution, TabBarToolbarContribution, NextMenuContribution {

  @Autowired(ICommentsService)
  private readonly commentsService: ICommentsService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  @Autowired(ICommentsFeatureRegistry)
  private readonly commentsFeatureRegistry: ICommentsFeatureRegistry;

  @Autowired(CommentsContribution)
  private readonly contributions: ContributionProvider<CommentsContribution>;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  onStart() {
    this.registerCommentsFeature();
    this.listenToCreateCommentsPanel();
    this.commentsService.init();
  }

  get panelBadge() {
    const length = this.commentsService.commentsThreads.length;
    return length ? length + '' : '';
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({
      id: CollapseId,
      label: '%comments.panel.action.collapse%',
      iconClass: getIcon('collapse-all'),
    }, {
      execute: () => {
        this.eventBus.fire(new CommentPanelCollapse());
      },
    });

    registry.registerCommand({
      id: CloseThreadId,
      label: '%comments.thread.action.close%',
      iconClass: getIcon('up'),
    }, {
      execute: (threadTitle: ICommentThreadTitle) => {
        const { thread, widget } = threadTitle;
        if (!thread.comments.length) {
          thread.dispose();
        } else {
          if (widget.isShow) {
            widget.toggle();
          }
        }
      },
    });
  }

  registerNextMenus(registry: IMenuRegistry): void {
    registry.registerMenuItem(MenuId.CommentsCommentThreadTitle, {
      command: CloseThreadId,
      group: 'inline',
      order: Number.MAX_SAFE_INTEGER,
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: CollapseId,
      viewId: CommentPanelId,
      command: CollapseId,
      tooltip: localize('comments.panel.action.collapse'),
    });
  }

  private registerCommentsFeature() {
    this.contributions.getContributions().forEach((contribution, index) => {
      this.addDispose(this.commentsService.registerCommentRangeProvider(`contribution_${index}`, {
        getCommentingRanges: (documentModel) => contribution.provideCommentingRanges(documentModel),
      }));
      if (contribution.registerCommentsFeature) {
        contribution.registerCommentsFeature(this.commentsFeatureRegistry);
      }
    });
  }
  /**
   * 因为大多数情况下没有评论，所以默认先不注册底部面板
   * 在第一次创建 thread 的时候再创建底部面板
   * @memberof CommentsBrowserContribution
   */
  private listenToCreateCommentsPanel() {
    if (this.commentsFeatureRegistry.getCommentsPanelOptions().defaultShow) {
      this.commentsService.registerCommentPanel();
    } else {
      Event.once(this.commentsService.onThreadsCreated)(() => {
        this.commentsService.registerCommentPanel();
      });
    }

    this.commentsService.onThreadsChanged(() => {
      const handler = this.layoutService.getTabbarHandler(CommentPanelId);
      handler?.setBadge(this.panelBadge);
    });
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        return this.commentsService.handleOnCreateEditor(editor);
      },
      provideEditorOptionsForUri: async (uri) => {
        const ranges = await this.commentsService.getContributionRanges(uri);

        // 说明当前 uri 可以评论
        if (ranges.length) {
          return {
            // 让编辑器的 lineDecorationsWidth 宽一点，以便放下评论 icon
            lineDecorationsWidth: 25,
          };
        } else {
          return {};
        }
      },
    });
  }

}
