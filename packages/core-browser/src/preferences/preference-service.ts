import { Injectable, Autowired } from '@ali/common-di';

import { Deferred, Event, Emitter, DisposableCollection, IDisposable, Disposable, deepFreeze, URI, isUndefined } from '@ali/ide-core-common';
import { PreferenceProvider, PreferenceProviderDataChange, PreferenceProviderDataChanges, PreferenceResolveResult } from './preference-provider';
import { PreferenceSchemaProvider, OverridePreferenceName } from './preference-contribution';
import { PreferenceScope } from './preference-scope';
import { PreferenceConfigurations } from './preference-configurations';
import { getExternalPreferenceProvider, getExternalPreference } from './early-preferences';

export interface PreferenceChange {
  readonly preferenceName: string;
  readonly newValue?: any;
  readonly oldValue?: any;
  readonly scope: PreferenceScope;
  affects(resourceUri?: string): boolean;
}

export class PreferenceChangeImpl implements PreferenceChange {
  constructor(
    private change: PreferenceProviderDataChange,
  ) { }

  get preferenceName() {
    return this.change.preferenceName;
  }
  get newValue() {
    return this.change.newValue;
  }
  get oldValue() {
    return this.change.oldValue;
  }
  get scope(): PreferenceScope {
    return this.change.scope;
  }

  public affects(resourceUri?: string): boolean {
    const resourcePath = resourceUri && new URI(resourceUri).path;
    const domain = this.change.domain;
    return !resourcePath || !domain || domain.some((uri) => new URI(uri).path.relativity(resourcePath) >= 0);
  }
}

export interface PreferenceChanges {
  [preferenceName: string]: PreferenceChange;
}
export const PreferenceService = Symbol('PreferenceService');

export interface PreferenceService extends IDisposable {
  readonly ready: Promise<void>;
  get<T>(preferenceName: string): T | undefined;
  get<T>(preferenceName: string, defaultValue: T): T;
  // tslint:disable-next-line:unified-signatures
  get<T>(preferenceName: string, defaultValue: T, resourceUri: string): T;
  // tslint:disable-next-line:unified-signatures
  get<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): T | undefined;
  set(preferenceName: string, value: any, scope?: PreferenceScope, resourceUri?: string): Promise<void>;
  onPreferenceChanged: Event<PreferenceChange>;
  onPreferencesChanged: Event<PreferenceChanges>;
  inspect<T>(preferenceName: string, resourceUri?: string): {
    preferenceName: string,
    defaultValue: T | undefined,
    globalValue: T | undefined, // User Preference
    workspaceValue: T | undefined, // Workspace Preference
    workspaceFolderValue: T | undefined, // Folder Preference
  } | undefined;

  overridePreferenceName(options: OverridePreferenceName): string;
  overriddenPreferenceName(preferenceName: string): OverridePreferenceName | undefined;

  resolve<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): PreferenceResolveResult<T>;
}

export const PreferenceProviderProvider = Symbol('PreferenceProviderProvider');
export type PreferenceProviderProvider = (scope: PreferenceScope, uri?: URI) => PreferenceProvider;

@Injectable()
export class PreferenceServiceImpl implements PreferenceService {

  protected readonly onPreferenceChangedEmitter = new Emitter<PreferenceChange>();
  public readonly onPreferenceChanged = this.onPreferenceChangedEmitter.event;

  protected readonly onPreferencesChangedEmitter = new Emitter<PreferenceChanges>();
  public readonly onPreferencesChanged = this.onPreferencesChangedEmitter.event;

  protected readonly toDispose = new DisposableCollection(this.onPreferenceChangedEmitter, this.onPreferencesChangedEmitter);

  @Autowired(PreferenceSchemaProvider)
  protected readonly schema: PreferenceSchemaProvider;

  @Autowired(PreferenceProvider, { tag: PreferenceScope.Default })
  protected readonly defaultPreferenceProvider: PreferenceProvider;

  @Autowired(PreferenceProviderProvider)
  protected readonly providerProvider: PreferenceProviderProvider;

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  protected readonly preferenceProviders = new Map<PreferenceScope, PreferenceProvider>();

