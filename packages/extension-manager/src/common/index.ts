import { IMenu } from '@ali/ide-core-browser/lib/menu/next';

export const EXTENSION_DIR = 'extension/';

export enum EnableScope {
  GLOBAL = 'GLOBAL',
  WORKSPACE = 'WORKSPACE',
}

export enum TabActiveKey {
  MARKETPLACE = 'marketplace',
  INSTALLED = 'installed',
}

export interface ExtensionMomentState {
  isInstalling?: boolean;
  isUpdating?: boolean;
  isUnInstalling?: boolean;
}

export const SearchFromMarketplaceCommandId = 'SearchFromMarketplaceCommand';

export const DEFAULT_ICON_URL = 'https://gw.alipayobjects.com/mdn/rms_d8fa74/afts/img/A*upJXQo96It8AAAAAAAAAAABkARQnAQ';

export const PREFIX = '/openapi/ide/';
export const enableExtensionsContainerId = 'extensions';
export const hotExtensionsContainerId = 'hot-extensions';
export const enableExtensionsTarbarHandlerId = 'extensions.enable';
export const disableExtensionsTarbarHandlerId = 'extensions.disable';
export const searchExtensionsFromInstalledTarbarHandlerId = 'extensions.installed.search';
export const searchExtensionsFromMarketplaceTarbarHandlerId = 'extensions.marketplace.search';
export const hotExtensionsFromMarketplaceTarbarHandlerId = 'extensions.marketplace.hot';

export const EXTENSION_SCHEME = 'extension';

export enum SearchState {
  LOADING,
  LOADED,
  NO_CONTENT,
  NO_MORE,
}

/**
 * 从插件市场过来的搜索结果
 */
export interface SearchExtension {
  extensionId: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  version: string;
  downloadCount: number;
  publisher: string;
}

// 最小单元的插件信息
export interface BaseExtension {
  extensionId: string; // 插件市场 extensionId
  name: string;
  version: string;
  path: string;
  publisher: string;
}

// 插件面板左侧显示
export interface RawExtension extends BaseExtension {
  id: string; // publisher.name
  displayName: string;
  description: string;
  installed: boolean;
  icon: string;
  enable: boolean;
  isBuiltin: boolean;
  downloadCount?: number;
  reloadRequire?: boolean;
  // 启用范围
  enableScope: EnableScope;
  engines: {
    vscode: string,
    kaitian: string,
  };
}

// 插件详情页显示
export interface ExtensionDetail extends RawExtension {
  readme: string;
  changelog: string;
  license: string;
  categories: string;
  // 代码仓库
  repository: string;
  contributes: {
    [name: string]: any;
  };
}

export const ExtensionManagerServerPath = 'ExtensionManagerServerPath';

// 插件市场前端服务
export const IExtensionManagerService = Symbol('IExtensionManagerService');

export const IExtensionManager = Symbol('IExtensionManager');
export interface IExtensionManager {
  installExtension(extension: BaseExtension, version?: string): Promise<string>;
  updateExtension(extension: BaseExtension, version: string): Promise<string>;
  uninstallExtension(extension: BaseExtension): Promise<boolean>;
}
export interface IExtensionManagerService  {
  isInit: boolean;
  loading: SearchState;
  hotExtensions: RawExtension[];
  enableResults: RawExtension[];
  marketplaceQuery: string;
  installedQuery: string;
  tabActiveKey: TabActiveKey;
  disableResults: RawExtension[];
  searchInstalledState: SearchState;
  searchInstalledResults: RawExtension[];
  searchMarketplaceState: SearchState;
  searchMarketplaceResults: RawExtension[];
  contextMenu: IMenu;
  extensionMomentState: Map<string, ExtensionMomentState>;
  init(): Promise<void>;
  getDetailById(extensionId: string): Promise<ExtensionDetail | undefined>;
  getDetailFromMarketplace(extensionId: string, version?: string): Promise<ExtensionDetail | undefined>;
  getRawExtensionById(extensionId: string): RawExtension;
  toggleActiveExtension(extension: BaseExtension, active: boolean, scope: EnableScope): Promise<void>;
  searchFromMarketplace(query: string): void;
  searchFromInstalled(query: string): void;
  onInstallExtension(extensionId: string, path: string): Promise<void>;
  onUpdateExtension(path: string, oldExtensionPath: string): Promise<void>;
  computeReloadState(extensionPath: string): Promise<boolean>;
  onDisableExtension(extensionPath: string): Promise<void>;
  onEnableExtension(extensionPath: string): Promise<void>;
  makeExtensionStatus(extensionId: string, state: Partial<RawExtension>): Promise<void>;
  setRequestHeaders(requestHeaders: RequestHeaders): Promise<void>;
  openExtensionDetail(options: OpenExtensionOptions): void;
  installExtensionByReleaseId(releaseId: string): Promise<string>;
  installExtension(extension: BaseExtension, version?: string): Promise<string>;
  updateExtension(extension: BaseExtension, version: string): Promise<string>;
  uninstallExtension(extension: BaseExtension): Promise<boolean>;
  loadHotExtensions(): Promise<void>;
}

export const IExtensionManagerServer = Symbol('IExtensionManagerServer');
export interface IExtensionManagerServer {
  search(query: string, ignoreId?: string[]): Promise<any>;
  getExtensionFromMarketPlace(extensionId: string, version?: string): Promise<any>;
  getHotExtensions(ignoreId: string[], queryIndex: number): Promise<any>;
  isShowBuiltinExtensions(): boolean;
  setHeaders(headers: RequestHeaders): void;
  installExtensionByReleaseId(releaseId: string): Promise<string>;
  installExtension(extension: BaseExtension, version?: string): Promise<string>;
  updateExtension(extension: BaseExtension, version: string): Promise<string>;
  uninstallExtension(extension: BaseExtension): Promise<boolean>;
}

export interface RequestHeaders {
  [header: string]: string;
}

export const IExtensionManagerRequester = Symbol('IExtensionManagerRequester');

export interface IExtensionManagerRequester {
  request<T = any>(path: string, options?: urllib.RequestOptions): Promise<urllib.HttpClientResponse<T>>;
  setHeaders(headers: RequestHeaders): void;
  getHeaders(): RequestHeaders;
}

export interface OpenExtensionOptions {
  publisher: string;
  name: string;
  preview: boolean;
  remote: boolean;
  displayName?: string;
  version?: string;
  icon?: string;
}
