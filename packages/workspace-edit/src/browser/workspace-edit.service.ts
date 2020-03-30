import { IResourceTextEdit, ITextEdit, IWorkspaceEditService, IWorkspaceEdit, IResourceFileEdit, WorkspaceEditDidRenameFileEvent, WorkspaceEditDidDeleteFileEvent } from '../common';
import { URI, IEventBus, isWindows } from '@ali/ide-core-browser';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { Injectable, Autowired } from '@ali/common-di';
import { EndOfLineSequence, WorkbenchEditorService, EOL } from '@ali/ide-editor';
import { runInAction } from 'mobx';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { IMonacoImplEditor } from '@ali/ide-editor/lib/browser/editor-collection.service';
import { EditorGroup } from '@ali/ide-editor/lib/browser/workbench-editor.service';

type WorkspaceEdit = ResourceTextEdit | ResourceFileEdit;

@Injectable()
export class WorkspaceEditServiceImpl implements IWorkspaceEditService {

  private editStack: BulkEdit[] = [];

  @Autowired(IEditorDocumentModelService)
  documentModelService: IEditorDocumentModelService;

  @Autowired(IFileServiceClient)
  fileSystemService: IFileServiceClient;

  @Autowired()
  editorService: WorkbenchEditorService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  async apply(edit: IWorkspaceEdit): Promise<void> {
    const bulkEdit = new BulkEdit();
    edit.edits.forEach((edit) => {
      bulkEdit.add(edit);
    });
    await bulkEdit.apply(this.documentModelService, this.fileSystemService, this.editorService, this.eventBus);
    this.editStack.push(bulkEdit);
  }

  revertTopFileEdit(): Promise<void> {
    // TODO
    throw new Error('Method not implemented.');
  }

}

export class BulkEdit {

  private edits: WorkspaceEdit[] = [];

  async apply(documentModelService: IEditorDocumentModelService, fileSystemService: IFileServiceClient, editorService: WorkbenchEditorService, eventBus: IEventBus) {
    for (const edit of this.edits) {
      if (edit instanceof ResourceFileEdit) {
        await edit.apply(editorService, fileSystemService, documentModelService, eventBus);
      } else {
        await edit.apply(documentModelService, editorService);
      }
    }
  }

  add(edit: IResourceTextEdit | IResourceFileEdit) {
    if (isResourceFileEdit(edit)) {
      this.edits.push(new ResourceFileEdit(edit));
    } else {
      const last = this.edits[this.edits.length - 1];
      const textEdit = edit as IResourceTextEdit;
      if (last && !isResourceFileEdit(last)) {
        // 合并连续同目标的edits
        if (last.resource.toString() === textEdit.resource.toString()) {
          let shouldMerge = false;
          if (last.modelVersionId) {
            if (textEdit.modelVersionId) {
              shouldMerge = textEdit.modelVersionId === last.modelVersionId;
            } else {
              shouldMerge = true;
            }
          } else {
            if (!textEdit.modelVersionId) {
              shouldMerge = true;
            }
          }
          if (shouldMerge) {
            (last as IResourceTextEdit).edits = (last as IResourceTextEdit).edits.concat(textEdit.edits);
            return;
          }
        }
      }
      this.edits.push(new ResourceTextEdit(edit as IResourceTextEdit));
    }
  }

  revert(onlyFileEdits: true) {
    // TODO
  }

}

export class ResourceTextEdit implements IResourceTextEdit {

  resource: URI;
  modelVersionId: number | undefined;
  edits: ITextEdit[];
  options: {
    openDirtyInEditor?: boolean
    dirtyIfInEditor?: boolean,
  } = {};

  constructor(edit: IResourceTextEdit) {
    this.resource = edit.resource;
    this.modelVersionId = edit.modelVersionId,
      this.edits = edit.edits;
    this.options = edit.options || {};
  }

  async apply(documentModelService: IEditorDocumentModelService, editorService: WorkbenchEditorService): Promise<void> {
    const docRef = await documentModelService.createModelReference(this.resource, 'bulk-edit');
    const monacoModel = docRef.instance.getMonacoModel();
    if (this.modelVersionId) {
      if (monacoModel.getVersionId() !== this.modelVersionId) {
        throw new Error('文档版本不一致，无法执行变更');
      }
    }
    const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    let newEOL: EndOfLineSequence | null = null;
    for (const edit of this.edits) {
      if (edit.eol) {
        newEOL = edit.eol;
      }
      edits.push({
        range: monaco.Range.lift(edit.range),
        text: edit.text,
      });
    }
    if (edits.length > 0) {
      monacoModel.pushStackElement();
      monacoModel.pushEditOperations([], edits, () => []);
      monacoModel.pushStackElement();
    }
    if (newEOL) {
      monacoModel.pushStackElement();
      monacoModel.setEOL(newEOL as any);
      monacoModel.pushStackElement();
    }
    const shouldSave = await this.editorOperation(editorService);
    if (shouldSave) {
      docRef.instance.save();
    }
    docRef.dispose();
  }

  async focusEditor(editorService: WorkbenchEditorService) {
    if (editorService.currentEditor && editorService.currentResource && editorService.currentResource.uri.isEqual(this.resource)) {
      (editorService.currentEditor as IMonacoImplEditor).monacoEditor.focus();
    }
  }

  // 返回是否保存
  async editorOperation(editorService: WorkbenchEditorService): Promise<boolean> {
    if (this.options.openDirtyInEditor) {
      for (const group of editorService.editorGroups) {
        if (group.resources.findIndex((r) => r.uri.isEqual(this.resource)) !== -1) {
          this.focusEditor(editorService);
          return false;
        }
      }
      editorService.open(this.resource, { backend: true });
      this.focusEditor(editorService);
      return false;
    } else if (this.options.dirtyIfInEditor) {
      for (const group of editorService.editorGroups) {
        if (group.resources.findIndex((r) => r.uri.isEqual(this.resource)) !== -1) {
          this.focusEditor(editorService);
          return false;
        }
      }
      this.focusEditor(editorService);
    }
    return true;
  }

