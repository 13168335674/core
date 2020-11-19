import type * as vscode from 'vscode';
import * as types from './ext-types';
import { CancellationToken, MessageType, MaybePromise } from '@ali/ide-core-common';
import { QuickPickItem, QuickPickOptions, QuickInputOptions } from '@ali/ide-quick-open';
import { Event } from '@ali/ide-core-common';
import { QuickTitleButton } from '@ali/ide-core-browser/lib/quick-open';
import { UriComponents, QuickInputButton } from './ext-types';

export interface IMainThreadMessage {
  $showMessage(type: MessageType, message: string, options: vscode.MessageOptions, actions: string[], from?: string): Promise<number | undefined>;
}

export interface IExtHostMessage {
  showMessage(type: MessageType, message: string,
              optionsOrFirstItem?: vscode.MessageOptions | string | vscode.MessageItem,
              from?: string,
              ...rest: (string | vscode.MessageItem)[]): Promise<string | vscode.MessageItem | undefined>;
}

export interface IMainThreadQuickOpen {
  $showQuickPick(items: QuickPickItem<number>[], options?: QuickPickOptions): Promise<number | undefined>;
  $hideQuickPick(): void;
  $showQuickInput(options: QuickInputOptions, validateInput: boolean): Promise<string | undefined>;
  $hideQuickinput(): void;
}

export interface IExtHostQuickOpen {
  $onDidTriggerButton(handler: number): void;
  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions, token?: CancellationToken): Promise<vscode.QuickPickItem | undefined>;
  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions & { canSelectMany: true; }, token?: CancellationToken): Promise<vscode.QuickPickItem[] | undefined>;
  showQuickPick(promiseOrItems: string[] | Promise<string[]>, options?: QuickPickOptions, token?: CancellationToken): Promise<string | undefined>;
  showWorkspaceFolderPick(options: vscode.WorkspaceFolderPickOptions, token?: CancellationToken): Promise<vscode.WorkspaceFolder | undefined>;
  createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T>;
  createInputBox(): vscode.InputBox;
  hideQuickPick(): void;
  showInputBox(options?: QuickInputOptions, token?: CancellationToken): PromiseLike<string | undefined>;
  hideInputBox(): void;
  $validateInput(input: string): MaybePromise<string | null | undefined>;
}

export interface QuickInputTitleButtonHandle extends QuickTitleButton {
  index: number; // index of where they are in buttons array if QuickInputButton or -1 if QuickInputButtons.Back
}

export interface ITransferQuickInput {
  quickInputIndex: number;
  title: string | undefined;
  step: number | undefined;
  totalSteps: number | undefined;
  enabled: boolean;
  busy: boolean;
  ignoreFocusOut: boolean;
}

export interface ITransferInputBox extends ITransferQuickInput {
  value: string;
  placeholder: string | undefined;
  password: boolean;
  buttons: ReadonlyArray<QuickInputButton>;
  prompt: string | undefined;
  validationMessage: string | undefined;
  validateInput(value: string): MaybePromise<string | undefined>;
}

export interface ITransferQuickPick<T extends vscode.QuickPickItem> extends ITransferQuickInput {
  value: string;
  placeholder: string | undefined;
  buttons: ReadonlyArray<QuickInputButton>;
  items: PickOpenItem[];
  canSelectMany: boolean;
  matchOnDescription: boolean;
  matchOnDetail: boolean;
  activeItems: ReadonlyArray<T>;
  selectedItems: ReadonlyArray<T>;
}

export interface QuickPickValue<T> {
  label: string;
  value: T;
  description?: string;
  detail?: string;
  iconClass?: string;
}

export interface PickOpenItem {
  handle: number;
  id?: string;
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
}

export interface IMainThreadStatusBar {
  $setStatusBarMessage(text: string): void;

  $dispose(id?: string): void;

  $createStatusBarItem(id: string, alignment: number, priority: number): void;

  $setMessage(id: string,
              text: string | undefined,
              priority: number,
              alignment: number,
              color: string | undefined,
              tooltip: string | undefined,
              command: string | undefined): Promise<void>;

}

export interface IExtHostStatusBar {

  setStatusBarMessage(text: string, arg?: number | Thenable<any>): types.Disposable;

  createStatusBarItem(alignment?: types.StatusBarAlignment, priority?: number): types.StatusBarItem;

}

export interface IMainThreadOutput {
  $append(channelName: string, value: string): PromiseLike<void>;
  $clear(channelName: string): PromiseLike<void>;
  $dispose(channelName: string): PromiseLike<void>;
  $reveal(channelName: string, preserveFocus: boolean): PromiseLike<void>;
  $close(channelName: string): PromiseLike<void>;

}

export interface IExtHostOutput {

  createOutputChannel(name: string): types.OutputChannel;
}

export interface IExtHostWindowState {

  $setWindowState(focused: boolean);

  readonly state: types.WindowState;

  onDidChangeWindowState: Event<types.WindowState>;

}

export interface IExtHostWindow {
  $onOpenDialogResult(id: string, result: UriComponents[] | undefined): void;
  $onSaveDialogResult(id: string, result: UriComponents | undefined): void;
}

export interface IMainThreadWindow {
  $showOpenDialog(id: string, options: IExtOpenDialogOptions): void;
  $showSaveDialog(id: string, options: IExtSaveDialogOptions): void;
}

export interface IExtDialogOptions {
  defaultUri?: UriComponents;
  filters?: {
    [name: string]: string,
  };
}

export interface IExtSaveDialogOptions extends IExtDialogOptions {
  saveLabel?: string;
}

export interface IExtOpenDialogOptions extends IExtDialogOptions {
  canSelectFiles?: boolean;
  canSelectFolders?: boolean;
  canSelectMany?: boolean;
  openLabel?: string;
}
