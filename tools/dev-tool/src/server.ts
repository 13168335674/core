import 'tsconfig-paths/register';
import * as path from 'path';
import * as http from 'http';
import * as Koa from 'koa';
import { Deferred, LogLevel } from '@ali/ide-core-common';
import { IServerAppOpts, ServerApp, NodeModule } from '@ali/ide-core-node';

export async function startServer(arg1: NodeModule[] | Partial<IServerAppOpts>) {
  const app = new Koa();
  const deferred = new Deferred<http.Server>();
  const port = process.env.IDE_SERVER_PORT || 8000;
  let opts: IServerAppOpts = {
    workspaceDir: path.join(__dirname, '../../workspace'),
    extensionDir: path.join(__dirname, '../../extensions'),
    webSocketHandler: [
      // new TerminalHandler(logger),
    ],
    // TODO 临时方案，传递外层 中间件函数
    use: app.use.bind(app),
    marketplace: {
      showBuiltinExtensions: true,
      accountId: 'nGJBcqs1D-ma32P3mBftgsfq',
      masterKey: '-nzxLbuqvrKh8arE0grj2f1H',
    },
    processCloseExitThreshold: 5 * 60 * 1000,
    terminalPtyCloseThreshold: 5 * 60 * 1000,
    staticAllowOrigin: '*',
    staticAllowPath: [
      path.join(__dirname, '../../../packages/kaitian-extension'),
    ],
    extLogServiceClassPath: path.join(__dirname, './mock-log-service.js'),
  };
  if (Array.isArray(arg1)) {
    opts = {
      ...opts,
       modulesInstances: arg1,
      };
  } else {
    opts = {
      ...opts,
      ...arg1,
    };
  }

  const serverApp = new ServerApp(opts);
  // server 必须在 ServerApp 实例化后才能创建，因为依赖 app 里收集的中间件
  const server = http.createServer(app.callback());

  await serverApp.start(server);

  server.on('error', (err) => {
    deferred.reject(err);
    console.error('server error: ' + err.message);
    setTimeout(process.exit, 0, 1);
  });

  server.listen(port, () => {
    console.log(`server listen on port ${port}`);
    deferred.resolve(server);
  });
  return deferred.promise;
}
