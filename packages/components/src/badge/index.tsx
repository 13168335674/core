import * as React from 'react';
import * as clx from 'classnames';

import './styles.less';

export const Badge: React.FC<{} & React.HTMLAttributes<HTMLSpanElement>> = ({
  className,
  children,
  ...restProps
}) => {
  return <span className={clx('kt-badge', className)} {...restProps}>{children}</span>;
};
