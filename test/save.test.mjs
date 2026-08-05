import { describe, it, expect } from "vitest";
import { DOWN, LEFT, RIGHT, UP } from "../lib/directions.js";
import { generateLevel } from "../lib/generator.js";
import { formatLevel, parseLevel } from "../lib/level-format.js";
import { LEVELS } from "../lib/levels.js";
import { seeded } from "../lib/random.js";
import { HISTORY_LIMIT, SAVE_KEY, SAVE_VERSION, decodeSave, encodeSave } from "../lib/save.js";
import { createGame, isSolved, move, restart, undo } from "../lib/sokoban.js";

const ROOM = ["#######", "#-----#", "#-@$--#", "#---.-#", "#-----#", "#######"];

function played(picture, directions) {
  const game = createGame(parseLevel(picture));
  for (const direction of directions || []) {
    move(game, direction);
  }
  return game;
}

// Turn a decoded save back into something the rule set will play.
function revive(saved) {
  return saved.game;
}

describe("a saved game", () => {
  it("comes back exactly as it went in", () => {
    const game = played(ROOM, [RIGHT, DOWN, LEFT]);
    const saved = decodeSave(encodeSave(2, 1, game));

    expect(saved.level).toBe(2);
    expect(saved.source).toBe(1);
    expect(saved.game.cols).toBe(game.cols);
    expect(saved.game.rows).toBe(game.rows);
    expect(saved.game.walls).toEqual(game.walls);
    expect(saved.game.goals).toEqual(game.goals);
    expect(saved.game.boxes).toEqual(game.boxes);
    expect(saved.game.player).toBe(game.player);
    expect(saved.game.moves).toBe(game.moves);
    expect(saved.game.pushes).toBe(game.pushes);
    expect(saved.game.history).toEqual(game.history);
  });

  it("keeps where the warehouse started, so Restart still works", () => {
    const game = played(ROOM, [RIGHT, DOWN, DOWN]);
    const saved = revive(decodeSave(encodeSave(0, 0, game)));

    expect(saved.start.boxes).toEqual(game.start.boxes);
    expect(saved.start.player).toBe(game.start.player);

    restart(saved);
    expect(formatLevel(saved)).toEqual(ROOM);
  });

  it("can be played on from where it was left", () => {
    const game = played(ROOM, [RIGHT]);
    const saved = revive(decodeSave(encodeSave(0, 0, game)));

    expect(move(saved, RIGHT).moved).toBe(true);
    expect(saved.moves).toBe(2);
  });

  it("can be undone after it comes back", () => {
    const game = played(ROOM, [RIGHT, DOWN]);
    const saved = revive(decodeSave(encodeSave(0, 0, game)));

    expect(undo(saved)).toBe(true);
    expect(undo(saved)).toBe(true);
    expect(formatLevel(saved)).toEqual(ROOM);
  });

  it("survives a warehouse that is already finished", () => {
    const game = played(["#####", "#@$.#", "#####"], [RIGHT]);
    expect(isSolved(game)).toBe(true);
    const saved = revive(decodeSave(encodeSave(0, 0, game)));
    expect(isSolved(saved)).toBe(true);
  });

  it("survives every size the game ships", () => {
    for (const spec of LEVELS) {
      const level = generateLevel(spec, seeded(spec.cols * 7 + 1));
      const game = createGame(level);
      for (let i = 0; i < 10 && i < level.solution.length; i++) {
        move(game, level.solution[i]);
      }

      const saved = revive(decodeSave(encodeSave(0, 0, game)));
      expect(saved.walls, spec.id).toEqual(game.walls);
      expect(saved.boxes, spec.id).toEqual(game.boxes);
      expect(saved.player, spec.id).toBe(game.player);
      expect(saved.goals, spec.id).toEqual(game.goals);
    }
  });

  it("stays small enough for watch storage", () => {
    const spec = LEVELS[LEVELS.length - 1];
    const level = generateLevel(spec, seeded(11));
    const game = createGame(level);
    for (const direction of level.solution) {
      move(game, direction);
    }
    expect(encodeSave(5, 0, game).length).toBeLessThan(3000);
  });
});

describe("the undo history in a save", () => {
  it("keeps the most recent moves when it has to be trimmed", () => {
    const game = createGame(parseLevel(ROOM));
    // Pace up and down so the history is long without the position wandering.
    for (let i = 0; i < HISTORY_LIMIT + 50; i++) {
      move(game, i % 2 === 0 ? DOWN : UP);
    }
    expect(game.history.length).toBeGreaterThan(HISTORY_LIMIT);

    const saved = revive(decodeSave(encodeSave(0, 0, game)));
    expect(saved.history.length).toBe(HISTORY_LIMIT);
    // The last move made is the last one kept.
    const last = game.history[game.history.length - 1];
    expect(saved.history[saved.history.length - 1]).toEqual(last);
  });

  it("remembers which moves were pushes", () => {
    const game = played(ROOM, [RIGHT, DOWN]);
    const saved = revive(decodeSave(encodeSave(0, 0, game)));
    expect(saved.history[0]).toEqual({ direction: RIGHT, pushed: true });
    expect(saved.history[1]).toEqual({ direction: DOWN, pushed: false });
  });

  it("handles every direction", () => {
    const game = played(ROOM, [DOWN, LEFT, UP, RIGHT]);
    const saved = revive(decodeSave(encodeSave(0, 0, game)));
    expect(saved.history.map((entry) => entry.direction)).toEqual([DOWN, LEFT, UP, RIGHT]);
  });
});

describe("reading a save that cannot be trusted", () => {
  const good = encodeSave(0, 0, played(ROOM, [RIGHT]));

  it("refuses nothing at all", () => {
    expect(decodeSave(undefined)).toBeNull();
    expect(decodeSave("")).toBeNull();
    expect(decodeSave(null)).toBeNull();
  });

  it("refuses text that is not hex", () => {
    expect(decodeSave("not a save at all")).toBeNull();
    expect(decodeSave("abc")).toBeNull();
  });

  it("refuses a save written by a version it does not know", () => {
    const future = HEXED(good, 0, SAVE_VERSION + 1);
    expect(decodeSave(future)).toBeNull();
  });

  it("refuses a save that has been cut short", () => {
    expect(decodeSave(good.slice(0, good.length - 10))).toBeNull();
    expect(decodeSave(good.slice(0, 20))).toBeNull();
  });

  it("refuses a warehouse whose own numbers make no sense", () => {
    expect(decodeSave(HEXED(good, 3, 1))).toBeNull();
    expect(decodeSave(HEXED(good, 5, 0))).toBeNull();
  });

  it("has a storage key of its own", () => {
    expect(SAVE_KEY).toBeTruthy();
  });
});

// Rewrite one byte of a hex save, so a test can corrupt exactly one field.
function HEXED(text, byteIndex, value) {
  const hex = "0123456789abcdef";
  const at = byteIndex * 2;
  return text.slice(0, at) + hex.charAt(value >> 4) + hex.charAt(value & 15) + text.slice(at + 2);
}
