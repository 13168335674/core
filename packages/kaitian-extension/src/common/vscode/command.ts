
import { Disposable, Position } from './ext-types';
import URI from 'vscode-uri';
import { IExtensionInfo } from '@ali/ide-core-common';

export interface IMainThreadCommands {
  $registerCommand(id: string): void;
  $unregisterCommand(id: string): void;
  $getCommands(): Promise<string[]>;
  /**
   * 来自main -> extHost的command调用
   */
  $executeExtensionCommand(id: string, ...args: any[]): Promise<any>;
  /**
   * 来自ext -> main的command调用
   */
  $executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined>;
  $executeCommandWithExtensionInfo<T>(id: string, extensionInfo: IExtensionInfo, ...args: any[]): Promise<T | undefined>;
  $executeReferenceProvider(arg: {resource: URI, position: Position}): Promise<any | undefined>;
  $executeImplementationProvider(arg: {resource: URI, position: Position}): Promise<any | undefined>;
  $executeCodeLensProvider(arg: {resource: URI, itemResolveCount: number}): Promise<any | undefined>;
  $executeDocumentSymbolProvider(arg: {resource: URI}): Promise<any>;
  registerArgumentProcessor(processor: ArgumentProcessor): void;
}

export interface CommandHandler<T = any> {
  handler: Handler<T>;
  thisArg?: any;
  description?: ICommandHandlerDescription;
  isPermitted?: PermittedHandler;
}

export type Handler<T = any> = (...args: any[]) => T | Promise<T>;

export type PermittedHandler = (extensionInfo: IExtensionInfo, ...args: any[]) => boolean;

// 处理单个参数的 processor
export interface ArgumentProcessor {
  processArgument(arg: any): any;
}

export interface IExtHostCommands {
  registerCommand(global: boolean, id: string, handler: Handler, thisArg?: any, description?: ICommandHandlerDescription): Disposable;
  registerCommand(global: boolean, id: string, handler: CommandHandler): Disposable;
  executeCommand<T>(id: string, ...args: any[]): Promise<T | undefined>;
  $executeCommandWithExtensionInfo<T>(id: string, extensionInfo: IExtensionInfo, ...args: any[]): Promise<T | undefined>;
  $executeContributedCommand<T>(id: string, ...args: any[]): Promise<T>;
  getCommands(filterUnderscoreCommands: boolean): Promise<string[]>;
  registerArgumentProcessor(processor: ArgumentProcessor): void;
  $registerBuiltInCommands(): void;
}

export interface ICommandHandlerDescription {
  description: string;
  args: { name: string; description?: string; constraint?: any; schema?: any; }[];
  returns?: string;
}
