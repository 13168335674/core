import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IFeatureExtensionType, IFeatureExtension, FeatureExtensionCapability, JSONSchema, FeatureExtensionManagerService } from '@ali/ide-feature-extension/lib/browser';
import { IDisposable, registerLocalizationBundle, getLogger, Deferred, Disposable } from '@ali/ide-core-browser';
import { ContributesSchema, VscodeContributesRunner } from './contributes';
import { LANGUAGE_BUNDLE_FIELD, VSCodeExtensionService } from './types';
import {createApiFactory} from './api/main.thread.api.impl';
import {VSCodeExtensionNodeServiceServerPath, VSCodeExtensionNodeService, ExtHostAPIIdentifier} from '../common';
import { ActivationEventService } from '@ali/ide-activation-event';
import { IRPCProtocol } from '@ali/ide-connection';
@Injectable()
export class VscodeExtensionType implements IFeatureExtensionType<VscodeJSONSchema> {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  public readonly name = 'vscode-extension';

  public isThisType(packageJSON: { [key: string]: any; }): boolean {
    return packageJSON.engines && packageJSON.engines.vscode;
  }

  createCapability(extension: IFeatureExtension): VscodeExtensionCapability {
    return this.injector.get(VscodeExtensionCapability, [extension]);
  }

}

export interface VscodeJSONSchema extends JSONSchema {

  contributes: ContributesSchema;

  activationEvents: string[] | undefined;

}

@Injectable()
export class VSCodeExtensionServiceImpl implements VSCodeExtensionService {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(VSCodeExtensionNodeServiceServerPath)
  private vscodeService: VSCodeExtensionNodeService;

  private ready: Deferred<any> = new Deferred();

  @Autowired()
  private activationService: ActivationEventService;

  private protocol: IRPCProtocol;

  constructor() {

  }

  get extensionService(): FeatureExtensionManagerService {
    return this.injector.get(FeatureExtensionManagerService);
  }

  async getProxy(identifier): Promise<any> {
    await this.ready.promise;
    return this.protocol.getProxy(identifier);
  }

  public async createExtensionHostProcess() {
    const extPath = await this.vscodeService.getExtHostPath();

    const extForkOptions = {
      execArgv: ['--inspect=9992'],
    };

    await this.extensionService.createFeatureExtensionNodeProcess('vscode', extPath, ['--testarg=1'], extForkOptions);
    await this.setMainThreadAPI();
    this.ready.resolve();
    this.activationService.fireEvent('*');
  }

  private async setMainThreadAPI() {
    return new Promise((resolve) => {
      this.extensionService.setupAPI((protocol) => {
        this.protocol = protocol;
        createApiFactory(protocol, this.injector, this);
        resolve();
      });
    });

  }
  // FIXME: 应识别为 VSCode 的插件
  public async $getCandidates() {
    const candidates = await this.extensionService.getCandidates();
    return candidates;
  }

  public async activeExtension(extension: IFeatureExtension) {
    await this.ready.promise;
    const proxy = this.extensionService.getProxy(ExtHostAPIIdentifier.ExtHostExtensionService);
    // const extension = await proxy.$getExtension();

    console.log('activeExtension path', extension.path);
    await proxy.$activateExtension(extension.path);

  }
}

@Injectable({multiple: true})
export class VscodeExtensionCapability extends FeatureExtensionCapability<VscodeJSONSchema> {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(VSCodeExtensionService)
  private service: VSCodeExtensionServiceImpl;

  @Autowired()
  private activationService: ActivationEventService;

  public async onEnable(): Promise<IDisposable> {
    if (this.extension.extraMetadata[LANGUAGE_BUNDLE_FIELD]) {
      try {
        const bundle = JSON.parse(this.extension.extraMetadata[LANGUAGE_BUNDLE_FIELD]!);
        registerLocalizationBundle({
          locale: 'zh-CN',
          messages: bundle,
        });
        // todo unregister i18n
      } catch (e) {
        getLogger().error(e);
      }
    }
    const { contributes } = this.packageJSON;
    const runner = this.injector.get(VscodeContributesRunner, [contributes]);
    runner.run(this.extension);

    // bind activation event;
    const { activationEvents = [] } = this.packageJSON;
    const activateDisposer = new Disposable();
    activationEvents.forEach((event) => {
      this.activationService.onEvent(event, async () => {
        await this.extension.activate();
        activateDisposer.dispose();
      });
    });

    return {
      dispose: () => {
        runner.dispose();
        activateDisposer.dispose();
      },
    };
  }

  public async onActivate(): Promise<IDisposable> {
    await this.service.activeExtension(this.extension);
    return {
      dispose: () => {
        return null; // todo dispose;
      },
    };
  }

}
