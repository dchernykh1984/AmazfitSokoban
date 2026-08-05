// Everything the screen needs that is not a rule: colours, and the fractions the
// layout is derived from. Fractions rather than pixels, because the app is built
// for two round resolutions (466 and 480) and the whole board is laid out from
// the diameter.

// The colours of the chrome around the board. The warehouse itself - floor,
// walls, crates, goals, the keeper - is coloured in lib/paint.js, next to the
// code that draws it.
export const COLOR_BACKGROUND = 0x000000;
export const COLOR_BOARD_EDGE = 0x2b3339;
export const COLOR_TEXT = 0xffffff;
export const COLOR_MUTED = 0x9aa4ab;
export const COLOR_ACCENT = 0x2fbf71;
export const COLOR_BUTTON = 0x1d262c;
export const COLOR_BUTTON_PRESSED = 0x2f3d46;

// The frame drawn around the window onto the warehouse, and the padding kept
// between any centred text or button and the bezel.
export const BOARD_EDGE = 3;
export const SCREEN_PADDING = 8;

// How much a menu dims the board behind it. The board is already nearly black,
// so three quarters is enough for white text to sit on comfortably - and it
// leaves the crates ghosting through, which is the point on the solved screen,
// where seeing where the last one went is half the reward.
export const SCRIM_ALPHA = 190;

// The menu type scale and the caps above and below the board, all as fractions of
// the screen diameter.
export const TEXT_BIG_FRACTION = 0.092;
export const TEXT_ROW_FRACTION = 0.07;
export const TEXT_SMALL_FRACTION = 0.058;
export const BUTTON_HEIGHT_FRACTION = 0.112;
export const STACK_GAP_FRACTION = 0.026;
export const MENU_WIDTH_FRACTION = 0.78;

// How far the finger may travel and still count as a tap rather than a drag of
// the map. About a fingertip: 14px on a 466px watch.
export const TAP_SLOP_FRACTION = 0.03;

// How many cells of the warehouse are kept visible ahead of the keeper. Below
// this the map scrolls to follow, the way a navigator scrolls ahead of you.
export const FOLLOW_MARGIN = 2;

// How long the screen stays lit while the app is open. A puzzle is thought about
// rather than played fast, and a ten-second display timeout would black out
// mid-move, so the page asks for ten minutes and hands the setting back when it
// closes.
export const BRIGHT_TIME_MS = 600000;
