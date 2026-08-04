import { describe, it, expect } from "vitest";
import { DEFAULT_LEVEL, LEVELS, clampLevel, levelSpec, nextLevel } from "../lib/levels.js";
import { UI_KEYS } from "../lib/i18n/keys.js";

describe("the size table", () => {
  it("offers six sizes, smallest first", () => {
    expect(LEVELS.map((level) => level.id)).toEqual(["xs", "s", "m", "l", "xl", "xxl"]);
  });

  it("grows the warehouse with the difficulty", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].cols).toBeGreaterThan(LEVELS[i - 1].cols);
      expect(LEVELS[i].boxes).toBeGreaterThanOrEqual(LEVELS[i - 1].boxes);
      expect(LEVELS[i].minPulls).toBeGreaterThan(LEVELS[i - 1].minPulls);
    }
  });

  it("describes a warehouse the generator can actually fill", () => {
    for (const level of LEVELS) {
      expect(level.rows).toBe(level.cols);
      expect(level.cols).toBeGreaterThanOrEqual(5);
      expect(level.boxes).toBeGreaterThanOrEqual(1);
      const interior = (level.cols - 2) * (level.rows - 2);
      expect(level.blocks).toBeLessThan(interior);
      expect(level.boxes).toBeLessThan(interior - level.blocks);
      expect(level.pulls).toBeGreaterThan(level.minPulls);
    }
  });

  it("shows the two smallest whole and pans the rest", () => {
    expect(LEVELS[0].visible).toBe(LEVELS[0].cols);
    expect(LEVELS[1].visible).toBe(LEVELS[1].cols);
    for (let i = 2; i < LEVELS.length; i++) {
      expect(LEVELS[i].visible, LEVELS[i].id).toBeLessThan(LEVELS[i].cols);
    }
  });

  it("never shows more cells than the window it was tuned for", () => {
    for (const level of LEVELS) {
      expect(level.visible, level.id).toBeLessThanOrEqual(11);
    }
  });

  it("packs the bigger warehouses tighter, so they are not empty halls", () => {
    let previous = 0;
    for (const level of LEVELS) {
      const density = level.blocks / ((level.cols - 2) * (level.rows - 2));
      expect(density, level.id).toBeGreaterThanOrEqual(previous - 0.01);
      expect(density, level.id).toBeLessThan(0.4);
      previous = density;
    }
  });

  it("names every size with a key the screen can translate", () => {
    for (const level of LEVELS) {
      expect(UI_KEYS).toContain(level.label);
    }
  });
});

describe("clampLevel", () => {
  it("passes a level in range through", () => {
    expect(clampLevel(0)).toBe(0);
    expect(clampLevel(LEVELS.length - 1)).toBe(LEVELS.length - 1);
    expect(clampLevel("2")).toBe(2);
  });

  it("falls back to the default for anything unusable", () => {
    expect(clampLevel(null)).toBe(DEFAULT_LEVEL);
    expect(clampLevel(undefined)).toBe(DEFAULT_LEVEL);
    expect(clampLevel("")).toBe(DEFAULT_LEVEL);
    expect(clampLevel("nonsense")).toBe(DEFAULT_LEVEL);
    expect(clampLevel(-1)).toBe(DEFAULT_LEVEL);
    expect(clampLevel(LEVELS.length)).toBe(DEFAULT_LEVEL);
  });
});

describe("nextLevel", () => {
  it("walks through every difficulty and wraps", () => {
    let level = 0;
    const seen = [];
    for (let i = 0; i < LEVELS.length; i++) {
      seen.push(level);
      level = nextLevel(level);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    expect(level).toBe(0);
  });

  it("starts from the default when the stored level is junk", () => {
    expect(nextLevel("nonsense")).toBe(nextLevel(DEFAULT_LEVEL));
  });
});

describe("levelSpec", () => {
  it("hands back the spec for a level", () => {
    expect(levelSpec(1)).toBe(LEVELS[1]);
    expect(levelSpec(99)).toBe(LEVELS[DEFAULT_LEVEL]);
  });
});
