// The six warehouse sizes. Each one is a spec for the level generator plus the
// size of the window the watch shows it through, kept pure so the numbers can be
// checked by a test rather than by playing six games.
//
// `cols` x `rows` counts the solid border, so an 11x11 warehouse has a 9x9 floor.
// `visible` is how many cells fit across the round screen at once: XS and S are
// shown whole, and from M upwards the warehouse is deliberately bigger than the
// window, so the map has to be dragged around to see the rest of it.
//
// `blocks` rises much faster than the area on purpose. A big open hall is a dull
// Sokoban and an easy one - the crate can be pushed anywhere - so the bigger
// sizes are made deliberately TIGHT, all rooms and corridors.

export const LEVELS = [
  {
    id: "xs",
    label: "size_xs",
    cols: 9,
    rows: 9,
    boxes: 2,
    blocks: 9,
    pulls: 18,
    minPulls: 10,
    visible: 9,
  },
  {
    id: "s",
    label: "size_s",
    cols: 11,
    rows: 11,
    boxes: 3,
    blocks: 15,
    pulls: 27,
    minPulls: 15,
    visible: 11,
  },
  {
    id: "m",
    label: "size_m",
    cols: 13,
    rows: 13,
    boxes: 4,
    blocks: 22,
    pulls: 36,
    minPulls: 20,
    visible: 11,
  },
  {
    id: "l",
    label: "size_l",
    cols: 15,
    rows: 15,
    boxes: 5,
    blocks: 30,
    pulls: 45,
    minPulls: 25,
    visible: 11,
  },
  {
    id: "xl",
    label: "size_xl",
    cols: 17,
    rows: 17,
    boxes: 6,
    blocks: 41,
    pulls: 54,
    minPulls: 30,
    visible: 11,
  },
  {
    id: "xxl",
    label: "size_xxl",
    cols: 19,
    rows: 19,
    boxes: 7,
    blocks: 52,
    pulls: 63,
    minPulls: 35,
    visible: 11,
  },
];

export const DEFAULT_LEVEL = 0;

// Clamp a stored or user-supplied size into the range of LEVELS; anything
// unusable falls back to the default rather than leaving the game without a
// size. Nothing-at-all is checked before the numeric coercion, because
// Number(null) and Number("") are both 0 - a fresh install would otherwise
// silently start on the first size instead of the default one.
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

// The next size in the cycle, so one button can walk through all of them.
export function nextLevel(level) {
  return (clampLevel(level) + 1) % LEVELS.length;
}

export function levelSpec(level) {
  return LEVELS[clampLevel(level)];
}
