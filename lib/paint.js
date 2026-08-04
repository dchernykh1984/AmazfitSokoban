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
