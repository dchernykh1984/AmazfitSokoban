import { describe, it, expect } from "vitest";
import { LEVEL_KEY, NO_BEST, bestKey, hasBest, normalizeMoves, updateBest } from "../lib/scores.js";

describe("storage keys", () => {
  it("keeps a separate best per difficulty", () => {
    expect(bestKey(0)).not.toBe(bestKey(1));
    expect(bestKey(0)).toBe(bestKey(0));
  });

  it("remembers the chosen difficulty under its own key", () => {
    expect(LEVEL_KEY).toBeTruthy();
    expect(LEVEL_KEY).not.toBe(bestKey(0));
  });
});

describe("normalizeMoves", () => {
  it("reads a stored number, however it comes back", () => {
    expect(normalizeMoves(42)).toBe(42);
    expect(normalizeMoves("42")).toBe(42);
    expect(normalizeMoves(42.7)).toBe(42);
  });

  it("reads anything unusable as no record at all", () => {
    expect(normalizeMoves(null)).toBe(NO_BEST);
    expect(normalizeMoves(undefined)).toBe(NO_BEST);
    expect(normalizeMoves("")).toBe(NO_BEST);
    expect(normalizeMoves("junk")).toBe(NO_BEST);
    expect(normalizeMoves(-3)).toBe(NO_BEST);
  });
});

describe("hasBest", () => {
  it("is false on a fresh install and true once something is stored", () => {
    expect(hasBest(undefined)).toBe(false);
    expect(hasBest(0)).toBe(false);
    expect(hasBest(1)).toBe(true);
  });
});

describe("updateBest", () => {
  it("records the first solve, because there was nothing before it", () => {
    expect(updateBest(NO_BEST, 61)).toEqual({ best: 61, isRecord: true });
  });

  it("counts fewer moves as better", () => {
    expect(updateBest(61, 48)).toEqual({ best: 48, isRecord: true });
  });

  it("keeps the old record when the puzzle took longer", () => {
    expect(updateBest(48, 61)).toEqual({ best: 48, isRecord: false });
    expect(updateBest(48, 48)).toEqual({ best: 48, isRecord: false });
  });

  it("never announces a record for a puzzle solved in no moves", () => {
    expect(updateBest(NO_BEST, 0)).toEqual({ best: NO_BEST, isRecord: false });
  });

  it("survives junk on either side", () => {
    expect(updateBest("junk", 20)).toEqual({ best: 20, isRecord: true });
    expect(updateBest(20, "junk")).toEqual({ best: 20, isRecord: false });
  });
});
