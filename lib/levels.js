// The difficulty levels. Each one is a spec for the level generator plus the size
// of the window the watch shows it through, kept pure so the numbers can be
// checked by a test rather than by playing three games.
//
// `cols` x `rows` counts the solid border, so an 8x8 warehouse has a 6x6 floor.
// `visible` is how many cells fit across the round screen at once: Easy shows the
// whole warehouse, and from Normal upwards the board is deliberately bigger than
// the window, so the map has to be dragged around to see the rest of it.

export const LEVELS = [
  {
    id: "easy",
    label: "level_easy",
    cols: 7,
    rows: 7,
    boxes: 2,
    blocks: 2,
    pulls: 10,
    minPulls: 4,
    visible: 7,
  },
  {
    id: "normal",
    label: "level_normal",
    cols: 10,
    rows: 10,
    boxes: 3,
    blocks: 10,
    pulls: 18,
    minPulls: 8,
    visible: 9,
  },
  {
    id: "hard",
    label: "level_hard",
    cols: 13,
    rows: 13,
    boxes: 4,
    blocks: 26,
    pulls: 30,
    minPulls: 14,
    visible: 11,
  },
];

export const DEFAULT_LEVEL = 0;

// Clamp a stored or user-supplied level into the range of LEVELS; anything
// unusable falls back to the default rather than leaving the game without a size.
// Nothing-at-all is checked before the numeric coercion, because Number(null) and
// Number("") are both 0 - a fresh install would otherwise silently start on the
// first level instead of the default one.
export function clampLevel(level) {
  if (level === null || level === undefined || level === "") {
    return DEFAULT_LEVEL;
  }
  const index = Math.floor(Number(level));
  if (!Number.isFinite(index) || index < 0 || index >= LEVELS.length) {
    return DEFAULT_LEVEL;
  }
  return index;
}

// The next difficulty in the cycle, so one button can walk through all of them.
export function nextLevel(level) {
  return (clampLevel(level) + 1) % LEVELS.length;
}

export function levelSpec(level) {
  return LEVELS[clampLevel(level)];
}
