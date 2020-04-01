import { FileSystemWatcher } from '../../src/browser/watcher';
import { FileChangeType, FileChange } from '../../src';
import { URI } from '@ali/ide-core-common';

describe('ExtensionFileSystemManage', () => {
  const calledMap: Map<string, any[]> = new Map();
  const mockChangeList = [
    {
      uri: URI.file('/root/test.txt').toString(),
      type: FileChangeType.ADDED,
    }];
  const mockFileServiceClient: any = {
    onFilesChanged(callback) {
      calledMap.set('onFilesChanged', callback);
      setTimeout(() => {
        callback(mockChangeList);
      }, 20);
    },

    unwatchFileChanges(id) {
      calledMap.set('unwatchFileChanges', id);
    },
  };
  const uri = URI.file('/root/test.txt');
  let changeList: FileChange[] | void;

  const watcher = new FileSystemWatcher({
    fileServiceClient: mockFileServiceClient,
    watchId: 0,
    uri,
  });

  watcher.onFilesChanged((data) => {
    changeList = data;
  });

  it('Should Run method with args', async () => {
    await new Promise((resolve) => setTimeout(() => resolve(), 21));
    expect(changeList).toEqual(mockChangeList);
    expect(watcher.onFilesChanged).toBeInstanceOf(Function);
    watcher.dispose();
    expect(calledMap.get('unwatchFileChanges')).toEqual(0);
  });
});
