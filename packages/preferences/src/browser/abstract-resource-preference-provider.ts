import * as jsoncparser from 'jsonc-parser';
import { Injectable, Autowired } from '@ali/common-di';
import { JSONUtils, URI, ResourceProvider, Disposable, isUndefined, PreferenceProviderDataChanges, ILogger, IResolvedPreferences } from '@ali/ide-core-browser';
import {
  PreferenceProvider,
  PreferenceSchemaProvider,
  PreferenceScope,
  PreferenceProviderDataChange,
  PreferenceConfigurations,
} from '@ali/ide-core-browser';

// vscode 对语言的setting是根据这种格式来的
// "[json]": { "editor.formatter": "xxxx" }
// 对其进行兼容
const OVERRIDE_PROPERTY = '\\[(.*)\\]$';
export const OVERRIDE_PROPERTY_PATTERN = new RegExp(OVERRIDE_PROPERTY);

@Injectable()
export abstract class AbstractResourcePreferenceProvider extends PreferenceProvider {

  protected preferences: IResolvedPreferences = {
    default: {},
    languageSpecific: {},
  };

  @Autowired(ResourceProvider)
  protected readonly resourceProvider: ResourceProvider;

  @Autowired(PreferenceSchemaProvider)
  protected readonly schemaProvider: PreferenceSchemaProvider;

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  @Autowired(ILogger)
  private logger: ILogger;

  constructor() {
    super();
    this.init();
  }

  protected async init(): Promise<void> {
    const uri = this.getUri();
    this.resource = this.resourceProvider(uri);
    // 尝试读取preferences初始内容
    this.readPreferences()
      .then(() => this._ready.resolve())
      .catch(() => this._ready.resolve());

    const resource = await this.resource;
    this.toDispose.push(resource);
    if (resource.onDidChangeContents) {
      // 配置文件改变时，重新读取配置
      this.toDispose.push(resource.onDidChangeContents(() => {
        return this.readPreferences();
      }));
    }
    this.toDispose.push(Disposable.create(() => this.reset()));
  }

  protected abstract getUri(): URI;
  protected abstract getScope(): PreferenceScope;

  getConfigUri(): URI;
  getConfigUri(resourceUri: string | undefined): URI | undefined;
  getConfigUri(resourceUri?: string): URI | undefined {
    if (!resourceUri) {
      return this.getUri();
    }
    // 获取configUri不需要等待配置读取完应该就可以读取
    return this.contains(resourceUri) ? this.getUri() : undefined;
  }

  contains(resourceUri: string | undefined): boolean {
    if (!resourceUri) {
      return true;
    }
    const domain = this.getDomain();
    if (!domain) {
      return true;
    }
    const resourcePath = new URI(resourceUri).path;
    return domain.some((uri) => new URI(uri).path.relativity(resourcePath) >= 0);
  }

  getPreferences(resourceUri?: string, language?: string): { [key: string]: any } {
    return this.loaded && this.contains(resourceUri) ? this.getOnePreference(language) : {};
  }

  getLanguagePreferences(resourceUri?: string) {
    return this.loaded && this.contains(resourceUri) ? this.preferences.languageSpecific : {};
  }

  getOnePreference(language?: string): { [key: string]: any } {
    if (language) {
      return this.preferences.languageSpecific[language] || {};
    } else {
      return this.preferences.default;
    }
  }

  async setPreference(key: string, value: any, resourceUri?: string, language?: string): Promise<boolean> {
    if (!this.contains(resourceUri)) {
      return false;
    }
    const path = this.getPath(key, language);
    if (!path) {
      return false;
    }
    const resource = await this.resource;
    if (!resource.saveContents) {
      return false;
    }
    const content = ((await this.readContents()) || '').trim();
    if (!content && value === undefined) {
      return true;
    }
    try {
      let newContent = '';
      if (path.length || value !== undefined) {
        const formattingOptions = { tabSize: 2, insertSpaces: true, eol: '' };
        const edits = jsoncparser.modify(content, path, value, { formattingOptions });
        newContent = jsoncparser.applyEdits(content, edits);
      }
      await resource.saveContents(newContent);
    } catch (e) {
      const message = `Failed to update the value of ${key}.`;
      this.logger.error(`${message} ${e.toString()}`);
      return false;
    }
    await this.readPreferences();
    return true;
  }

  protected getPath(preferenceName: string, language?: string): string[] | undefined {
    if (language) {
      return [`[${language}]`, preferenceName];
    }
    return [preferenceName];
  }

  protected loaded = false;
  protected async readPreferences(): Promise<void> {
    const newContent = await this.readContents();
    this.loaded = !isUndefined(newContent);
    const newPrefs = newContent ? this.getParsedContent(newContent) : {default: {}, languageSpecific: {}};
    this.handlePreferenceChanges(newPrefs);
  }

