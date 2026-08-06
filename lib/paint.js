// What to draw for one cell, as a list of primitives.
//
// The page owns a canvas and knows how to execute `rect`, `circle`, `ring` and
// `line`; it does not know what a crate looks like. That lives here, in a pure
// function, so the artwork is unit tested like everything else - a test can ask
// "what does a crate on a goal look like" and get an answer without a watch.
//
// Everything is expressed as fractions of the cell and multiplied out at the
// end, so the same code draws a 25px cell on a crowded XXL board and a 46px one
// on XS without a second set of numbers.
import { DOWN, LEFT, RIGHT, UP } from "./directions.js";
import { BOX, BOX_ON_GOAL, FLOOR, GOAL, KEEPER, KEEPER_ON_GOAL, OUTSIDE, WALL } from "./render.js";

export const COLOR_EMPTY = 0x000000;
export const COLOR_WALL = 0x46545f;
export const COLOR_WALL_EDGE = 0x5b6c79;
export const COLOR_FLOOR = 0x141a1f;
export const COLOR_FLOOR_EDGE = 0x1d262c;
export const COLOR_GOAL = 0x2fbf71;
export const COLOR_BOX = 0xc9873a;
export const COLOR_BOX_EDGE = 0x8a5a20;
export const COLOR_BOX_DONE = 0x35a86a;
export const COLOR_BOX_DONE_EDGE = 0x1d6b41;
export const COLOR_KEEPER = 0x4fa8ff;
export const COLOR_KEEPER_FACE = 0xdff0ff;

// A crate nearly fills its cell, the keeper is a smaller disc, the goal ring
// sits just inside the floor tile.
const BOX_INSET = 0.12;
const BOX_BORDER = 0.1;
const KEEPER_RADIUS = 0.3;
const KEEPER_EYE = 0.1;
const GOAL_RADIUS = 0.26;
const GOAL_RING = 0.07;

function rect(x1, y1, x2, y2, color) {
  return { op: "rect", x1, y1, x2, y2, color };
}

function ring(x, y, radius, width, color) {
  return { op: "ring", x, y, radius, width, color };
}

function disc(x, y, radius, color) {
  return { op: "disc", x, y, radius, color };
}

function line(x1, y1, x2, y2, color) {
  return { op: "line", x1, y1, x2, y2, color };
}

// The floor tile, inset by a pixel so the grid reads as cells rather than as one
// flat slab.
function floorTile(box, color) {
  return rect(box.x + 1, box.y + 1, box.x + box.w - 1, box.y + box.h - 1, color);
}

// A crate: a filled square with a darker border and the diagonal bracing that
// makes it read as a crate rather than a coloured block.
function crate(box, fill, edge) {
  const inset = Math.max(1, Math.round(box.w * BOX_INSET));
  const border = Math.max(1, Math.round(box.w * BOX_BORDER));
  const x1 = box.x + inset;
  const y1 = box.y + inset;
  const x2 = box.x + box.w - inset;
  const y2 = box.y + box.h - inset;

  return [
    rect(x1, y1, x2, y2, edge),
    rect(x1 + border, y1 + border, x2 - border, y2 - border, fill),
    line(x1 + border, y1 + border, x2 - border, y2 - border, edge),
    line(x2 - border, y1 + border, x1 + border, y2 - border, edge),
  ];
}

// The keeper, facing the way it last pushed: a disc with a bright marker on the
// leading edge, which is enough to read at 25px and costs two primitives.
function keeper(box, facing) {
  const centreX = box.x + Math.round(box.w / 2);
  const centreY = box.y + Math.round(box.h / 2);
  const radius = Math.max(2, Math.round(box.w * KEEPER_RADIUS));
  const eye = Math.max(1, Math.round(box.w * KEEPER_EYE));
  const reach = radius - eye;

  let eyeX = centreX;
  let eyeY = centreY;
  if (facing === UP) {
    eyeY = centreY - reach;
  } else if (facing === DOWN) {
    eyeY = centreY + reach;
  } else if (facing === LEFT) {
    eyeX = centreX - reach;
  } else if (facing === RIGHT) {
    eyeX = centreX + reach;
  }

  return [disc(centreX, centreY, radius, COLOR_KEEPER), disc(eyeX, eyeY, eye, COLOR_KEEPER_FACE)];
}

