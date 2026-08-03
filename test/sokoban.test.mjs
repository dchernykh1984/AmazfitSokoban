import { describe, it, expect } from "vitest";
import { DOWN, LEFT, RIGHT, UP } from "../lib/directions.js";
import {
  boxSlot,
  boxesOnGoals,
  columnOf,
  createGame,
  hasBox,
  indexOf,
  inside,
  isFree,
  isGoal,
  isSolved,
  isWall,
  move,
  restart,
  rowOf,
  undo,
} from "../lib/sokoban.js";
import { drawLevel, parseLevel } from "./helpers/ascii-level.mjs";

const ROOM = ["#######", "#-----#", "#-@$--#", "#---.-#", "#-----#", "#######"];

function game(picture) {
  return createGame(parseLevel(picture));
}

describe("grid helpers", () => {
  const level = parseLevel(ROOM);

  it("converts between coordinates and flat indexes", () => {
    expect(indexOf(level, 3, 2)).toBe(2 * level.cols + 3);
    expect(columnOf(level, indexOf(level, 3, 2))).toBe(3);
    expect(rowOf(level, indexOf(level, 3, 2))).toBe(2);
  });

  it("knows what is on the grid", () => {
    expect(inside(level, 0, 0)).toBe(true);
    expect(inside(level, -1, 0)).toBe(false);
    expect(inside(level, level.cols, 0)).toBe(false);
    expect(inside(level, 0, level.rows)).toBe(false);
  });

  it("treats everything off the grid as wall", () => {
    expect(isWall(level, 0, 0)).toBe(true);
    expect(isWall(level, 1, 1)).toBe(false);
    expect(isWall(level, -1, 1)).toBe(true);
    expect(isWall(level, 99, 99)).toBe(true);
  });

  it("finds goals, boxes and free cells", () => {
    const state = game(ROOM);
    expect(isGoal(state, 4, 3)).toBe(true);
    expect(isGoal(state, 1, 1)).toBe(false);
    expect(isGoal(state, -1, -1)).toBe(false);
    expect(hasBox(state, 3, 2)).toBe(true);
    expect(boxSlot(state, 3, 2)).toBe(0);
    expect(boxSlot(state, 1, 1)).toBe(-1);
    expect(boxSlot(state, -5, 0)).toBe(-1);
    expect(isFree(state, 1, 1)).toBe(true);
    expect(isFree(state, 3, 2)).toBe(false);
    expect(isFree(state, 0, 0)).toBe(false);
  });
});

describe("createGame", () => {
  it("copies the level so replaying it cannot corrupt it", () => {
    const level = parseLevel(ROOM);
    const state = createGame(level);
    move(state, RIGHT);
    expect(state.boxes).not.toEqual(level.boxes);
    expect(level.boxes).toEqual(parseLevel(ROOM).boxes);
    expect(level.player).toBe(parseLevel(ROOM).player);
  });

  it("starts with no moves, no pushes and nothing to undo", () => {
    const state = game(ROOM);
    expect(state.moves).toBe(0);
    expect(state.pushes).toBe(0);
    expect(state.history).toEqual([]);
  });
});

