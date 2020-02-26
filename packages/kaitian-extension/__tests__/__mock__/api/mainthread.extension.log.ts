import { IMainThreadExtensionLog } from '@ali/ide-kaitian-extension/lib/common/extension-log';
import { LogLevel } from '@ali/ide-core-common';

export class MainThreadExtensionLog implements IMainThreadExtensionLog {

  private level: LogLevel = LogLevel.Verbose;
  $getLevel() {
    return this.level;
  }

  $setLevel(level: LogLevel) {
    this.level = level;
  }

  $verbose(...args: any[]) {
    console.log(args);
    return Promise.resolve();
  }

  $debug(...args: any[]) {
    console.log(args);
    return Promise.resolve();
  }

  $log(...args: any[]) {
    console.log(args);
    return Promise.resolve();
  }

  $warn(...args: any[]) {
    console.log(args);
    return Promise.resolve();
  }

  $error(...args: any[]) {
    console.log(args);
    return Promise.resolve();
  }

  $critical(...args: any[]) {
    console.log(args);
    return Promise.resolve();
  }

  $dispose() {
    return Promise.resolve();
  }
}
