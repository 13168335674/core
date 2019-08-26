
import * as types from '../../../../common/vscode/ext-types';
import { IExtHostWindowState, MainThreadAPIIdentifier } from '../../../../common/vscode';
import { Emitter, Event } from '@ali/ide-core-common';
import { IRPCProtocol } from '@ali/ide-connection';

export class ExtHostWindowState implements IExtHostWindowState {
  public readonly state: types.WindowState = new WindowStateImpl();

  constructor(private rpcProtocol: IRPCProtocol) {
  }
  private readonly _onDidChangeWindowState: Emitter<types.WindowState> = new Emitter();

  public readonly onDidChangeWindowState: Event<types.WindowState> = this._onDidChangeWindowState.event;

  public $setWindowState(focused: boolean) {
    if (focused !== this.state.focused) {
      this.state.focused = focused;
      this._onDidChangeWindowState.fire(this.state);
    }
  }
}

export class WindowStateImpl implements types.WindowState {
    public focused: boolean;

    constructor() {
      this.focused = false;
    }
}
