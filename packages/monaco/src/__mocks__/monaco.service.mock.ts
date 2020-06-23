import { Deferred, Emitter } from '@ali/ide-core-common';
import { createMockedMonaco } from './monaco';
import { Injectable } from '@ali/common-di';
import { MonacoService, ServiceNames } from '../common';

@Injectable()
export class MockedMonacoService implements MonacoService {

  private _onMonacoLoaded: Emitter<boolean> = new Emitter<boolean>();
  public onMonacoLoaded = this._onMonacoLoaded.event;
  private mockedMonaco = createMockedMonaco() as (typeof monaco);

  private readonly _monacoLoaded = new Deferred<void>();
  get monacoLoaded(): Promise<void> {
    return this._monacoLoaded.promise;
  }

  constructor() {
    (global as any).monaco = this.mockedMonaco;
    setTimeout(() => {
      this._onMonacoLoaded.fire(true);
      this._monacoLoaded.resolve();
    });
  }

  public async createCodeEditor(monacoContainer: HTMLElement, options?: monaco.editor.IEditorConstructionOptions | undefined): Promise<monaco.editor.IStandaloneCodeEditor> {
    return this.mockedMonaco.editor.create(monacoContainer, options);
  }
  public async loadMonaco(): Promise<void> {
  }
  public async createDiffEditor(monacoContainer: HTMLElement, options?: monaco.editor.IDiffEditorConstructionOptions | undefined): Promise<monaco.editor.IDiffEditor> {
    return this.mockedMonaco.editor.createDiffEditor(monacoContainer, options);
  }
  public registerOverride(serviceName: ServiceNames, service: any): void {

  }
  public testTokenize(line: string, languageId: string) {

  }

  public getOverride(serviceName: ServiceNames) {

  }

}
