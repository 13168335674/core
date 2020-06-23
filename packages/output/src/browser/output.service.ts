import { observable, action } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus } from '@ali/ide-core-common';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { AppConfig, MonacoService, PreferenceService } from '@ali/ide-core-browser';

import { OutputChannel } from './output.channel';

@Injectable()
export class OutputService extends WithEventBus {

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(MonacoService)
  private readonly monacoService: MonacoService;

  @Autowired(IEditorDocumentModelService)
  protected readonly documentService: IEditorDocumentModelService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private outputEditor: monaco.editor.IStandaloneCodeEditor;

  @observable
  readonly channels = new Map<string, OutputChannel>();

  @observable.ref
  selectedChannel: OutputChannel;

  @observable
  public keys: string = '' + Math.random();

  private monacoDispose: monaco.IDisposable;

  private autoReveal: boolean = true;

  private enableSmartScroll: boolean = true;

  constructor() {
    super();

    this.enableSmartScroll = Boolean(this.preferenceService.get<boolean>('output.enableSmartScroll'));
    this.addDispose(this.preferenceService.onPreferenceChanged((e) => {
      if (e.preferenceName === 'output.enableSmartScroll' && e.newValue !== this.enableSmartScroll) {
        this.enableSmartScroll = e.newValue;
      }
    }));
  }

  @action
  public updateSelectedChannel(channel: OutputChannel) {
    if (this.monacoDispose) {
      this.monacoDispose.dispose();
    }
    this.selectedChannel = channel;
    this.selectedChannel.modelReady.promise.then(() => {
      const model = this.selectedChannel.outputModel.instance.getMonacoModel();
      this.outputEditor.setModel(model);
      if (this.enableSmartScroll) {
        this.outputEditor.revealLine(model.getLineCount());
        this.autoReveal = true;
      }

      this.monacoDispose = model.onDidChangeContent(() => {
        if (this.autoReveal && this.enableSmartScroll) {
          this.outputEditor.revealLine(model.getLineCount(), 0);
        }
      });
    });
  }

  @observable
  private _viewHeight: string;

  set viewHeight(value: string) {
    this._viewHeight = value;
  }

  get viewHeight() {
    return this._viewHeight;
  }

  getChannel(name: string): OutputChannel {
    const existing = this.channels.get(name);
    if (existing) {
      return existing;
    }
    const channel = this.config.injector.get(OutputChannel, [name]);
    this.channels.set(name, channel);
    if (this.channels.size === 1) {
      this.updateSelectedChannel(channel);
    }
    return channel;
  }

  deleteChannel(name: string): void {
    this.channels.delete(name);
  }

  getChannels(): OutputChannel[] {
    return Array.from(this.channels.values());
  }

  public async initOuputMonacoInstance(container: HTMLDivElement) {
    this.outputEditor = await this.monacoService.createCodeEditor(container, {
      automaticLayout: true,
      minimap: {
        enabled: false,
      },
      lineNumbers: 'off',
      readOnly: true,
      scrollbar: {
        useShadows: false,
      },
      wordWrap: 'on',
      overviewRulerLanes: 3,
      lineNumbersMinChars: 3,
      fixedOverflowWidgets: true,
      lineDecorationsWidth: 4,
      renderIndentGuides: false,
      glyphMargin: false,
      scrollBeyondLastLine: false,
      scrollBeyondLastColumn: 0,
    });

    this.addDispose(this.outputEditor.onMouseUp((e) => {
      /**
       * 这里的逻辑是
       * 当开启智能滚动后，如果鼠标事件点击所在行小于当前总行数，则停止自动滚动
       * 如果点击到最后一行，则启用自动滚动
       */
      if (this.enableSmartScroll) {
        const { range } = e.target;
        const maxLine = this.outputEditor.getModel()?.getLineCount();
        if (range?.startLineNumber! < maxLine!) {
          this.autoReveal = false;
        }
        if (range?.startLineNumber! >= maxLine!) {
          this.autoReveal = true;
        }
      }
    }));
  }
}