// The goal marker: a ring, like a painted circle on a warehouse floor. Not a
// pit - the crate does not fall into it, it just has to end up there, and a pit
// would promise something the rules do not do.
function goalRing(box) {
  const centreX = box.x + Math.round(box.w / 2);
  const centreY = box.y + Math.round(box.h / 2);
  const radius = Math.max(2, Math.round(box.w * GOAL_RADIUS));
  const width = Math.max(1, Math.round(box.w * GOAL_RING));
  return ring(centreX, centreY, radius, width, COLOR_GOAL);
}

// Everything to draw for one cell, back to front. `facing` is the direction the
// keeper last pushed in and is ignored for every other kind.
export function paintCell(kind, box, facing) {
  if (kind === OUTSIDE) {
    return [rect(box.x, box.y, box.x + box.w, box.y + box.h, COLOR_EMPTY)];
  }

  if (kind === WALL) {
    return [
      rect(box.x, box.y, box.x + box.w, box.y + box.h, COLOR_WALL_EDGE),
      rect(box.x + 1, box.y + 1, box.x + box.w - 1, box.y + box.h - 1, COLOR_WALL),
    ];
  }

  const tile = [
    rect(box.x, box.y, box.x + box.w, box.y + box.h, COLOR_FLOOR_EDGE),
    floorTile(box, COLOR_FLOOR),
  ];

  if (kind === FLOOR) {
    return tile;
  }
  if (kind === GOAL) {
    return tile.concat([goalRing(box)]);
  }
  if (kind === BOX) {
    return tile.concat(crate(box, COLOR_BOX, COLOR_BOX_EDGE));
  }
  if (kind === BOX_ON_GOAL) {
    return tile.concat([goalRing(box)]).concat(crate(box, COLOR_BOX_DONE, COLOR_BOX_DONE_EDGE));
  }
  if (kind === KEEPER) {
    return tile.concat(keeper(box, facing));
  }
  if (kind === KEEPER_ON_GOAL) {
    return tile.concat([goalRing(box)]).concat(keeper(box, facing));
  }

  return tile;
}

// ---------------------------------------------------------------- controls ---

// The controls are drawn rather than lettered: an arrow reads as a direction in
// any language, needs no glyph the source file cannot hold, and scales with the
// screen like everything else here. They go onto the one game canvas along with
// the warehouse, and a pure hit test decides which control a tap landed on.

// How big to draw an arrow, given every button that has to hold one.
//
// One size for all four, not one per button. The buttons are nowhere near the
// same shape - a wide shallow strip along the top, a tall narrow one down each
// side, a short wide one at the bottom - and sizing each arrow to its own box
// draws four different symbols: the bottom one half the span of the sides, at
// three different stroke weights. Four arrows that are the same size and weight
// read as one set of controls; four that are not read as clutter.
//
// The smallest button decides, so the shared size always fits every one of them,
// stroke included.
export function arrowMetrics(boxes) {
  let shortest = Infinity;
  // How far the centre can travel before it leaves the tightest button. Measured
  // from the centre the arrow is actually drawn around, which is rounded to a
  // whole pixel and so is not exactly half way across an odd-sized button.
  let room = Infinity;

  for (const box of boxes) {
    shortest = Math.min(shortest, box.w, box.h);
    const midX = Math.round(box.x + box.w / 2);
    const midY = Math.round(box.y + box.h / 2);
    room = Math.min(room, midX - box.x, box.x + box.w - midX, midY - box.y, box.y + box.h - midY);
  }
  if (!isFinite(shortest) || shortest <= 0 || room <= 0) {
    return { reach: 0, width: 0 };
  }

  const width = Math.max(2, Math.round(shortest * 0.14));
  // Half the stroke hangs outside the endpoint it is drawn from, so the reach
  // has to leave room for it or the arrow overhangs the button - and both are
  // whole pixels, because the endpoints are rounded before they are drawn.
  const reach = Math.max(0, Math.floor(Math.min(shortest * 0.34, room - width / 2)));
  return { reach, width };
}

