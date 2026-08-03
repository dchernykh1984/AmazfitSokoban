// Telling a tap apart from a drag, and turning a tap into a step. Pure state
// machine over a plain object, so the whole control scheme is unit tested without
// a touchscreen; the page only feeds it the raw press, move and lift coordinates.
//
// The watch screen has one finger and two jobs: dragging moves the map, the way a
// navigator pans, and tapping steps the keeper towards the cell you touched. They
// are separated by distance alone - once the finger has travelled further than
// the slop it is a drag for the rest of that touch, even if it wanders back, so a
// pan can never also step.
import { DOWN, LEFT, RIGHT, UP } from "./directions.js";

// How far the finger may travel and still count as a tap. Roughly a fingertip on
// a 466px watch: below this a "tap" is really just the hand shaking.
export const DEFAULT_SLOP = 12;

export function createTouch(slop) {
  const limit = typeof slop === "number" && slop >= 0 ? slop : DEFAULT_SLOP;
  return {
    slop: limit,
    active: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    dragging: false,
  };
}

export function beginTouch(touch, x, y) {
  touch.active = true;
  touch.startX = x;
  touch.startY = y;
  touch.x = x;
  touch.y = y;
  touch.dx = 0;
  touch.dy = 0;
  touch.dragging = false;
  return touch;
}

function track(touch, x, y) {
  touch.x = x;
  touch.y = y;
  touch.dx = x - touch.startX;
  touch.dy = y - touch.startY;
  if (touch.dx * touch.dx + touch.dy * touch.dy > touch.slop * touch.slop) {
    touch.dragging = true;
  }
}

// Report where the finger is now. `dragging` turns true as soon as the touch has
// gone far enough to be a pan and stays true until the finger is lifted.
export function moveTouch(touch, x, y) {
  if (!touch.active) {
    return { dragging: false, dx: 0, dy: 0 };
  }
  track(touch, x, y);
  return { dragging: touch.dragging, dx: touch.dx, dy: touch.dy };
}

// Close the touch and say what it was. A lift with no press behind it - which the
// watch does send, for instance when a touch started on a widget that has since
// been deleted - is neither a tap nor a drag.
export function endTouch(touch, x, y) {
  if (!touch.active) {
    return { tap: false, dragging: false, x, y, dx: 0, dy: 0 };
  }
  track(touch, x, y);
  touch.active = false;
  return { tap: !touch.dragging, dragging: touch.dragging, x, y, dx: touch.dx, dy: touch.dy };
}

export function cancelTouch(touch) {
  touch.active = false;
  touch.dragging = false;
  return touch;
}

// The step that takes the keeper towards a tapped cell: the dominant axis of the
// offset, so the whole screen is a target rather than the four cells next door.
// A tie goes to the horizontal, and tapping the keeper itself does nothing.
// Returns -1 when there is no step to make.
export function directionToward(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) {
    return -1;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? RIGHT : LEFT;
  }
  return dy > 0 ? DOWN : UP;
}
