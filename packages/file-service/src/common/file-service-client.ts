import { URI, Event, IFileServiceClient as IFileServiceClientToken, IDisposable, TextDocumentContentChangeEvent } from '@ali/ide-core-common';
import { FileStat,
  FileMoveOptions,
  FileDeleteOptions,
  FileSetContentOptions,
  FileCreateOptions,
  FileCopyOptions,
  FileSystemProvider,
} from './files';
import { IFileServiceWatcher } from './watcher';
import { DidFilesChangedParams, FileChangeEvent } from '@ali/ide-core-common';

export const IFileServiceClient = IFileServiceClientToken;

export interface IFileServiceClient {

  onFilesChanged: Event<FileChangeEvent>;

  registerProvider(scheme: string, provider: FileSystemProvider): IDisposable;

  handlesScheme(scheme: string): boolean;

  /**
   * Read the entire contents of a file.
   *
   * @param uri The uri of the file.
   * @return An array of bytes or a thenable that resolves to such.
   * @throws [`FileNotFound`](#FileSystemError.FileNotFound) when `uri` doesn't exist.
   * @throws [`FileIsDirectory`](#FileSystemError.FileIsDirectory) when `uri` is a directory.
   * @throws [`FileIsNoPermissions`](#FileSystemError.FileIsNoPermissions) when `uri` has no permissions.
   */
  resolveContent(uri: string, options?: FileSetContentOptions): Promise<{ content: string }>;

  /**
   * Read the file stat
   * @param uri {string} The uri of the file.
   * @param withChildren {boolean} [true]
   */
  getFileStat(uri: string, withChildren?: boolean): Promise<FileStat | undefined>;

  getFileType(uri: string): Promise<string|undefined>;

  setContent(file: FileStat, content: string, options?: FileSetContentOptions): Promise<FileStat>;

  updateContent(file: FileStat, contentChanges: TextDocumentContentChangeEvent[], options?: FileSetContentOptions): Promise<FileStat>;

  createFile(uri: string, options?: FileCreateOptions): Promise<FileStat>;

  createFolder(uri: string): Promise<FileStat>;

  access(uri: string, mode?: number): Promise<boolean>;

  move(sourceUri: string, targetUri: string, options?: FileMoveOptions): Promise<FileStat>;

  copy(sourceUri: string, targetUri: string, options?: FileCopyOptions): Promise<FileStat>;

  delete(uri: string, options?: FileDeleteOptions);

  getCurrentUserHome(): Promise<FileStat | undefined>;

  fireFilesChange(event: DidFilesChangedParams): void;

  watchFileChanges(uri: URI, excludes?: string[]): Promise<IFileServiceWatcher>;

  unwatchFileChanges(watchId: number): Promise<void>;

  setWatchFileExcludes(excludes: string[]): Promise<void>;

  getWatchFileExcludes(): Promise<string[]>;

  setFilesExcludes(excludes: string[], roots: string[]): Promise<void>;

  getFsPath(uri: string): Promise<string | undefined>;

  setWorkspaceRoots(roots: string[]): Promise<void>;

  getEncoding(uri: string): Promise<string>;

  isReadonly(uri: string): Promise<boolean>;
}

export interface IBrowserFileSystemRegistry {

  registerFileSystemProvider(provider: IFileSystemProvider): IDisposable;

}

export const IBrowserFileSystemRegistry = Symbol('IBrowserFileSystemRegistry');

// TODO 重构前真正的provider仍然注册在node层，这里只保留scheme让它能够欧正常判断是否处理scheme
export interface IFileSystemProvider {

  scheme: string;

}
