// Random Sokoban levels that are ALWAYS solvable, built by reverse play.
//
// Scattering boxes at random and hoping for the best does not work: most random
// Sokoban positions are dead on arrival, because a box pushed into a corner can
// never come out. So this generator never builds a puzzle - it builds a SOLVED
// warehouse (every box already on its goal) and then walks the game backwards,
// PULLING boxes off their goals. A pull is the exact inverse of a push, so the
// scrambled position it lands on is reachable from the solved one; replaying the
// pulls in reverse is, by construction, a solution.
//
// That solution is handed back with the level as `solution`, a full list of
// keeper moves. Nothing on the watch uses it - it is the certificate the unit
// tests replay to prove that what the generator emits can actually be finished.
import { DIRECTIONS, VECTORS } from "./directions.js";
import { columnOf, indexOf, inside, isWall, rowOf } from "./sokoban.js";

// How many independent tries a spec gets before the best-so-far is accepted. A
// try fails only when a cramped random layout leaves a box sitting on its goal;
// with the shipped specs the first try almost always succeeds, and the fallback
// exists so the watch always gets a playable board rather than an exception.
const MAX_ATTEMPTS = 24;

// How often the scramble keeps working on the box it just pulled. Wandering
// between boxes on every step spreads them evenly and makes flat, dull puzzles;
// dragging one box a long way and then moving on is what creates the tangles
// that have to be unpicked in a particular order.
const SAME_BOX_BIAS = 0.6;

// The least floor a layout may keep after the random blocks are dropped in, as a
// fraction of the interior. Below that the boxes have nowhere to go.
const MIN_FLOOR_FRACTION = 0.6;

// How much of the floor a puzzle has to actually use. Goals picked at random
// cluster, pulls are local, and the result is a warehouse where the whole game
// happens in one corner while the rest of the map is scenery. A level that never
// sends the keeper across this much of its own floor is thrown away.
const MIN_COVERAGE = 0.45;

// The grid the goals are spread over. Taking each goal from a different cell of
// this grid is what stops them all landing in the same corner in the first
// place; the coverage filter above is the safety net behind it.
function sectorGrid(shape) {
  return shape.cols <= 11 ? 2 : 3;
}

export function sectorOf(shape, index, divisions) {
  const x = columnOf(shape, index);
  const y = rowOf(shape, index);
  const column = Math.min(divisions - 1, Math.floor((x * divisions) / shape.cols));
  const row = Math.min(divisions - 1, Math.floor((y * divisions) / shape.rows));
  return row * divisions + column;
}

// Goals taken from as many different sectors as possible: the sectors are walked
// in a random order and contribute one cell each, round after round, so a
// warehouse gets its targets spread across it rather than piled in one place.
export function spreadGoals(shape, candidates, count, random) {
  const divisions = sectorGrid(shape);
  const buckets = {};
  for (let i = 0; i < candidates.length; i++) {
    const sector = sectorOf(shape, candidates[i], divisions);
    if (!buckets[sector]) {
      buckets[sector] = [];
    }
    buckets[sector].push(candidates[i]);
  }

  const order = Object.keys(buckets);
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }

  const goals = [];
  while (goals.length < count) {
    let took = 0;
    for (let i = 0; i < order.length && goals.length < count; i++) {
      const bucket = buckets[order[i]];
      if (bucket.length === 0) {
        continue;
      }
      const at = randomInt(random, bucket.length);
      goals.push(bucket[at]);
      bucket.splice(at, 1);
      took += 1;
    }
    if (took === 0) {
      return null;
    }
  }
  return goals;
}

// Every cell the solution actually touches: where the keeper walks and where the
// crates travel. This is the honest measure of how much of a warehouse is in
// play, as opposed to how big it is.
export function workingArea(shape, level, solution) {
  const used = {};
  const boxes = level.boxes.slice();
  let at = level.player;
  used[at] = true;
  for (let i = 0; i < boxes.length; i++) {
    used[boxes[i]] = true;
  }

  for (let i = 0; i < solution.length; i++) {
    const vector = VECTORS[solution[i]];
    const step = vector.dy * shape.cols + vector.dx;
    const next = at + step;
    const slot = boxes.indexOf(next);
    if (slot !== -1) {
      boxes[slot] = next + step;
      used[boxes[slot]] = true;
    }
    at = next;
    used[at] = true;
  }

  let count = 0;
  for (const key in used) {
    if (Object.prototype.hasOwnProperty.call(used, key)) {
      count += 1;
    }
  }
  return count;
}

