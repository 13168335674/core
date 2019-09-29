export enum TrackedRangeStickiness {
  AlwaysGrowsWhenTypingAtEdges = 0,
  NeverGrowsWhenTypingAtEdges = 1,
  GrowsOnlyWhenTypingBefore = 2,
  GrowsOnlyWhenTypingAfter = 3,
}

export const STICKINESS = TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;

export const BREAK_PONINT_HOVER_MARGIN: monaco.editor.IModelDecorationOptions = {
  glyphMarginClassName: 'kaitian-debug-hover',
  linesDecorationsClassName: 'kaitian-debug-hover',
  isWholeLine: true,
};

export const TOP_STACK_FRAME_MARGIN: monaco.editor.IModelDecorationOptions = {
  glyphMarginClassName: 'kaitian-debug-top-stack-frame',
  stickiness: STICKINESS,
};

export const FOCUSED_STACK_FRAME_MARGIN: monaco.editor.IModelDecorationOptions = {
  glyphMarginClassName: 'kaitian-debug-focused-stack-frame',
  stickiness: STICKINESS,
};

export const TOP_STACK_FRAME_DECORATION: monaco.editor.IModelDecorationOptions = {
  isWholeLine: true,
  className: 'kaitian-debug-top-stack-frame-line',
  stickiness: STICKINESS,
};

export const TOP_STACK_FRAME_EXCEPTION_DECORATION: monaco.editor.IModelDecorationOptions = {
  isWholeLine: true,
  className: 'kaitian-debug-top-stack-frame-exception-line',
  stickiness: STICKINESS,
};

export const FOCUSED_STACK_FRAME_DECORATION: monaco.editor.IModelDecorationOptions = {
  isWholeLine: true,
  className: 'kaitian-debug-focused-stack-frame-line',
  stickiness: STICKINESS,
};

export const TOP_STACK_FRAME_INLINE_DECORATION: monaco.editor.IModelDecorationOptions = {
  beforeContentClassName: 'kaitian-debug-top-stack-frame-column',
};

export const BREAKPOINT_HINT_DECORATION: monaco.editor.IModelDecorationOptions = {
  glyphMarginClassName: 'kaitian-debug-breakpoint-hint',
  stickiness: STICKINESS,
};

export const BREAKPOINT_DECORATION: monaco.editor.IModelDecorationOptions = {
  glyphMarginClassName: 'kaitian-debug-breakpoint',
  stickiness: STICKINESS,
};
