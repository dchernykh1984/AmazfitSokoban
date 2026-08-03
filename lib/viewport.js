// The camera: which part of the warehouse the round window is showing. Pure
// integer maths in cells, so panning, centring and hit-testing are unit tested
// rather than felt out on a watch.
//
// A camera is `{ cols, rows, visible, x, y }`, where (x, y) is the board cell in
// the top-left slot of the window. Everything below keeps that origin inside the
// board: a board smaller than the window is pinned at zero, so the map can never
// be dragged off into empty space.

export function clampOrigin(origin, span, visible) {
  const limit = span - visible;
  if (limit <= 0) {
    return 0;
  }
  const value = Math.round(origin);
  if (Number.isNaN(value) || value < 0) {
    return 0;
  }
  return value > limit ? limit : value;
}

// The origin that puts a cell in the middle of the window, clamped to the board.
export function centerOrigin(coord, span, visible) {
  return clampOrigin(Math.round(coord) - Math.floor(visible / 2), span, visible);
}

// The smallest change to the origin that keeps a cell at least `margin` cells
// away from both edges of the window. Used after every step so the keeper walking
// towards the edge drags the map along, the way a navigator scrolls ahead of you,
// while a map you deliberately dragged elsewhere is left alone.
export function followOrigin(origin, coord, span, visible, margin) {
  const room = Math.max(0, Math.min(margin, Math.floor((visible - 1) / 2)));
  const start = clampOrigin(origin, span, visible);
  const cell = Math.round(coord);
  if (cell - start < room) {
    return clampOrigin(cell - room, span, visible);
  }
  if (start + visible - 1 - cell < room) {
    return clampOrigin(cell - visible + 1 + room, span, visible);
  }
  return start;
}

// The origin after dragging the map by `deltaPx` from where the finger went down.
// The map follows the finger, so dragging right (a positive delta) shows cells
// further left - the origin moves the other way.
export function panOrigin(startOrigin, deltaPx, cell, span, visible) {
  const size = Math.max(1, cell);
  return clampOrigin(startOrigin - Math.round(deltaPx / size), span, visible);
}

export function createCamera(cols, rows, visible) {
  const window = Math.max(1, Math.floor(visible));
  return { cols, rows, visible: window, x: 0, y: 0 };
}

export function centerCamera(camera, x, y) {
  camera.x = centerOrigin(x, camera.cols, camera.visible);
  camera.y = centerOrigin(y, camera.rows, camera.visible);
  return camera;
}

export function followCamera(camera, x, y, margin) {
  camera.x = followOrigin(camera.x, x, camera.cols, camera.visible, margin);
  camera.y = followOrigin(camera.y, y, camera.rows, camera.visible, margin);
  return camera;
}

export function panCamera(camera, start, deltaX, deltaY, cell) {
  camera.x = panOrigin(start.x, deltaX, cell, camera.cols, camera.visible);
  camera.y = panOrigin(start.y, deltaY, cell, camera.rows, camera.visible);
  return camera;
}

// The board cell under a screen point, or null when the point is outside the
// window - which is how a tap on a button in the cap above or below the board is
// ignored by the game even if the tap also reaches the background.
export function cellFromPoint(camera, board, px, py) {
  const column = Math.floor((px - board.x) / board.cell);
  const row = Math.floor((py - board.y) / board.cell);
  if (column < 0 || row < 0 || column >= board.cells || row >= board.cells) {
    return null;
  }
  return { x: camera.x + column, y: camera.y + row };
}
