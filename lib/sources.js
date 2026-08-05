// Where a warehouse comes from.
//
// The app ships thousands of levels that were generated on a computer and put
// through a real solver, which is the only way to know a puzzle is not trivially
// easy. It can also generate one on the wrist, which nobody needs for quality -
// but a level nobody has ever seen is worth something on its own, so the choice
// stays with the player.
//
// The two are kept apart for scoring: a hand-picked level and a level the watch
// happened to roll are not the same challenge, and one best score covering both
// would mean nothing.
export const BUILT_IN = "builtin";
export const GENERATED = "generated";

export const SOURCES = [BUILT_IN, GENERATED];

// Built-in first: it is the better experience, so it is what a fresh install
// gets without being asked.
export const DEFAULT_SOURCE = BUILT_IN;

// Where the chosen source is remembered.
export const SOURCE_KEY = "source";

export function clampSource(source) {
  return SOURCES.indexOf(source) === -1 ? DEFAULT_SOURCE : source;
}

export function nextSource(source) {
  const at = SOURCES.indexOf(clampSource(source));
  return SOURCES[(at + 1) % SOURCES.length];
}

// The i18n key naming this source on the start screen.
export function sourceLabel(source) {
  return clampSource(source) === BUILT_IN ? "source_builtin" : "source_random";
}
