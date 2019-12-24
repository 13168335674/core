import { IRPCProtocol } from '@ali/ide-connection';
import { ExtensionCandiDate } from '@ali/ide-core-common';

import { IExtHostLifeCycle, IMainThreadLifeCycle } from '../../../common/kaitian/lifecycle';
import { MainThreadKaitianAPIIdentifier } from '../../../common/kaitian';
import { IExtHostCommands } from '../../../common/vscode';

export function createLifeCycleApi(
  extHostCommands: IExtHostCommands,
  lifeCycle: IExtHostLifeCycle,
) {
  return {
    setExtensionDir: (dir: string) => {
      lifeCycle.setExtensionDir(dir);
    },
    setExtensionCandidate: (exts: ExtensionCandiDate[]) => {
      lifeCycle.setExtensionCandidate(exts);
    },
  };
}

export class ExtHostLifeCycle implements IExtHostLifeCycle {

  private proxy: IMainThreadLifeCycle;

  constructor(
    private rpcProtocol: IRPCProtocol,
  ) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadKaitianAPIIdentifier.MainThreadLifecycle);
  }

  public setExtensionDir(path: string) {
    this.proxy.$setExtensionDir(path);
  }

  public setExtensionCandidate(candidate: ExtensionCandiDate[]) {
    this.proxy.$setExtensionCandidate(candidate);
  }
}
