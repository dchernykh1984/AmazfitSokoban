// An optimal Sokoban solver, used offline only.
//
// The generator already guarantees that a level CAN be finished - it built the
// level backwards from a solved one and hands over the certificate. What it
// cannot tell you is whether the puzzle is any good. This solver answers the one
// question the certificate does not: what is the FEWEST pushes a level can be
// finished in. A warehouse that falls over in four pushes is not worth shipping,
// however big it is.
//
// Sokoban is PSPACE-complete, so this is a breadth-first search with the two
// standard economies and a hard budget:
//
//   * search over PUSHES, not steps - where the keeper walks between pushes does
//     not matter, only which crate it shoves next;
//   * normalise the keeper to the smallest cell it can reach, so two positions
//     that differ only in where the keeper is standing are the same state;
//   * refuse to explore a crate frozen in a corner off-goal, which is dead.
//
// Past `budget` states it gives up and says so, rather than running for ever.
// For the offline filter that is a perfectly good answer: a level the solver
// cannot crack quickly is not a level that is too easy.
import { DIRECTIONS, VECTORS } from "./directions.js";
import { columnOf, indexOf, inside, isWall, rowOf } from "./sokoban.js";

export const SOLVED = "solved";
export const UNSOLVABLE = "unsolvable";
export const EXHAUSTED = "exhausted";

export const DEFAULT_BUDGET = 200000;

function freeCell(shape, blocked, x, y) {
  if (isWall(shape, x, y)) {
    return false;
  }
  return !blocked[indexOf(shape, x, y)];
}

// Where the keeper can get to, and the smallest cell in that region. That
// cell is the state's fingerprint: any keeper position in the same region leads
// to exactly the same set of pushes.
function reach(shape, blocked, from) {
  const seen = new Array(shape.cols * shape.rows).fill(false);
  const queue = [from];
  seen[from] = true;
  let smallest = from;

  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const x = columnOf(shape, index);
    const y = rowOf(shape, index);
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const vector = VECTORS[DIRECTIONS[d]];
      const nx = x + vector.dx;
      const ny = y + vector.dy;
      if (!inside(shape, nx, ny) || isWall(shape, nx, ny)) {
        continue;
      }
      const next = indexOf(shape, nx, ny);
      if (seen[next] || blocked[next]) {
        continue;
      }
      seen[next] = true;
      if (next < smallest) {
        smallest = next;
      }
      queue.push(next);
    }
  }

  return { seen, smallest };
}

// A crate wedged into a corner it cannot be pushed out of. Cheap and only
// catches the obvious case, which is the one that matters: it prunes the huge
// branch of the search where a crate has been shoved somewhere fatal.
export function isCornerDeadlock(shape, goals, index) {
  if (goals.indexOf(index) !== -1) {
    return false;
  }
  const x = columnOf(shape, index);
  const y = rowOf(shape, index);
  const up = isWall(shape, x, y - 1);
  const down = isWall(shape, x, y + 1);
  const left = isWall(shape, x - 1, y);
  const right = isWall(shape, x + 1, y);
  return (up || down) && (left || right);
}

function keyOf(boxes, smallest) {
  return boxes.join(",") + "|" + smallest;
}

function allHome(boxes, goalFlags) {
  for (let i = 0; i < boxes.length; i++) {
    if (!goalFlags[boxes[i]]) {
      return false;
    }
  }
  return true;
}

// The fewest pushes the level can be finished in.
//
//   { status, pushes, states }
//
// `status` is SOLVED, UNSOLVABLE (the search ran dry) or EXHAUSTED (the budget
// ran out first). `pushes` is only meaningful when SOLVED.
export function solve(level, budget) {
  const limit = typeof budget === "number" && budget > 0 ? budget : DEFAULT_BUDGET;
  const cells = level.cols * level.rows;

  const goalFlags = new Array(cells).fill(false);
  for (let i = 0; i < level.goals.length; i++) {
    goalFlags[level.goals[i]] = true;
  }

  const startBoxes = level.boxes.slice().sort((a, b) => a - b);
  if (allHome(startBoxes, goalFlags)) {
    return { status: SOLVED, pushes: 0, states: 0 };
  }

  const blocked = new Array(cells).fill(false);
  for (let i = 0; i < startBoxes.length; i++) {
    blocked[startBoxes[i]] = true;
  }

  const first = reach(level, blocked, level.player);
  const seen = {};
  seen[keyOf(startBoxes, first.smallest)] = true;

  let frontier = [{ boxes: startBoxes, reachable: first.seen }];
  let pushes = 0;
  let states = 1;

  while (frontier.length > 0) {
    const next = [];
    pushes += 1;

    for (let f = 0; f < frontier.length; f++) {
      const node = frontier[f];
      const boxes = node.boxes;

      const occupied = new Array(cells).fill(false);
      for (let i = 0; i < boxes.length; i++) {
        occupied[boxes[i]] = true;
      }

      for (let b = 0; b < boxes.length; b++) {
        const bx = columnOf(level, boxes[b]);
        const by = rowOf(level, boxes[b]);

        for (let d = 0; d < DIRECTIONS.length; d++) {
          const vector = VECTORS[DIRECTIONS[d]];
          // To push the crate this way the keeper must stand behind it, and the
          // cell in front of it must be free.
          const standX = bx - vector.dx;
          const standY = by - vector.dy;
          const toX = bx + vector.dx;
          const toY = by + vector.dy;
          if (!freeCell(level, occupied, standX, standY) || !freeCell(level, occupied, toX, toY)) {
            continue;
          }
          if (!node.reachable[indexOf(level, standX, standY)]) {
            continue;
          }

          const landing = indexOf(level, toX, toY);
          if (isCornerDeadlock(level, level.goals, landing)) {
            continue;
          }

          const moved = boxes.slice();
          moved[b] = landing;
          moved.sort((a, b2) => a - b2);

          const nextBlocked = new Array(cells).fill(false);
          for (let i = 0; i < moved.length; i++) {
            nextBlocked[moved[i]] = true;
          }
          const region = reach(level, nextBlocked, boxes[b]);
          const key = keyOf(moved, region.smallest);
          if (seen[key]) {
            continue;
          }
          seen[key] = true;
          states += 1;

          if (allHome(moved, goalFlags)) {
            return { status: SOLVED, pushes, states };
          }
          if (states > limit) {
            return { status: EXHAUSTED, pushes: -1, states };
          }
          next.push({ boxes: moved, reachable: region.seen });
        }
      }
    }

    frontier = next;
  }

  return { status: UNSOLVABLE, pushes: -1, states };
}
