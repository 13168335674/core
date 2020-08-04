import * as React from 'react';
import clx from 'classnames';

import { defaultIconfont } from './iconfont/iconMap';
import { getKaitianIcon, IIconShapeOptions } from './util';

import './styles.less';

export type DefaultIconKeys = keyof typeof defaultIconfont;

export interface IiconContext<T extends string> {
  getIcon: (iconKey: DefaultIconKeys | T, options?: IIconShapeOptions) => string;
}

export const IconContext = React.createContext<IiconContext<any>>({
  getIcon: (iconKey, options?: IIconShapeOptions) => iconKey,
});

export function IconContextProvider(props: React.PropsWithChildren<{ value: IiconContext<any> }>) {
  return (
    <IconContext.Provider value={props.value}>
      <IconContext.Consumer>
        {(value) => props.value === value ? props.children : null}
      </IconContext.Consumer>
    </IconContext.Provider>
  );
}

export interface IconBaseProps<T> extends IIconShapeOptions {
  title?: string;
  // 合并默认图标与自定义图标类型
  icon?: DefaultIconKeys | T;
  iconClass?: string;
  tooltip?: string;
  size?: 'small' | 'large';
  loading?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

export type IconProps<T = any> = IconBaseProps<T> & React.HTMLAttributes<HTMLSpanElement>;

/**
 * 在 IDE 集成环境下使用自定义图标时，建议提供自定义 IconKeys 类型
 * @example
 * ```ts
 * const demo = () => (
 *    <Icon<'foo' | 'bar'> icon='bar' />
 * );
 * //自定义前缀
 * const demo = () => (
 *    <Icon<'foo' | 'bar'> iconClass=`${customPrefix} bar` />
 * );
 * ```
 */

// tslint:disable-next-line:only-arrow-functions
const IconBase = function<T>(
  props: IconProps<T>,
  ref: React.Ref<HTMLSpanElement>,
) {
  const {
    size = 'small', loading, icon,
    iconClass, className, tooltip,
    rotate, anim, fill, disabled,
    onClick, children, ...restProps
  } = props;
  const iconShapeOptions = { rotate, anim, fill };

  let iconClx: string | undefined;
  if (icon) {
    // FIXME: @柳千 这一段看不懂，是啥意思呢?
    // 因为 getIcon 默认是倒序查找优先级
    // 这里的逻辑会导致是优先用 defaultIconFont 里面去查找
    // 所以这里应该是跟 getIcon 逻辑表现不太一样
    // 此外这里的 useContext 的话，作用看起来意义不大了，因为 getIcon 是个函数，本质上无法做到通知
    if (defaultIconfont[icon as DefaultIconKeys]) {
      iconClx = getKaitianIcon(icon as string, iconShapeOptions);
    } else {
      const { getIcon } = React.useContext(IconContext);
      iconClx = getIcon(icon, iconShapeOptions);
    }
  } else {
    iconClx = iconClass;
  }

  return (
    <span
      {...restProps}
      title={tooltip}
      onClick={onClick}
      ref={ref}
      className={clx(
        'kt-icon',
        iconClx,
        className,
        {
          'kt-icon-loading': loading,
          'kt-icon-disabled': !!disabled,
          [`kt-icon-${size}`]: !!size,
          'kt-icon-clickable': !!onClick,
        },
      )}
    >
      {children}
    </span>
  );
};

export const Icon = React.forwardRef<HTMLSpanElement, IconProps>(IconBase) as <T = any> (
  props: IconProps<T>,
  ref: React.Ref<HTMLSpanElement>,
) => React.ReactElement;
