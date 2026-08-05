import { describe, it, expect } from "vitest";
import {
  BOX,
  BOX_ON_GOAL,
  CELL_KINDS,
  FLOOR,
  GOAL,
  KEEPER,
  KEEPER_ON_GOAL,
  OUTSIDE,
  WALL,
  cellKind,
} from "../lib/render.js";
import { createGame } from "../lib/sokoban.js";
import { parseLevel } from "./helpers/ascii-level.mjs";

const PICTURE = ["######", "#@$.-#", "#-*--#", "######"];

const game = createGame(parseLevel(PICTURE));
const onGoal = createGame(parseLevel(["####", "#+-#", "####"]));

describe("cellKind", () => {
  it("names the wall and the plain floor", () => {
    expect(cellKind(game, 0, 0)).toBe(WALL);
    expect(cellKind(game, 4, 1)).toBe(FLOOR);
  });

  it("names an empty goal", () => {
    expect(cellKind(game, 3, 1)).toBe(GOAL);
  });

  it("tells a box on a goal from one that still has to get there", () => {
    expect(cellKind(game, 2, 1)).toBe(BOX);
    expect(cellKind(game, 2, 2)).toBe(BOX_ON_GOAL);
  });

  it("draws the keeper over whatever it is standing on", () => {
    expect(cellKind(game, 1, 1)).toBe(KEEPER);
    expect(cellKind(onGoal, 1, 1)).toBe(KEEPER_ON_GOAL);
  });

  it("calls everything past the edge of the board outside", () => {
    expect(cellKind(game, -1, 0)).toBe(OUTSIDE);
    expect(cellKind(game, 0, -1)).toBe(OUTSIDE);
    expect(cellKind(game, game.cols, 0)).toBe(OUTSIDE);
    expect(cellKind(game, 0, game.rows)).toBe(OUTSIDE);
  });

  it("only ever returns a kind the page knows how to paint", () => {
    for (let y = -1; y <= game.rows; y++) {
      for (let x = -1; x <= game.cols; x++) {
        expect(CELL_KINDS, x + "," + y).toContain(cellKind(game, x, y));
      }
    }
  });
});
