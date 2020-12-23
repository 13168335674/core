import { Autowired } from '@ali/common-di';
import {
  Domain,
  ResourceResolverContribution,
  URI,
  Resource,
  DisposableCollection,
  Event,
  Emitter,
  ResourceError,
  getDebugLogger,
  FsProviderContribution,
  ContributionProvider,
  ClientAppContribution,
  TextDocumentContentChangeEvent,
} from '@ali/ide-core-browser';
import { FileStat, FileSystemError, IFileServiceClient, IDiskFileProvider, IShadowFileProvider } from '../common';
import { FileChangeEvent } from '../common';
import { FileServiceClient } from './file-service-client';

export class FileResource implements Resource {

  protected readonly toDispose = new DisposableCollection();
  protected readonly onDidChangeContentsEmitter = new Emitter<void>();
  private readonly logger = getDebugLogger();

  readonly onDidChangeContents: Event<void> = this.onDidChangeContentsEmitter.event;

  protected stat: FileStat | undefined;
  protected uriString: string;

  constructor(
    readonly uri: URI,
    protected readonly fileSystem: IFileServiceClient,
  ) {
    this.uriString = this.uri.toString();
    this.toDispose.push(this.onDidChangeContentsEmitter);
  }

  async init(): Promise<void> {
    const stat = await this.getFileStat();
    if (stat && stat.isDirectory) {
      throw new Error('The given uri is a directory: ' + this.uriString);
    }

    this.stat = stat;
    this.toDispose.push(this.fileSystem.onFilesChanged((event: FileChangeEvent) => {
      const needSync = event.filter((e) => e.uri === this.uri.toString()).length > 0;
      if (needSync) {
        this.sync();
      }
    }));

    try {
      const exist = await this.fileSystem.access(this.uri.toString());
      if (exist) {
        this.toDispose.push(await this.fileSystem.watchFileChanges(this.uri));
      }
    } catch (e) {
      this.logger.error(e);
    }
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  async readContents(options?: { encoding?: string }): Promise<string> {
    try {
      const [ ret, stat ] = await Promise.all([
        this.fileSystem.resolveContent(this.uriString, options),
        this.fileSystem.getFileStat(this.uriString),
      ]);
      this.stat = stat;
      return ret!.content;
    } catch (e) {
      if (FileSystemError.FileNotFound.is(e)) {
        this.stat = undefined;
        throw ResourceError.NotFound({
          ...e.toJson(),
          data: {
            uri: this.uri,
          },
        });
      }
      throw e;
    }
  }

  async saveContents(content: string, options?: { encoding?: string }): Promise<void> {
    this.stat = await this.doSaveContents(content, options);
  }

  async getFsPath() {
    return await this.fileSystem.getFsPath(this.uriString);
  }

  protected async doSaveContents(content: string, options?: { encoding?: string }): Promise<FileStat> {
    const stat = await this.getFileStat();
    if (stat) {
      return this.fileSystem.setContent(stat, content, options);
    }
    return this.fileSystem.createFile(this.uriString, { content, ...options });
  }

  async saveContentChanges(changes: TextDocumentContentChangeEvent[], options?: { encoding?: string }): Promise<void> {
    if (!this.stat) {
      throw new Error(this.uriString + ' has not been read yet');
    }
    this.stat = await this.fileSystem.updateContent(this.stat, changes, options);
  }

  protected async sync(): Promise<void> {
    if (await this.isInSync(this.stat)) {
      return;
    }
    this.onDidChangeContentsEmitter.fire(undefined);
  }
  protected async isInSync(current: FileStat | undefined): Promise<boolean> {
    const stat = await this.getFileStat();
    if (!current) {
      return !stat;
    }
    return !!stat && current.lastModification >= stat.lastModification;
  }

  protected async getFileStat(): Promise<FileStat | undefined> {
    const exist = await this.fileSystem.access(this.uriString);
    if (!exist) {
      return undefined;
    }
    try {
      return this.fileSystem.getFileStat(this.uriString);
    } catch (e) {
      this.logger.error(e);
      return undefined;
    }
  }

}

// 常规文件资源读取
@Domain(ResourceResolverContribution, ClientAppContribution)
export class FileResourceResolver implements ResourceResolverContribution, ClientAppContribution {

  @Autowired(IFileServiceClient)
  protected readonly fileSystem: FileServiceClient;

  @Autowired(IDiskFileProvider)
  private diskFileServiceProvider: IDiskFileProvider;

  @Autowired(IShadowFileProvider)
  private shadowFileServiceProvider: IShadowFileProvider;

  @Autowired(FsProviderContribution)
  contributionProvider: ContributionProvider<FsProviderContribution>;

  constructor() {
    this.fileSystem.registerProvider('file', this.diskFileServiceProvider);
    this.fileSystem.registerProvider('debug', this.shadowFileServiceProvider);
  }

  async initialize() {
    const fsProviderContributions = this.contributionProvider.getContributions();
    for (const contribution of fsProviderContributions) {
      contribution.registerProvider && await contribution.registerProvider(this.fileSystem);
    }
    for (const contribution of fsProviderContributions) {
      contribution.onFileServiceReady && await contribution.onFileServiceReady();
    }
  }

  async resolve(uri: URI): Promise<FileResource | void> {
    if (uri.scheme !== 'file') {
      return ;
    }
    const resource = new FileResource(uri, this.fileSystem);
    await resource.init();
    return resource;
  }

}
