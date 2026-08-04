import { describe, it, expect } from "vitest";
import {
  DISAGREEMENT,
  KEEP,
  QUALITY,
  TOO_EASY,
  fingerprint,
  judgeLevel,
  qualityFor,
} from "../lib/collection.js";
import { generateLevel } from "../lib/generator.js";
import { parseLevel } from "../lib/level-format.js";
import { LEVELS } from "../lib/levels.js";
import { seeded } from "../lib/random.js";

describe("the quality table", () => {
  it("has an entry for every size the game ships", () => {
    for (const spec of LEVELS) {
      expect(QUALITY[spec.id], spec.id).toBeTruthy();
      expect(QUALITY[spec.id].budget, spec.id).toBeGreaterThan(0);
      expect(QUALITY[spec.id].minPushes, spec.id).toBeGreaterThan(0);
    }
  });

  it("asks more pushes of a bigger warehouse", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const smaller = QUALITY[LEVELS[i - 1].id].minPushes;
      const bigger = QUALITY[LEVELS[i].id].minPushes;
      expect(bigger, LEVELS[i].id).toBeGreaterThan(smaller);
    }
  });

  it("spends less on the sizes the solver cannot crack anyway", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const smaller = QUALITY[LEVELS[i - 1].id].budget;
      const bigger = QUALITY[LEVELS[i].id].budget;
      expect(bigger, LEVELS[i].id).toBeLessThanOrEqual(smaller);
    }
  });

  it("falls back to a sane budget for a size it does not know", () => {
    expect(qualityFor("nonsense")).toBe(QUALITY.m);
    expect(qualityFor("xs")).toBe(QUALITY.xs);
  });
});

describe("judgeLevel", () => {
  it("throws away a warehouse that falls over in a couple of pushes", () => {
    const level = parseLevel(["#####", "#@$.#", "#####"]);
    const verdict = judgeLevel(level, { budget: 10000, minPushes: 5 });
    expect(verdict.verdict).toBe(TOO_EASY);
    expect(verdict.pushes).toBe(1);
  });

  it("keeps one that needs the pushes asked for, and says how many", () => {
    const level = parseLevel(["#####", "#@$.#", "#####"]);
    const verdict = judgeLevel(level, { budget: 10000, minPushes: 1 });
    expect(verdict.verdict).toBe(KEEP);
    expect(verdict.pushes).toBe(1);
  });

  it("keeps one the solver could not crack, because easy levels always crack", () => {
    const level = generateLevel(LEVELS[5], seeded(3));
    const verdict = judgeLevel(level, { budget: 200, minPushes: 5 });
    expect(verdict.verdict).toBe(KEEP);
    expect(verdict.pushes).toBe(-1);
  });

  it("reports a disagreement rather than dropping the level quietly", () => {
    // A crate in a corner with the goal elsewhere: the solver proves there is no
    // way to finish it, which for a generated level would mean a bug.
    const level = parseLevel(["#####", "#$--#", "#-@-#", "#--.#", "#####"]);
    expect(judgeLevel(level, { budget: 10000, minPushes: 1 }).verdict).toBe(DISAGREEMENT);
  });

  it("agrees with the generator on every size it is quick enough to check", () => {
    for (const spec of [LEVELS[0], LEVELS[1]]) {
      for (let seed = 0; seed < 4; seed++) {
        const level = generateLevel(spec, seeded(seed * 131 + 9));
        const verdict = judgeLevel(level, qualityFor(spec.id));
        expect(verdict.verdict, spec.id + " seed " + seed).not.toBe(DISAGREEMENT);
      }
    }
  });
});

describe("fingerprint", () => {
  it("is the same for the same warehouse", () => {
    const level = parseLevel(["#####", "#@$.#", "#####"]);
    expect(fingerprint(level)).toBe(fingerprint(parseLevel(["#####", "#@$.#", "#####"])));
  });

  it("differs when anything about the warehouse differs", () => {
    const base = fingerprint(parseLevel(["#####", "#@$.#", "#####"]));
    expect(fingerprint(parseLevel(["#####", "#.$@#", "#####"]))).not.toBe(base);
    expect(fingerprint(parseLevel(["######", "#@$.-#", "######"]))).not.toBe(base);
  });

  it("does not care what order the goals and crates were listed in", () => {
    const level = parseLevel(["######", "#@$$.#", "#---.#", "######"]);
    const shuffled = {
      cols: level.cols,
      rows: level.rows,
      walls: level.walls,
      goals: level.goals.slice().reverse(),
      boxes: level.boxes.slice().reverse(),
      player: level.player,
    };
    expect(fingerprint(shuffled)).toBe(fingerprint(level));
  });
});
