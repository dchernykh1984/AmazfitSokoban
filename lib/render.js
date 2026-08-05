// What is on a cell: one name for each thing the rules can put there.
//
// This is the only place that turns a board position into something the drawing
// code can act on. What those names LOOK like is lib/paint.js - keeping the two
// apart means the rules never mention a colour and the artwork never mentions a
// rule.
import { hasBox, indexOf, inside, isGoal, isWall } from "./sokoban.js";

export const OUTSIDE = "outside";
export const WALL = "wall";
export const FLOOR = "floor";
export const GOAL = "goal";
export const BOX = "box";
export const BOX_ON_GOAL = "box_on_goal";
export const KEEPER = "keeper";
export const KEEPER_ON_GOAL = "keeper_on_goal";

// Every name `cellKind` can return, so the artwork can be checked against it by
// a test rather than discovering a missing case on the wrist.
export const CELL_KINDS = [OUTSIDE, WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, KEEPER, KEEPER_ON_GOAL];

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
