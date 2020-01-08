import { PreferenceScope } from './preference-scope';
import { IDisposable } from '@ali/ide-core-common';

export interface IPreferenceSettingsService {

  setPreference(key: string, value: any, scope: PreferenceScope);

  getSettingGroups(scope: PreferenceScope, search?: string): ISettingGroup[];

  registerSettingGroup(group: ISettingGroup): IDisposable;

  registerSettingSection(groupId: string, section: ISettingSection): IDisposable;

  getSections(groupId: string, scope: PreferenceScope, search?: string): ISettingSection[];

  getPreference(preferenceName: string, scope: PreferenceScope): {value: any, effectingScope: PreferenceScope};

  setEnumLabels(preferenceName: string, labels: {[key: string]: string}): void;

  setCurrentGroup(groupId: string): void;
}

export const IPreferenceSettingsService = Symbol('IPreferenceSettingsService');

export interface ISettingGroup {

  // 唯一
  id: string;

  title: string;

  iconClass: string;

}

export interface ISettingSection {

  title?: string;

  preferences: Array<string | {id: string, localized: string} >;

  component?: React.ComponentClass<{scope: PreferenceScope}> | React.FunctionComponent <{scope: PreferenceScope}> ;

  hiddenInScope?: PreferenceScope[];
}
