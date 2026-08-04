import { describe, it, expect } from "vitest";
import { DIRECTIONS, VECTORS } from "../lib/directions.js";
import {
  buildSolution,
  carveWalls,
  coverage,
  sectorOf,
  spreadGoals,
  workingArea,
  directionBetween,
  findPath,
  floorCells,
  generateLevel,
  isFloorConnected,
  pullableCells,
  walkableFrom,
} from "../lib/generator.js";
import { LEVELS } from "../lib/levels.js";
import { createGame, isSolved, isWall, move } from "../lib/sokoban.js";
import { parseLevel, parseShape, seeded } from "./helpers/ascii-level.mjs";

// Enough seeds that a rule which only breaks on an awkward layout still shows up,
// while the whole file stays well under a second.
const SEEDS = 24;

describe("carveWalls", () => {
  it("keeps a solid border and an open interior", () => {
    const cols = 9;
    const rows = 9;
    const walls = carveWalls(cols, rows, 0, seeded(1));
    const shape = { cols, rows, walls };
    for (let x = 0; x < cols; x++) {
      expect(isWall(shape, x, 0)).toBe(true);
      expect(isWall(shape, x, rows - 1)).toBe(true);
    }
    for (let y = 0; y < rows; y++) {
      expect(isWall(shape, 0, y)).toBe(true);
      expect(isWall(shape, cols - 1, y)).toBe(true);
    }
    expect(floorCells(shape).length).toBe((cols - 2) * (rows - 2));
  });

  it("never breaks the floor into pieces, whatever the seed", () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const walls = carveWalls(11, 11, 20, seeded(seed));
      expect(isFloorConnected({ cols: 11, rows: 11, walls }), "seed " + seed).toBe(true);
    }
  });

  it("leaves room to play in rather than filling the interior", () => {
    const walls = carveWalls(9, 9, 999, seeded(7));
    const shape = { cols: 9, rows: 9, walls };
    expect(floorCells(shape).length).toBeGreaterThanOrEqual(Math.floor(49 * 0.6));
  });

  it("is repeatable for the same seed", () => {
    expect(carveWalls(11, 11, 12, seeded(42))).toEqual(carveWalls(11, 11, 12, seeded(42)));
  });
});

describe("isFloorConnected", () => {
  it("spots a walled-off pocket", () => {
    expect(isFloorConnected(parseShape(["#####", "#-#-#", "#####"]))).toBe(false);
    expect(isFloorConnected(parseShape(["#####", "#---#", "#####"]))).toBe(true);
  });

  it("calls a solid block disconnected rather than connected", () => {
    expect(isFloorConnected(parseShape(["###", "###"]))).toBe(false);
  });
});

describe("walkableFrom", () => {
  it("stops at walls and at boxes", () => {
    const level = parseLevel(["#####", "#@$-#", "#####"]);
    const seen = walkableFrom(level, level.boxes, level.player);
    expect(seen[level.player]).toBe(true);
    expect(seen[level.boxes[0]]).toBe(false);
    expect(seen[level.boxes[0] + 1]).toBe(false);
  });

  it("reaches around a box when there is a way around", () => {
    const level = parseLevel(["#####", "#@$-#", "#---#", "#####"]);
    const seen = walkableFrom(level, level.boxes, level.player);
    expect(seen[level.boxes[0] + 1]).toBe(true);
  });

  it("returns nothing at all when the start is blocked", () => {
    const level = parseLevel(["###", "#@#", "###"]);
    const seen = walkableFrom(level, [level.player], level.player);
    expect(seen.indexOf(true)).toBe(-1);
  });
});

describe("findPath", () => {
  it("finds a walk and reports it as directions", () => {
    const level = parseLevel(["####", "#@-#", "#--#", "####"]);
    const target = level.player + level.cols + 1;
    const path = findPath(level, [], level.player, target);
    expect(path).not.toBeNull();
    expect(path.length).toBe(2);

    let at = level.player;
    for (const direction of path) {
      const vector = VECTORS[direction];
      at += vector.dy * level.cols + vector.dx;
    }
    expect(at).toBe(target);
  });

  it("is empty when there is nowhere to go", () => {
    const level = parseLevel(["###", "#@#", "###"]);
    expect(findPath(level, [], level.player, level.player)).toEqual([]);
  });

  it("gives up when a box seals the only way through", () => {
    const level = parseLevel(["#####", "#@$-#", "#####"]);
    expect(findPath(level, level.boxes, level.player, level.boxes[0] + 1)).toBeNull();
  });
});

