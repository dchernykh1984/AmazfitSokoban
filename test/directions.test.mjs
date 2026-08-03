import { describe, it, expect } from "vitest";
import { DIRECTIONS, DOWN, LEFT, RIGHT, UP, VECTORS, isDirection } from "../lib/directions.js";

describe("the direction table", () => {
  it("lists all four, once each", () => {
    expect(DIRECTIONS).toEqual([UP, RIGHT, DOWN, LEFT]);
    expect(VECTORS.length).toBe(DIRECTIONS.length);
  });

  it("gives each direction the step it is named after", () => {
    expect(VECTORS[UP]).toEqual({ dx: 0, dy: -1 });
    expect(VECTORS[RIGHT]).toEqual({ dx: 1, dy: 0 });
    expect(VECTORS[DOWN]).toEqual({ dx: 0, dy: 1 });
    expect(VECTORS[LEFT]).toEqual({ dx: -1, dy: 0 });
  });

  it("is laid out clockwise, so opposites are two apart", () => {
    for (const direction of DIRECTIONS) {
      const back = VECTORS[(direction + 2) % DIRECTIONS.length];
      expect(back.dx + VECTORS[direction].dx).toBe(0);
      expect(back.dy + VECTORS[direction].dy).toBe(0);
    }
  });
});

describe("isDirection", () => {
  it("accepts every direction in the table", () => {
    for (const direction of DIRECTIONS) {
      expect(isDirection(direction)).toBe(true);
    }
  });

  it("rejects everything else, including the no-direction marker", () => {
    expect(isDirection(-1)).toBe(false);
    expect(isDirection(4)).toBe(false);
    expect(isDirection(1.5)).toBe(false);
    expect(isDirection("1")).toBe(false);
    expect(isDirection(null)).toBe(false);
    expect(isDirection(undefined)).toBe(false);
    expect(isDirection(NaN)).toBe(false);
  });
});
