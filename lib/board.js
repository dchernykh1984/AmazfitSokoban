// Pure board geometry: where the window onto the warehouse sits on a round screen
// and where a single grid cell lands in pixels. Free of any Zepp OS dependency so
// it is unit tested; the page turns these boxes into widgets.

// The corners of the exactly-inscribed square touch the glass, so rounding the
// centring to whole pixels can push one of them a fraction past the bezel. Two
// pixels off each side costs nothing visible and keeps every corner inside the
// circle at both round resolutions.
const BEZEL_MARGIN = 2;

// The window is the largest axis-aligned square that fits inside the round screen
// (side = diameter / sqrt(2)), shrunk to a whole number of equal cells so no cell
// is a pixel wider than its neighbour. Centring that square leaves a circular cap
// above and below it, which the page uses for the counters and the buttons.
//
// `cells` is how many cells are on screen at once, which is not how big the
// warehouse is: from Normal upwards the board is larger than the window and the
// rest is reached by dragging the map.
export function boardLayout(screenSize, cells) {
  const columns = Math.max(1, Math.floor(cells));
  const inscribed = Math.max(1, Math.floor(screenSize / Math.SQRT2) - BEZEL_MARGIN);
  const cell = Math.max(1, Math.floor(inscribed / columns));
  const size = cell * columns;
  const origin = Math.round((screenSize - size) / 2);
  return { cell, size, x: origin, y: origin, cells: columns };
}

// The pixel box of the window slot at (column, row), inset on every side. The
// inset is capped at a third of the cell so a small cell can never collapse to
// nothing.
export function cellRect(board, column, row, inset) {
  const gap = Math.max(0, Math.min(inset, Math.floor(board.cell / 3)));
  return {
    x: board.x + column * board.cell + gap,
    y: board.y + row * board.cell + gap,
    w: board.cell - 2 * gap,
    h: board.cell - 2 * gap,
  };
}

// The same box, inset by a fraction of the cell rather than a pixel count, which
// is how the contents of a cell (a crate, the keeper, a goal marker) are drawn
// smaller than the floor tile they sit on at any screen size. `minimum` is the
// inset a cell with nothing on it still keeps, so the grid lines between tiles
// are never painted over.
export function insetRect(board, column, row, fraction, minimum) {
  const floor = Math.max(0, minimum || 0);
  const gap = Math.max(floor, Math.floor(board.cell * Math.max(0, Math.min(0.45, fraction))));
  return cellRect(board, column, row, gap);
}
