// The persisted best result, kept pure so the storage contract is unit tested.
// The page owns the actual LocalStorage handle; this module owns the key names
// and the "is this a record" decision.
//
// Sokoban scores the other way round from most games: the fewest moves wins. So
// zero is not a bad score, it is the absence of one - which is what a fresh
// install has, and what the screen shows as a dash.

// A best result is kept per size AND per source. Solving a 19x19 warehouse in
// forty moves says something quite different from solving a 9x9 one in forty -
// and a level the watch rolled at random is not the same challenge as one that
// was put through a solver before it shipped, so they do not share a record.
const BEST_KEY_PREFIX = "best_";

// Where the last chosen difficulty is remembered, so the game reopens the way it
// was left.
export const LEVEL_KEY = "level";

// No record yet. Named because `0` reads as "solved in no moves" otherwise.
export const NO_BEST = 0;

export function bestKey(level, source) {
  return BEST_KEY_PREFIX + (source ? source + "_" : "") + level;
}

// A stored value coerced to a usable move count. Storage can hand back a string,
// null or leftover junk from an older build; none of that may crash the game or
// show up on screen, so anything unusable reads as "no record".
export function normalizeMoves(value) {
  const moves = Math.floor(Number(value));
  if (!Number.isFinite(moves) || moves < 0) {
    return NO_BEST;
  }
  return moves;
}

export function hasBest(value) {
  return normalizeMoves(value) > NO_BEST;
}

// The best after a solved puzzle, and whether it is a new record. Fewer moves
// wins, and the first solve always sets the record because there was none.
export function updateBest(previousBest, moves) {
  const best = normalizeMoves(previousBest);
  const result = normalizeMoves(moves);
  if (result > NO_BEST && (best === NO_BEST || result < best)) {
    return { best: result, isRecord: true };
  }
  return { best, isRecord: false };
}
