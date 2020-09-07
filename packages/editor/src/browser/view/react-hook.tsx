import { EditorGroup } from '../workbench-editor.service';
import { useUpdateOnEvent } from '@ali/ide-core-browser';

export function useUpdateOnGroupTabChange(editorGroup: EditorGroup) {

  return useUpdateOnEvent(editorGroup.onDidEditorGroupTabChanged, [editorGroup]);

}
