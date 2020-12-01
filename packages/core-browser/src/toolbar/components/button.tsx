import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { IToolbarActionReactElement, IToolbarActionElementProps, IToolbarActionBtnStyle, IToolbarActionBtnProps, IToolbarActionBtnDelegate, IToolbarActionBtnState, IToolbarPopoverStyle } from '../types';
import { useInjectable } from '../../react-hooks';
import { BasicEvent, Disposable, Emitter, IDisposable } from '@ali/ide-core-common';
import * as classnames from 'classnames';
import { AppConfig, ConfigProvider } from '../../react-providers';
import { Button } from '@ali/ide-components';
import { PreferenceService } from '../../preferences';
import { DomListener } from '../../utils';

export const ToolbarActionBtn = (props: IToolbarActionBtnProps & IToolbarActionElementProps) => {
  const context = useInjectable<AppConfig>(AppConfig);
  const ref = React.useRef<HTMLDivElement>();
  const [viewState, setViewState] = React.useState(props.defaultState || 'default');
  const [title, setTitle] = React.useState(undefined);
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const [, updateState] = React.useState();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  const { defaultButtonStyle = {} } = props.preferences || {} ;

  const styles: IToolbarActionBtnState = {
    title: props.title,
    iconClass: props.iconClass,
    showTitle: preferenceService.get('toolbar.buttonDisplay') !== 'icon',
    btnStyle: 'button',
    ...defaultButtonStyle,
    ...props.defaultStyle,
    ...(props.styles || {})[viewState] || {},
  };
  if (title) {
    styles.title = title;
  }
  if (styles.btnStyle !== 'button') {
    styles.showTitle = false;
  }

  const delegate = React.useRef<ToolbarBtnDelegate | undefined>();
  const inDropDownRef = React.useRef<boolean>(props.inDropDown);
  React.useEffect(() => {
    inDropDownRef.current = props.inDropDown;
  }, [props.inDropDown]);

  React.useEffect(() => {
    const disposer = new Disposable();
    disposer.addDispose(preferenceService.onSpecificPreferenceChange('toolbar.buttonDisplay', () => {
      forceUpdate();
    }));
    if (ref.current && props.delegate) {
      // 如果是在 dropdown 中，popover 元素将显示在 more 按钮上
      const getPopoverParent = () => (inDropDownRef.current ? document.querySelector(`#toolbar-location-${props.location} .kt-toolbar-more`) : ref.current) as HTMLElement;
      delegate.current = new ToolbarBtnDelegate(ref.current, props.id, (state, title) => {
        setViewState(state);
        setTitle(title);
      }, () => {
        return viewState;
      }, context,  getPopoverParent , props.popoverComponent, props.popoverStyle);
      props.delegate(delegate.current);
      disposer.addDispose(delegate.current);
      disposer.addDispose({
        dispose: () => {
          props.delegate && props.delegate(undefined);
        },
      });
    }
    return () => disposer.dispose();
  }, []);
  const iconContent = !props.inDropDown ? <div className={styles.iconClass + ' kt-toolbar-action-btn-icon'} title={styles.title} style={{
    color: styles.iconForeground,
    backgroundColor: styles.iconBackground,
    // 如果指定了按钮宽度，需要将padding清空，防止按钮比预期大16px
    ...(styles.width ? { width: styles.width } : null),
    ...(styles.height ? { height: styles.height } : null),
    ...(styles.iconSize ? { fontSize: styles.iconSize, WebkitMaskSize: styles.iconSize } : null),
}}></div> : null;
  const titleContent = (styles.showTitle || props.inDropDown) ? <div className = 'kt-toolbar-action-btn-title' style={{
    color: styles.titleForeground,
    backgroundColor: styles.titleBackground,
    fontSize: styles.titleSize,
  }}>{styles.title}</div> : null;

  const bindings = {
    onClick: (event) => {
      delegate.current && delegate.current._onClick.fire(event);
      if (props.inDropDown) {
        props.closeDropDown();
      }
    },
    onMouseLeave: (event) => {
      delegate.current && delegate.current._onMouseLeave.fire(event);
    },
    onMouseEnter: (event) => {
      delegate.current && delegate.current._onMouseEnter.fire(event);
    },
  };

  const backgroundBindings = {
    style: {
      backgroundColor: styles.background,
      ...(styles.width ? { padding: 0 } : null),
    },
  };
  let buttonElement;
  if (props.inDropDown) {
    buttonElement = <div className={classnames({'kt-toolbar-action-btn': true,
    'action-btn-in-dropdown': true})} {...bindings} {...backgroundBindings} ref={ref as any}>
      {iconContent}
      {titleContent}
    </div>;
  } else {
    if (styles.btnStyle === 'button' && styles.btnTitleStyle !== 'vertical') {
      buttonElement = <Button type='default' size='small'  {...bindings} {...backgroundBindings} >
          {iconContent}
          {titleContent}
        </Button>;
    } else {
      // BtnStyle == inline 或 btnTitleStyle === 'vertical' (类似小程序IDE工具栏） 的模式
      buttonElement =  <div className={ classnames({'kt-toolbar-action-btn': true,
      'kt-toolbar-action-btn-button': styles.btnStyle === 'button',
      'kt-toolbar-action-btn-inline': styles.btnStyle !== 'button',
      'kt-toolbar-action-btn-vertical': styles.btnTitleStyle === 'vertical',
      'kt-toolbar-action-btn-horizontal': styles.btnTitleStyle !== 'vertical'})}
       {...bindings}>
         <Button type='default' size='small' {...backgroundBindings}>
          {iconContent}
        </Button>
        {titleContent}
      </div>;
    }
  }

  return <div className={'kt-toolbar-action-btn-wrapper'} ref={ref as any}>
    { buttonElement }
  </div>;
};

