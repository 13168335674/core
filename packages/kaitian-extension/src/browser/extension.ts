import { Injectable, Optional, Autowired } from '@ali/common-di';
import { JSONType, ExtensionService, IExtension, IExtensionProps, IExtensionMetaData } from '../common';
import { getLogger, Disposable, registerLocalizationBundle, getCurrentLanguageInfo, Emitter } from '@ali/ide-core-common';
import { VSCodeMetaService } from './vscode/meta';

const metaDataSymbol = Symbol.for('metaDataSymbol');
const extensionServiceSymbol = Symbol.for('extensionServiceSymbol');

@Injectable({multiple: true})
export class Extension extends Disposable implements IExtension {
  public readonly id: string;
  public readonly extensionId: string;
  public readonly name: string;
  public readonly extraMetadata: JSONType = {};
  public readonly packageJSON: JSONType;
  public readonly deafaultPkgNlsJSON: JSONType | undefined;
  public readonly packageNlsJSON: JSONType | undefined;
  public readonly path: string;
  public readonly realPath: string;
  public readonly extendConfig: JSONType;
  public readonly enableProposedApi: boolean;

  private _activated: boolean = false;
  private _activating: Promise<void> | null = null;

  private _enabled: boolean;

  private readonly logger = getLogger();

  @Autowired(VSCodeMetaService)
  vscodeMetaService: VSCodeMetaService;

  constructor(
    @Optional(metaDataSymbol) private extensionData: IExtensionMetaData,
    @Optional(extensionServiceSymbol) private extensionService: ExtensionService,
    @Optional(Symbol()) public isUseEnable: boolean,
    @Optional(Symbol()) public isBuiltin: boolean,
    private didActivated: Emitter<IExtensionProps>,
  ) {
    super();

    this._enabled = isUseEnable;
    this.packageJSON = this.extensionData.packageJSON;
    this.deafaultPkgNlsJSON = this.extensionData.deafaultPkgNlsJSON;
    this.packageNlsJSON = this.extensionData.packageNlsJSON;
    this.id = this.extensionData.id;
    this.extensionId = this.extensionData.extensionId;
    this.name = this.packageJSON.name;
    this.extraMetadata = this.extensionData.extraMetadata;
    this.path = this.extensionData.path;
    this.realPath = this.extensionData.realPath;
    this.extendConfig = this.extensionData.extendConfig || {};
    this.enableProposedApi = Boolean(this.extensionData.packageJSON.enableProposedApi);
  }

  get activated() {
    return this._activated;
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(enable: boolean) {
    this._enabled = enable;
  }

  disable() {
    if (!this._enabled) {
      return;
    }
    this.vscodeMetaService.dispose();
    this._enabled = false;
  }

  enable() {
    if (this._enabled) {
      return ;
    }

    this._enabled = true;
  }

  async contributeIfEnabled() {
    if (this._enabled) {
      this.addDispose(this.vscodeMetaService);
      this.logger.log(`${this.name} vscodeMetaService.run`);
      if (this.packageNlsJSON) {
        registerLocalizationBundle( {
          ...getCurrentLanguageInfo(),
          contents: this.packageNlsJSON as any,
        }, this.id);
      }

      if (this.deafaultPkgNlsJSON) {
        registerLocalizationBundle( {
          languageId: 'default',
          languageName: 'en-US',
          localizedLanguageName: '英文(默认)',
          contents: this.deafaultPkgNlsJSON as any,
        }, this.id);
      }

      await this.vscodeMetaService.run(this);
    }
  }

  async activate() {
    if (this._activated) {
      return ;
    }

    if (this._activating) {
      return this._activating;
    }

    this._activating = this.extensionService.activeExtension(this).then(() => {
      this._activated = true;
      this.didActivated.fire(this.toJSON());
    }).catch((e) => {
      this.logger.error(e);
    });

    return this._activating;
  }

  toJSON(): IExtensionProps {
    return {
      id: this.id,
      extensionId: this.extensionId,
      name: this.name,
      activated: this.activated,
      enabled: this.enabled,
      packageJSON: this.packageJSON,
      deafaultPkgNlsJSON: this.deafaultPkgNlsJSON,
      packageNlsJSON: this.packageNlsJSON,
      path: this.path,
      realPath: this.realPath,
      isUseEnable: this.isUseEnable,
      extendConfig: this.extendConfig,
      enableProposedApi: this.enableProposedApi,
      extraMetadata: this.extraMetadata,
      isBuiltin: this.isBuiltin,
    };
  }

}