// The share of the floor a solution puts to use.
export function coverage(shape, level, solution) {
  const floor = floorCells(shape).length;
  if (floor === 0 || !solution) {
    return 0;
  }
  return workingArea(shape, level, solution) / floor;
}

function randomInt(random, bound) {
  return Math.min(bound - 1, Math.max(0, Math.floor(random() * bound)));
}

function pick(list, random) {
  return list[randomInt(random, list.length)];
}

// A rectangular room: a solid border with an open interior, then `wallCount`
// random blocks dropped inside it. A block is kept only if the floor stays in one
// piece, so the keeper can always walk the whole warehouse.
export function carveWalls(cols, rows, wallCount, random) {
  const walls = new Array(cols * rows).fill(1);
  const shape = { cols, rows, walls };

  let interior = 0;
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      walls[y * cols + x] = 0;
      interior += 1;
    }
  }

  const floor = Math.floor(interior * MIN_FLOOR_FRACTION);
  const wanted = Math.max(0, Math.min(wallCount, interior - floor));
  let placed = 0;
  // Bounded rather than looping until `wanted` blocks land: on a small room most
  // candidates cut the floor in two and would spin here forever.
  for (let tries = 0; tries < wanted * 20 && placed < wanted; tries++) {
    const x = 1 + randomInt(random, cols - 2);
    const y = 1 + randomInt(random, rows - 2);
    const index = y * cols + x;
    if (walls[index] === 1) {
      continue;
    }
    walls[index] = 1;
    if (isFloorConnected(shape)) {
      placed += 1;
    } else {
      walls[index] = 0;
    }
  }

  return walls;
}

export function floorCells(shape) {
  const cells = [];
  for (let index = 0; index < shape.walls.length; index++) {
    if (shape.walls[index] === 0) {
      cells.push(index);
    }
  }
  return cells;
}

// Whether every floor cell can be walked to from every other one. Checked after
// each random block so a layout can never end up with an unreachable pocket.
export function isFloorConnected(shape) {
  const cells = floorCells(shape);
  if (cells.length === 0) {
    return false;
  }
  const seen = walkableFrom(shape, [], cells[0]);
  for (let i = 0; i < cells.length; i++) {
    if (!seen[cells[i]]) {
      return false;
    }
  }
  return true;
}

// Flood fill from `start` across floor cells that carry no box: exactly where the
// keeper can walk without touching anything. Returned as a flat array of flags so
// membership is a single lookup.
export function walkableFrom(shape, boxes, start) {
  const seen = new Array(shape.cols * shape.rows).fill(false);
  const blocked = new Array(shape.cols * shape.rows).fill(false);
  for (let i = 0; i < boxes.length; i++) {
    blocked[boxes[i]] = true;
  }
  if (shape.walls[start] === 1 || blocked[start]) {
    return seen;
  }

  const queue = [start];
  seen[start] = true;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const x = columnOf(shape, index);
    const y = rowOf(shape, index);
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const vector = VECTORS[DIRECTIONS[d]];
      const nx = x + vector.dx;
      const ny = y + vector.dy;
      if (!inside(shape, nx, ny)) {
        continue;
      }
      const next = indexOf(shape, nx, ny);
      if (seen[next] || shape.walls[next] === 1 || blocked[next]) {
        continue;
      }
      seen[next] = true;
      queue.push(next);
    }
  }
  return seen;
}

