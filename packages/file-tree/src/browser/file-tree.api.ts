
import { Injectable, Autowired } from '@ali/common-di';
import { IFileTreeAPI } from '../common/file-tree.defination';
import { FileStat } from '@ali/ide-file-service';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IWorkspaceEditService } from '@ali/ide-workspace-edit';
import { EDITOR_COMMANDS, URI, CommandService, localize } from '@ali/ide-core-browser';
import { AbstractFileTreeItem, Directory, File } from './file-tree-item';
import { IMessageService } from '@ali/ide-overlay';
import * as paths from '@ali/ide-core-common/lib/path';

@Injectable()
export class FileTreeAPI implements IFileTreeAPI {

  @Autowired(IFileServiceClient)
  private fileServiceClient: IFileServiceClient;

  @Autowired(IWorkspaceEditService)
  private workspaceEditService: IWorkspaceEditService;

  @Autowired(IMessageService)
  private messageService: IMessageService;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired()
  private labelService: LabelService;

  private _userhomePath: URI;

  private whenReady: Promise<any>;

  constructor() {
    this.whenReady = this.init();
  }

  async init() {
    const userhome = await this.fileServiceClient.getCurrentUserHome();
    if (userhome) {
      this._userhomePath = new URI(userhome.uri);
    }
  }

  get userhomePath(): URI {
    return this._userhomePath;
  }

  async getFiles(path: string | FileStat, parent?: Directory | undefined) {
    let file: FileStat | undefined;
    await this.whenReady;
    if (typeof path === 'string') {
      file = await this.fileServiceClient.getFileStat(path);
    } else {
      file = await this.fileServiceClient.getFileStat(path.uri);
      file = {
        ...file,
      } as FileStat;
    }
    if (file) {
      const result = await this.fileStat2FileTreeItem(file, parent);
      return [result];
    } else {
      return [];
    }
  }

  async getFileStat(path: string) {
    const stat: any = await this.fileServiceClient.getFileStat(path);
    return stat;
  }

