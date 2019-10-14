import * as React from 'react';

import * as styles from './styles.module.less';

export const ProgressBar: React.FC<{
  loading: boolean;
}> = ({ loading }) => {
  if (!loading) {
    return null;
  }

  return (
    <div className={styles.progressbar}>
      <div className={styles.barblock} />
    </div>
  );
};
