// Deciding whether a generated warehouse is worth shipping.
//
// This is the offline quality gate, kept here rather than inside the build
// script so it can be unit tested: the script is the part that touches the disk,
// this is the part that makes the judgement.
//
// Solvability is NOT what is being checked - the generator guarantees that by
// construction. What is being checked is whether the puzzle is any good, and the
// only honest answer to "is this too easy" comes from actually solving it. The
// catch is that solving is exponential in the number of crates, so the solver is
// given a budget. That leads to the rule that makes the whole thing practical:
//
//   solved quickly, few pushes  -> too easy, throw it away
//   solved quickly, many pushes -> good, and we know exactly how hard
//   not solved inside the budget -> good, because easy levels never do that
import { measure } from "./quality.js";
import { EXHAUSTED, SOLVED, solve } from "./solver.js";

// What the solver may spend per size, and the fewest pushes a level of that size
// may need. The budget only has to be big enough to catch an easy level, because
// an easy level falls out of the search in a few hundred states; raising it
// further just buys slow confirmation that a hard level is hard.
// `minBound`, `maxEmpty` and `minFreedom` came out of reading a sample of the
// shipped collection by hand. They catch the three ways a correct level can
// still be a poor one - a map with a quarter of itself empty, crates that all
// start next to their goal, and a keeper walled into a pocket with no opening
// move. See lib/quality.js.
export const QUALITY = {
  xs: { budget: 60000, minPushes: 7, minBound: 7, maxEmpty: 0.28, minFreedom: 0.5 },
  s: { budget: 20000, minPushes: 10, minBound: 10, maxEmpty: 0.25, minFreedom: 0.5 },
  m: { budget: 8000, minPushes: 13, minBound: 13, maxEmpty: 0.22, minFreedom: 0.5 },
  l: { budget: 6000, minPushes: 16, minBound: 15, maxEmpty: 0.2, minFreedom: 0.5 },
  xl: { budget: 4000, minPushes: 18, minBound: 18, maxEmpty: 0.18, minFreedom: 0.5 },
  xxl: { budget: 3000, minPushes: 20, minBound: 21, maxEmpty: 0.16, minFreedom: 0.5 },
};

export const KEEP = "keep";
export const TOO_EASY = "too_easy";
export const SHALLOW = "shallow";
export const EMPTY_MAP = "empty_map";
export const WALLED_IN = "walled_in";
export const DISAGREEMENT = "disagreement";

export function qualityFor(id) {
  return Object.prototype.hasOwnProperty.call(QUALITY, id) ? QUALITY[id] : QUALITY.m;
}

// Judge one warehouse. Returns { verdict, pushes, states }, where `pushes` is
// the optimal push count when it is known and -1 when the solver ran out of
// budget before finding it.
//
// A DISAGREEMENT verdict means the solver could not finish a level the generator
// promised was solvable. That is not a bad level, it is a bug in one of the two,
// and the caller is expected to stop rather than quietly drop it.
export function judgeLevel(level, quality) {
  // The cheap shape checks first: they need no search, and on the big sizes
  // they are the only quality signal there is, because the solver cannot
  // finish those inside any sane budget.
  const shape = measure(level);
  const floor = countFloor(level);

  if (quality.minBound !== undefined && shape.lowerBound < quality.minBound) {
    return { verdict: SHALLOW, pushes: -1, states: 0, shape };
  }
  if (quality.maxEmpty !== undefined && shape.emptyBlock > quality.maxEmpty) {
    return { verdict: EMPTY_MAP, pushes: -1, states: 0, shape };
  }
  if (quality.minFreedom !== undefined && shape.freedom < floor * quality.minFreedom) {
    return { verdict: WALLED_IN, pushes: -1, states: 0, shape };
  }

  const result = solve(level, quality.budget);

  if (result.status === SOLVED) {
    if (result.pushes < quality.minPushes) {
      return { verdict: TOO_EASY, pushes: result.pushes, states: result.states, shape };
    }
    return { verdict: KEEP, pushes: result.pushes, states: result.states, shape };
  }

  if (result.status === EXHAUSTED) {
    return { verdict: KEEP, pushes: -1, states: result.states, shape };
  }

  return { verdict: DISAGREEMENT, pushes: -1, states: result.states, shape };
}

function countFloor(level) {
  let floor = 0;
  for (let i = 0; i < level.walls.length; i++) {
    if (level.walls[i] === 0) {
      floor += 1;
    }
  }
  return floor;
}

// A warehouse reduced to a string, so a collection can refuse to ship the same
// one twice.
export function fingerprint(level) {
  return (
    level.cols +
    ":" +
    level.walls.join("") +
    ":" +
    level.goals
      .slice()
      .sort((a, b) => a - b)
      .join(",") +
    ":" +
    level.boxes
      .slice()
      .sort((a, b) => a - b)
      .join(",") +
    ":" +
    level.player
  );
}