describe("directionBetween", () => {
  it("names the step between two neighbours", () => {
    const level = parseLevel(["###", "#@#", "#-#", "###"]);
    const below = level.player + level.cols;
    expect(directionBetween(level, level.player, below)).toBe(DIRECTIONS[2]);
    expect(directionBetween(level, below, level.player)).toBe(DIRECTIONS[0]);
  });

  it("refuses cells that are not neighbours", () => {
    const level = parseLevel(["####", "#@-#", "#--#", "####"]);
    expect(directionBetween(level, level.player, level.player + level.cols + 1)).toBe(-1);
    expect(directionBetween(level, level.player, level.player)).toBe(-1);
  });
});

describe("pullableCells", () => {
  it("skips cells a box could never be dragged out of", () => {
    // The middle of the plus has no direction with two free cells behind it.
    const shape = parseShape(["#####", "##-##", "#---#", "##-##", "#####"]);
    const middle = 2 * 5 + 2;
    expect(floorCells(shape)).toContain(middle);
    expect(pullableCells(shape)).not.toContain(middle);
  });

  it("keeps a cell with room behind it", () => {
    const shape = parseShape(["#####", "#---#", "#####"]);
    expect(pullableCells(shape)).toContain(1 * 5 + 1);
  });
});

describe("sectorOf", () => {
  it("splits the warehouse into a grid", () => {
    const shape = parseShape(["#########", "#-------#", "#-------#", "#########"]);
    expect(sectorOf(shape, 0, 3)).toBe(0);
    expect(sectorOf(shape, 8, 3)).toBe(2);
    expect(sectorOf(shape, 3 * 9 + 8, 3)).toBe(8);
  });

  it("never falls off the last sector", () => {
    const shape = parseShape(["#####", "#---#", "#####"]);
    const last = shape.cols * shape.rows - 1;
    expect(sectorOf(shape, last, 2)).toBe(3);
    expect(sectorOf(shape, last, 3)).toBe(8);
  });
});

describe("spreadGoals", () => {
  const shape = parseShape([
    "#############",
    "#-----------#",
    "#-----------#",
    "#-----------#",
    "#-----------#",
    "#-----------#",
    "#############",
  ]);

  it("takes the goals from different corners of the warehouse", () => {
    const candidates = floorCells(shape);
    const goals = spreadGoals(shape, candidates, 4, seeded(5));
    const sectors = goals.map((index) => sectorOf(shape, index, 3));
    expect(new Set(sectors).size).toBeGreaterThan(1);
    expect(new Set(goals).size).toBe(4);
  });

  it("keeps going when there are fewer sectors than goals", () => {
    const small = parseShape(["#####", "#---#", "#---#", "#####"]);
    const goals = spreadGoals(small, floorCells(small), 5, seeded(2));
    expect(goals.length).toBe(5);
    expect(new Set(goals).size).toBe(5);
  });

  it("gives up rather than repeating a cell it has already used", () => {
    const tiny = parseShape(["####", "#--#", "####"]);
    expect(spreadGoals(tiny, floorCells(tiny), 5, seeded(1))).toBeNull();
  });
});

describe("workingArea and coverage", () => {
  it("counts the cells the solution actually touches", () => {
    const level = parseLevel(["######", "#@$.-#", "######"]);
    // One push: the keeper starts on 1, steps to 2, the crate moves 2 -> 3.
    const used = workingArea(level, level, [DIRECTIONS[1]]);
    expect(used).toBe(3);
  });

  it("is the share of the floor that is in play", () => {
    const level = parseLevel(["######", "#@$.-#", "######"]);
    // Four floor cells, three of them used.
    expect(coverage(level, level, [DIRECTIONS[1]])).toBeCloseTo(3 / 4, 5);
  });

  it("is zero when there is no solution to walk", () => {
    const level = parseLevel(["######", "#@$.-#", "######"]);
    expect(coverage(level, level, null)).toBe(0);
  });
});

describe("buildSolution", () => {
  it("turns the recorded pulls back into pushes", () => {
    // The box was pulled one cell left off its goal, leaving the keeper on its
    // left; pushing it back east is the whole solution.
    const level = parseLevel(["######", "#@$.-#", "######"]);
    const goalIndex = level.goals[0];
    const boxIndex = level.boxes[0];
    const pulls = [{ slot: 0, from: goalIndex, to: boxIndex, playerTo: boxIndex - 1 }];
    const moves = buildSolution(level, level.boxes, boxIndex - 1, pulls);
    expect(moves).toEqual([DIRECTIONS[1]]);
  });
});

