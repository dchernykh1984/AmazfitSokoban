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
