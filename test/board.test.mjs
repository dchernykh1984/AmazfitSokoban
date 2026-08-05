import { describe, it, expect } from "vitest";
import { boardLayout } from "../lib/board.js";

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
