import { localize } from '@ali/ide-core-common';
import { registerColor, transparent } from '../color-registry';
import { Color } from '../../common/color';
import { contrastBorder } from './base';

// < --- Activity Bar --- >

export const ACTIVITY_BAR_BACKGROUND = registerColor('activityBar.background', {
  dark: '#333333',
  light: '#2C2C2C',
  hc: '#000000',
}, localize('activityBarBackground', 'Activity bar background color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_FOREGROUND = registerColor('activityBar.foreground', {
  dark: Color.white,
  light: Color.white,
  hc: Color.white,
}, localize('activityBarForeground', 'Activity bar item foreground color when it is active. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_INACTIVE_FOREGROUND = registerColor('activityBar.inactiveForeground', {
  dark: transparent(ACTIVITY_BAR_FOREGROUND, 0.6),
  light: transparent(ACTIVITY_BAR_FOREGROUND, 0.6),
  hc: Color.white,
}, localize('activityBarInActiveForeground', 'Activity bar item foreground color when it is inactive. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_BORDER = registerColor('activityBar.border', {
  dark: null,
  light: null,
  hc: contrastBorder,
}, localize('activityBarBorder', 'Activity bar border color separating to the side bar. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_DRAG_AND_DROP_BACKGROUND = registerColor('activityBar.dropBackground', {
  dark: Color.white.transparent(0.12),
  light: Color.white.transparent(0.12),
  hc: Color.white.transparent(0.12),
}, localize('activityBarDragAndDropBackground', 'Drag and drop feedback color for the activity bar items. The color should have transparency so that the activity bar entries can still shine through. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_BADGE_BACKGROUND = registerColor('activityBarBadge.background', {
  dark: '#007ACC',
  light: '#007ACC',
  hc: '#000000',
}, localize('activityBarBadgeBackground', 'Activity notification badge background color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

export const ACTIVITY_BAR_BADGE_FOREGROUND = registerColor('activityBarBadge.foreground', {
  dark: Color.white,
  light: Color.white,
  hc: Color.white,
}, localize('activityBarBadgeForeground', 'Activity notification badge foreground color. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));

// extend tokens
export const KT_ACTIVITY_BAR_ACTIVE_BORDER = registerColor('kt.activityBar.activeBorder', {
  dark: '#167CDB',
  light: '#167CDB',
  hc: '#167CDB',
}, localize('kt.activityBar.activeBorder', 'Active icon left/right border color'));
export const ACTIVITY_BAR_ACTIVE_BORDER = registerColor('activityBar.activeBorder', {
  dark: ACTIVITY_BAR_FOREGROUND,
  light: ACTIVITY_BAR_FOREGROUND,
  hc: null,
}, localize('activityBarActiveBorder', 'Activity bar border color for the active item. The activity bar is showing on the far left or right and allows to switch between views of the side bar.'));