  async createFile(uri: URI) {
    await this.workspaceEditService.apply({
      edits: [
        {
          newUri: uri,
          options: {},
        },
      ],
    });
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri);
  }

  async createFolder(uri: URI) {
    await this.fileServiceClient.createFolder(uri.toString());
  }

  async exists(uri: URI) {
    return await this.fileServiceClient.exists(uri.toString());
  }

  async deleteFile(uri: URI) {
    await this.workspaceEditService.apply({
      edits: [
        {
          oldUri: uri,
          options: {},
        },
      ],
    });
  }

  async moveFile(from: URI, to: URI, isDirectory: boolean = false) {
    const exists = await this.fileServiceClient.exists(to.toString());
    if (exists) {
      this.messageService.error(localize('file.move.existMessage'));
      return;
    }
    await this.workspaceEditService.apply({
      edits: [
        {
          newUri: to,
          oldUri: from,
          options: {
            isDirectory,
            overwrite: true,
          },
        },
      ],
    });
  }

  async copyFile(from: URI, to: URI) {
    let idx = 1;
    let exists = await this.fileServiceClient.exists(to.toString());
    while (exists) {
      const name = to.displayName.replace(/\Wcopy\W\d+/, '');
      const extname = paths.extname(name);
      const basename = paths.basename(name, extname);
      const newFileName = `${basename} copy ${idx}${extname}`;
      to = to.parent.resolve(newFileName);
      idx++;
      exists = await this.fileServiceClient.exists(to.toString());
    }
    this.fileServiceClient.copy(from.toString(), to.toString());
  }

  /**
   * 转换FileStat对象为FileTreeItem
   *
   * @param {FileStat} filestat
   * @param {(AbstractFileTreeItem | undefined)} parent
   * @param {boolean} isSymbolicLink
   * @returns {AbstractFileTreeItem}
   * @memberof FileTreeAPI
   */
  fileStat2FileTreeItem(filestat: FileStat, parent: Directory | undefined, isInSymbolicDirectory?: boolean): AbstractFileTreeItem {
    const uri = new URI(filestat.uri);
    const icon = this.labelService.getIcon(uri, { isDirectory: filestat.isDirectory, isSymbolicLink: filestat.isSymbolicLink });
    const name = this.labelService.getName(uri);
    if (filestat.isDirectory && filestat.children) {
      return new Directory(
        this,
        uri,
        name,
        {
          ...filestat,
          isSymbolicLink: filestat.isSymbolicLink,
          isInSymbolicDirectory,
        },
        this.getReadableTooltip(uri),
        icon,
        this.labelService.getIcon(uri, { isDirectory: filestat.isDirectory, isSymbolicLink: filestat.isSymbolicLink, isOpenedDirectory: true }),
        parent,
        1,
      );
    } else {
      return new File(
        this,
        uri,
        name,
        {
          ...filestat,
          isSymbolicLink: filestat.isSymbolicLink,
          isInSymbolicDirectory,
        },
        this.getReadableTooltip(uri),
        icon,
        parent,
        1,
      );
    }
  }

  /**
   * 替换用户目录为 ~
   * 移除协议头文本 file://
   *
   * @param {URI} path
   * @returns
   * @memberof FileTreeAPI
   */
  getReadableTooltip(path: URI) {
    const pathStr = path.toString();
    const userhomePathStr = this.userhomePath && this.userhomePath.toString();
    if (!this.userhomePath) {
      return decodeURIComponent(path.withScheme('').toString());
    }
    if (this.userhomePath.isEqualOrParent(path)) {
      return decodeURIComponent(pathStr.replace(userhomePathStr, '~'));
    }
    return decodeURIComponent(path.withScheme('').toString());
  }

  generatorFileFromFilestat(filestat: FileStat, parent: Directory): AbstractFileTreeItem {
    const uri = new URI(filestat.uri);
    if (filestat.isDirectory) {
      return new Directory(
        this,
        uri,
        this.labelService.getName(uri),
        filestat,
        this.getReadableTooltip(uri),
        this.labelService.getIcon(uri, filestat),
        this.labelService.getIcon(uri, {...filestat, isOpenedDirectory: true}),
        parent,
        1,
      );
    }
    return new File(
      this,
      uri,
      this.labelService.getName(uri),
      filestat,
      this.getReadableTooltip(uri),
      this.labelService.getIcon(uri, filestat),
      parent,
      1,
    );
  }

  generatorTempFile(uri: URI, parent: Directory, isDirectory: boolean = false): AbstractFileTreeItem {
    const filestat: FileStat = {
      uri: uri.toString(),
      isDirectory,
      isSymbolicLink: false,
      lastModification: new Date().getTime(),
    };
    if (isDirectory) {
      return new Directory(
        this,
        uri,
        this.labelService.getName(uri),
        filestat,
        '',
        this.labelService.getIcon(uri, filestat),
        this.labelService.getIcon(uri, {...filestat, isOpenedDirectory: true}),
        parent,
        10,
        true,
      );
    }
    return new File(
      this,
      uri,
      this.labelService.getName(uri),
      filestat,
      '',
      this.labelService.getIcon(uri, filestat),
      parent,
      10,
      true,
    );
  }

  generatorTempFolder(uri: URI, parent: Directory): AbstractFileTreeItem {
    return this.generatorTempFile(uri, parent, true);
  }

  sortByNumberic(files: AbstractFileTreeItem[]): AbstractFileTreeItem[] {
    return files.sort((a: AbstractFileTreeItem, b: AbstractFileTreeItem) => {
      if ((a.filestat.isDirectory && b.filestat.isDirectory) || (!a.filestat.isDirectory && !b.filestat.isDirectory)) {
        if (a.priority > b.priority) {
          return -1;
        }
        if (a.priority < b.priority) {
          return 1;
        }
        // numeric 参数确保数字为第一排序优先级
        return a.name.localeCompare(b.name, 'kn', { numeric: true });
      } else if (a.filestat.isDirectory && !b.filestat.isDirectory) {
        return -1;
      } else if (!a.filestat.isDirectory && b.filestat.isDirectory) {
        return 1;
      } else {
        return a.priority > b.priority ? -1 : 1;
      }
    });
  }
}
