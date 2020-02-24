import { PreferenceScope } from './preference-scope';
import { PreferenceItem } from '@ali/ide-core-common';

// 这些设置选项生效时间太早, 并且可能在app生命周期外生效，不能只由preference服务进行管理
export interface IExternalPreferenceProvider<T = any> {
  get(scope: PreferenceScope): T | undefined;
  set(value: T, scope: PreferenceScope): void;
  onDidChange?: ({value: T, scope: PreferenceScope}) => void;
}

const providers = new Map<string, IExternalPreferenceProvider>();

export function registerExternalPreferenceProvider<T>(name, provider: IExternalPreferenceProvider<T>) {
  providers.set(name, provider); // 可覆盖
}

export function getExternalPreferenceProvider(name) {
  return providers.get(name);
}

export function getPreferenceThemeId(): string {
  return getExternalPreference<string>('general.theme').value as string;
}

export function getPreferenceIconThemeId(): string {
  return getExternalPreference<string>('general.icon').value as string;
}

export function getPreferenceLanguageId(): string {
  return getExternalPreference<string>('general.language').value || 'zh-CN';
}

// 默认使用localStorage
function registerLocalStorageProvider(key: string) {
  registerExternalPreferenceProvider<string>(key, {
    set: (value, scope) => {
      if (scope >= PreferenceScope.Folder) {
        // earlyPreference不支持针对作用域大于Folder的值设置
        return;
      }
      if ((global as any).localStorage) {
        if (value !== undefined) {
          localStorage.setItem(scope + `:${key}`, value);
        } else {
          localStorage.removeItem(scope + `:${key}`);
        }
      }
    },
    get: (scope) => {
      if ((global as any).localStorage) {
        return localStorage.getItem(scope + `:${key}`) || undefined;
      }
    },
  });
}

registerLocalStorageProvider('general.theme');
registerLocalStorageProvider('general.icon');
registerLocalStorageProvider('general.language');

export function getExternalPreference<T>(preferenceName: string, schema?: PreferenceItem, untilScope?: PreferenceScope): {value: T | undefined, scope: PreferenceScope } {
  for (const scope of PreferenceScope.getReversedScopes()) {
    const value = providers.get(preferenceName)!.get(scope);
    if (value !== undefined) {
      return {
        value,
        scope,
      };
    }
    if (scope === untilScope) {
      return {
        value: undefined,
        scope: untilScope,
      };
    }
  }
  return {
    value: schema && schema.default,
    scope: PreferenceScope.Default,
  };
}
