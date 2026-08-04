import { describe, it, expect } from "vitest";
import { generateLevel } from "../lib/generator.js";
import { parseLevel } from "../lib/level-format.js";
import { LEVELS } from "../lib/levels.js";
import { EXHAUSTED, SOLVED, UNSOLVABLE, isCornerDeadlock, solve } from "../lib/solver.js";
import { createGame, isSolved, move } from "../lib/sokoban.js";
import { seeded } from "./helpers/ascii-level.mjs";

describe("isCornerDeadlock", () => {
  const level = parseLevel(["#####", "#@--#", "#-$.#", "#####"]);

  it("calls a crate wedged between two walls dead", () => {
    // The bottom-left floor cell has a wall below it and a wall to its left.
    expect(isCornerDeadlock(level, level.goals, 2 * 5 + 1)).toBe(true);
  });

  it("forgives a crate that is already home", () => {
    expect(isCornerDeadlock(level, level.goals, level.goals[0])).toBe(false);
  });

  it("leaves a crate with room to move alone", () => {
    const open = parseLevel(["#####", "#---#", "#@$.#", "#---#", "#####"]);
    expect(isCornerDeadlock(open, open.goals, 2 * 5 + 2)).toBe(false);
  });
});

describe("solve", () => {
  it("finds the one push a trivial warehouse needs", () => {
    const level = parseLevel(["#####", "#@$.#", "#####"]);
    const result = solve(level);
    expect(result.status).toBe(SOLVED);
    expect(result.pushes).toBe(1);
  });

  it("says nothing is needed when the crates are already home", () => {
    const level = parseLevel(["#####", "#@*-#", "#####"]);
    expect(solve(level)).toEqual({ status: SOLVED, pushes: 0, states: 0 });
  });

  it("counts pushes, not the walking between them", () => {
    // Up once, then right once - and the keeper has to walk around the crate in
    // between, which costs steps but not pushes.
    const level = parseLevel(["#####", "#--.#", "#-$-#", "#-@-#", "#####"]);
    const result = solve(level);
    expect(result.status).toBe(SOLVED);
    expect(result.pushes).toBe(2);
  });

  it("finds the fewest pushes when several routes work", () => {
    // Two right then one down, or one down then two right: three either way.
    const level = parseLevel(["######", "#----#", "#@$--#", "#---.#", "######"]);
    const result = solve(level);
    expect(result.status).toBe(SOLVED);
    expect(result.pushes).toBe(3);
  });

  it("will not push a crate along a wall it can never leave", () => {
    // The crate can only travel along the top row, and the goal is not on it.
    const level = parseLevel(["######", "#@$--#", "#----#", "#---.#", "######"]);
    expect(solve(level).status).toBe(UNSOLVABLE);
  });

  it("reports a warehouse that cannot be finished", () => {
    // The crate is in a corner and the goal is elsewhere.
    const level = parseLevel(["#####", "#$--#", "#-@-#", "#--.#", "#####"]);
    expect(solve(level).status).toBe(UNSOLVABLE);
  });

  it("gives up rather than running for ever when the budget is tiny", () => {
    const level = generateLevel(LEVELS[5], seeded(3));
    const result = solve(level, 50);
    expect(result.status).toBe(EXHAUSTED);
    expect(result.states).toBeGreaterThan(50);
  });

  it("never claims fewer pushes than a real solution uses", () => {
    for (const spec of [LEVELS[0]]) {
      for (let seed = 0; seed < 5; seed++) {
        const level = generateLevel(spec, seeded(seed * 31 + 7));
        const result = solve(level, 120000);
        if (result.status !== SOLVED) {
          continue;
        }

        // The generator's own certificate is a valid solution, so the optimum
        // can never be longer than it.
        const game = createGame(level);
        for (const direction of level.solution) {
          move(game, direction);
        }
        expect(isSolved(game)).toBe(true);
        expect(result.pushes, spec.id + " seed " + seed).toBeLessThanOrEqual(game.pushes);
        expect(result.pushes, spec.id + " seed " + seed).toBeGreaterThan(0);
      }
    }
  });

  it("always finishes, one way or the other, inside its budget", () => {
    for (const spec of [LEVELS[0], LEVELS[1]]) {
      for (let seed = 0; seed < 3; seed++) {
        const level = generateLevel(spec, seeded(seed * 977 + 5));
        const result = solve(level, 20000);
        expect([SOLVED, EXHAUSTED, UNSOLVABLE], spec.id).toContain(result.status);
        expect(result.states, spec.id).toBeLessThanOrEqual(20001);
      }
    }
  });
});
