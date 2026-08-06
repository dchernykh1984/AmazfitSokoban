import { describe, it, expect } from "vitest";
import { boardLayout } from "../lib/board.js";
import {
  cellBox,
  cellFromPoint,
  centerCamera,
  centerOffset,
  clampOffset,
  createCamera,
  followCamera,
  followOffset,
  maxOffset,
  panCamera,
  panOffset,
  visibleCells,
} from "../lib/viewport.js";

const CELL = 30;

describe("maxOffset", () => {
  it("is how much of the warehouse hangs off the window", () => {
    expect(maxOffset(19, 11, CELL)).toBe(8 * CELL);
  });

  it("is nothing when the whole warehouse fits", () => {
    expect(maxOffset(9, 9, CELL)).toBe(0);
    expect(maxOffset(5, 11, CELL)).toBe(0);
  });
});

describe("clampOffset", () => {
  it("keeps the map inside the board", () => {
    expect(clampOffset(0, 19, 11, CELL)).toBe(0);
    expect(clampOffset(100, 19, 11, CELL)).toBe(100);
    expect(clampOffset(9999, 19, 11, CELL)).toBe(8 * CELL);
    expect(clampOffset(-50, 19, 11, CELL)).toBe(0);
  });

  it("pins a warehouse that fits on screen", () => {
    expect(clampOffset(120, 9, 9, CELL)).toBe(0);
  });

  it("survives nonsense", () => {
    expect(clampOffset(NaN, 19, 11, CELL)).toBe(0);
    expect(clampOffset(Infinity, 19, 11, CELL)).toBe(8 * CELL);
  });
});

describe("centerOffset", () => {
  it("puts the cell in the middle of the window", () => {
    // Cell 9 centred in an 11-cell window: 9.5 cells in, less 5.5 windows out.
    expect(centerOffset(9, 19, 11, CELL)).toBe(4 * CELL);
  });

  it("stops at the edges rather than showing nothing", () => {
    expect(centerOffset(0, 19, 11, CELL)).toBe(0);
    expect(centerOffset(18, 19, 11, CELL)).toBe(8 * CELL);
  });
});

describe("followOffset", () => {
  it("leaves the map alone while the keeper is comfortably inside", () => {
    const offset = 4 * CELL;
    expect(followOffset(offset, 9, 19, 11, CELL, 2)).toBe(offset);
  });

  it("scrolls just far enough when the keeper nears an edge", () => {
    const offset = 4 * CELL;
    // Cell 5 is only one cell from the left edge of the window; with a margin
    // of two the map has to come back by one cell.
    expect(followOffset(offset, 5, 19, 11, CELL, 2)).toBe(3 * CELL);
    expect(followOffset(offset, 13, 19, 11, CELL, 2)).toBe(5 * CELL);
  });

  it("does not scroll past the board", () => {
    expect(followOffset(0, 0, 19, 11, CELL, 2)).toBe(0);
    expect(followOffset(8 * CELL, 18, 19, 11, CELL, 2)).toBe(8 * CELL);
  });

  it("shrinks a margin too big for the window instead of jittering", () => {
    expect(followOffset(0, 1, 19, 3, CELL, 9)).toBe(0);
    expect(followOffset(0, 2, 19, 3, CELL, 9)).toBe(CELL);
  });
});

describe("panOffset", () => {
  it("moves the map with the finger, pixel for pixel", () => {
    expect(panOffset(150, 20, 19, 11, CELL)).toBe(130);
    expect(panOffset(150, -20, 19, 11, CELL)).toBe(170);
  });

  it("follows even a drag shorter than a cell", () => {
    expect(panOffset(150, 3, 19, 11, CELL)).toBe(147);
  });

  it("stops at the edge of the warehouse", () => {
    expect(panOffset(150, 9999, 19, 11, CELL)).toBe(0);
    expect(panOffset(150, -9999, 19, 11, CELL)).toBe(8 * CELL);
  });
});

describe("the camera", () => {
  it("starts at the top-left corner of the board", () => {
    expect(createCamera(19, 19, 11, CELL)).toEqual({
      cols: 19,
      rows: 19,
      visible: 11,
      cell: CELL,
      x: 0,
      y: 0,
    });
  });

  it("centres on a cell in both axes", () => {
    const camera = centerCamera(createCamera(19, 19, 11, CELL), 9, 2);
    expect(camera.x).toBe(4 * CELL);
    expect(camera.y).toBe(0);
  });

  it("follows the keeper towards an edge", () => {
    const camera = centerCamera(createCamera(19, 19, 11, CELL), 9, 9);
    followCamera(camera, 9, 14, 2);
    expect(camera.x).toBe(4 * CELL);
    expect(camera.y).toBe(6 * CELL);
  });

  it("pans from where the drag started, not from where it is now", () => {
    const camera = createCamera(19, 19, 11, CELL);
    const start = { x: 120, y: 120 };
    panCamera(camera, start, -30, 15);
    expect(camera.x).toBe(150);
    expect(camera.y).toBe(105);
    panCamera(camera, start, -45, 15);
    expect(camera.x).toBe(165);
    expect(camera.y).toBe(105);
  });
});

