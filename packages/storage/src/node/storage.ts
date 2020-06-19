import { IStorageServer, IUpdateRequest, IStoragePathServer, StorageChange, StringKeyToAnyValue } from '../common';
import { Injectable, Autowired } from '@ali/common-di';
import { IFileService } from '@ali/ide-file-service';
import { Deferred, URI, Emitter, Event } from '@ali/ide-core-common';
import { INodeLogger } from '@ali/ide-core-node';
import { Path } from '@ali/ide-core-common/lib/path';

@Injectable()
export abstract class StorageServer implements IStorageServer {
  @Autowired(IFileService)
  protected readonly fileSystem: IFileService;

  @Autowired(IStoragePathServer)
  protected readonly dataStoragePathServer: IStoragePathServer;

  @Autowired(INodeLogger)
  protected readonly logger: INodeLogger;

  public deferredStorageDirPath = new Deferred<string>();
  public databaseStorageDirPath: string | undefined;

  public storageName: string;
  public _cache: any = {};

  public onDidChangeEmitter = new Emitter<StorageChange>();
  readonly onDidChange: Event<StorageChange> = this.onDidChangeEmitter.event;

  abstract init(storageDirName?: string, workspaceNamespace?: string): Promise<string | undefined>;
  abstract setupDirectories(storageDirName: string): Promise<string | undefined>;
  abstract getStoragePath(storageName: string): Promise<string | undefined>;
  abstract getItems(storageName: string): Promise<StringKeyToAnyValue>;
  abstract updateItems(storageName: string, request: IUpdateRequest): Promise<void>;

  async close(recovery?: () => Map<string, string>) {
    // do nothing
  }
}

@Injectable()
export class WorkspaceStorageServer extends StorageServer {

  private workspaceNamespace: string | undefined;

  public async init(storageDirName?: string, workspaceNamespace?: string) {
    this.workspaceNamespace = workspaceNamespace;
    return await this.setupDirectories(storageDirName);
  }

  async setupDirectories(storageDirName?: string) {
    const storagePath = await this.dataStoragePathServer.provideWorkspaceStorageDirPath(storageDirName);
    this.deferredStorageDirPath.resolve(storagePath);
    this.databaseStorageDirPath = storagePath;
    return storagePath;
  }

  async getStoragePath(storageName: string): Promise<string | undefined> {
    if (!this.databaseStorageDirPath) {
      await this.deferredStorageDirPath.promise;
    }
    const hasSlash = storageName.indexOf(Path.separator) >= 0;

    const storagePath = await this.dataStoragePathServer.getLastWorkspaceStoragePath();

    if (hasSlash) {
      const storagePaths = new Path(storageName);
      storageName = storagePaths.name;
      const uriString = new URI(storagePath!).resolve(storagePaths.dir).toString();
      if (!await this.fileSystem.access(uriString)) {
        await this.fileSystem.createFolder(uriString);
      }
      return storagePath ? new URI(uriString).resolve(`${storageName}.json`).toString() : undefined;
    }
    return storagePath ? new URI(storagePath).resolve(`${storageName}.json`).toString() : undefined;
  }

  async getItems(storageName: string) {
    let items = {};
    const workspaceNamespace = this.workspaceNamespace;
    const storagePath = await this.getStoragePath(storageName);

    if (!storagePath) {
      this.logger.error(`Storage [${this.storageName}] is invalid.`);
    } else {
      const uriString = new URI(storagePath).toString();
      if (await this.fileSystem.access(uriString)) {
        const data = await this.fileSystem.resolveContent(uriString);
        try {
          items = JSON.parse(data.content);
        } catch (error) {
          this.logger.error(`Storage [${this.storageName}] content can not be parse. Error: ${error.stack}`);
          items = {};
        }
      }
    }
    this._cache[storageName] = items;
    if (!!workspaceNamespace) {
      items = items[workspaceNamespace] || {};
    }
    return items;
  }

