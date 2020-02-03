import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { observer } from 'mobx-react-lite';
import { ExplorerOpenedEditorService } from './explorer-opened-editor.service';
import { ViewState } from '@ali/ide-core-browser';
import { ThemeProvider, localize, MenuPath } from '@ali/ide-core-browser';
import * as styles from './index.module.less';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';

export const ExplorerOpenEditorPanel = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>) => {
  const OPEN_EDITOR_NODE_HEIGHT = 22;
  const {
    onSelect,
    actions,
    commandActuator,
    nodes,
    overrideFileDecorationService,
    themeService,
    decorationChangeEvent,
    themeChangeEvent,
    onContextMenu,
  }: ExplorerOpenedEditorService = useInjectable(ExplorerOpenedEditorService);
  const containerHeight = viewState.height || 0;

  const scrollContainerStyle = {
    width: '100%',
    height: containerHeight,
  };

  const renderContent = () => {
    if (nodes.length === 0) {
      return <span className={styles.openeditor_empty_text}>{localize('open.editors.empty')}</span>;
    } else {
      return <RecycleTree
        nodes={ nodes }
        scrollContainerStyle={ scrollContainerStyle }
        onSelect={ onSelect }
        onContextMenu={ onContextMenu }
        containerHeight={ containerHeight }
        itemLineHeight={ OPEN_EDITOR_NODE_HEIGHT }
        leftPadding = { 15 }
        foldable = { false }
        actions = { actions }
        commandActuator = { commandActuator }
        fileDecorationProvider = { overrideFileDecorationService }
        themeProvider = { themeService as ThemeProvider }
        notifyFileDecorationsChange = { decorationChangeEvent }
        notifyThemeChange = { themeChangeEvent }
      ></RecycleTree>;
    }
  };
  return <div className={styles.openeditor_container} >
    { renderContent() }
  </div>;
});
