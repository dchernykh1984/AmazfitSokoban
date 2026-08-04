import { describe, it, expect } from "vitest";
import {
  allPlayed,
  createProgress,
  decodeProgress,
  encodeProgress,
  isPlayed,
  markPlayed,
  pickUnplayed,
  playedCount,
  progressKey,
  resetProgress,
} from "../lib/progress.js";
import { seeded } from "../lib/random.js";

describe("createProgress", () => {
  it("starts with nothing played", () => {
    const progress = createProgress(20);
    expect(progress.count).toBe(20);
    expect(playedCount(progress)).toBe(0);
    expect(allPlayed(progress)).toBe(false);
  });

  it("uses one bit per level", () => {
    expect(createProgress(8).bits.length).toBe(1);
    expect(createProgress(9).bits.length).toBe(2);
    expect(createProgress(1000).bits.length).toBe(125);
  });

  it("copes with a nonsense count", () => {
    expect(createProgress(0).count).toBe(0);
    expect(createProgress(-5).count).toBe(0);
  });
});

describe("marking a level played", () => {
  it("remembers exactly the level that was marked", () => {
    const progress = createProgress(16);
    markPlayed(progress, 5);
    expect(isPlayed(progress, 5)).toBe(true);
    expect(isPlayed(progress, 4)).toBe(false);
    expect(isPlayed(progress, 6)).toBe(false);
    expect(playedCount(progress)).toBe(1);
  });

  it("survives being marked twice", () => {
    const progress = createProgress(16);
    markPlayed(progress, 3);
    markPlayed(progress, 3);
    expect(playedCount(progress)).toBe(1);
  });

  it("ignores a level that is not in the collection", () => {
    const progress = createProgress(8);
    markPlayed(progress, 99);
    markPlayed(progress, -1);
    expect(playedCount(progress)).toBe(0);
    expect(isPlayed(progress, 99)).toBe(false);
  });

  it("knows when every one has been finished", () => {
    const progress = createProgress(5);
    for (let i = 0; i < 5; i++) {
      expect(allPlayed(progress)).toBe(false);
      markPlayed(progress, i);
    }
    expect(allPlayed(progress)).toBe(true);
    resetProgress(progress);
    expect(allPlayed(progress)).toBe(false);
  });
});

describe("pickUnplayed", () => {
  it("deals every warehouse once before repeating any", () => {
    const progress = createProgress(25);
    const random = seeded(7);
    const dealt = [];
    for (let i = 0; i < 25; i++) {
      const pick = pickUnplayed(progress, random);
      expect(pick.wrapped, "deal " + i).toBe(false);
      expect(dealt).not.toContain(pick.index);
      dealt.push(pick.index);
      markPlayed(progress, pick.index);
    }
    expect(dealt.length).toBe(25);
    expect(new Set(dealt).size).toBe(25);
  });

  it("wipes the slate and starts again once the collection is done", () => {
    const progress = createProgress(4);
    const random = seeded(2);
    for (let i = 0; i < 4; i++) {
      markPlayed(progress, pickUnplayed(progress, random).index);
    }
    expect(allPlayed(progress)).toBe(true);

    const next = pickUnplayed(progress, random);
    expect(next.wrapped).toBe(true);
    expect(playedCount(progress)).toBe(0);
    expect(next.index).toBeGreaterThanOrEqual(0);
    expect(next.index).toBeLessThan(4);
  });

  it("does not shuffle the deal into the same order every time", () => {
    const first = [];
    const second = [];
    for (const [seed, into] of [
      [1, first],
      [99, second],
    ]) {
      const progress = createProgress(30);
      const random = seeded(seed);
      for (let i = 0; i < 30; i++) {
        const pick = pickUnplayed(progress, random);
        into.push(pick.index);
        markPlayed(progress, pick.index);
      }
    }
    expect(first).not.toEqual(second);
  });

  it("never runs off the end of the collection", () => {
    const progress = createProgress(10);
    expect(pickUnplayed(progress, () => 1).index).toBe(9);
    expect(pickUnplayed(progress, () => 0).index).toBe(0);
  });

  it("hands something back for an empty collection rather than failing", () => {
    expect(pickUnplayed(createProgress(0), seeded(1))).toEqual({ index: 0, wrapped: false });
    expect(pickUnplayed(null, seeded(1))).toEqual({ index: 0, wrapped: false });
  });
});

describe("storing the record", () => {
  it("survives a round trip through storage", () => {
    const progress = createProgress(30);
    markPlayed(progress, 0);
    markPlayed(progress, 7);
    markPlayed(progress, 29);

    const back = decodeProgress(encodeProgress(progress), 30);
    expect(isPlayed(back, 0)).toBe(true);
    expect(isPlayed(back, 7)).toBe(true);
    expect(isPlayed(back, 29)).toBe(true);
    expect(playedCount(back)).toBe(3);
  });

  it("is two characters a byte", () => {
    expect(encodeProgress(createProgress(16)).length).toBe(4);
  });

  it("reads junk as nothing played rather than crashing", () => {
    expect(playedCount(decodeProgress("not hex at all", 20))).toBe(0);
    expect(playedCount(decodeProgress(undefined, 20))).toBe(0);
    expect(playedCount(decodeProgress("", 20))).toBe(0);
  });

  it("drops bits past the end when the collection has shrunk", () => {
    const big = createProgress(40);
    for (let i = 0; i < 40; i++) {
      markPlayed(big, i);
    }
    // The same record read back for a collection of only 12 levels must not be
    // stuck reporting that everything has been played.
    const small = decodeProgress(encodeProgress(big), 12);
    expect(playedCount(small)).toBe(12);
    expect(allPlayed(small)).toBe(true);
    resetProgress(small);
    expect(allPlayed(small)).toBe(false);
  });

  it("keeps a separate record per size", () => {
    expect(progressKey("xs")).not.toBe(progressKey("s"));
    expect(progressKey("xs")).toBe(progressKey("xs"));
  });
});
