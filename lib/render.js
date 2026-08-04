// What is on a cell, and what that looks like. The page asks for a cell's kind
// and then for the two rectangles it is painted as, and never has to know the
// rules or keep a colour table of its own - which is what lets a test check the
// drawing as well as the rules.
import { hasBox, indexOf, inside, isGoal, isWall } from "./sokoban.js";

export const OUTSIDE = "outside";
export const WALL = "wall";
export const FLOOR = "floor";
export const GOAL = "goal";
export const BOX = "box";
export const BOX_ON_GOAL = "box_on_goal";
export const KEEPER = "keeper";
export const KEEPER_ON_GOAL = "keeper_on_goal";

// Every name `cellKind` can return, so the style table can be checked against it
// by a test rather than discovering a missing entry on the wrist.
export const CELL_KINDS = [OUTSIDE, WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, KEEPER, KEEPER_ON_GOAL];

// The warehouse palette. The chrome around the board (text, buttons, the frame)
// lives in utils/config/constants.js; these are the colours of the game itself,
// and they live next to the rule that picks between them.
export const COLOR_EMPTY = 0x000000;
export const COLOR_WALL = 0x3d4a55;
export const COLOR_FLOOR = 0x141a1f;
export const COLOR_FLOOR_GOAL = 0x16281f;
export const COLOR_GOAL = 0x2fbf71;
export const COLOR_BOX = 0xc9873a;
export const COLOR_BOX_DONE = 0x2fbf71;
export const COLOR_KEEPER = 0x4fa8ff;

// How much of a cell is left around the thing standing on it: a crate nearly
// fills its cell, the keeper is a smaller disc, and an empty goal is just a dot.
const INSET_BOX = 0.1;
const INSET_KEEPER = 0.2;
const INSET_GOAL = 0.33;

// Each cell is two rectangles: `base` is the floor tile, `top` the thing standing
// on it, drawn `inset` of a cell smaller and rounded off into a disc when `round`
// is set. An empty cell gives both the same colour, so there is nothing to see on
// top - which means the page paints every cell exactly the same way and never
// needs a special case for "nothing here".
const TILE_STYLES = {};
TILE_STYLES[OUTSIDE] = { base: COLOR_EMPTY, top: COLOR_EMPTY, inset: 0, round: false };
TILE_STYLES[WALL] = { base: COLOR_WALL, top: COLOR_WALL, inset: 0, round: false };
TILE_STYLES[FLOOR] = { base: COLOR_FLOOR, top: COLOR_FLOOR, inset: 0, round: false };
TILE_STYLES[GOAL] = { base: COLOR_FLOOR_GOAL, top: COLOR_GOAL, inset: INSET_GOAL, round: true };
TILE_STYLES[BOX] = { base: COLOR_FLOOR, top: COLOR_BOX, inset: INSET_BOX, round: false };
TILE_STYLES[BOX_ON_GOAL] = {
  base: COLOR_FLOOR_GOAL,
  top: COLOR_BOX_DONE,
  inset: INSET_BOX,
  round: false,
};
TILE_STYLES[KEEPER] = { base: COLOR_FLOOR, top: COLOR_KEEPER, inset: INSET_KEEPER, round: true };
TILE_STYLES[KEEPER_ON_GOAL] = {
  base: COLOR_FLOOR_GOAL,
  top: COLOR_KEEPER,
  inset: INSET_KEEPER,
  round: true,
};

// The window can hang over the edge of a small board, so cells off the grid are a
// kind of their own rather than an error: they are painted as background.
export function cellKind(game, x, y) {
  if (!inside(game, x, y)) {
    return OUTSIDE;
  }
  if (isWall(game, x, y)) {
    return WALL;
  }

  const goal = isGoal(game, x, y);
  if (game.player === indexOf(game, x, y)) {
    return goal ? KEEPER_ON_GOAL : KEEPER;
  }
  if (hasBox(game, x, y)) {
    return goal ? BOX_ON_GOAL : BOX;
  }
  return goal ? GOAL : FLOOR;
}

// How a cell of that kind is painted. An unknown kind is painted as background
// rather than left undefined, so a stray name can never crash a repaint.
export function tileStyle(kind) {
  return Object.prototype.hasOwnProperty.call(TILE_STYLES, kind)
    ? TILE_STYLES[kind]
    : TILE_STYLES[OUTSIDE];
}