  /**
   * 使用 getPreferences()方法获取
   */
  protected preferences: { [key: string]: any } = {};

  constructor() {
    this.init();
  }

  protected async init(): Promise<void> {
    this.toDispose.push(Disposable.create(() => this._ready.reject(new Error('preference service is disposed'))));
    this.initializeProviders();
  }

  public dispose(): void {
    this.toDispose.dispose();
  }

  protected readonly _ready = new Deferred<void>();
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * 初始化并创建默认的PreferenceProvider
   */
  protected async initializeProviders(): Promise<void> {
    try {
      const scopes = PreferenceScope.getScopes();
      for (const scope of scopes) {
        const provider = this.providerProvider(scope);
        this.preferenceProviders.set(scope, provider);
        this.setExternalProvider(scope, provider);
        this.toDispose.push(provider.onDidPreferencesChanged((changes) =>
          this.reconcilePreferences(changes),
        ));
        await provider.ready;
      }
      this._ready.resolve();
    } catch (e) {
      this._ready.reject(e);
    }
  }

  /**
   * 合并preference 变化
   * @param changes
   */
  protected reconcilePreferences(changes: PreferenceProviderDataChanges): void {
    const changesToEmit: PreferenceChanges = {};
    const acceptChange = (change: PreferenceProviderDataChange) => {
      return this.getAffectedPreferenceNames(change, (preferenceName) =>
        changesToEmit[preferenceName] = new PreferenceChangeImpl({ ...change, preferenceName }),
      );
    };

    for (const preferenceName of Object.keys(changes)) {
      let change = changes[preferenceName];
      if (change.newValue === undefined) {
        const overridden = this.overriddenPreferenceName(change.preferenceName);
        if (overridden) {
          change = {
            ...change, newValue: this.doGet(overridden.preferenceName),
          };
        }
      }
      if (this.schema.isValidInScope(preferenceName, PreferenceScope.Folder)) {
        acceptChange(change);
        continue;
      }
      for (const scope of PreferenceScope.getReversedScopes()) {
        if (this.schema.isValidInScope(preferenceName, scope)) {
          const provider = this.getProvider(scope);
          if (provider) {
            const value = provider.get(preferenceName);
            if (scope > change.scope && value !== undefined) {
              // preference defined in a more specific scope
              break;
            } else if (scope === change.scope && change.newValue !== undefined) {
              // preference is changed into something other than `undefined`
              acceptChange(change);
            } else if (scope < change.scope && change.newValue === undefined && value !== undefined) {
              // preference is changed to `undefined`, use the value from a more general scope
              change = {
                ...change,
                newValue: value,
                scope,
              };
              acceptChange(change);
            }
          }
        }
      }
    }
    // 触发配置变更事件
    const changedPreferenceNames = Object.keys(changesToEmit);
    if (changedPreferenceNames.length > 0) {
      this.triggerPeferencesChanged(changesToEmit);
    }
    changedPreferenceNames.forEach((preferenceName) => {
      this.onPreferenceChangedEmitter.fire(changesToEmit[preferenceName]);
    });
  }

  protected getAffectedPreferenceNames(change: PreferenceProviderDataChange, accept: (affectedPreferenceName: string) => void): void {
    accept(change.preferenceName);
    for (const overridePreferenceName of this.schema.getOverridePreferenceNames(change.preferenceName)) {
      if (!this.doHas(overridePreferenceName)) {
        accept(overridePreferenceName);
      }
    }
  }

