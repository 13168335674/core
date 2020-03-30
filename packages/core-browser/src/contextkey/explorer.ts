import { RawContextKey } from '../raw-context-key';

/**
 * Context Keys to use with keybindings for the Explorer and Open Editors view
 */
export const ExplorerFolderContext = new RawContextKey<boolean>('explorerResourceIsFolder', false);

export const ExplorerResourceCut = new RawContextKey<boolean>('explorerResourceCut', false);
export const ExplorerFocusedContext = new RawContextKey<boolean>('explorerViewletFocus', false);
// TODO: 移除，该contextKey为旧版本FileTree依赖
export const ExplorerFilteredContext = new RawContextKey<boolean>('explorerViewletFilter', false);

export const FilesExplorerFocusedContext = new RawContextKey<boolean>('filesExplorerFocus', false);
export const FilesExplorerInputFocusedContext = new RawContextKey<boolean>('filesExplorerInputFocus', false);
export const FilesExplorerFilteredContext = new RawContextKey<boolean>('filesExplorerFilteredContext', false);
