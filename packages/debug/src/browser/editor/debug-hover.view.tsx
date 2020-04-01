import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { DebugHoverService } from './debug-hover.service';
import { observer } from 'mobx-react-lite';
import * as styles from './debug-hover.module.less';
import { SourceTree } from '@ali/ide-core-browser/lib/components';
import * as cls from 'classnames';

export const DebugHoverView = observer(() => {
  const { value, elements, nodes, onSelect }: DebugHoverService = useInjectable(DebugHoverService);

  const mouseWheelHandler = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const containerHeight = {
    min: 22,
    max: 350,
  };

  const contentHeight = nodes.length * 22;

  const scrollContainerStyle = {
    height: containerHeight.min > contentHeight ? containerHeight.min : contentHeight > containerHeight.max ? containerHeight.max : contentHeight,
  };

  const renderContent = () => {
    if (nodes && nodes.length > 0) {
      return <div
        onWheel={ mouseWheelHandler }
        className={ styles.debug_hover_content }
      >
        <SourceTree
          nodes={ nodes }
          onSelect={ onSelect }
          outline={ false }
          scrollContainerStyle={
            scrollContainerStyle
          }
        />
      </div>;
    }
    return null;
  };

  return (
    <div className={ styles.debug_hover }>
      {
        value &&
        <div className={ cls(styles.debug_hover_title, nodes.length > 0 && styles.has_complex_value) }>
          { value }
        </div>
      }
      {
        elements.length > 0 ?
          renderContent() :
          <div className={ styles.debug_hover_string }>
            <div className={ styles.debug_hover_string_overflow }>
              {
                nodes.map(({ name }, index) => {
                  if (index > 0) {
                    return (<div key={ index }>&nbsp;&nbsp;{ name }</div>);
                  } else {
                    return (<div key={ index }>{ name }</div>);
                  }
                })
              }
            </div>
          </div>
      }
    </div>
  );
});
