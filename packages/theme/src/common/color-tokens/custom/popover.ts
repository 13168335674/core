import { localize } from '@ali/ide-core-common';

import { registerColor } from '../../color-registry';
import { NOTIFICATIONS_FOREGROUND, NOTIFICATIONS_BACKGROUND } from '../notification';

export const ktPopoverForground = registerColor('kt.popover.foreground', { dark: '#D7DBDE', 'light': '#4D4D4D', hc: NOTIFICATIONS_FOREGROUND }, localize('Popover foreground color. Popover when hover a icon or link to show some informations'));

export const ktPopoverBackground = registerColor('kt.popover.background', { dark: '#35393D', light: '#FFFFFF', hc: NOTIFICATIONS_BACKGROUND }, localize('Popover background color. Popover when hover a icon or link to show some informations'));

export const ktPopoverBorder = registerColor('kt.popover.border', { dark: '#2c3033', light: '#E0E0E0', hc: NOTIFICATIONS_BACKGROUND }, localize('Popover border color.'));
