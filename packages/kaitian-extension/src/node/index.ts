import { Provider, Injectable, Autowired } from '@ali/common-di';
import { NodeModule, ServerAppContribution, Domain, INodeLogger } from '@ali/ide-core-node';
import { IExtensionNodeService, ExtensionNodeServiceServerPath, IExtensionNodeClientService } from '../common';
import { ExtensionNodeServiceImpl } from './extension.service';
import { ExtensionServiceClientImpl } from './extension.service.client';

@Injectable()
export class KaitianExtensionModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IExtensionNodeService,
      useClass: ExtensionNodeServiceImpl,
    },
    {
      token: IExtensionNodeClientService,
      useClass: ExtensionServiceClientImpl,
    },
    KaitianExtensionContribution,
  ];
  backServices = [
    {
      servicePath: ExtensionNodeServiceServerPath,
      token: IExtensionNodeClientService,
    },
  ];
}

@Domain(ServerAppContribution)
export class KaitianExtensionContribution implements ServerAppContribution {

  @Autowired(IExtensionNodeService)
  extensionNodeService: IExtensionNodeService;

  @Autowired(INodeLogger)
  logger;

  async initialize() {
    // await (this.extensionNodeService as any).preCreateProcess();
    // console.log('kaitian ext pre create process');

    await (this.extensionNodeService as any).setExtProcessConnectionForward();
    this.logger.verbose('kaitian ext setExtProcessConnectionForward');
  }

  async onStop() {
    if (process.env.KTELECTRON) {
      const clientId = process.env.CODE_WINDOW_CLIENT_ID as string;
      await this.extensionNodeService.disposeClientExtProcess(clientId, true);
      this.logger.warn('kaitian extension exit by server stop');
    }
  }
}
