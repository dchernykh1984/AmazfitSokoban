// Every string the watch screen can show, as a key. This is the contract each
// language table must satisfy: the locale-completeness unit test fails if a table
// is missing a key or carries one that is not here.
export const UI_KEYS = [
  "title",
  "play",
  "level",
  "level_easy",
  "level_normal",
  "level_hard",
  "moves",
  "best",
  "undo",
  "menu",
  "restart",
  "new_game",
  "resume",
  "solved",
  "new_best",
  "hint_move",
  "hint_pan",
];

// The on-watch character budgets. Everything is drawn on a round screen with no
// auto-shrinking, so a label that overruns its box is simply clipped. The hints
// are full phrases printed under the menu and get a wider allowance than the
// words that sit on buttons and in the counter cap.
export const MAX_LABEL = 12;
export const MAX_HINT = 20;
export const LONG_KEYS = ["hint_move", "hint_pan"];

export function budgetFor(key) {
  return LONG_KEYS.indexOf(key) === -1 ? MAX_LABEL : MAX_HINT;
}
