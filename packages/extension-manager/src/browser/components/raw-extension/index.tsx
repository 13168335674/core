import * as React from 'react';
import { localize, IClientApp } from '@ali/ide-core-browser';
import { getIcon } from '@ali/ide-core-browser';
import { Button } from '@ali/ide-components';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import * as clx from 'classnames';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { generateCtxMenu, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';

import { RawExtension, IExtensionManagerService } from '../../../common';
import * as commonStyles from '../../extension-manager.common.module.less';
import * as styles from './index.module.less';

interface RawExtensionProps extends React.HTMLAttributes<HTMLDivElement> {
  extension: RawExtension;
  select: (extension: RawExtension, isDouble: boolean) => void;
  install: (extension: RawExtension) => Promise<void>;
}

export const RawExtensionView: React.FC<RawExtensionProps> = observer(({
   extension, select, install, className,
  }) => {
  const timmer = React.useRef<any>();
  const clickCount = React.useRef(0);

  const clientApp = useInjectable<IClientApp>(IClientApp);
  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
  const extensionMomentState = extensionManagerService.extensionMomentState.get(extension.extensionId);
  const isInstalling = extensionMomentState?.isInstalling;

  function handleInstall(e) {
    e.stopPropagation();
    install(extension);
  }

  function handleClick(e) {
    clickCount.current++;
    clearTimeout(timmer.current);
    timmer.current = setTimeout(() => {
      if (clickCount.current === 1) {
        select(extension, false);
      } else if (clickCount.current === 2) {
        select(extension, true);
      }
      clickCount.current = 0;
    }, 200);
  }

  const handleCtxMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    // 只有已安装才有右键菜单
    if (!extension.installed) {
      return;
    }
    const result = generateCtxMenu({
      menus: extensionManagerService.contextMenu,
      args: [extension],
    });

    ctxMenuRenderer.show({
      anchor: { x: e.clientX, y: e.clientY },
      menuNodes: result[1],
    });
  }, []);

  return (
    <div className={className} onContextMenu={handleCtxMenu}>
      <div onClick={handleClick} className={clx(styles.wrap, 'kt-extension-raw')}>
        <div>
          <img className={styles.icon} src={extension.icon}></img>
        </div>
        <div className={styles.info_wrap}>
          <div className={styles.info_header}>
            <div className={styles.name_wrapper}>
              <div className={styles.name}>{extension.displayName || extension.name}</div>
              {extension.isBuiltin ? (<span className={commonStyles.tag}>{localize('marketplace.extension.builtin')}</span>) : null}
            </div>
              <span style={{display: 'flex', flexShrink: 0}} onClick={(e) => e.stopPropagation()}>
                {extension.reloadRequire && <Button size='small' type='primary' ghost={true} style={{marginRight: 4}} onClick={() => clientApp.fireOnReload()}>{localize('marketplace.extension.reloadrequire')}</Button>}
                {extension.installed ? (
                  <InlineActionBar
                  menus={extensionManagerService.contextMenu}
                  context={[extension]} />
                ) : null}
              </span>
            {!extension.installed ? <Button size='small' type='primary' loading={isInstalling} onClick={handleInstall} ghost={true} style={{flexShrink: 0}}>{localize('marketplace.extension.install')}</Button> : null}
          </div>
          <div className={styles.extension_props}>
            {extension.downloadCount ? (<span><i className={clx(commonStyles.icon, getIcon('download'))}></i> {extension.downloadCount}</span>) : null}
            <span>V {extension.version}</span>
            <span>{extension.publisher}</span>
          </div>
          <div className={clx(styles.description, 'kt-extension-raw-description')}>{extension.description}</div>
        </div>
      </div>
    </div>
  );
});
