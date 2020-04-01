import { IDisposable } from '@ali/ide-core-common';
import { FileSystemProvider } from '../common/';

export class FileSystemManage {
  readonly providers = new Map<string, FileSystemProvider>();

  add(schema: string, provider: FileSystemProvider): IDisposable {
    if (this.providers.has(schema)) {
      throw new Error(`A provider for the scheme ${schema} is already registered.`);
    }
    this.providers.set(schema, provider);
    return {
      dispose: () => {
        this.providers.delete(schema);
      },
    };
  }

  delete(schema: string) {
    this.providers.delete(schema);
  }

  get(schema: string) {
    return this.providers.get(schema);
  }
}