describe("generateLevel", () => {
  it("is repeatable for the same seed", () => {
    const spec = LEVELS[1];
    expect(generateLevel(spec, seeded(11))).toEqual(generateLevel(spec, seeded(11)));
  });

  it("returns nothing when the room is too small to hold the boxes", () => {
    const spec = { cols: 4, rows: 4, boxes: 6, blocks: 0, pulls: 4, minPulls: 1 };
    expect(generateLevel(spec, seeded(3))).toBeNull();
  });

  // A spec with no room to pull anything scrambles nothing, which would leave
  // every crate on its goal. Better no level at all than a finished one.
  it("refuses to hand back a warehouse that is already solved", () => {
    const spec = { cols: 5, rows: 5, boxes: 1, blocks: 0, pulls: 0, minPulls: 0 };
    expect(generateLevel(spec, seeded(3))).toBeNull();
  });

  for (const spec of LEVELS) {
    describe("the " + spec.id + " warehouse", () => {
      const levels = [];
      for (let seed = 0; seed < SEEDS; seed++) {
        levels.push({ seed, level: generateLevel(spec, seeded(seed * 977 + 13)) });
      }

      it("is always produced", () => {
        for (const { seed, level } of levels) {
          expect(level, "seed " + seed).not.toBeNull();
        }
      });

      it("has the size the difficulty asks for", () => {
        for (const { seed, level } of levels) {
          expect(level.cols, "seed " + seed).toBe(spec.cols);
          expect(level.rows, "seed " + seed).toBe(spec.rows);
          expect(level.walls.length, "seed " + seed).toBe(spec.cols * spec.rows);
        }
      });

      it("has one box per goal and a solid border", () => {
        for (const { seed, level } of levels) {
          expect(level.goals.length, "seed " + seed).toBe(spec.boxes);
          expect(level.boxes.length, "seed " + seed).toBe(spec.boxes);
          for (let x = 0; x < level.cols; x++) {
            expect(isWall(level, x, 0), "seed " + seed).toBe(true);
            expect(isWall(level, x, level.rows - 1), "seed " + seed).toBe(true);
          }
          for (let y = 0; y < level.rows; y++) {
            expect(isWall(level, 0, y), "seed " + seed).toBe(true);
            expect(isWall(level, level.cols - 1, y), "seed " + seed).toBe(true);
          }
        }
      });

      // The whole point of spreading the goals: a big warehouse where the game
      // happens in one corner is a big map, not a big puzzle.
      it("puts a real share of its own floor in play", () => {
        for (const { seed, level } of levels) {
          expect(level.coverage, "seed " + seed).toBeGreaterThanOrEqual(0.45);
        }
      });

      it("keeps every floor cell reachable", () => {
        for (const { seed, level } of levels) {
          expect(isFloorConnected(level), "seed " + seed).toBe(true);
        }
      });

      it("puts the boxes and the keeper on distinct floor cells", () => {
        for (const { seed, level } of levels) {
          const seen = {};
          for (const box of level.boxes) {
            expect(level.walls[box], "seed " + seed).toBe(0);
            expect(seen[box], "seed " + seed).toBeUndefined();
            seen[box] = true;
          }
          expect(level.walls[level.player], "seed " + seed).toBe(0);
          expect(seen[level.player], "seed " + seed).toBeUndefined();
        }
      });

      it("hands over a puzzle rather than the answer", () => {
        for (const { seed, level } of levels) {
          expect(isSolved(createGame(level)), "seed " + seed).toBe(false);
          for (const box of level.boxes) {
            expect(level.goals.indexOf(box), "seed " + seed).toBe(-1);
          }
        }
      });

      // The point of building levels backwards: the recorded pulls, replayed as
      // pushes, are a solution. If this passes for every seed, no generated
      // warehouse can be a dead end.
      it("comes with a solution that actually solves it", () => {
        for (const { seed, level } of levels) {
          expect(level.solution, "seed " + seed).not.toBeNull();
          expect(level.solution.length, "seed " + seed).toBeGreaterThan(0);

          const game = createGame(level);
          for (let i = 0; i < level.solution.length; i++) {
            const result = move(game, level.solution[i]);
            expect(result.moved, "seed " + seed + " move " + i).toBe(true);
          }
          expect(isSolved(game), "seed " + seed).toBe(true);
        }
      });

      // The certificate is the scramble read backwards, not the shortest way
      // through, so this is how far the crates were dragged from their goals -
      // an upper bound on the puzzle, not its minimum. A cramped layout can
      // block the scramble early, so the bar is on the collection rather than
      // on every single warehouse; the offline generator filters the stragglers
      // out of the shipped collection.
      it("drags the crates as far off their goals as the size asks", () => {
        let reached = 0;
        for (const { seed, level } of levels) {
          const game = createGame(level);
          for (const direction of level.solution) {
            move(game, direction);
          }
          expect(game.pushes, "seed " + seed).toBeGreaterThan(0);
          expect(game.pushes, "seed " + seed).toBeLessThanOrEqual(spec.pulls);
          if (game.pushes >= spec.minPulls) {
            reached += 1;
          }
        }
        expect(reached / levels.length, spec.id).toBeGreaterThan(0.5);
      });
    });
  }
});
