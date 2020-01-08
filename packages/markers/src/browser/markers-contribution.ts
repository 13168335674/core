import { Autowired } from '@ali/common-di';
import { ComponentContribution, ComponentRegistry, Domain, Logger } from '@ali/ide-core-browser';
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';
import { MarkerFilterPanel } from './markers-filter.view';
import { MarkerService } from './markers-service';
import { MarkerPanel } from './markers-tree.view';
import Messages from './messages';

const MARKER_CONTAINER_ID = 'ide-markers';

@Domain(ComponentContribution, MainLayoutContribution)
export class MarkersContribution implements ComponentContribution, MainLayoutContribution {

  @Autowired()
  logger: Logger;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired(MarkerService)
  protected readonly markerService: MarkerService;

  onDidRender() {
    const handler = this.mainlayoutService.getTabbarHandler(MARKER_CONTAINER_ID);
    if (handler) {
      this.markerService.getManager().onMarkerChanged(() => {
        const badge = this.markerService.getBadge();
        handler.setBadge(badge || '');
      });
    }
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register('@ali/ide-markers', {
      id: MARKER_CONTAINER_ID,
      component: MarkerPanel,
    }, {
      title: Messages.markerTile(),
      priority: 11,
      containerId: MARKER_CONTAINER_ID,
      activateKeyBinding: 'ctrlcmd+shift+m',
      titleComponent: MarkerFilterPanel,
    });
  }

}