  protected async readContents(): Promise<string | undefined> {
    try {
      const resource = await this.resource;
      return await resource.readContents();
    } catch {
      return undefined;
    }
  }

  protected getParsedContent(content: string): IResolvedPreferences {
    const jsonData = this.parse(content);

    const preferences: IResolvedPreferences = {
      default: {},
      languageSpecific: {},
    };
    if (typeof jsonData !== 'object') {
      return preferences;
    }
    // tslint:disable-next-line:forin
    for (const preferenceName in jsonData) {
      const preferenceValue = jsonData[preferenceName];
      // TODO：这里由于插件的schema注册较晚，在第一次获取配置时会校验不通过导致取不到值，读取暂时去掉校验逻辑
      if (OVERRIDE_PROPERTY_PATTERN.test(preferenceName)) {
        const language = preferenceName.match(OVERRIDE_PROPERTY_PATTERN)![1];
        preferences.languageSpecific[language] = preferences.languageSpecific[language] || {};
        // tslint:disable-next-line:forin
        for (const overriddenPreferenceName in preferenceValue) {
          const overriddenValue = preferenceValue[overriddenPreferenceName];
          preferences.languageSpecific[language][`${overriddenPreferenceName}`] = overriddenValue;
        }
      } else {
        preferences.default[preferenceName] = preferenceValue;
      }
    }
    return preferences;
  }

  protected validate(preferenceName: string, preferenceValue: any): boolean {
    if (this.configurations.getPath(this.getUri()) !== this.configurations.getPaths()[0]) {
      return true;
    }
    return preferenceValue === undefined || this.schemaProvider.validate(preferenceName, preferenceValue);
  }

  protected parse(content: string): any {
    content = content.trim();
    if (!content) {
      return undefined;
    }
    const strippedContent = jsoncparser.stripComments(content);
    return jsoncparser.parse(strippedContent);
  }

  protected handlePreferenceChanges(newPrefs: IResolvedPreferences): void {
    const oldPrefs = Object.assign({}, this.preferences);
    this.preferences = newPrefs;
    const changes: PreferenceProviderDataChanges = this.collectChanges(this.preferences, oldPrefs);

    if (Object.keys(changes.default).length > 0 || Object.keys(changes.languageSpecific).length > 0) {
      this.emitPreferencesChangedEvent(changes);
    }
  }

  protected reset(): void {
    const preferences = this.preferences;
    this.preferences = {default: {}, languageSpecific: {}};
    const changes: PreferenceProviderDataChanges = this.collectChanges(this.preferences, preferences);

    if (Object.keys(changes.default).length > 0 || Object.keys(changes.languageSpecific).length > 0) {
      this.emitPreferencesChangedEvent(changes);
    }
  }

  private collectChanges(newPref: IResolvedPreferences, oldPref: IResolvedPreferences): PreferenceProviderDataChanges {
    const changes: PreferenceProviderDataChanges = {
      default: this.collectOneChanges(newPref.default, oldPref.default),
      languageSpecific: {},
    };
    const languages = new Set<string>([...Object.keys(newPref.languageSpecific), ...Object.keys(oldPref.languageSpecific)]);
    for (const language of languages) {
      const languageChange = this.collectOneChanges(newPref.languageSpecific[language], oldPref.languageSpecific[language]);
      if (Object.keys(languageChange).length > 0) {
        changes.languageSpecific[language] = languageChange;
      }
    }
    return changes;
  }

  private collectOneChanges(newPref: {[name: string]: any}, oldPref: {[name: string]: any}): {[preferenceName: string]: PreferenceProviderDataChange}  {
    const keys = new Set([...Object.keys(oldPref), ...Object.keys(newPref)]);
    const changes: {[preferenceName: string]: PreferenceProviderDataChange} = {};
    const uri = this.getUri();

    for (const prefName of keys) {
      const oldValue = oldPref[prefName];
      const newValue = newPref[prefName];
      const schemaProperties = this.schemaProvider.getCombinedSchema().properties[prefName];
      if (schemaProperties) {
        const scope = schemaProperties.scope;
        // do not emit the change event if the change is made out of the defined preference scope
        if (!this.schemaProvider.isValidInScope(prefName, this.getScope())) {
          this.logger.warn(`Preference ${prefName} in ${uri} can only be defined in scopes: ${PreferenceScope.getScopeNames(scope).join(', ')}.`);
          continue;
        }
      }
      if ((newValue === undefined && oldValue !== newValue)
        || (oldValue === undefined && newValue !== oldValue) // JSONUtils.deepEqual() does not support handling `undefined`
        || !JSONUtils.deepEqual(oldValue, newValue)) {
        changes[prefName] = {
          preferenceName: prefName, newValue, oldValue, scope: this.getScope(), domain: this.getDomain(),
        };
      }
    }
    return changes;
  }

}
