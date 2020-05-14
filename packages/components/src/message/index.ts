import * as React from 'react';
import antdMessage from 'antd/lib/message';
import 'antd/lib/message/style/index.css';
import './style.less';

function generateSnackbar(funName: string) {
  return (content: string | React.ReactNode, duration?: number): Promise<void> => {
    return new Promise((resolve) => {
      antdMessage[funName](content, duration, resolve);
    });
  };
}

export const message = {
  success: generateSnackbar('success'),
  error: generateSnackbar('error'),
  info: generateSnackbar('info'),
  warning: generateSnackbar('warning'),
  loading: generateSnackbar('loading'),
};
