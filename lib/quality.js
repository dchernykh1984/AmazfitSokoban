// Measuring whether a warehouse is a good PUZZLE, as opposed to a valid one.
//
// The generator already guarantees a level can be finished, and the solver
// already rejects levels that fall over in a couple of pushes. Neither catches
// the three ways a technically-correct level can still be a poor one, all of
// which turned up when a sample of the shipped collection was read by hand:
//
//   1. A quarter of the map holds no crate and no goal, so the player pans into
//      empty rooms and learns nothing. Spreading the goals across sectors helped
//      but did not fix it - a whole corner can still end up as scenery.
//   2. Every crate starts one push from a goal. The map is big, the puzzle is
//      not: it decomposes into N independent nudges instead of one problem.
//   3. The keeper starts sealed in a pocket where the only legal move is a
//      forced push, so the opening carries no decision at all.
//
// All three are cheap to measure and none of them need a solver, which matters:
// on the big sizes the solver cannot finish, so these are the only quality
// signals available there.
import { DIRECTIONS, VECTORS } from "./directions.js";
import { columnOf, indexOf, inside, isWall, rowOf } from "./sokoban.js";

// The largest block of the warehouse that holds neither a crate nor a goal, as a
// share of the floor. A big empty block is the "dead scenery" the player pans
// through for nothing.
export function emptyBlockShare(level) {
  const cols = level.cols;
  const rows = level.rows;

  const interesting = new Array(cols * rows).fill(false);
  for (let i = 0; i < level.goals.length; i++) {
    interesting[level.goals[i]] = true;
  }
  for (let i = 0; i < level.boxes.length; i++) {
    interesting[level.boxes[i]] = true;
  }

  let floor = 0;
  for (let index = 0; index < cols * rows; index++) {
    if (level.walls[index] === 0) {
      floor += 1;
    }
  }
  if (floor === 0) {
    return 1;
  }

  // Largest rectangle of cells that are floor and hold nothing, by the standard
  // histogram sweep: heights per column, then the widest bar under each.
  const heights = new Array(cols).fill(0);
  let best = 0;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < cols; column++) {
      const index = row * cols + column;
      const usable = level.walls[index] === 0 && !interesting[index];
      heights[column] = usable ? heights[column] + 1 : 0;
    }
    best = Math.max(best, widestBar(heights));
  }

  return best / floor;
}

function widestBar(heights) {
  let best = 0;
  const stack = [];
  for (let i = 0; i <= heights.length; i++) {
    const height = i === heights.length ? 0 : heights[i];
    while (stack.length > 0 && heights[stack[stack.length - 1]] >= height) {
      const top = stack.pop();
      const left = stack.length === 0 ? -1 : stack[stack.length - 1];
      best = Math.max(best, heights[top] * (i - left - 1));
    }
    stack.push(i);
  }
  return best;
}

// How far every crate has to travel, at the very least: the cheapest way of
// pairing each crate with a goal, measured as distance across the floor.
//
// It is a LOWER bound on the number of pushes - a crate cannot reach its goal in
// fewer moves than the distance - and it is the honest way to spot a level where
// every crate is already sitting next to its goal.
export function pushLowerBound(level) {
  const boxes = level.boxes;
  const goals = level.goals;
  if (boxes.length === 0) {
    return 0;
  }

  // Distance from every goal to every cell, walking the floor and ignoring
  // crates: a crate cannot beat this.
  const table = [];
  for (let g = 0; g < goals.length; g++) {
    table.push(floorDistances(level, goals[g]));
  }

  const used = new Array(goals.length).fill(false);
  return cheapestPairing(table, boxes, used, 0);
}

// Distances from one cell to every other across the floor.
function floorDistances(level, from) {
  const cells = level.cols * level.rows;
  const distance = new Array(cells).fill(-1);
  distance[from] = 0;

  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const x = columnOf(level, index);
    const y = rowOf(level, index);
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const vector = VECTORS[DIRECTIONS[d]];
      const nx = x + vector.dx;
      const ny = y + vector.dy;
      if (!inside(level, nx, ny) || isWall(level, nx, ny)) {
        continue;
      }
      const next = indexOf(level, nx, ny);
      if (distance[next] === -1) {
        distance[next] = distance[index] + 1;
        queue.push(next);
      }
    }
  }
  return distance;
}

// Cheapest crate-to-goal pairing, by trying them all. With at most seven crates
// that is 5040 combinations of a handful of lookups - nothing, and exact.
function cheapestPairing(table, boxes, used, at) {
  if (at >= boxes.length) {
    return 0;
  }
  let best = -1;
  for (let g = 0; g < table.length; g++) {
    if (used[g]) {
      continue;
    }
    const step = table[g][boxes[at]];
    if (step < 0) {
      continue;
    }
    used[g] = true;
    const rest = cheapestPairing(table, boxes, used, at + 1);
    used[g] = false;
    if (rest < 0) {
      continue;
    }
    const total = step + rest;
    if (best === -1 || total < best) {
      best = total;
    }
  }
  return best;
}

// How many cells the keeper can walk to before touching anything. A keeper
// sealed into a pocket has no opening move worth making - its first move is
// forced, and a forced move is not a decision.
export function keeperFreedom(level) {
  const cells = level.cols * level.rows;
  const blocked = new Array(cells).fill(false);
  for (let i = 0; i < level.boxes.length; i++) {
    blocked[level.boxes[i]] = true;
  }

  const seen = new Array(cells).fill(false);
  seen[level.player] = true;
  const queue = [level.player];
  let reached = 1;

  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const x = columnOf(level, index);
    const y = rowOf(level, index);
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const vector = VECTORS[DIRECTIONS[d]];
      const nx = x + vector.dx;
      const ny = y + vector.dy;
      if (!inside(level, nx, ny) || isWall(level, nx, ny)) {
        continue;
      }
      const next = indexOf(level, nx, ny);
      if (seen[next] || blocked[next]) {
        continue;
      }
      seen[next] = true;
      reached += 1;
      queue.push(next);
    }
  }
  return reached;
}

// Everything worth knowing about a level's shape, in one pass.
export function measure(level) {
  return {
    emptyBlock: emptyBlockShare(level),
    lowerBound: pushLowerBound(level),
    freedom: keeperFreedom(level),
  };
}