describe("visibleCells", () => {
  // Eleven cells fit the window, so an aligned map shows cells 0 to 10. Column
  // 11 begins exactly where the window ends: taking it as well would draw a
  // whole column outside the board, and nothing on this canvas clips it.
  it("covers the whole window when the map is aligned", () => {
    const camera = createCamera(19, 19, 11, CELL);
    expect(visibleCells(camera)).toEqual({ fromX: 0, toX: 10, fromY: 0, toY: 10 });
  });

  it("never hands back a cell with no pixel in the window", () => {
    const camera = createCamera(19, 19, 11, CELL);
    for (const offset of [0, 1, 7, CELL - 1, CELL, CELL * 3 + 11, CELL * 8]) {
      camera.x = offset;
      camera.y = offset;
      const range = visibleCells(camera);
      const window = camera.visible * camera.cell;

      expect(range.fromX * CELL, "left at " + offset).toBeLessThan(camera.x + window);
      expect((range.toX + 1) * CELL, "right at " + offset).toBeGreaterThan(camera.x);
      // The cell after the last one drawn starts at or past the window's end.
      expect((range.toX + 1) * CELL, "past the right edge at " + offset).toBeLessThanOrEqual(
        camera.x + window + CELL - 1
      );
    }
  });

  it("includes the row that is only half on screen", () => {
    const camera = createCamera(19, 19, 11, CELL);
    camera.x = CELL + 5;
    const range = visibleCells(camera);
    expect(range.fromX).toBe(1);
    expect(range.toX).toBeGreaterThanOrEqual(12);
  });

  it("never runs off the board", () => {
    const camera = createCamera(12, 12, 11, CELL);
    camera.x = maxOffset(12, 11, CELL);
    const range = visibleCells(camera);
    expect(range.toX).toBe(11);
    expect(range.fromX).toBeGreaterThanOrEqual(0);
  });
});

describe("cellBox", () => {
  const board = boardLayout(466, 11);

  it("puts the first cell at the board corner when the map is home", () => {
    const camera = createCamera(19, 19, 11, board.cell);
    expect(cellBox(camera, board, 0, 0)).toEqual({
      x: board.x,
      y: board.y,
      w: board.cell,
      h: board.cell,
    });
  });

  it("slides every cell by the pixel offset", () => {
    const camera = createCamera(19, 19, 11, board.cell);
    camera.x = 7;
    camera.y = 3;
    const cell = cellBox(camera, board, 2, 1);
    expect(cell.x).toBe(board.x + 2 * board.cell - 7);
    expect(cell.y).toBe(board.y + board.cell - 3);
  });
});

describe("cellFromPoint", () => {
  const board = boardLayout(466, 11);
  const camera = createCamera(19, 19, 11, board.cell);

  it("maps a point in the window to the cell under it", () => {
    camera.x = 0;
    camera.y = 0;
    expect(cellFromPoint(camera, board, board.x + 1, board.y + 1)).toEqual({ x: 0, y: 0 });
    expect(
      cellFromPoint(camera, board, board.x + board.cell * 3 + 2, board.y + board.cell * 4 + 2)
    ).toEqual({ x: 3, y: 4 });
  });

  it("accounts for a map that has been dragged", () => {
    camera.x = 2 * board.cell;
    camera.y = board.cell;
    expect(cellFromPoint(camera, board, board.x + 1, board.y + 1)).toEqual({ x: 2, y: 1 });
  });

  it("returns nothing for the caps above and below the board", () => {
    camera.x = 0;
    camera.y = 0;
    expect(cellFromPoint(camera, board, board.x + 1, board.y - 1)).toBeNull();
    expect(cellFromPoint(camera, board, board.x + 1, board.y + board.size + 1)).toBeNull();
    expect(cellFromPoint(camera, board, board.x - 1, board.y + 1)).toBeNull();
    expect(cellFromPoint(camera, board, board.x + board.size + 1, board.y + 1)).toBeNull();
  });
});
