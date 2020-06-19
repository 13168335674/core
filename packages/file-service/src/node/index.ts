import { NodeModule } from '@ali/ide-core-node';
import { Injectable, Injector } from '@ali/common-di';
import { IFileService, IDiskFileProvider, ShadowFileServicePath, FileServicePath, IShadowFileProvider, FileSystemProvider, DiskFileServicePath } from '../common';
import { DiskFileSystemProvider } from './disk-file-system.provider';
import { getSafeFileservice } from './file-service';
import { ShadowFileSystemProvider } from './shadow-file-system.provider';

export * from './file-service';

const fsInstanceMap: Map<Injector, FileSystemProvider> = new Map();
// tslint:disable-next-line: ban-types
export function getFileservice(injector: Injector, providerToken: string | symbol | Function): FileSystemProvider {
  if (fsInstanceMap.get(injector)) {
    return fsInstanceMap.get(injector)!;
  }
  const fileService = injector.get(providerToken) as FileSystemProvider;
  fsInstanceMap.set(injector, fileService);
  return fileService;
}

@Injectable()
export class FileServiceModule extends NodeModule {

  providers = [
    { token: IFileService, useFactory: (injector: Injector) => getSafeFileservice(injector)},
    { token: IDiskFileProvider, useFactory: (injector: Injector) => getFileservice(injector, DiskFileSystemProvider)},
    { token: IShadowFileProvider, useFactory: (injector: Injector) => getFileservice(injector, ShadowFileSystemProvider)},
  ];

  backServices = [
    {
      servicePath: DiskFileServicePath,
      token: IDiskFileProvider,
    },
    {
      servicePath: ShadowFileServicePath,
      token: IShadowFileProvider,
    },
    // TODO: 移除node层fs
    {
      servicePath: FileServicePath,
      token: IFileService,
    },
  ];
}
