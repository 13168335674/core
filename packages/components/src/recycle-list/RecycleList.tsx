import * as React from 'react';
import { FixedSizeList } from 'react-window';
import { ScrollbarsVirtualList } from '../scrollbars';
import AutoSizer from 'react-virtualized-auto-sizer';
import * as cls from 'classnames';

export interface IRecycleListProps {
  /**
   * 容器高度
   * height 计算出可视区域渲染数量
   * @type {number}
   * @memberof RecycleTreeProps
   */
  height?: number;
  /**
   * 容器宽度
   * height 计算出可视区域渲染数量
   * @type {number}
   * @memberof RecycleTreeProps
   */
  width?: number;
  /**
   * 节点高度
   * @type {number}
   * @memberof RecycleTreeProps
   */
  itemHeight: number;
  /**
   * List外部样式
   * @type {React.CSSProperties}
   * @memberof RecycleListProps
   */
  style?: React.CSSProperties;
  /**
   * List外部样式名
   * @type {string}
   * @memberof RecycleListProps
   */
  className?: string;
  /**
   * List数据源
   * @type {any[]}
   * @memberof IRecycleListProps
   */
  data: any[];
  /**
   * 基础数据源渲染模板
   * 默认传入参数为：(data, index) => {}
   * data 为 this.props.data中的子项
   * index 为当前下标
   * @type {React.ComponentType<any>}
   * @memberof IRecycleListProps
   */
  template: React.ComponentType<any>;
  /**
   * 头部组件渲染模板
   * 默认传入参数为：() => {}
   * @type {React.ComponentType<any>}
   * @memberof IRecycleListProps
   */
  header?: React.ComponentType<any>;
  /**
   * 底部组件渲染模板
   * 默认传入参数为：() => {}
   * @type {React.ComponentType<any>}
   * @memberof IRecycleListProps
   */
  footer?: React.ComponentType<any>;
  /**
   * 处理 RecycleList API回调
   * @memberof IRecycleListProps
   */
  onReady?: (api: IRecycleListHandle) => void;
}

export interface IRecycleListHandle {
  scrollTo: (offset: number) => void;
  scrollToIndex: (index: number) => void;
}

export class RecycleList extends React.Component<IRecycleListProps> {

  private listRef = React.createRef<FixedSizeList>();

  public componentDidMount() {
    const { onReady, header, itemHeight } = this.props;
    if (typeof onReady === 'function') {
      const api = {
        scrollTo: (offset: number) => {
          this.listRef.current?.scrollTo(offset);
        },
        scrollToIndex: (index: number) => {
          let locationIndex = index;
          if (!!header) {
            locationIndex ++;
          }
          this.listRef.current?.scrollTo(locationIndex * itemHeight);
        },
      };
      onReady(api);
    }
  }

  private get adjustedRowCount() {
    const { data, header, footer } = this.props;
    let count = data.length;
    if (!!header) {
      count++;
    }
    if (!!footer) {
      count++;
    }
    return count;
  }

  private renderItem = ({ index, style }): JSX.Element => {
    const { data, template: Template, header: Header, footer: Footer } = this.props;
    let node;
    if (index === 0) {
      if (Header) {
        return <div style={style}>
          <Header />
        </div>;
      }
    }
    if ((index + 1) === this.adjustedRowCount) {
      if (!!Footer) {
        return <div style={style}>
          <Footer />
        </div>;
      }
    }
    if (!!Header) {
      node = data[index - 1];
    } else {
      node = data[index];
    }
    if (!node) {
      return <div style={style}></div>;
    }
    return <div style={style}>
      <Template data={node} index={index}/>
    </div>;
  }

  private getItemKey = (index: number) => {
    const { data } = this.props;
    const node = data[index];
    if (node && node.id) {
      return node.id;
    }
    return index;
  }

  public render() {
    const {
      itemHeight,
      style,
      className,
      width,
      height,
    } = this.props;
    if (width && height) {
      return (<FixedSizeList
        width={width}
        height={height}
        // 这里的数据不是必要的，主要用于在每次更新列表
        itemData={[]}
        itemSize={itemHeight}
        itemCount={this.adjustedRowCount}
        getItemKey={this.getItemKey}
        overscanCount={10}
        ref={this.listRef}
        style={style}
        className={cls(className, 'kt-recycle-list')}
        outerElementType={ScrollbarsVirtualList}>
        {this.renderItem}
      </FixedSizeList>);
    }
    return <AutoSizer>
      {({height, width}) => (
        <FixedSizeList
          width={width}
          height={height}
          // 这里的数据不是必要的，主要用于在每次更新列表
          itemData={[]}
          itemSize={itemHeight}
          itemCount={this.adjustedRowCount}
          getItemKey={this.getItemKey}
          overscanCount={10}
          ref={this.listRef}
          style={style}
          className={cls(className, 'kt-recycle-list')}
          outerElementType={ScrollbarsVirtualList}>
          {this.renderItem}
        </FixedSizeList>
      )}
    </AutoSizer>;
  }
}
