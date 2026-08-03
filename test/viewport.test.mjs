import { describe, it, expect } from "vitest";
import { boardLayout } from "../lib/board.js";
import {
  cellFromPoint,
  centerCamera,
  centerOrigin,
  clampOrigin,
  createCamera,
  followCamera,
  followOrigin,
  panCamera,
  panOrigin,
} from "../lib/viewport.js";

describe("clampOrigin", () => {
  it("keeps the window inside the board", () => {
    expect(clampOrigin(0, 13, 11)).toBe(0);
    expect(clampOrigin(2, 13, 11)).toBe(2);
    expect(clampOrigin(5, 13, 11)).toBe(2);
    expect(clampOrigin(-4, 13, 11)).toBe(0);
  });

  it("pins a board that is smaller than the window", () => {
    expect(clampOrigin(3, 7, 7)).toBe(0);
    expect(clampOrigin(3, 5, 9)).toBe(0);
  });

  it("survives nonsense", () => {
    expect(clampOrigin(NaN, 13, 11)).toBe(0);
    expect(clampOrigin(Infinity, 13, 11)).toBe(2);
  });
});

describe("centerOrigin", () => {
  it("puts the cell in the middle of the window", () => {
    expect(centerOrigin(6, 13, 5)).toBe(4);
  });

  it("stops at the edges rather than showing nothing", () => {
    expect(centerOrigin(0, 13, 5)).toBe(0);
    expect(centerOrigin(12, 13, 5)).toBe(8);
  });
});

describe("followOrigin", () => {
  it("leaves the map alone while the cell is comfortably inside", () => {
    expect(followOrigin(4, 6, 13, 5, 1)).toBe(4);
  });

  it("scrolls just far enough when the cell nears an edge", () => {
    expect(followOrigin(4, 4, 13, 5, 1)).toBe(3);
    expect(followOrigin(4, 8, 13, 5, 1)).toBe(5);
  });

  it("does not scroll past the board", () => {
    expect(followOrigin(0, 0, 13, 5, 1)).toBe(0);
    expect(followOrigin(8, 12, 13, 5, 1)).toBe(8);
  });

  it("shrinks a margin too big for the window instead of jittering", () => {
    expect(followOrigin(0, 1, 13, 3, 9)).toBe(0);
    expect(followOrigin(0, 2, 13, 3, 9)).toBe(1);
  });
});

describe("panOrigin", () => {
  it("moves the map with the finger", () => {
    // Dragging right shows the cells further left, so the origin comes down.
    expect(panOrigin(5, 60, 30, 20, 10)).toBe(3);
    expect(panOrigin(5, -60, 30, 20, 10)).toBe(7);
  });

  it("ignores a drag shorter than half a cell", () => {
    expect(panOrigin(5, 14, 30, 20, 10)).toBe(5);
  });

  it("stops at the edge of the board", () => {
    expect(panOrigin(5, 6000, 30, 20, 10)).toBe(0);
    expect(panOrigin(5, -6000, 30, 20, 10)).toBe(10);
  });

  it("treats a zero cell size as one pixel rather than dividing by it", () => {
    expect(Number.isFinite(panOrigin(5, 60, 0, 20, 10))).toBe(true);
  });
});

describe("the camera", () => {
  it("starts at the top-left corner of the board", () => {
    const camera = createCamera(13, 13, 11);
    expect(camera).toEqual({ cols: 13, rows: 13, visible: 11, x: 0, y: 0 });
  });

  it("centres on a cell in both axes", () => {
    const camera = centerCamera(createCamera(13, 13, 5), 6, 2);
    expect(camera.x).toBe(4);
    expect(camera.y).toBe(0);
  });

  it("follows the keeper towards an edge", () => {
    const camera = centerCamera(createCamera(13, 13, 5), 6, 6);
    followCamera(camera, 6, 9, 1);
    expect(camera.x).toBe(4);
    expect(camera.y).toBe(6);
  });

  it("pans from where the drag started, not from where it is now", () => {
    const camera = createCamera(20, 20, 10);
    const start = { x: 5, y: 5 };
    panCamera(camera, start, -60, 30, 30);
    expect(camera.x).toBe(7);
    expect(camera.y).toBe(4);
    panCamera(camera, start, -90, 30, 30);
    expect(camera.x).toBe(8);
    expect(camera.y).toBe(4);
  });
});

describe("cellFromPoint", () => {
  const board = boardLayout(466, 9);
  const camera = createCamera(13, 13, 9);
  camera.x = 2;
  camera.y = 3;

  it("maps a point in the window to the board cell under it", () => {
    const first = cellFromPoint(camera, board, board.x + 1, board.y + 1);
    expect(first).toEqual({ x: 2, y: 3 });

    const middle = cellFromPoint(
      camera,
      board,
      board.x + board.cell * 4 + 2,
      board.y + board.cell * 5 + 2
    );
    expect(middle).toEqual({ x: 6, y: 8 });
  });

  it("returns nothing for the caps above and below the board", () => {
    expect(cellFromPoint(camera, board, board.x + 1, board.y - 1)).toBeNull();
    expect(cellFromPoint(camera, board, board.x + 1, board.y + board.size + 1)).toBeNull();
    expect(cellFromPoint(camera, board, board.x - 1, board.y + 1)).toBeNull();
    expect(cellFromPoint(camera, board, board.x + board.size + 1, board.y + 1)).toBeNull();
  });
});