export function createToolbarActionBtn(props: IToolbarActionBtnProps): IToolbarActionReactElement {
  return ( actionProps ) => {
    return <ToolbarActionBtn {...actionProps} {...props} />;
  };
}

export class ToolbarActionBtnClickEvent extends BasicEvent<{
  id: string,
  event: React.MouseEvent<HTMLDivElement, MouseEvent>,
}> {}

const popOverMap = new Map<string, Promise<HTMLDivElement>>();

class ToolbarBtnDelegate implements IToolbarActionBtnDelegate {

  _onClick = new Emitter<React.MouseEvent<HTMLDivElement>>();
  onClick = this._onClick.event;

  _onMouseLeave = new Emitter<React.MouseEvent<HTMLDivElement>>();
  onMouseLeave = this._onClick.event;

  _onMouseEnter = new Emitter<React.MouseEvent<HTMLDivElement>>();
  onMouseEnter = this._onClick.event;

  _onChangeState = new Emitter<{from: string, to: string}>();
  onChangeState = this._onChangeState.event;

  private popOverContainer: HTMLDivElement | undefined;

  private _popOverElement: Promise<HTMLDivElement> | undefined;

  private _popOverClickOutsideDisposer: IDisposable | undefined;

  dispose() {
    this._onClick.dispose();
    this._onMouseEnter.dispose();
    this._onMouseLeave.dispose();
    if (this.popOverContainer) {
      this.popOverContainer.remove();
      this.popOverContainer = undefined;
    }
    if (this._popOverClickOutsideDisposer) {
      this._popOverClickOutsideDisposer.dispose();
    }
  }

  constructor(private element: HTMLElement, private actionId: string,  private readonly _setState, private _getState, private context: AppConfig, private getPopoverParent: () => HTMLElement, private popoverComponent?: React.FC, private popoverStyle?: IToolbarPopoverStyle) {
    if (this.popoverComponent) {
      this._popOverElement = popOverMap.get(actionId);
      this.popOverContainer = document.createElement('div');
      this.popOverContainer.classList.add('kt-toolbar-popover');
    }
  }

  setState(to, title?) {
    const from = this._getState();
    this._setState(to, title);
    this._onChangeState.fire({from, to});
  }

  getRect() {
    return this.element.getBoundingClientRect();
  }

  getPopOverContainer() {
    return this.popOverContainer;
  }

  async showPopOver(style?: IToolbarPopoverStyle) {
    if (!this.popOverContainer) {
      return;
    }
    if (!this._popOverElement) {
      this._popOverElement = new Promise((resolve) => {
        const div = document.createElement('div');
        const C = this.popoverComponent!;
        ReactDOM.render(<ConfigProvider value={this.context}>
          <C/>
        </ConfigProvider>, div, () => {
          resolve(div);
        });
      });
      popOverMap.set(this.actionId, this._popOverElement);
    }
    const mergedStyle: IToolbarPopoverStyle = {
      ...this.popoverStyle,
      ...style,
    };
    if (mergedStyle.position === 'top') {
      this.popOverContainer.classList.add('kt-toolbar-popover-top');
      this.popOverContainer.classList.remove('kt-toolbar-popover-bottom');
    } else {
      this.popOverContainer.classList.remove('kt-toolbar-popover-top');
      this.popOverContainer.classList.add('kt-toolbar-popover-bottom');
    }

    this.popOverContainer.remove();
    const popoverParent = this.getPopoverParent() || this.element;
    popoverParent.append(this.popOverContainer);
    const popoverParentRect = popoverParent.getBoundingClientRect();
    this.popOverContainer.style.setProperty('--button-width', popoverParentRect.width + 'px');

    let offset = typeof mergedStyle.horizontalOffset === 'number' ? mergedStyle.horizontalOffset : 30;

    // 如果父容器离右边距很近，防止视图突出去
    offset = Math.min(offset, window.innerWidth - popoverParentRect.left - popoverParentRect.width - 2);
    this.popOverContainer.style.setProperty('--offset-size', offset + 'px');
    this.popOverContainer.classList.add('kt-toolbar-popover-visible');

    if (mergedStyle.noContainerStyle) {
      this.popOverContainer.classList.remove('kt-toolbar-popover-default');
    } else {
      this.popOverContainer.classList.add('kt-toolbar-popover-default');
    }

    return this._popOverElement.then((ele) => {
      if (this._popOverClickOutsideDisposer) {
        this._popOverClickOutsideDisposer.dispose();
        this._popOverClickOutsideDisposer = undefined;
      }
      if (this.popOverContainer && ele.parentElement !== this.popOverContainer) {
        this.popOverContainer.append(ele);
      }
      if (mergedStyle.hideOnClickOutside !== false) {
        setTimeout(() => {
          const disposer = new Disposable();
          disposer.addDispose(new DomListener(window, 'click', (e: MouseEvent) => {
            if (e.target && ele.contains(e.target as Node)) {
              return;
            }
            const rect = ele.getBoundingClientRect();
            if (rect.x <= e.clientX && rect.x + rect.width >= e.clientX && rect.y <= e.clientY && rect.y + rect.height >= e.clientY) {
              // 点击在区域内，这里防止点击 target 已经被移除导致误判
              return;
            }
            this.hidePopOver();
          }));
          this._popOverClickOutsideDisposer = disposer;
        });
      }
    });
  }

  async hidePopOver() {
    if (this._popOverElement) {
      const ele = await this._popOverElement;
      ele.remove();
    }
    this.popOverContainer && this.popOverContainer.classList.remove('kt-toolbar-popover-visible');
  }

}
