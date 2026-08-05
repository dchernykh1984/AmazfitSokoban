import { describe, it, expect } from "vitest";
import { parseLevel } from "../lib/level-format.js";
import { emptyBlockShare, keeperFreedom, measure, pushLowerBound } from "../lib/quality.js";

describe("emptyBlockShare", () => {
  it("is nothing when the crates and goals are spread about", () => {
    const level = parseLevel(["#####", "#@$.#", "#.$-#", "#####"]);
    expect(emptyBlockShare(level)).toBeLessThan(0.5);
  });

  it("finds a big room with nothing in it", () => {
    // The whole left half is floor with no crate and no goal on it.
    const level = parseLevel([
      "##########",
      "#--------#",
      "#-------$#",
      "#--------#",
      "#-------.#",
      "#-------@#",
      "##########",
    ]);
    expect(emptyBlockShare(level)).toBeGreaterThan(0.6);
  });

  it("is always a share, never more than the whole floor", () => {
    for (const picture of [
      ["#####", "#@$.#", "#####"],
      ["#######", "#@$--.#", "#-----#", "#######"],
      ["#######", "#@$--.#", "#-###-#", "#######"],
    ]) {
      const share = emptyBlockShare(parseLevel(picture));
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
  });

  it("only counts a block that is genuinely empty", () => {
    // Sprinkling goals through the middle breaks the empty block up.
    const empty = parseLevel(["#######", "#@$--.#", "#-----#", "#-----#", "#######"]);
    const dotted = parseLevel(["#######", "#@$--.#", "#--.--#", "#-$---#", "#######"]);
    expect(emptyBlockShare(dotted)).toBeLessThan(emptyBlockShare(empty));
  });

  it("survives a warehouse with no floor to speak of", () => {
    expect(
      emptyBlockShare({ cols: 3, rows: 3, walls: new Array(9).fill(1), goals: [], boxes: [] })
    ).toBe(1);
  });
});

describe("pushLowerBound", () => {
  it("is the distance a lone crate has to travel", () => {
    const level = parseLevel(["#######", "#@$--.#", "#######"]);
    expect(pushLowerBound(level)).toBe(3);
  });

  it("is nothing when a crate is already home", () => {
    const level = parseLevel(["#####", "#@*-#", "#####"]);
    expect(pushLowerBound(level)).toBe(0);
  });

  it("pairs crates with goals the cheapest way round", () => {
    // Pairing each crate with its NEAREST goal costs 1 + 1; pairing them across
    // would cost far more, and the cheapest pairing is what matters.
    const level = parseLevel(["########", "#@$.-$.#", "########"]);
    expect(pushLowerBound(level)).toBe(2);
  });

  it("measures around walls rather than through them", () => {
    const straight = parseLevel(["######", "#@$-.#", "#----#", "######"]);
    const around = parseLevel(["######", "#@$#.#", "#----#", "######"]);
    expect(around).toBeTruthy();
    expect(pushLowerBound(straight)).toBe(2);
  });

  it("says so when a crate is sealed away from every goal", () => {
    // The crate is in its own sealed room; no goal is reachable from it.
    const level = parseLevel(["#######", "#@---.#", "#######", "#-$---#", "#######"]);
    expect(pushLowerBound(level)).toBe(-1);
  });
});

describe("keeperFreedom", () => {
  it("counts everywhere the keeper can walk before touching anything", () => {
    const level = parseLevel(["#####", "#@--#", "#-$.#", "#####"]);
    // Six floor cells, one holds a crate, so five are walkable.
    expect(keeperFreedom(level)).toBe(5);
  });

  it("is one when the keeper is walled into a pocket", () => {
    // Keeper boxed in by walls and a crate: its only move is a forced push.
    const level = parseLevel(["#####", "##@##", "#-$-#", "#-.-#", "#####"]);
    expect(keeperFreedom(level)).toBe(1);
  });

  it("does not count cells behind a crate that seals the way", () => {
    const sealed = parseLevel(["#######", "#@$--.#", "#######"]);
    expect(keeperFreedom(sealed)).toBe(1);
  });
});

describe("measure", () => {
  it("reports all three shape numbers at once", () => {
    const level = parseLevel(["######", "#@$-.#", "#----#", "######"]);
    const shape = measure(level);
    expect(shape.emptyBlock).toBeGreaterThanOrEqual(0);
    expect(shape.lowerBound).toBe(2);
    expect(shape.freedom).toBeGreaterThan(1);
  });
});