// An arrow, drawn as a chevron: two thick strokes meeting at the tip.
//
// It is NOT a filled triangle, and that is deliberate. The first version used
// `drawPoly`, which the watch accepts without complaint and then draws nothing
// at all - the arrows were simply missing on a real device while every
// line-drawn icon appeared. Lines are the primitive that is known to work here,
// so the arrows are built from the same thing the undo and menu icons are.
export function paintArrow(direction, box, color, metrics) {
  const midX = Math.round(box.x + box.w / 2);
  const midY = Math.round(box.y + box.h / 2);
  const size = metrics || arrowMetrics([box]);
  const reach = size.reach;
  const width = size.width;

  let tip;
  let armA;
  let armB;
  if (direction === UP) {
    tip = [midX, midY - reach];
    armA = [midX - reach, midY + reach];
    armB = [midX + reach, midY + reach];
  } else if (direction === DOWN) {
    tip = [midX, midY + reach];
    armA = [midX - reach, midY - reach];
    armB = [midX + reach, midY - reach];
  } else if (direction === LEFT) {
    tip = [midX - reach, midY];
    armA = [midX + reach, midY - reach];
    armB = [midX + reach, midY + reach];
  } else {
    tip = [midX + reach, midY];
    armA = [midX - reach, midY - reach];
    armB = [midX - reach, midY + reach];
  }

  return [thickLine(armA, tip, width, color), thickLine(tip, armB, width, color)];
}

function thickLine(from, to, width, color) {
  return {
    op: "line",
    x1: Math.round(from[0]),
    y1: Math.round(from[1]),
    x2: Math.round(to[0]),
    y2: Math.round(to[1]),
    width,
    color,
  };
}

// Undo: an arrow curving back on itself, drawn as a shaft with a head. Cheaper
// and clearer at this size than any glyph would be.
//
// The stroke width is passed in rather than left to default, so the two buttons
// carry the same weight as the arrow between them: they sit in the same row, and
// a hairline icon beside a 5px arrow looks like a different app drew it.
export function paintUndoIcon(box, color, width) {
  const midY = box.y + Math.round(box.h / 2);
  const left = box.x + Math.round(box.w * 0.28);
  const right = box.x + Math.round(box.w * 0.72);
  const head = Math.max(2, Math.round(box.w * 0.16));

  return [
    { op: "line", x1: left, y1: midY, x2: right, y2: midY, width, color },
    { op: "line", x1: left, y1: midY, x2: left + head, y2: midY - head, width, color },
    { op: "line", x1: left, y1: midY, x2: left + head, y2: midY + head, width, color },
    { op: "line", x1: right, y1: midY, x2: right, y2: midY - head, width, color },
  ];
}

// Menu: three stacked bars, at the same weight as everything else in the row.
export function paintMenuIcon(box, color, width) {
  const left = box.x + Math.round(box.w * 0.28);
  const right = box.x + Math.round(box.w * 0.72);
  // The bars have to clear each other once they are drawn thick, so the gap is
  // measured from the stroke and not only from the button.
  const gap = Math.max(2, Math.round(box.h * 0.16), Math.round((width || 2) * 1.6));
  const midY = box.y + Math.round(box.h / 2);

  return [
    { op: "line", x1: left, y1: midY - gap, x2: right, y2: midY - gap, width, color },
    { op: "line", x1: left, y1: midY, x2: right, y2: midY, width, color },
    { op: "line", x1: left, y1: midY + gap, x2: right, y2: midY + gap, width, color },
  ];
}