  async updateItems(storageName: string, request: IUpdateRequest) {
    let raw = {};
    const workspaceNamespace = this.workspaceNamespace;
    if (this._cache[storageName]) {
      raw = this._cache[storageName];
    } else {
      raw = await this.getItems(storageName);
      if (!!workspaceNamespace) {
        raw = raw[workspaceNamespace];
      }
    }
    // INSERT
    if (request.insert) {
      if (workspaceNamespace) {
        raw[workspaceNamespace] = {
          ...raw[workspaceNamespace],
          ...request.insert,
        };
      } else {
        raw = {
          ...raw,
          ...request.insert,
        };
      }
    }

    // DELETE
    if (request.delete && request.delete.length > 0) {
      const deleteSet = new Set(request.delete);
      deleteSet.forEach((key) => {
        if (!!workspaceNamespace) {
          if (raw[workspaceNamespace][key]) {
            delete raw[workspaceNamespace][key];
          }
        } else {
          if (raw[key]) {
            delete raw[key];
          }
        }
      });
    }

    this._cache[storageName] = raw;

    const storagePath = await this.getStoragePath(storageName);

    if (storagePath) {
      const uriString = new URI(storagePath).toString();
      let storageFile = await this.fileSystem.getFileStat(uriString);
      if (!storageFile) {
        storageFile = await this.fileSystem.createFile(uriString);
      }
      await this.fileSystem.setContent(storageFile, JSON.stringify(raw));
      const change: StorageChange = {
        path: storageFile.uri,
        data: JSON.stringify(raw),
      };
      this.onDidChangeEmitter.fire(change);
    }
  }
}

@Injectable()
export class GlobalStorageServer extends StorageServer {

  public async init(storageDirName: string) {
    return await this.setupDirectories(storageDirName);
  }

  async setupDirectories(storageDirName: string) {
    const storagePath = await this.dataStoragePathServer.provideGlobalStorageDirPath(storageDirName);
    this.deferredStorageDirPath.resolve(storagePath);
    this.databaseStorageDirPath = storagePath;
    return storagePath;
  }

  async getStoragePath(storageName: string): Promise<string | undefined> {
    if (!this.databaseStorageDirPath) {
      await this.deferredStorageDirPath.promise;
    }
    const hasSlash = storageName.indexOf(Path.separator) >= 0;

    const storagePath = await this.dataStoragePathServer.getLastGlobalStoragePath();

    if (hasSlash) {
      const storagePaths = new Path(storageName);
      storageName = storagePaths.name;
      const uriString = new URI(storagePath!).resolve(storagePaths.dir).toString();
      if (!await this.fileSystem.access(uriString)) {
        await this.fileSystem.createFolder(uriString);
      }
      return storagePath ? new URI(uriString).resolve(`${storageName}.json`).toString() : undefined;
    }

    return storagePath ? new URI(storagePath).resolve(`${storageName}.json`).toString() : undefined;
  }

  async getItems(storageName: string) {
    let items = {};
    const storagePath = await this.getStoragePath(storageName);

    if (!storagePath) {
      this.logger.error(`Storage [${this.storageName}] is invalid.`);
    } else {
      const uriString = new URI(storagePath).toString();
      if (await this.fileSystem.access(uriString)) {
        const data = await this.fileSystem.resolveContent(uriString);
        try {
          items = JSON.parse(data.content);
        } catch (error) {
          this.logger.error(`Storage [${this.storageName}] content can not be parse. Error: ${error.stack}`);
          items = {};
        }
      }
    }
    this._cache[storageName] = items;
    return items;
  }

  async updateItems(storageName: string, request: IUpdateRequest) {
    let raw = {};
    if (this._cache[storageName]) {
      raw = this._cache[storageName];
    } else {
      raw = await this.getItems(storageName);
    }
    // INSERT
    if (request.insert) {
      raw = {
        ...raw,
        ...request.insert,
      };
    }

    // DELETE
    if (request.delete && request.delete.length > 0) {
      const deleteSet = new Set(request.delete);
      deleteSet.forEach((key) => {
        if (raw[key]) {
          delete raw[key];
        }
      });
    }

    this._cache[storageName] = raw;
    const storagePath = await this.getStoragePath(storageName);

    if (storagePath) {
      let storageFile = await this.fileSystem.getFileStat(storagePath);
      if (!storageFile) {
        storageFile = await this.fileSystem.createFile(storagePath, {content: ''});
      }
      await this.fileSystem.setContent(storageFile, JSON.stringify(raw));
      const change: StorageChange = {
        path: storageFile.uri,
        data: JSON.stringify(raw),
      };
      this.onDidChangeEmitter.fire(change);
    }
  }
}
