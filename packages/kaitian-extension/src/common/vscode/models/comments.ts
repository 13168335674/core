import { Event, IRange } from '@ali/ide-core-common';
import {
  CommentThread, CommentReaction, CommentingRanges,
  Comment, CommentThreadChangedEvent,  CommentInput,
  CommentMode, CommentThreadCollapsibleState,
} from '@ali/monaco-editor-core/esm/vs/editor/common/modes';

import { ICommand } from './command';

/**
 * @internal
 */
export {
  CommentThread, CommentReaction, CommentingRanges,
  Comment, CommentThreadChangedEvent, CommentInput,
  CommentMode, CommentThreadCollapsibleState,
};

/**
 * @internal
 */
export interface CommentThreadTemplate {
  controllerHandle: number;
  label: string;
  acceptInputCommand?: ICommand;
  additionalCommands?: ICommand[];
  deleteCommand?: ICommand;
}

/* --------------- start 以下类型在 monaco 中没有，在 vscode 源码中有 ----------------- */
/**
 * @internal
 */
export interface CommentInfo {
  extensionId?: string;
  threads: CommentThread[];
  commentingRanges: CommentingRanges;
}

/**
 * @internal
 */
export interface CommentWidget {
  commentThread: CommentThread;
  comment?: Comment;
  input: string;
  onDidChangeInput: Event<string>;
}

/**
 * @internal
 */
export type CommentThreadChanges = Partial<{
  range: IRange,
  label: string,
  contextValue: string,
  comments: Comment[],
  collapseState: CommentThreadCollapsibleState;
}>;

/* --------------- end 以下类型在 monaco 中没有，在 vscode 源码中有 ----------------- */
