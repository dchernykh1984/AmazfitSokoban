import { describe, it, expect } from "vitest";
import { boardLayout, cellRect, insetRect } from "../lib/board.js";

const ROUND_SIZES = [466, 480];

describe("boardLayout", () => {
  it("fits inside the square inscribed in the round screen", () => {
    for (const size of ROUND_SIZES) {
      const board = boardLayout(size, 11);
      expect(board.size).toBeLessThanOrEqual(Math.floor(size / Math.SQRT2));
    }
  });

  it("keeps every corner of the board inside the bezel", () => {
    for (const size of ROUND_SIZES) {
      for (const cells of [7, 9, 11]) {
        const board = boardLayout(size, cells);
        const radius = size / 2;
        const corners = [
          [board.x, board.y],
          [board.x + board.size, board.y],
          [board.x, board.y + board.size],
          [board.x + board.size, board.y + board.size],
        ];
        for (const [x, y] of corners) {
          const dx = x - radius;
          const dy = y - radius;
          expect(Math.sqrt(dx * dx + dy * dy), size + "/" + cells).toBeLessThanOrEqual(radius);
        }
      }
    }
  });

  it("gives every cell the same whole number of pixels", () => {
    for (const size of ROUND_SIZES) {
      for (const cells of [7, 9, 11]) {
        const board = boardLayout(size, cells);
        expect(board.cells).toBe(cells);
        expect(board.size).toBe(board.cell * cells);
        expect(Number.isInteger(board.cell)).toBe(true);
      }
    }
  });

  it("centres the board, leaving a cap above and below", () => {
    const board = boardLayout(466, 9);
    expect(board.x).toBe(board.y);
    expect(board.x).toBe(Math.round((466 - board.size) / 2));
    expect(466 - (board.y + board.size)).toBeGreaterThan(0);
  });

  it("makes the cells bigger when fewer of them are on screen", () => {
    expect(boardLayout(466, 7).cell).toBeGreaterThan(boardLayout(466, 11).cell);
  });

  it("survives a nonsense cell count rather than dividing by zero", () => {
    const board = boardLayout(466, 0);
    expect(board.cells).toBe(1);
    expect(board.cell).toBeGreaterThan(0);
  });
});

describe("cellRect", () => {
  const board = boardLayout(466, 9);

  it("places a cell in the grid", () => {
    const rect = cellRect(board, 0, 0, 0);
    expect(rect).toEqual({ x: board.x, y: board.y, w: board.cell, h: board.cell });

    const other = cellRect(board, 3, 5, 0);
    expect(other.x).toBe(board.x + 3 * board.cell);
    expect(other.y).toBe(board.y + 5 * board.cell);
  });

  it("insets on every side", () => {
    const rect = cellRect(board, 2, 2, 2);
    expect(rect.x).toBe(board.x + 2 * board.cell + 2);
    expect(rect.w).toBe(board.cell - 4);
  });

  it("never lets an inset eat the whole cell", () => {
    const rect = cellRect(board, 0, 0, 999);
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
  });

  it("ignores a negative inset", () => {
    expect(cellRect(board, 0, 0, -5)).toEqual(cellRect(board, 0, 0, 0));
  });
});

describe("insetRect", () => {
  const board = boardLayout(466, 9);

  it("shrinks a cell by a fraction of its size", () => {
    const rect = insetRect(board, 0, 0, 0.2);
    const gap = Math.floor(board.cell * 0.2);
    expect(rect.w).toBe(board.cell - 2 * gap);
  });

  it("draws a full tile for a zero fraction", () => {
    expect(insetRect(board, 1, 1, 0)).toEqual(cellRect(board, 1, 1, 0));
  });

  it("keeps the minimum inset when the fraction asks for less", () => {
    expect(insetRect(board, 1, 1, 0, 1)).toEqual(cellRect(board, 1, 1, 1));
    expect(insetRect(board, 1, 1, 0.2, 1)).toEqual(insetRect(board, 1, 1, 0.2));
  });

  it("keeps something visible however large the fraction", () => {
    const rect = insetRect(board, 0, 0, 5);
    expect(rect.w).toBeGreaterThan(0);
  });

  it("scales with the screen, so both round sizes look the same", () => {
    for (const size of ROUND_SIZES) {
      const layout = boardLayout(size, 9);
      const rect = insetRect(layout, 0, 0, 0.2);
      expect(rect.w / layout.cell).toBeGreaterThan(0.5);
      expect(rect.w / layout.cell).toBeLessThan(0.8);
    }
  });
});
