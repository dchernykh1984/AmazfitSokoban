// The whole Sokoban rule set, as plain data and functions with no Zepp OS
// dependency, so every rule is exercised by the unit tests rather than by
// squinting at a watch. The page owns pixels and input; this module owns truth.
//
// A LEVEL is immutable plain data:
//   { cols, rows, walls, goals, boxes, player }
// `walls` is a flat array of 0/1 indexed by `y * cols + x`; `goals` and `boxes`
// are arrays of those same flat indexes and `player` is one of them. A GAME is a
// level plus the mutable run state (the boxes that have been pushed, where the
// warehouse keeper stands, the move counters and the undo history), so every
// helper below happily takes either.
//
// The one rule that makes Sokoban Sokoban: a box can only ever be PUSHED. There
// is no pull, which is why a box shoved into a corner is lost - hence the undo
// stack, which is part of the game rather than a convenience.
import { VECTORS, isDirection } from "./directions.js";

export function indexOf(level, x, y) {
  return y * level.cols + x;
}

export function columnOf(level, index) {
  return index % level.cols;
}

export function rowOf(level, index) {
  return Math.floor(index / level.cols);
}

export function inside(level, x, y) {
  return x >= 0 && y >= 0 && x < level.cols && y < level.rows;
}

// Anything off the grid counts as wall. Generated levels always carry a solid
// border so this cannot happen in play, but a rule that answers safely off the
// edge keeps every caller free of its own bounds check.
export function isWall(level, x, y) {
  if (!inside(level, x, y)) {
    return true;
  }
  return level.walls[indexOf(level, x, y)] === 1;
}

export function isGoal(level, x, y) {
  if (!inside(level, x, y)) {
    return false;
  }
  return level.goals.indexOf(indexOf(level, x, y)) !== -1;
}

// Which box sits on the cell, as its slot in `boxes`, or -1. Slots are stable for
// the life of a game, which is what lets `move` write a pushed box back in place.
export function boxSlot(game, x, y) {
  if (!inside(game, x, y)) {
    return -1;
  }
  return game.boxes.indexOf(indexOf(game, x, y));
}

export function hasBox(game, x, y) {
  return boxSlot(game, x, y) !== -1;
}

// A cell the keeper may stand on: on the grid, not a wall and not a box.
export function isFree(game, x, y) {
  return !isWall(game, x, y) && !hasBox(game, x, y);
}

// A fresh game from a level. The level's arrays are copied rather than aliased so
// that replaying the same level - or generating one and playing it twice - can
// never be corrupted by a previous run. `walls` is the exception: it is shared
// because nothing ever writes to it.
export function createGame(level) {
  return {
    cols: level.cols,
    rows: level.rows,
    walls: level.walls,
    goals: level.goals.slice(),
    boxes: level.boxes.slice(),
    player: level.player,
    start: { boxes: level.boxes.slice(), player: level.player },
    moves: 0,
    pushes: 0,
    history: [],
  };
}

// Put the game back to how the level started, keeping the same object so the page
// does not have to rewire anything.
export function restart(game) {
  game.boxes = game.start.boxes.slice();
  game.player = game.start.player;
  game.moves = 0;
  game.pushes = 0;
  game.history = [];
  return game;
}

// Step the keeper one cell, pushing a single box if one is in the way. Reports
// what happened as { moved, pushed } so the page can redraw exactly the cells
// that changed and count the pushes. A move into a wall, into a box backed by a
// wall, or into a box backed by another box does nothing at all - Sokoban never
// shoves two boxes at once.
export function move(game, direction) {
  if (!isDirection(direction)) {
    return { moved: false, pushed: false };
  }

  const vector = VECTORS[direction];
  const fromX = columnOf(game, game.player);
  const fromY = rowOf(game, game.player);
  const toX = fromX + vector.dx;
  const toY = fromY + vector.dy;

  if (isWall(game, toX, toY)) {
    return { moved: false, pushed: false };
  }

  const slot = boxSlot(game, toX, toY);
  if (slot !== -1) {
    const beyondX = toX + vector.dx;
    const beyondY = toY + vector.dy;
    if (!isFree(game, beyondX, beyondY)) {
      return { moved: false, pushed: false };
    }
    game.boxes[slot] = indexOf(game, beyondX, beyondY);
    game.pushes += 1;
  }

  game.player = indexOf(game, toX, toY);
  game.moves += 1;
  game.history.push({ direction, pushed: slot !== -1 });
  return { moved: true, pushed: slot !== -1 };
}

// Take back the last step, dragging the box back with it when that step was a
// push. Returns whether there was anything to take back.
export function undo(game) {
  const last = game.history.pop();
  if (!last) {
    return false;
  }

  const vector = VECTORS[last.direction];
  const atX = columnOf(game, game.player);
  const atY = rowOf(game, game.player);

  if (last.pushed) {
    // The box that was pushed is the one directly ahead of the keeper. The
    // counter only comes down if it was actually found and dragged back, so a
    // history that has somehow come adrift from the board cannot leave the game
    // claiming pushes that are not on it.
    const slot = boxSlot(game, atX + vector.dx, atY + vector.dy);
    if (slot !== -1) {
      game.boxes[slot] = game.player;
      game.pushes -= 1;
    }
  }

  game.player = indexOf(game, atX - vector.dx, atY - vector.dy);
  game.moves -= 1;
  return true;
}

// How many boxes stand on a goal. Shown on the watch as "2/3", which is the only
// progress a Sokoban player gets.
export function boxesOnGoals(game) {
  let count = 0;
  for (let i = 0; i < game.boxes.length; i++) {
    if (game.goals.indexOf(game.boxes[i]) !== -1) {
      count += 1;
    }
  }
  return count;
}

// The puzzle is solved when every goal carries a box. Levels are generated with
// as many boxes as goals, so counting the covered ones is enough.
export function isSolved(game) {
  return game.goals.length > 0 && boxesOnGoals(game) === game.goals.length;
}
