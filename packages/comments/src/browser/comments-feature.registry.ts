import { Injectable } from '@ali/common-di';
import { CommentsPanelOptions, ICommentsFeatureRegistry, PanelTreeNodeHandler, FileUploadHandler, MentionsOptions, ZoneWidgerRender, ICommentsConfig } from '../common';

@Injectable()
export class CommentsFeatureRegistry implements ICommentsFeatureRegistry {

  private config: ICommentsConfig = {};

  private options: CommentsPanelOptions = {};

  private panelTreeNodeHandlers: PanelTreeNodeHandler[] = [];

  private fileUploadHandler: FileUploadHandler;

  private mentionsOptions: MentionsOptions = {};

  private zoneWidgetRender: ZoneWidgerRender;

  registerConfig(config: ICommentsConfig): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  registerPanelTreeNodeHandler(handler: PanelTreeNodeHandler): void {
    this.panelTreeNodeHandlers.push(handler);
  }

  registerPanelOptions(options: CommentsPanelOptions): void {
    this.options = {
      ...this.options,
      ... options,
    };
  }

  registerFileUploadHandler(handler: FileUploadHandler): void {
    this.fileUploadHandler = handler;
  }

  registerMentionsOptions(options: MentionsOptions): void {
    this.mentionsOptions = options;
  }

  registerZoneWidgetRender(render: ZoneWidgerRender): void {
    this.zoneWidgetRender = render;
  }

  getConfig(): ICommentsConfig {
    return this.config;
  }

  getCommentsPanelOptions(): CommentsPanelOptions {
    return this.options;
  }

  getCommentsPanelTreeNodeHandlers(): PanelTreeNodeHandler[] {
    return this.panelTreeNodeHandlers;
  }

  getFileUploadHandler() {
    return this.fileUploadHandler;
  }

  getMentionsOptions() {
    return this.mentionsOptions;
  }

  getZoneWidgetRender(): ZoneWidgerRender | undefined {
    return this.zoneWidgetRender;
  }
}