  /**
   * 通知外部的配置项样式更改
   * @private
   * @param {PreferenceScope} scope
   * @param {PreferenceProvider} provider
   * @memberof PreferenceServiceImpl
   */
  private setExternalProvider(scope: PreferenceScope, provider: PreferenceProvider): void {
    if (!provider) {
      return;
    }
    if (provider.getPreferences) {
      Object.keys(provider.getPreferences()).forEach((key) => {
        const externalProvider = getExternalPreferenceProvider(key);
        if (externalProvider) {
          const value = provider.getPreferences()[key];
          if (externalProvider.get(scope) !== value) {
            provider.setPreference(key, externalProvider.get(scope));
          }
        }
      });
    }
    if (provider.onDidPreferencesChanged) {
      provider.onDidPreferencesChanged((e: PreferenceProviderDataChanges) => {
        if (e) {
          Object.keys(e).forEach((key) => {
            const externalProvider = getExternalPreferenceProvider(key);
            if (externalProvider) {
              externalProvider.set(e[key].newValue, scope);
            }
          });
        }
      });
    }
  }

  /**
   * 获取对应scope下的preferenceProvider
   * @protected
   * @param {PreferenceScope} scope
   * @returns {(PreferenceProvider | undefined)}
   * @memberof PreferenceServiceImpl
   */
  protected getProvider(scope: PreferenceScope): PreferenceProvider | undefined {
    return this.preferenceProviders.get(scope);
  }

  /**
   * 获取指定资源的Preferences
   * @param {string} [resourceUri]
   * @returns {{ [key: string]: any }}
   * @memberof PreferenceServiceImpl
   */
  public getPreferences(resourceUri?: string): { [key: string]: any } {
    const preferences: { [key: string]: any } = {};
    for (const preferenceName of this.schema.getPreferenceNames()) {
      preferences[preferenceName] = this.get(preferenceName, undefined, resourceUri);
    }
    return preferences;
  }

  /**
   * 插叙是否有对应配置
   * @param {string} preferenceName
   * @param {string} [resourceUri]
   * @returns {boolean}
   * @memberof PreferenceServiceImpl
   */
  public has(preferenceName: string, resourceUri?: string): boolean {
    return this.get(preferenceName, undefined, resourceUri) !== undefined;
  }

