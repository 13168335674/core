import { MenuPath } from '@ali/ide-core-common';

export interface IElectronMenuFactory {

  createContextMenu(menuPath: MenuPath, args: any, onHide?: () => void);

  setApplicationMenu(menuPath: MenuPath) ;

}

/**
 * @deprecated
 */
export const IElectronMenuFactory = Symbol('ElectronMenuFactory');
