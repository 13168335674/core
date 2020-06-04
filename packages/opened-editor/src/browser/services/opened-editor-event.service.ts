import { Emitter, WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { IResource, IEditorGroup, ResourceDecorationChangeEvent, IResourceDecorationChangeEventPayload } from '@ali/ide-editor';
import { Injectable } from '@ali/common-di';
import { EditorGroupOpenEvent, EditorGroupCloseEvent, EditorGroupDisposeEvent, EditorGroupChangeEvent } from '@ali/ide-editor/lib/browser';

export type OpenedEditorData = IEditorGroup | IResource;
export interface OpenedEditorEvent {
  group: IEditorGroup;
  resource: IResource;
}

@Injectable()
export class OpenedEditorEventService extends WithEventBus {

  private _onDidChange: Emitter<OpenedEditorEvent | null> = new Emitter();
  private _onDidDecorationChange: Emitter<IResourceDecorationChangeEventPayload | null> = new Emitter();
  private _onDidActiveChange: Emitter<OpenedEditorEvent | null> = new Emitter();

  public onDidChange = this._onDidChange.event;
  public onDidDecorationChange = this._onDidDecorationChange.event;
  public onDidActiveChange = this._onDidActiveChange.event;

  constructor() {
    super();
  }

  @OnEvent(EditorGroupOpenEvent)
  onEditorGroupOpenEvent(e: EditorGroupOpenEvent) {
    this._onDidActiveChange.fire(e.payload);
  }

  @OnEvent(EditorGroupChangeEvent)
  onEditorGroupChangeEvent() {
    this._onDidChange.fire(null);
  }

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupCloseEvent() {
    this._onDidChange.fire(null);
  }

  @OnEvent(EditorGroupDisposeEvent)
  onEditorGroupDisposeEvent() {
    this._onDidChange.fire(null);
  }

  // 为修改的文件添加dirty装饰
  @OnEvent(ResourceDecorationChangeEvent)
  onResourceDecorationChangeEvent(e: ResourceDecorationChangeEvent) {
    this._onDidDecorationChange.fire(e.payload);
  }
}
