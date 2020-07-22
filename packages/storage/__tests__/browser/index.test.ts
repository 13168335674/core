import { Injectable, Injector } from '@ali/common-di';
import { IStorageServer, IStoragePathServer, IUpdateRequest, IWorkspaceStorageServer, IGlobalStorageServer } from '../../src/common';
import { URI, FileUri, AppConfig } from '@ali/ide-core-node';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { IFileServiceClient, IDiskFileProvider } from '@ali/ide-file-service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { DiskFileSystemProvider } from '@ali/ide-file-service/lib/node/disk-file-system.provider';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { StorageModule } from '../../src/browser';

const track = temp.track();
let root: URI;
root = FileUri.create(fs.realpathSync(temp.mkdirSync('node-fs-root')));
@Injectable()
class MockDatabaseStoragePathServer implements IStoragePathServer {

  async getLastWorkspaceStoragePath() {
    return root.resolve('datas').toString();
  }

  async getLastGlobalStoragePath() {
    return root.toString();
  }

  async provideWorkspaceStorageDirPath(): Promise<string | undefined> {
    return root.resolve('datas').toString();
  }

  async provideGlobalStorageDirPath(): Promise<string | undefined> {
    return root.toString();
  }

}

describe('WorkspaceStorage should be work', () => {
  let workspaceStorage: IStorageServer;
  let globalStorage: IStorageServer;
  let injector: Injector;
  const storageName = 'testStorage';
  beforeAll(() => {
    injector = createBrowserInjector([
      StorageModule,
    ]);

    injector.addProviders({
      token: AppConfig,
      useValue: {},
    });

    injector.overrideProviders({
      token: IFileServiceClient,
      useClass: FileServiceClient,
    }, {
      token: IDiskFileProvider,
      useClass: DiskFileSystemProvider,
    }, {
      token: IStoragePathServer,
      useClass: MockDatabaseStoragePathServer,
    });
    const fileServiceClient: FileServiceClient = injector.get(IFileServiceClient);
    fileServiceClient.registerProvider('file', injector.get(IDiskFileProvider));
    workspaceStorage = injector.get(IWorkspaceStorageServer);
    globalStorage = injector.get(IGlobalStorageServer);
  });

  afterAll(async () => {
    track.cleanupSync();
  });

  describe('01 #init', () => {
    let storagePath;

    it('Storage directory path should be return.', async () => {
      storagePath = await workspaceStorage.init();
      expect(typeof storagePath).toBe('string');
      storagePath = await globalStorage.init();
      expect(typeof storagePath).toBe('string');
    });
  });

  describe('02 #getItems', () => {
    it('Storage should return {}.', async () => {
      const workspace = await workspaceStorage.getItems(storageName);
      expect(typeof workspace).toBe('object');
      expect(Object.keys(workspace).length).toBe(0);
      const global = await globalStorage.getItems(storageName);
      expect(typeof global).toBe('object');
      expect(Object.keys(global).length).toBe(0);
    });
  });

  describe('03 #workspaceStorage', () => {
    it('storage with single storageName should be updated.', async () => {
      const updateRequest: IUpdateRequest = {
        insert: {
          'id': 2,
          'name': 'test',
        },
        delete: ['id'],
      };
      await workspaceStorage.updateItems(storageName, updateRequest);
      expect(fs.existsSync(root.resolve(`datas/${storageName}.json`).withScheme('').toString())).toBeTruthy();
      const res = await workspaceStorage.getItems(storageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });

    it('storage with long storageName should be updated.', async () => {
      const longStorageName = `${storageName}/path`;
      const updateRequest: IUpdateRequest = {
        insert: {
          'id': 2,
          'name': 'test',
        },
        delete: ['id'],
      };
      await workspaceStorage.updateItems(longStorageName, updateRequest);
      expect(fs.existsSync(root.resolve(`datas/${longStorageName}.json`).withScheme('').toString())).toBeTruthy();
      const res = await workspaceStorage.getItems(longStorageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });
  });

  describe('04 #globalStorage', () => {
    it('storage with single storageName should be updated.', async () => {
      const updateRequest: IUpdateRequest = {
        insert: {
          'id': 2,
          'name': 'test',
        },
        delete: ['id'],
      };
      await globalStorage.updateItems(storageName, updateRequest);
      expect(fs.existsSync(root.resolve(`${storageName}.json`).withScheme('').toString())).toBeTruthy();
      const res = await globalStorage.getItems(storageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });

    it('storage with long storageName should be updated.', async () => {
      const longStorageName = `${storageName}/path`;
      const updateRequest: IUpdateRequest = {
        insert: {
          'id': 2,
          'name': 'test',
        },
        delete: ['id'],
      };
      await globalStorage.updateItems(longStorageName, updateRequest);
      expect(fs.existsSync(root.resolve(`${longStorageName}.json`).withScheme('').toString())).toBeTruthy();
      const res = await globalStorage.getItems(longStorageName);
      expect(typeof res).toBe('object');
      expect(Object.keys(res).length).toBe(1);
      expect(res.id).toBe(undefined);
      expect(res.name).toBe(updateRequest.insert!.name);
    });
  });
});
