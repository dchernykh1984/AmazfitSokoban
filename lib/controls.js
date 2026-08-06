// Where the controls sit on a round screen, and what is under a finger.
//
// The board is the square inscribed in the circle, which leaves four segments
// around it - one at each edge, about 70px thick in the middle and tapering to
// nothing at the corners. Those segments are dead space on a round watch, and
// they are exactly where the four direction arrows go: the map keeps the whole
// board to itself, and steering never fights with dragging.
//
// The bottom segment carries three controls rather than one, because undo and
// the menu have to live somewhere: [undo] [down] [menu] in a row.
//
// All of it is pure geometry, so a test can ask what a tap at a point would do
// without a screen in the room.
import { DOWN, LEFT, RIGHT, UP } from "./directions.js";
import { centeredBox } from "./round-geometry.js";
import { BOARD_EDGE } from "../utils/config/constants.js";

export const BOARD = "board";
export const UNDO = "undo";
export const MENU = "menu";

// How much of a segment a control fills. The arrows are generous - they are the
// thing being aimed at constantly - and everything is kept clear of the bezel.
const ARROW_SPAN = 0.72;
const ARROW_HEIGHT = 0.34;
const SEGMENT_FILL = 0.55;
const COUNTER_FILL = 0.38;
const ARROW_FILL = 0.5;
const EDGE_PADDING = 8;

// The bottom row sits just under the board rather than centred in the segment.
// A round screen narrows fast towards the bottom: centred, the row can only be
// as wide as the chord at its lowest edge, which is about 131px - three buttons
// in that are shoulder to shoulder. Moved up against the board it gets over
// 200px of chord to share, and that width is what buys the gaps below.
//
// One pixel clear of the frame drawn around the window, so tightening the frame
// cannot slide the row underneath it.
const ROW_TOP_GAP = BOARD_EDGE + 1;

// The bottom row is not three equal buttons. The down arrow is steering, pressed
// hundreds of times a game; undo and the menu are pressed a handful of times and
// both are unwelcome surprises mid-solve - undo silently takes a move back, the
// menu covers the board. So the arrow is the widest of the three, the other two
// are pushed out to the ends of the row, and what is left between them is dead
// space that belongs to nobody: a thumb landing slightly wide of the arrow does
// nothing at all rather than undoing the move it just made.
const DOWN_SHARE = 0.32;
const SIDE_SHARE = 0.22;

function box(x, y, w, h) {
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

// Every control, given the screen size and where the board sits on it.
//
//   up / down / left / right   the four arrows
//   undo / menu                the two buttons flanking the down arrow
//   board                      the window onto the warehouse
//
// The top and bottom controls are sized through the chord of the circle at their
// own height, not the full width: near the top and bottom of a round screen a
// centred row is much narrower than the screen, and a row laid out as if it were
// square has its ends sliced off by the bezel.
export function controlLayout(screenSize, board) {
  const top = board.y;
  const bottom = screenSize - (board.y + board.size);
  const side = board.x;
  const middle = board.y + board.size / 2;

  const armWidth = Math.round(side * ARROW_SPAN);
  const armHeight = Math.round(board.size * ARROW_HEIGHT);

  // The top segment carries two things: the counters above and the up arrow
  // below them. Splitting it is what keeps the arrows symmetrical - putting the
  // counters anywhere else would leave one segment doing nothing.
  const counterHeight = Math.round(top * COUNTER_FILL);
  const counterTop = Math.round(top * 0.06);
  const counterRow = centeredBox(screenSize, counterTop, counterHeight, board.size, EDGE_PADDING);

  const upHeight = Math.round(top * ARROW_FILL);
  const upTop = counterTop + counterHeight;
  const upRow = centeredBox(screenSize, upTop, upHeight, board.size * 0.5, EDGE_PADDING);

  const rowHeight = Math.round(bottom * SEGMENT_FILL);
  const rowTop = board.y + board.size + ROW_TOP_GAP;
  const row = centeredBox(screenSize, rowTop, rowHeight, board.size, EDGE_PADDING);
  const downWidth = Math.round(row.w * DOWN_SHARE);
  const sideWidth = Math.round(row.w * SIDE_SHARE);
  const cells = [
    { x: row.x, y: row.y, w: sideWidth, h: row.h },
    { x: row.x + (row.w - downWidth) / 2, y: row.y, w: downWidth, h: row.h },
    { x: row.x + row.w - sideWidth, y: row.y, w: sideWidth, h: row.h },
  ];

  return {
    board: box(board.x, board.y, board.size, board.size),
    left: box((side - armWidth) / 2, middle - armHeight / 2, armWidth, armHeight),
    right: box(
      board.x + board.size + (side - armWidth) / 2,
      middle - armHeight / 2,
      armWidth,
      armHeight
    ),
    counter: box(counterRow.x, counterRow.y, counterRow.w, counterRow.h),
    up: box(upRow.x, upRow.y, upRow.w, upRow.h),
    undo: box(cells[0].x, cells[0].y, cells[0].w, cells[0].h),
    down: box(cells[1].x, cells[1].y, cells[1].w, cells[1].h),
    menu: box(cells[2].x, cells[2].y, cells[2].w, cells[2].h),
  };
}

function inside(area, x, y) {
  return x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h;
}

// What a touch at this point is aimed at, or null for the dead space between
// controls. The arrows are checked before the board so a stray pixel of overlap
// can never steal a step.
export function hitTest(layout, x, y) {
  if (inside(layout.up, x, y)) {
    return UP;
  }
  if (inside(layout.down, x, y)) {
    return DOWN;
  }
  if (inside(layout.left, x, y)) {
    return LEFT;
  }
  if (inside(layout.right, x, y)) {
    return RIGHT;
  }
  if (inside(layout.undo, x, y)) {
    return UNDO;
  }
  if (inside(layout.menu, x, y)) {
    return MENU;
  }
  if (inside(layout.board, x, y)) {
    return BOARD;
  }
  return null;
}

export function isDirectionHit(hit) {
  return hit === UP || hit === DOWN || hit === LEFT || hit === RIGHT;
}

// The controls that are drawn as arrows, paired with the direction they mean.
export const ARROWS = [
  { key: "up", direction: UP },
  { key: "down", direction: DOWN },
  { key: "left", direction: LEFT },
  { key: "right", direction: RIGHT },
];