describe("move", () => {
  it("walks onto a free cell", () => {
    const state = game(ROOM);
    expect(move(state, DOWN)).toEqual({ moved: true, pushed: false });
    expect(drawLevel(state)).toEqual([
      "#######",
      "#-----#",
      "#--$--#",
      "#-@-.-#",
      "#-----#",
      "#######",
    ]);
    expect(state.moves).toBe(1);
    expect(state.pushes).toBe(0);
  });

  it("refuses to walk into a wall", () => {
    const state = game(ROOM);
    move(state, LEFT);
    expect(move(state, LEFT)).toEqual({ moved: false, pushed: false });
    expect(state.moves).toBe(1);
  });

  it("pushes a single box", () => {
    const state = game(ROOM);
    expect(move(state, RIGHT)).toEqual({ moved: true, pushed: true });
    expect(drawLevel(state)).toEqual([
      "#######",
      "#-----#",
      "#--@$-#",
      "#---.-#",
      "#-----#",
      "#######",
    ]);
    expect(state.moves).toBe(1);
    expect(state.pushes).toBe(1);
  });

  it("refuses to push a box into a wall", () => {
    const state = game(["#####", "#@$-#", "#####"]);
    move(state, RIGHT);
    expect(move(state, RIGHT)).toEqual({ moved: false, pushed: false });
    expect(state.moves).toBe(1);
    expect(state.pushes).toBe(1);
  });

  it("never pushes two boxes at once", () => {
    const state = game(["######", "#@$$-#", "######"]);
    expect(move(state, RIGHT)).toEqual({ moved: false, pushed: false });
    expect(state.moves).toBe(0);
    expect(drawLevel(state)).toEqual(["######", "#@$$-#", "######"]);
  });

  it("ignores a direction that is not one", () => {
    const state = game(ROOM);
    expect(move(state, -1)).toEqual({ moved: false, pushed: false });
    expect(move(state, 4)).toEqual({ moved: false, pushed: false });
    expect(move(state, null)).toEqual({ moved: false, pushed: false });
    expect(state.moves).toBe(0);
  });

  it("records every step so it can be taken back", () => {
    const state = game(ROOM);
    move(state, RIGHT);
    move(state, DOWN);
    expect(state.history).toEqual([
      { direction: RIGHT, pushed: true },
      { direction: DOWN, pushed: false },
    ]);
  });
});

describe("undo", () => {
  it("takes back a walk", () => {
    const state = game(ROOM);
    move(state, DOWN);
    expect(undo(state)).toBe(true);
    expect(drawLevel(state)).toEqual(ROOM);
    expect(state.moves).toBe(0);
  });

  it("drags the box back out of a push", () => {
    const state = game(ROOM);
    move(state, RIGHT);
    expect(undo(state)).toBe(true);
    expect(drawLevel(state)).toEqual(ROOM);
    expect(state.moves).toBe(0);
    expect(state.pushes).toBe(0);
  });

  it("unwinds a whole run of moves back to the start", () => {
    const state = game(ROOM);
    const order = [RIGHT, DOWN, DOWN, LEFT, UP, UP, RIGHT];
    for (const direction of order) {
      move(state, direction);
    }
    while (undo(state)) {
      // rewind
    }
    expect(drawLevel(state)).toEqual(ROOM);
    expect(state.moves).toBe(0);
    expect(state.pushes).toBe(0);
  });

  it("says there was nothing to take back", () => {
    const state = game(ROOM);
    expect(undo(state)).toBe(false);
    expect(state.moves).toBe(0);
  });
});

describe("restart", () => {
  it("puts the warehouse back the way it was found", () => {
    const state = game(ROOM);
    move(state, RIGHT);
    move(state, DOWN);
    restart(state);
    expect(drawLevel(state)).toEqual(ROOM);
    expect(state.moves).toBe(0);
    expect(state.pushes).toBe(0);
    expect(state.history).toEqual([]);
  });
});

describe("isSolved", () => {
  it("counts the boxes standing on a goal", () => {
    const state = game(["#####", "#@$.#", "#-*-#", "#####"]);
    expect(boxesOnGoals(state)).toBe(1);
    expect(isSolved(state)).toBe(false);
  });

  it("is solved once every goal carries a box", () => {
    const state = game(["#####", "#@$.#", "#####"]);
    move(state, RIGHT);
    expect(boxesOnGoals(state)).toBe(1);
    expect(isSolved(state)).toBe(true);
  });

  it("can be undone back out of a solution", () => {
    const state = game(["#####", "#@$.#", "#####"]);
    move(state, RIGHT);
    undo(state);
    expect(isSolved(state)).toBe(false);
  });
});
