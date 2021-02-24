import { PreferenceService, createPreferenceProxy } from '@ali/ide-core-browser';
import { editorPreferenceSchema, EditorPreferences } from './schema';

export function createEditorPreferenceProxy(preferenceService: PreferenceService, resourceUri: string, overrideIdentifier: string): EditorPreferences {
  return createPreferenceProxy(preferenceService, editorPreferenceSchema, {
    resourceUri,
    overrideIdentifier,
  });
}
