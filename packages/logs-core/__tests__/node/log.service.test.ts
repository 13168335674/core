import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { createNodeInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { AppConfig } from '@ali/ide-core-node';
import { toLocalISOString, ILogService } from '@ali/ide-core-common';
import { LogServiceModule } from '../../src/node';
import { LogLevelMessageMap } from '../../src/node/log.service';
import { LogLevel, SupportLogNamespace, ILogServiceManager } from '../../src/common';

const ktDir = path.join(os.homedir(), `.kaitian-test`);
const logDir = path.join(ktDir, `logs_1`);
const today = Number(toLocalISOString(new Date()).replace(/-/g, '').match(/^\d{8}/)![0]);

function doAllLog(logger: ILogService) {
  logger.verbose('verbose!');
  logger.debug('debug!');
  logger.log('log!');
  logger.warn('warn!');
  logger.error('error!');
  logger.critical('critical!');
}

describe('LogService', () => {
  const injector = createNodeInjector([LogServiceModule]);
  injector.addProviders({
    token: AppConfig,
    useValue: {
      logDir,
    },
  });
  const loggerManager: ILogServiceManager = injector.get(ILogServiceManager);

  afterAll(() => {
    loggerManager.cleanAllLogs();
    fs.rmdirSync(ktDir);
  });

  test('Test level with default Info', async () => {
    const logger = loggerManager.getLogger(SupportLogNamespace.Browser);

    doAllLog(logger);
    await logger.flush();
    logger.error(new Error('error!'));
    await logger.flush();

    const text = fs.readFileSync(path.join(logDir, String(today), `${SupportLogNamespace.Browser}.log`), {encoding: 'utf8'});
    console.log('text', text);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Verbose]) < 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Debug]) < 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Info]) > 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Warning]) > 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Error]) > 0).toBe(true);
    expect(text.indexOf(LogLevelMessageMap[LogLevel.Critical]) > 0).toBe(true);
    expect(text.indexOf('at Object.test') > -1).toBe(true);
  });
});
