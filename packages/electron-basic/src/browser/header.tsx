import { observer } from 'mobx-react-lite';
import * as React from 'react';
import * as styles from './header.module.less';
import { useInjectable, MaybeNull, isWindows, ComponentRenderer, ComponentRegistry, Disposable, DomListener, AppConfig, replaceLocalizePlaceholder, electronEnv, isOSX, IWindowService } from '@ali/ide-core-browser';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { WorkbenchEditorService, IResource } from '@ali/ide-editor';
import { getIcon } from '@ali/ide-core-browser';
import { observable } from 'mobx';
import { basename } from '@ali/ide-core-common/lib/utils/paths';

const state = observable({
  maximized: (global as any).electronEnv && (global as any).electronEnv.isMaximized(),
});

export const ElectronHeaderBar = observer(() => {

  const uiService = useInjectable(IElectronMainUIService) as IElectronMainUIService;
  const windowService: IWindowService = useInjectable(IWindowService);
  const componentRegistry: ComponentRegistry = useInjectable(ComponentRegistry);

  const [isFullScreen, setFullScreen] = React.useState<boolean>(false);

  React.useEffect(() => {
    uiService.isFullScreen(electronEnv.currentWindowId).then((res) => {
      setFullScreen(res);
    });
    const listener = uiService.on('fullScreenStatusChange', (windowId, res) => {
      if (windowId === electronEnv.currentWindowId) {
        setFullScreen(res);
      }
    });
    return () => {
      listener.dispose();
    };
  }, []);
  // 在 Mac 下，如果是全屏状态，隐藏顶部标题栏
  if (isOSX && isFullScreen) {
    return <div><TitleInfo hidden={true}/></div>;
  }
  return <div className={styles.header} onDoubleClick={() => {
    uiService.maximize((global as any).currentWindowId);
    state.maximized = (global as any).electronEnv.isMaximized();
  }}>
    {
      (isWindows) ? <ComponentRenderer Component={componentRegistry.getComponentRegistryInfo('@ali/ide-menu-bar')!.views[0].component!}/> : null
    }
    <TitleInfo />
    {
      (isWindows) ? <div className={styles.windowActions}>
        <div className={getIcon('windows_mini')} onClick= {() => {
          windowService.minimize();
        }} />
        {
          !state.maximized ? <div className={getIcon('windows_fullscreen')} onClick= {() => {
            windowService.maximize();
            state.maximized =  (global as any).electronEnv.isMaximized();
          }}/> : <div className={getIcon('windows_recover')} onClick= {() => {
            windowService.unmaximize();
            state.maximized =  (global as any).electronEnv.isMaximized();
          }}/>
        }
        <div className={getIcon('windows_quit')} onClick= {() => {
          windowService.close();
        }}/>
      </div> : undefined
    }
  </div>;

});

declare const ResizeObserver: any;

export const TitleInfo = observer(({ hidden }: { hidden?: boolean }) => {

  const editorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorService;
  const [currentResource, setCurrentResource] = React.useState<MaybeNull<IResource>>(editorService.currentResource);
  const ref = React.useRef<HTMLDivElement>();
  const spanRef = React.useRef<HTMLSpanElement>();
  const appConfig: AppConfig = useInjectable(AppConfig);

  React.useEffect(() => {
    setPosition();
    const disposer = new Disposable();
    disposer.addDispose(editorService.onActiveResourceChange((resource) => {
      setCurrentResource(resource);
    }));
    disposer.addDispose(new DomListener(window, 'resize', () => {
      setPosition();
    }));
    if (ref.current && ref.current.previousElementSibling) {
      const resizeObserver = new ResizeObserver(setPosition);
      resizeObserver.observe(ref.current.previousElementSibling);
      disposer.addDispose({
        dispose : () => {
          resizeObserver.disconnect();
        },
      });
    }
    return disposer.dispose.bind(disposer);
  }, [currentResource]);

  function setPosition() {
    if (ref.current) {
      const windowWidth = window.innerWidth;
      let prevWidth = 0;
      let node = ref.current.previousElementSibling;
      while (node) {
        prevWidth += (node as HTMLElement).offsetWidth;
        node = node.previousElementSibling;
      }
      const left = Math.max(0, windowWidth * 0.5 - prevWidth - spanRef.current!.offsetWidth * 0.5);
      ref.current.style.paddingLeft = left + 'px';
    }
  }

  const dirname = appConfig.workspaceDir ? basename(appConfig.workspaceDir) : undefined;

  const title = (currentResource ? currentResource.name + ' — ' : '') + (dirname ? dirname + ' — '  : '') + (replaceLocalizePlaceholder(appConfig.appName) || 'Electron IDE');

  // 同时更新 Html Title
  React.useEffect(() => {
    document.title = title;
  }, [title]);

  if (hidden) {
    return null;
  }

  return <div className={styles.title_info} ref={ref as any}><span ref={spanRef as any}>{title}</span></div>;
});