  public get<T>(preferenceName: string): T | undefined;
  public get<T>(preferenceName: string, defaultValue: T): T;
  // tslint:disable-next-line: unified-signatures
  public get<T>(preferenceName: string, defaultValue: T, resourceUri?: string): T;
  public get<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): T | undefined {
    return this.resolve<T>(preferenceName, defaultValue, resourceUri).value;
  }

  public lookUp<T>(key: string): PreferenceResolveResult<T> {
    let value;
    let reset;
    if (!key) {
      return {
        value,
      };
    }
    const parts = key.split('.');
    if (!parts || parts.length === 0) {
      return {
        value,
      };
    }
    for (let i = parts.length - 1; i > 0 ; i--) {
      value = this.doResolve(parts.slice(0, i).join('.')).value;
      if (value) {
        reset = parts.slice(i);
        break;
      }
    }
    while (reset && reset.length > 0) {
      value = value[reset.shift()];
    }
    return { value };
  }

  public resolve<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): {
    configUri?: URI,
    value?: T,
  } {
    const { value, configUri } = this.doResolve(preferenceName, defaultValue, resourceUri);
    if (typeof value === 'undefined') {
      const overridden = this.overriddenPreferenceName(preferenceName);
      if (overridden) {
        return this.doResolve(overridden.preferenceName, defaultValue, resourceUri);
      } else {
        return this.lookUp(preferenceName);
      }
    }
    return { value, configUri };
  }

  public async set(preferenceName: string, value: any, scope: PreferenceScope | undefined, resourceUri?: string): Promise<void> {
    const resolvedScope = !isUndefined(scope) ? scope : (!resourceUri ? PreferenceScope.Workspace : PreferenceScope.Folder);
    // TODO: 错误日志错误码机制
    if (resolvedScope === PreferenceScope.User && this.configurations.isSectionName(preferenceName.split('.', 1)[0])) {
      throw new Error(`Unable to write to User Settings because ${preferenceName} does not support for global scope.`);
    }
    if (resolvedScope === PreferenceScope.Folder && !resourceUri) {
      throw new Error('Unable to write to Folder Settings because no resource is provided.');
    }
    const externalProvider = getExternalPreferenceProvider(preferenceName);
    if (externalProvider) {
      const oldValue = externalProvider.get(resolvedScope);
      externalProvider.set(value, resolvedScope);
      // FIXME 使用reconcile函数
      if ((this.doResolve(preferenceName).scope || 0) <= resolvedScope) {
        this.onPreferenceChangedEmitter.fire({
          preferenceName,
          newValue: value,
          oldValue,
          affects: () => false,
          scope: resolvedScope,
        });
      }
      return;
    }
    const provider = this.getProvider(resolvedScope);
    if (provider && await provider.setPreference(preferenceName, value, resourceUri)) {
      return;
    }
    throw new Error(`Unable to write to ${PreferenceScope.getScopeNames(resolvedScope)[0]} Settings.`);
  }

  public getBoolean(preferenceName: string): boolean | undefined;
  public getBoolean(preferenceName: string, defaultValue: boolean): boolean;
  // tslint:disable-next-line:unified-signatures
  public getBoolean(preferenceName: string, defaultValue: boolean, resourceUri: string): boolean;
  public getBoolean(preferenceName: string, defaultValue?: boolean, resourceUri?: string): boolean | undefined {
    const value = resourceUri ? this.get(preferenceName, defaultValue, resourceUri) : this.get(preferenceName, defaultValue);
    return value !== null && value !== undefined ? !!value : defaultValue;
  }

  public getString(preferenceName: string): string | undefined;
  public getString(preferenceName: string, defaultValue: string): string;
  // tslint:disable-next-line:unified-signatures
  public getString(preferenceName: string, defaultValue: string, resourceUri: string): string;
  public getString(preferenceName: string, defaultValue?: string, resourceUri?: string): string | undefined {
    const value = resourceUri ? this.get(preferenceName, defaultValue, resourceUri) : this.get(preferenceName, defaultValue);
    if (value === null || value === undefined) {
      return defaultValue;
    }
    return value.toString();
  }

  public getNumber(preferenceName: string): number | undefined;
  public getNumber(preferenceName: string, defaultValue: number): number;
  // tslint:disable-next-line:unified-signatures
  public getNumber(preferenceName: string, defaultValue: number, resourceUri: string): number;
  public getNumber(preferenceName: string, defaultValue?: number, resourceUri?: string): number | undefined {
    const value = resourceUri ? this.get(preferenceName, defaultValue, resourceUri) : this.get(preferenceName, defaultValue);
    if (value === null || value === undefined) {
      return defaultValue;
    }
    if (typeof value === 'number') {
      return value;
    }
    return Number(value);
  }

  public inspect<T>(preferenceName: string, resourceUri?: string): {
    preferenceName: string,
    defaultValue: T | undefined,
    globalValue: T | undefined, // User Preference
    workspaceValue: T | undefined, // Workspace Preference
    workspaceFolderValue: T | undefined, // Folder Preference
  } | undefined {
    const defaultValue = this.inspectInScope<T>(preferenceName, PreferenceScope.Default, resourceUri);
    const globalValue = this.inspectInScope<T>(preferenceName, PreferenceScope.User, resourceUri);
    const workspaceValue = this.inspectInScope<T>(preferenceName, PreferenceScope.Workspace, resourceUri);
    const workspaceFolderValue = this.inspectInScope<T>(preferenceName, PreferenceScope.Folder, resourceUri);

    return { preferenceName, defaultValue, globalValue, workspaceValue, workspaceFolderValue };
  }
  protected inspectInScope<T>(preferenceName: string, scope: PreferenceScope, resourceUri?: string): T | undefined {
    const value = this.doInspectInScope<T>(preferenceName, scope, resourceUri);
    if (value === undefined) {
      const overridden = this.overriddenPreferenceName(preferenceName);
      if (overridden) {
        return this.doInspectInScope(overridden.preferenceName, scope, resourceUri);
      }
    }
    return value;
  }

  public overridePreferenceName(options: OverridePreferenceName): string {
    return this.schema.overridePreferenceName(options);
  }

  public overriddenPreferenceName(preferenceName: string): OverridePreferenceName | undefined {
    return this.schema.overriddenPreferenceName(preferenceName);
  }

  protected doHas(preferenceName: string, resourceUri?: string): boolean {
    return this.doGet(preferenceName, undefined, resourceUri) !== undefined;
  }

  protected doInspectInScope<T>(preferenceName: string, scope: PreferenceScope, resourceUri?: string): T | undefined {
    const provider = this.getProvider(scope);
    return provider && provider.get<T>(preferenceName, resourceUri);
  }

  protected doGet<T>(preferenceName: string, defaultValue?: T, resourceUri?: string): T | undefined {
    return this.doResolve(preferenceName, defaultValue, resourceUri).value;
  }

  protected doResolve<T>(preferenceName: string, defaultValue?: T, resourceUri?: string, untilScope?: PreferenceScope): PreferenceResolveResult<T> {
    const result: PreferenceResolveResult<T> = { scope: PreferenceScope.Default };
    const externalProvider = getExternalPreferenceProvider(preferenceName);
    if (externalProvider) {
      return getExternalPreference(preferenceName, this.schema.getPreferenceProperty(preferenceName), untilScope);
    }
    const scopes = untilScope ? PreferenceScope.getScopes().filter((s) => s <= untilScope) : PreferenceScope.getScopes();
    for (const scope of scopes) {
      if (this.schema.isValidInScope(preferenceName, scope)) {
        const provider = this.getProvider(scope);
        if (provider) {
          const { configUri, value } = provider.resolve<T>(preferenceName, resourceUri);
          if (value !== undefined) {
            result.configUri = configUri;
            result.value = PreferenceProvider.merge(result.value as any, value as any) as any;
            result.scope = scope;
          }
        }
      }
    }
    return {
      configUri: result.configUri,
      value: result.value !== undefined ? deepFreeze(result.value) : defaultValue,
      scope: result.scope || PreferenceScope.Default, // TODO @魁武 这里可以是Default吗
    };
  }

  // hack duck types for ContextKeyService
  // https://yuque.antfin-inc.com/zymuwz/lsxfi3/kg9bng#5wAGA
  // https://github.com/microsoft/vscode/blob/master/src/vs/platform/configuration/common/configuration.ts
  protected triggerPeferencesChanged(changesToEmit: PreferenceChanges) {
    this.onPreferencesChangedEmitter.fire(changesToEmit);

    const changes = Object.values(changesToEmit);
    const defaultScopeChanges = changes.filter((change) => change.scope === PreferenceScope.Default);
    const userScopeChanges = changes.filter((change) => change.scope === PreferenceScope.User);
    const workspaceScopeChanges = changes.filter((change) => change.scope === PreferenceScope.Workspace);
    const folderScopeChanges = changes.filter((change) => change.scope === PreferenceScope.Folder);

    if (defaultScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: defaultScopeChanges.map((n) => n.preferenceName),
        source: ConfigurationTarget.DEFAULT,
      });
    }

    if (userScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: userScopeChanges.map((n) => n.preferenceName),
        source: ConfigurationTarget.USER,
      });
    }

    if (workspaceScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: workspaceScopeChanges.map((n) => n.preferenceName),
        source: ConfigurationTarget.WORKSPACE,
      });
    }

    if (folderScopeChanges.length) {
      this._onDidChangeConfiguration.fire({
        affectedKeys: folderScopeChanges.map((n) => n.preferenceName),
        source: ConfigurationTarget.WORKSPACE_FOLDER,
      });
    }
  }

  public getValue<T>(preferenceName: string): T | undefined {
    return this.resolve<T>(preferenceName).value;
  }

  protected readonly _onDidChangeConfiguration = new Emitter<IConfigurationChangeEvent>();
  public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;
}

// copied from vscdoe
interface IConfigurationChangeEvent {
  source: ConfigurationTarget;
  affectedKeys: string[];
}

const enum ConfigurationTarget {
  USER = 1,
  USER_LOCAL,
  USER_REMOTE,
  WORKSPACE,
  WORKSPACE_FOLDER,
  DEFAULT,
  MEMORY,
}