// The shortest walk from one cell to another as a list of directions, or null
// when there is no way through. Used only to stitch the certificate solution
// together: between two pushes the keeper still has to walk to the next box.
export function findPath(shape, boxes, from, to) {
  if (from === to) {
    return [];
  }
  const blocked = new Array(shape.cols * shape.rows).fill(false);
  for (let i = 0; i < boxes.length; i++) {
    blocked[boxes[i]] = true;
  }
  const cameFrom = new Array(shape.cols * shape.rows).fill(-1);
  const cameBy = new Array(shape.cols * shape.rows).fill(-1);
  const seen = new Array(shape.cols * shape.rows).fill(false);

  const queue = [from];
  seen[from] = true;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const x = columnOf(shape, index);
    const y = rowOf(shape, index);
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const direction = DIRECTIONS[d];
      const vector = VECTORS[direction];
      const nx = x + vector.dx;
      const ny = y + vector.dy;
      if (isWall(shape, nx, ny)) {
        continue;
      }
      const next = indexOf(shape, nx, ny);
      if (seen[next] || blocked[next]) {
        continue;
      }
      seen[next] = true;
      cameFrom[next] = index;
      cameBy[next] = direction;
      if (next === to) {
        const path = [];
        let cursor = to;
        while (cursor !== from) {
          path.unshift(cameBy[cursor]);
          cursor = cameFrom[cursor];
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

// The direction that steps from one cell to the neighbouring one, or -1 when they
// are not neighbours.
export function directionBetween(shape, from, to) {
  const dx = columnOf(shape, to) - columnOf(shape, from);
  const dy = rowOf(shape, to) - rowOf(shape, from);
  for (let d = 0; d < DIRECTIONS.length; d++) {
    const vector = VECTORS[DIRECTIONS[d]];
    if (vector.dx === dx && vector.dy === dy) {
      return DIRECTIONS[d];
    }
  }
  return -1;
}

// Cells a box could ever be pulled out of: there has to be a direction with two
// free cells behind it, one for the box to move into and one for the keeper to
// back into. Goals are drawn from these, so the scramble is not handed boxes it
// can never shift.
export function pullableCells(shape) {
  const cells = [];
  const floor = floorCells(shape);
  for (let i = 0; i < floor.length; i++) {
    const x = columnOf(shape, floor[i]);
    const y = rowOf(shape, floor[i]);
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const vector = VECTORS[DIRECTIONS[d]];
      if (
        !isWall(shape, x + vector.dx, y + vector.dy) &&
        !isWall(shape, x + 2 * vector.dx, y + 2 * vector.dy)
      ) {
        cells.push(floor[i]);
        break;
      }
    }
  }
  return cells;
}

// Every pull available right now. Pulling a box one cell in direction `u` means
// the keeper stands on the cell the box is about to occupy (`landing`) and walks
// one further (`standing`), dragging the box after it - so both cells must be
// free and the keeper must be able to walk to `landing` in the first place.
function legalPulls(shape, boxes, player) {
  const walkable = walkableFrom(shape, boxes, player);
  const occupied = new Array(shape.cols * shape.rows).fill(false);
  for (let i = 0; i < boxes.length; i++) {
    occupied[boxes[i]] = true;
  }

  const pulls = [];
  for (let slot = 0; slot < boxes.length; slot++) {
    const x = columnOf(shape, boxes[slot]);
    const y = rowOf(shape, boxes[slot]);
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const vector = VECTORS[DIRECTIONS[d]];
      const landX = x + vector.dx;
      const landY = y + vector.dy;
      const standX = x + 2 * vector.dx;
      const standY = y + 2 * vector.dy;
      if (isWall(shape, landX, landY) || isWall(shape, standX, standY)) {
        continue;
      }
      const landing = indexOf(shape, landX, landY);
      const standing = indexOf(shape, standX, standY);
      if (occupied[landing] || occupied[standing] || !walkable[landing]) {
        continue;
      }
      pulls.push({ slot, from: boxes[slot], to: landing, playerTo: standing });
    }
  }
  return pulls;
}

// Drag the boxes off their goals with `steps` random pulls. Returns the scrambled
// boxes, where the keeper ended up, and the pulls in the order they were made -
// which read backwards is the solution.
function scramble(shape, boxes, player, steps, random) {
  const current = boxes.slice();
  let at = player;
  const made = [];

  for (let step = 0; step < steps; step++) {
    const options = legalPulls(shape, current, at);
    const last = made.length > 0 ? made[made.length - 1] : null;
    // Undoing the pull just made would only walk the box back onto its goal.
    const fresh = options.filter(
      (option) => !last || option.slot !== last.slot || option.to !== last.from
    );
    const usable = fresh.length > 0 ? fresh : options;
    if (usable.length === 0) {
      break;
    }

    const sameBox = last ? usable.filter((option) => option.slot === last.slot) : [];
    const chosen =
      sameBox.length > 0 && random() < SAME_BOX_BIAS ? pick(sameBox, random) : pick(usable, random);

    current[chosen.slot] = chosen.to;
    at = chosen.playerTo;
    made.push(chosen);
  }

  return { boxes: current, player: at, pulls: made };
}

// Replay the pulls backwards as pushes, walking the keeper between them, to get
// the move list that finishes the puzzle. Returns null if a walk is impossible,
// which would mean the scramble broke its own invariant.
export function buildSolution(shape, boxes, player, pulls) {
  const current = boxes.slice();
  const moves = [];
  let at = player;

  for (let i = pulls.length - 1; i >= 0; i--) {
    const pull = pulls[i];
    const walk = findPath(shape, current, at, pull.playerTo);
    if (walk === null) {
      return null;
    }
    for (let m = 0; m < walk.length; m++) {
      moves.push(walk[m]);
    }
    const direction = directionBetween(shape, pull.to, pull.from);
    if (direction === -1) {
      return null;
    }
    const slot = current.indexOf(pull.to);
    if (slot === -1) {
      return null;
    }
    current[slot] = pull.from;
    at = pull.to;
    moves.push(direction);
  }

  return moves;
}

// How good a try is, as one number: crates off their goals first, then how much
// of the floor the solution uses, then how far the crates were dragged. Used to
// keep the best try when no try clears every bar.
function score(candidate) {
  return candidate.displaced * 1000 + candidate.coverage * 100 + candidate.pulls.length;
}

function attempt(spec, random) {
  const walls = carveWalls(spec.cols, spec.rows, spec.blocks, random);
  const shape = { cols: spec.cols, rows: spec.rows, walls };

  const candidates = pullableCells(shape);
  if (candidates.length <= spec.boxes) {
    return null;
  }

  const goals = spreadGoals(shape, candidates, spec.boxes, random);
  if (goals === null) {
    return null;
  }

  // The keeper starts anywhere that is not already under a box; the scramble
  // moves it around from there.
  const free = floorCells(shape).filter((index) => goals.indexOf(index) === -1);
  if (free.length === 0) {
    return null;
  }

  const scrambled = scramble(shape, goals.slice(), pick(free, random), spec.pulls, random);

  // Put the keeper on a random cell it could have walked to anyway. Leaving it
  // where the last pull dropped it would point straight at the first push.
  const walkable = walkableFrom(shape, scrambled.boxes, scrambled.player);
  const spots = [];
  for (let index = 0; index < walkable.length; index++) {
    if (walkable[index]) {
      spots.push(index);
    }
  }

  const player = spots.length > 0 ? pick(spots, random) : scrambled.player;
  const solution = buildSolution(shape, scrambled.boxes, player, scrambled.pulls);
  if (solution === null) {
    return null;
  }

  const displaced = scrambled.boxes.filter((index) => goals.indexOf(index) === -1).length;
  const level = {
    cols: shape.cols,
    rows: shape.rows,
    walls,
    goals,
    boxes: scrambled.boxes,
    player,
  };
  return {
    shape,
    goals,
    boxes: scrambled.boxes,
    player,
    pulls: scrambled.pulls,
    solution,
    displaced,
    coverage: coverage(shape, level, solution),
  };
}

// A random level for a difficulty spec:
//   { cols, rows, boxes, blocks, pulls, minPulls }
// `random` is injectable so the tests can generate the very same warehouse twice;
// on the watch it is Math.random. The result is a level (see lib/sokoban.js) with
// `solution` attached.
export function generateLevel(spec, random) {
  const rng = typeof random === "function" ? random : Math.random;
  const minPulls = typeof spec.minPulls === "number" ? spec.minPulls : 1;
  let best = null;

  for (let tries = 0; tries < MAX_ATTEMPTS; tries++) {
    const candidate = attempt(spec, rng);
    if (!candidate) {
      continue;
    }
    if (!best || score(candidate) > score(best)) {
      best = candidate;
    }
    // A puzzle that opens with a box already parked on a goal gives away part of
    // the answer, and one that only ever uses a corner of its own floor is a big
    // map pretending to be a big puzzle. Both have to be right before a try is
    // accepted; otherwise the loop keeps looking and settles for the best seen.
    if (
      candidate.displaced === spec.boxes &&
      candidate.pulls.length >= minPulls &&
      candidate.coverage >= MIN_COVERAGE
    ) {
      best = candidate;
      break;
    }
  }

  // The loop keeps the best try even when none of them cleared the bar, so a
  // cramped spec still gets a playable warehouse rather than an exception. What
  // it must never hand back is a warehouse with every crate already home: that
  // is not a hard puzzle, it is a finished one.
  if (!best || best.displaced === 0) {
    return null;
  }

  return {
    cols: best.shape.cols,
    rows: best.shape.rows,
    walls: best.shape.walls,
    goals: best.goals.slice().sort((a, b) => a - b),
    boxes: best.boxes,
    player: best.player,
    solution: best.solution,
    coverage: best.coverage,
  };
}
