// What is on a cell, as one of a handful of names. The page turns each name into
// two rectangles (a floor tile and the thing standing on it) and never has to
// know the rules; keeping the decision here means the drawing is unit tested too.
import { hasBox, indexOf, inside, isGoal, isWall } from "./sokoban.js";

export const OUTSIDE = "outside";
export const WALL = "wall";
export const FLOOR = "floor";
export const GOAL = "goal";
export const BOX = "box";
export const BOX_ON_GOAL = "box_on_goal";
export const KEEPER = "keeper";
export const KEEPER_ON_GOAL = "keeper_on_goal";

// Every name `cellKind` can return, so the page's colour table can be checked
// against it by a test rather than discovering a missing entry on the wrist.
export const CELL_KINDS = [OUTSIDE, WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, KEEPER, KEEPER_ON_GOAL];

// The window can hang over the edge of a small board, so cells off the grid are a
// kind of their own rather than an error: the page paints them as background.
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
