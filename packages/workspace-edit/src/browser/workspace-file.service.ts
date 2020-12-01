import { Injectable, Autowired } from '@ali/common-di';
import { IFileServiceClient } from '@ali/ide-file-service';
import { URI, Uri, ProgressLocation, CancellationTokenSource, CancellationToken, Disposable, IDisposable, getDebugLogger, raceTimeout, localize, AsyncEmitter, Event, FileStat } from '@ali/ide-core-common';
import { IProgressService } from '@ali/ide-core-browser/lib/progress';
import { FileOperation, FILE_OPERATION_TIMEOUT, IWorkspaceFileOperationParticipant, IWorkspaceFileService, SourceTargetPair, WorkspaceFileEvent } from '..';

@Injectable()
export class WorkspaceFileOperationParticipant extends Disposable {
  @Autowired(IProgressService)
  progressService: IProgressService;

  participants: IWorkspaceFileOperationParticipant[] = [];

  registerParticipant(participant: IWorkspaceFileOperationParticipant): IDisposable {
    this.participants.push(participant);
    return {
      dispose: () => {
        const index = this.participants.findIndex((item) => item === participant);
        this.participants.splice(index, 1);
      },
    };
  }

  async participate(files: { source?: Uri, target: Uri }[], operation: FileOperation): Promise<void> {
    const cts = new CancellationTokenSource();
    return this.progressService.withProgress({
      location: ProgressLocation.Window,
    }, async (progress) => {
      for (const participant of this.participants) {
        if (cts.token.isCancellationRequested) {
          break;
        }

        try {
          const promise = participant.participate(files, operation, progress, FILE_OPERATION_TIMEOUT, cts.token);
          await raceTimeout(promise, FILE_OPERATION_TIMEOUT, () => cts.dispose());
        } catch (err) {
          getDebugLogger().error(err);
        }
      }
    });
  }

  getProgressLabel(operation: FileOperation) {
    switch (operation) {
      case FileOperation.CREATE:
        return localize('fileOperation.create', "Running 'File Create' participants...");
      case FileOperation.DELETE:
        return localize('fileOperation.delete', "Running 'File Delete' participants...");
      case FileOperation.COPY:
        return localize('fileOperation.copy', "Running 'File Copy' participants...");
      case FileOperation.MOVE:
        return localize('fileOperation.move', "Running 'File Move' participants...");
    }
  }

  dispose() {
    this.participants.splice(0, this.participants.length);
  }
}

// TODO: 目前所有文件操作都是后置报错的，是否需要改造成先检测、后操作的模式？
@Injectable()
export class WorkspaceFileService implements IWorkspaceFileService {
  @Autowired(IFileServiceClient)
  fileService: IFileServiceClient;

  @Autowired(WorkspaceFileOperationParticipant)
  fileOperationParticipants: WorkspaceFileOperationParticipant;

  private correlationIds = 0;

  private readonly _onWillRunWorkspaceFileOperation = new AsyncEmitter<WorkspaceFileEvent>();
  readonly onWillRunWorkspaceFileOperation: Event<WorkspaceFileEvent> = this._onWillRunWorkspaceFileOperation.event;

  private readonly _onDidFailWorkspaceFileOperation = new AsyncEmitter<WorkspaceFileEvent>();
  readonly onDidFailWorkspaceFileOperation: Event<WorkspaceFileEvent> = this._onDidFailWorkspaceFileOperation.event;

  private readonly _onDidRunWorkspaceFileOperation = new AsyncEmitter<WorkspaceFileEvent>();
  readonly onDidRunWorkspaceFileOperation: Event<WorkspaceFileEvent> = this._onDidRunWorkspaceFileOperation.event;

  create(resource: URI, contents?: string, options?: { overwrite?: boolean }) {
    return this.doCreate(resource, true, contents, options);
  }

  createFolder(resource: URI) {
    return this.doCreate(resource, false);
  }

  protected async doCreate(resource: URI, isFile: boolean, content?: string, options?: { overwrite?: boolean }) {
    // file operation participant
    await this.runOpeartionParticipant([{ target: resource.codeUri }], FileOperation.CREATE);
    // before events
    const event = { correlationId: this.correlationIds++, operation: FileOperation.CREATE, files: [{ target: resource.codeUri }] };
    await this._onWillRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

    // now actually create on disk
    let stat: FileStat;
    try {
      if (isFile) {
        stat = await this.fileService.createFile(resource.toString(), { overwrite: options?.overwrite, content });
      } else {
        stat = await this.fileService.createFolder(resource.toString());
      }
    } catch (error) {

      // error event
      await this._onDidFailWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

      throw error;
    }

    // after event
    await this._onDidRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

    return stat;
  }

  move(files: Required<SourceTargetPair>[], options?: { overwrite?: boolean }): Promise<FileStat[]> {
    return this.doMoveOrCopy(files, true, options);
  }

  copy(files: Required<SourceTargetPair>[], options?: { overwrite?: boolean }): Promise<FileStat[]> {
    return this.doMoveOrCopy(files, false, options);
  }

  protected async doMoveOrCopy(files: Required<SourceTargetPair>[], move: boolean, options?: { overwrite?: boolean }): Promise<FileStat[]> {
    const overwrite = options?.overwrite;
    const stats: FileStat[] = [];

    // file operation participant
    await this.runOpeartionParticipant(files, move ? FileOperation.MOVE : FileOperation.COPY);

    // before event
    const event = { correlationId: this.correlationIds++, operation: move ? FileOperation.MOVE : FileOperation.COPY, files };
    await this._onWillRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

    try {
      for (const { source, target } of files) {
        // TODO: dirty check
        // now we can rename the source to target via file operation
        if (move) {
          stats.push(await this.fileService.move(source.toString(), target.toString(), { overwrite }));
        } else {
          stats.push(await this.fileService.copy(source.toString(), target.toString(), { overwrite }));
        }
      }
    } catch (error) {

      // error event
      await this._onDidFailWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

      throw error;
    }

    // after event
    await this._onDidRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

    return stats;
  }

  async delete(resources: URI[], options?: { useTrash?: boolean, recursive?: boolean }): Promise<void> {

    // file operation participant
    const files = resources.map((target) => ({ target: target.codeUri }));
    await this.runOpeartionParticipant(files, FileOperation.DELETE);

    // before events
    const event = { correlationId: this.correlationIds++, operation: FileOperation.DELETE, files };
    await this._onWillRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);
    // TODO: dirty check
    // now actually delete from disk
    try {
      for (const resource of resources) {
        // TODO: support recursive option
        await this.fileService.delete(resource.toString(), { moveToTrash: options?.useTrash });
      }
    } catch (error) {

      // error event
      await this._onDidFailWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

      throw error;
    }

    // after event
    await this._onDidRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);
  }

  registerFileOperationParticipant(participant: IWorkspaceFileOperationParticipant): IDisposable {
    return this.fileOperationParticipants.registerParticipant(participant);
  }

  protected runOpeartionParticipant(files: SourceTargetPair[], operation: FileOperation) {
    return this.fileOperationParticipants.participate(files, operation);
  }

}