  async revert(): Promise<void> {
    // TODO
  }

}

export class ResourceFileEdit implements IResourceFileEdit {

  oldUri?: URI;
  newUri?: URI;
  options: {
    overwrite?: boolean | undefined;
    ignoreIfNotExists?: boolean | undefined;
    ignoreIfExists?: boolean | undefined;
    recursive?: boolean | undefined;
    showInEditor?: boolean;
    isDirectory?: boolean;
  } = {};

  constructor(edit: IResourceFileEdit) {
    this.oldUri = edit.oldUri;
    this.newUri = edit.newUri;
    this.options = edit.options;
  }

  async notifyEditor(editorService: WorkbenchEditorService, documentModelService: IEditorDocumentModelService) {
    if (this.oldUri && this.newUri) {
      const promises: Promise<any>[] = [];
      const urisToDealWith: Set<string> = new Set();
      editorService.editorGroups.forEach((g) => {
        g.resources.forEach((r) => {
          if (this.oldUri!.isEqualOrParent(r.uri)) {
            urisToDealWith.add(r.uri.toString());
          }
        });
      });
      urisToDealWith.forEach((uriString) => {
        const oldUri = new URI(uriString);
        const subPath = uriString.substr(this.oldUri!.toString().length);
        const newUri = new URI(this.newUri!.toString()! + subPath);
        promises.push(this.notifyOnResource(oldUri, newUri, editorService, documentModelService));
      });
      return Promise.all(promises);
    }
  }

  async notifyOnResource(oldUri: URI, newUri: URI, editorService: WorkbenchEditorService, documentModelService: IEditorDocumentModelService) {
    const docRef = documentModelService.getModelReference(oldUri, 'bulk-file-move');
    let dirtyContent: string | undefined;
    let dirtyEOL: EOL | undefined;
    if (docRef && docRef.instance.dirty) {
      dirtyContent = docRef.instance.getText();
      dirtyEOL = docRef.instance.eol;
      await docRef.instance.revert(true);
    }
    if (docRef) {
      docRef.dispose();
    }
    // 如果之前的文件在编辑器中被打开，重新打开文件
    await Promise.all([editorService.editorGroups.map(async (g) => {
      const index = g.resources.findIndex((r) => r.uri.isEqual(oldUri));
      if (index !== -1) {
        await runInAction(async () => {
          await g.open(newUri, {
            index,
            backend: !(g.currentResource && g.currentResource.uri.isEqual(oldUri)),
            // 如果旧的是preview模式，应该保持，如果不是，应该不要关闭其他处于preview模式的资源tab
            preview: (g as EditorGroup).previewURI ? (g as EditorGroup).previewURI!.isEqual(oldUri) : false,
          });
          await g.close(oldUri);
        });
      }
    })]);

    if (dirtyContent) {
      const newDocRef = await documentModelService.createModelReference(newUri, 'bulk-file-move');
      newDocRef.instance.updateContent(dirtyContent, dirtyEOL);
      newDocRef.dispose();
    }
  }

  async apply(editorService: WorkbenchEditorService, fileSystemService: IFileServiceClient, documentModelService: IEditorDocumentModelService, eventBus: IEventBus) {
    const options = this.options || {};

    if (this.newUri && this.oldUri) {
      // rename
      if (options.overwrite === undefined && options.ignoreIfExists && await fileSystemService.exists(this.newUri.toString())) {
        return; // not overwriting, but ignoring, and the target file exists
      }

      try {
        await fileSystemService.move(this.oldUri.toString(), this.newUri.toString(), options);
      } catch (e) {
        throw new Error(e);
      }
      await this.notifyEditor(editorService, documentModelService);

      // TODO 文件夹rename应该带传染性, 但是遍历实现比较坑，先不实现
      eventBus.fire(new WorkspaceEditDidRenameFileEvent({ oldUri: this.oldUri, newUri: this.newUri }));

    } else if (!this.newUri && this.oldUri) {
      // 删除文件
      if (await fileSystemService.exists(this.oldUri.toString())) {
        // 默认recursive
        await editorService.close(this.oldUri, true);
        // electron windows下moveToTrash大量文件会导致IDE卡死，如果检测到这个情况就不使用moveToTrash
        try {
          await fileSystemService.delete(this.oldUri.toString(), { moveToTrash: !(isWindows && this.oldUri.path.name === 'node_modules') });
        } catch (e) {
          throw new Error(e);
        }
        eventBus.fire(new WorkspaceEditDidDeleteFileEvent({ oldUri: this.oldUri}));
      } else if (!options.ignoreIfNotExists) {
        throw new Error(`${this.oldUri} 不存在`);
      }
    } else if (this.newUri && !this.oldUri) {
      // 创建文件
      if (options.overwrite === undefined && options.ignoreIfExists && await fileSystemService.exists(this.newUri.toString())) {
        return; // not overwriting, but ignoring, and the target file exists
      }
      try {
        await fileSystemService.createFile(this.newUri.toString(), { content: '', overwrite: options.overwrite });
      } catch (e) {
        throw new Error(e);
      }
      if (options.showInEditor) {
        editorService.open(this.newUri);
      }
    }
  }

  async revert(): Promise<void> {
    // TODO
  }
}

export function isResourceFileEdit(thing: any): thing is ResourceFileEdit {
  return (!!((thing as ResourceFileEdit).newUri) || !!((thing as ResourceFileEdit).oldUri));
}
