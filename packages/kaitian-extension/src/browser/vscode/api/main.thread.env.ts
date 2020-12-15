import type * as vscode from 'vscode';
import { Injectable, Optinal, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { IRPCProtocol, WSChannelHandler } from '@ali/ide-connection';
import { ILoggerManagerClient } from '@ali/ide-logs/lib/browser';
import { IMainThreadEnv, IExtHostEnv, ExtHostAPIIdentifier } from '../../../common/vscode';
import { UIKind, UriComponents } from '../../../common/vscode/ext-types';
import { ClientAppConfigProvider, IOpenerService, IClipboardService, electronEnv, IExternalUriService } from '@ali/ide-core-browser';
import { getLanguageId, URI, isElectronEnv } from '@ali/ide-core-common';
import { HttpOpener } from '@ali/ide-core-browser/lib/opener/http-opener';

@Injectable({multiple: true})
export class MainThreadEnv implements IMainThreadEnv {
  @Autowired(ILoggerManagerClient)
  loggerManger: ILoggerManagerClient;

  private eventDispose;
  private readonly proxy: IExtHostEnv;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  @Autowired(IExternalUriService)
  private readonly externalUriService: IExternalUriService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private readonly appConfig = ClientAppConfigProvider.get();

  // 检测下支持的协议，以防打开内部协议
  // 支持 http/https/mailto/projectScheme 协议
  private isSupportedLink(uri: URI) {
    return HttpOpener.standardSupportedLinkSchemes.has(uri.scheme) || uri.scheme === ClientAppConfigProvider.get().uriScheme;
  }

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEnv);

    this.eventDispose = this.loggerManger.onDidChangeLogLevel((level) => {
      this.proxy.$fireChangeLogLevel(level);
    });
    this.setLogLevel();
    const { applicationName: appName, uriScheme } = this.appConfig;
    this.proxy.$setEnvValues({
      appName,
      uriScheme,
      language: getLanguageId(),
      uiKind: isElectronEnv() ? UIKind.Desktop : UIKind.Web,
    });
  }

  public dispose() {
    this.eventDispose.dispose();
  }

  private async setLogLevel() {
    const value = await this.loggerManger.getGlobalLogLevel();
    await this.proxy.$setLogLevel(value);
  }

  async $clipboardReadText() {
    try {
      const value = await this.clipboardService.readText();
      return value;
    } catch (e) {
      return '';
    }
  }

  $clipboardWriteText(text): Thenable<void> {
    return new Promise(async (resolve) => {
      try {
        await this.clipboardService.writeText(text);
      } catch (e) {}
      resolve();
    });
  }

  async $openExternal(target: vscode.Uri): Promise<boolean> {
    if (this.isSupportedLink(URI.from(target))) {
      return await this.openerService.open(target.toString(true));
    }
    return false;
  }

  private getWindowId() {
    if (isElectronEnv()) {
      return electronEnv.currentWindowId;
    } else {
      // web 场景先用 clientId
      const channelHandler = this.injector.get(WSChannelHandler);
      return channelHandler.clientId;
    }
  }

  async $asExternalUri(target: vscode.Uri): Promise<UriComponents> {
    const { uriScheme } = this.appConfig;
    const uri = URI.from(target);
    // 如果是 appUriScheme，则在 query 加入当前 windowId
    if (uri.scheme === uriScheme) {
      const windowId = this.getWindowId();
      let query = uri.query;
      if (!query) {
        query = `windowId=${windowId}`;
      } else {
        query += `&windowId=${windowId}`;
      }
      return uri.withQuery(query).codeUri;
    }
    const externalUri = this.externalUriService.resolveExternalUri(uri);
    return externalUri.codeUri;
  }
}
