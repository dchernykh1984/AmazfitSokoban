// The camera: which part of the warehouse the round window is showing.
//
// The offset is in PIXELS, not cells. With the board drawn on a canvas the map
// can follow a finger exactly instead of jumping a whole cell at a time, and a
// pixel offset is the only thing that makes that possible. Cells only come back
// at the edges, where the camera has to be told to keep the keeper in view.
//
// A camera is `{ cols, rows, visible, cell, x, y }`, where (x, y) is how many
// pixels of the warehouse are hidden off the left and top of the window.
// Everything below keeps that inside the board, so the map can never be dragged
// off into empty space.

// The furthest the map can be pushed before the far edge would come into view.
// Zero when the whole warehouse fits, which pins a small board in place.
export function maxOffset(span, visible, cell) {
  return Math.max(0, (span - visible) * cell);
}

export function clampOffset(value, span, visible, cell) {
  const limit = maxOffset(span, visible, cell);
  const offset = Math.round(value);
  if (Number.isNaN(offset) || offset < 0) {
    return 0;
  }
  return offset > limit ? limit : offset;
}

// The offset that puts a cell in the middle of the window.
export function centerOffset(coord, span, visible, cell) {
  const wanted = (Math.round(coord) + 0.5) * cell - (visible * cell) / 2;
  return clampOffset(wanted, span, visible, cell);
}

// The smallest change that keeps a cell at least `margin` cells from both edges
// of the window. Used after every step so the keeper walking towards the edge
// drags the map along, the way a navigator scrolls ahead of you, while a map you
// deliberately dragged elsewhere is left where you put it.
export function followOffset(current, coord, span, visible, cell, margin) {
  const room = Math.max(0, Math.min(margin, Math.floor((visible - 1) / 2)));
  const offset = clampOffset(current, span, visible, cell);
  const cellAt = Math.round(coord) * cell;

  const nearest = offset + room * cell;
  const furthest = offset + (visible - 1 - room) * cell;

  if (cellAt < nearest) {
    return clampOffset(cellAt - room * cell, span, visible, cell);
  }
  if (cellAt > furthest) {
    return clampOffset(cellAt - (visible - 1 - room) * cell, span, visible, cell);
  }
  return offset;
}

// The offset after dragging the map by `delta` pixels from where the finger went
// down. The map follows the finger, so dragging right shows what was off to the
// left - the offset moves the other way.
export function panOffset(start, delta, span, visible, cell) {
  return clampOffset(start - delta, span, visible, cell);
}

export function createCamera(cols, rows, visible, cell) {
  const window = Math.max(1, Math.floor(visible));
  return { cols, rows, visible: window, cell, x: 0, y: 0 };
}

export function centerCamera(camera, x, y) {
  camera.x = centerOffset(x, camera.cols, camera.visible, camera.cell);
  camera.y = centerOffset(y, camera.rows, camera.visible, camera.cell);
  return camera;
}

export function followCamera(camera, x, y, margin) {
  camera.x = followOffset(camera.x, x, camera.cols, camera.visible, camera.cell, margin);
  camera.y = followOffset(camera.y, y, camera.rows, camera.visible, camera.cell, margin);
  return camera;
}

export function panCamera(camera, start, deltaX, deltaY) {
  camera.x = panOffset(start.x, deltaX, camera.cols, camera.visible, camera.cell);
  camera.y = panOffset(start.y, deltaY, camera.rows, camera.visible, camera.cell);
  return camera;
}

// Which cells have any pixel inside the window. A pixel offset means a row can
// be half on screen, so a cell that only just reaches into the window counts.
//
// The last pixel of the window is what the range is measured against, not the
// one past it: measuring past the end adds a whole column that is entirely
// outside the window, and nothing clips it - the canvas is the whole screen, so
// that column lands on the arrows and over the edge of a round watch face.
export function visibleCells(camera) {
  const first = Math.floor(camera.x / camera.cell);
  const last = Math.floor((camera.x + camera.visible * camera.cell - 1) / camera.cell);
  const firstRow = Math.floor(camera.y / camera.cell);
  const lastRow = Math.floor((camera.y + camera.visible * camera.cell - 1) / camera.cell);
  return {
    fromX: Math.max(0, first),
    toX: Math.min(camera.cols - 1, last),
    fromY: Math.max(0, firstRow),
    toY: Math.min(camera.rows - 1, lastRow),
  };
}

// Where a board cell lands on screen, in pixels, given where the camera is.
export function cellBox(camera, board, column, row) {
  return {
    x: board.x + column * camera.cell - camera.x,
    y: board.y + row * camera.cell - camera.y,
    w: camera.cell,
    h: camera.cell,
  };
}

// The board cell under a screen point, or null when the point is outside the
// window - which is how a touch on a button in the cap above or below the board
// is ignored by the game.
export function cellFromPoint(camera, board, px, py) {
  if (px < board.x || py < board.y || px >= board.x + board.size || py >= board.y + board.size) {
    return null;
  }
  const x = Math.floor((px - board.x + camera.x) / camera.cell);
  const y = Math.floor((py - board.y + camera.y) / camera.cell);
  if (x < 0 || y < 0 || x >= camera.cols || y >= camera.rows) {
    return null;
  }
  return { x, y };
}
