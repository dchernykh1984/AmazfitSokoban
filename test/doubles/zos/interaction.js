// A stand-in for @zos/interaction. The page hands over one gesture callback; the
// test fires swipes into it and checks whether the page swallowed them.
export const GESTURE_UP = 0;
export const GESTURE_DOWN = 1;
export const GESTURE_LEFT = 2;
export const GESTURE_RIGHT = 3;

export const gestures = { callback: null };

export function onGesture(options) {
  gestures.callback = options.callback;
}

export function offGesture() {
  gestures.callback = null;
}
