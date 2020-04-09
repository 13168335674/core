import * as React from 'react';
import * as clx from 'classnames';
import { observer } from 'mobx-react-lite';
import * as styles from './toolbar.module.less';
import { IToolBarComponent, IToolBarAction, IToolBarViewService, ToolBarPosition } from './types';
import { useInjectable } from '@ali/ide-core-browser';
import { ToolBarViewService } from './toolbar.view.service';

export const ToolBar = observer<Pick<React.HTMLProps<HTMLElement>, 'className'>>(({ className }) => {
  const toolBarService = useInjectable(IToolBarViewService) as ToolBarViewService;

  return <div className={clx(styles['tool-bar'], className)}>
    <ToolBarElementContainer className={styles.left} elements={toolBarService.getVisibleElements(ToolBarPosition.LEFT)}/>
    <ToolBarElementContainer className={styles.center} elements={toolBarService.getVisibleElements(ToolBarPosition.CENTER)}/>
    <ToolBarElementContainer className={styles.right} elements={toolBarService.getVisibleElements(ToolBarPosition.RIGHT)}/>
  </div>;
});

export const ToolBarElementContainer = ({elements, className}: {elements: (IToolBarComponent | IToolBarAction)[], className?: string}) => {

  return <div className={className}>
    {
      elements.map((e, i) => {
        if (e.type === 'component' && e.component) {
          return <div key= {'element-' + i}>
            {React.createElement(e.component, {...e.initialProps || {}})}
          </div>;
        } else if (e.type === 'action') {
          return <ToolBarAction key= {'element-' + i} action={e}></ToolBarAction>;
        }
      })
    }
  </div>;
};

export const ToolBarAction = ({action}: {action: IToolBarAction}) => {

  const ref = React.useRef<HTMLDivElement>();

  return <div>
    <div className={action.iconClass + ' ' + styles.action} title={action.title} ref={ref as any} onMouseDown={() => {
      ref.current!.classList.add(styles.active);
    }} onMouseUp={() => {
      ref.current!.classList.remove(styles.active);
    }} onClick={(event) => {
      action.click(event);
    }}></div>
  </div>;
};
