import { describe, it, expect, afterEach, vi } from "vitest";
import { VECTORS } from "../lib/directions.js";
import { generateLevel } from "../lib/generator.js";
import { LABELS } from "../lib/i18n/labels.js";
import { LEVELS } from "../lib/levels.js";
import { cellKind, tileStyle } from "../lib/render.js";
import { LEVEL_KEY, bestKey } from "../lib/scores.js";
import { columnOf, rowOf } from "../lib/sokoban.js";
import { seeded } from "./helpers/ascii-level.mjs";
import { launch } from "./helpers/watch.mjs";

const EN = LABELS.en;

afterEach(() => {
  vi.restoreAllMocks();
});

// Start a watch whose Math.random is seeded, and work out the very level the page
// will generate from that same seed, so a test can play the puzzle it is looking
// at without being able to see it.
async function playing(seed, level, options) {
  const watch = await launch(Object.assign({ random: seeded(seed) }, options || {}));
  for (let i = 0; i < (level || 0); i++) {
    watch.press(EN[LEVELS[i].label]);
  }
  const expected = generateLevel(LEVELS[level || 0], seeded(seed));
  watch.press(EN.play);
  return { watch, level: expected };
}

// Tap the cell next to the keeper in the given direction, which is what a finger
// on the watch does to take one step.
function tapStep(watch, direction) {
  const game = watch.page.state.game;
  const vector = VECTORS[direction];
  const point = watch.cellCenter(
    columnOf(game, game.player) + vector.dx,
    rowOf(game, game.player) + vector.dy
  );
  watch.tap(point.x, point.y);
}

describe("the start screen", () => {
  it("opens on the title, the size and Play", async () => {
    const watch = await launch({});
    expect(watch.texts()).toContain(EN.title);
    expect(watch.buttons()).toEqual([EN.size_xs, EN.play]);
  });

  it("shows a dash until something has been solved", async () => {
    const watch = await launch({});
    expect(watch.texts()).toContain(EN.best + " -");
  });

  it("shows both halves of the control scheme", async () => {
    const watch = await launch({});
    expect(watch.texts()).toContain(EN.hint_move);
    expect(watch.texts()).toContain(EN.hint_pan);
  });

  it("asks for a longer screen timeout and hands it back", async () => {
    const watch = await launch({});
    expect(watch.zos.display.display.brightTime).toBeGreaterThan(0);
    watch.page.onDestroy();
    expect(watch.zos.display.display.reset).toBe(1);
    expect(watch.zos.interaction.gestures.callback).toBeNull();
  });

  it("speaks the watch's language", async () => {
    const watch = await launch({ language: 4 });
    expect(watch.buttons()).toContain(LABELS.ru.play);
  });
});

describe("choosing a size", () => {
  it("cycles through every size and wraps", async () => {
    const watch = await launch({});
    for (let i = 0; i < LEVELS.length; i++) {
      const current = EN[LEVELS[i].label];
      const next = EN[LEVELS[(i + 1) % LEVELS.length].label];
      expect(watch.buttons(), LEVELS[i].id).toContain(current);
      watch.press(current);
      expect(watch.buttons(), LEVELS[i].id).toContain(next);
    }
    expect(watch.buttons()).toContain(EN.size_xs);
  });

  it("remembers it, so the game reopens the way it was left", async () => {
    const watch = await launch({});
    watch.press(EN.size_xs);
    expect(watch.zos.storage.behaviour.items[LEVEL_KEY]).toBe(1);

    const reopened = await launch({ stored: { [LEVEL_KEY]: 1 } });
    expect(reopened.buttons()).toContain(EN.size_s);
  });

  it("shows the best for the size it is on", async () => {
    const watch = await launch({ stored: { [bestKey(0)]: 40, [bestKey(1)]: 90 } });
    expect(watch.texts()).toContain(EN.best + " 40");
    watch.press(EN.size_xs);
    expect(watch.texts()).toContain(EN.best + " 90");
  });
});

describe("starting a game", () => {
  it("lays out a tile pair for every cell of the window", async () => {
    const { watch } = await playing(3);
    const visible = LEVELS[0].visible;
    expect(watch.page.state.tiles.length).toBe(visible * visible);
  });

  it("puts the counters up and the play buttons out", async () => {
    const { watch, level } = await playing(3);
    expect(watch.texts()).toContain("0/" + level.goals.length + "   0");
    expect(watch.buttons()).toEqual([EN.undo, EN.menu]);
  });

  it("takes the menu off the screen", async () => {
    const { watch } = await playing(3);
    expect(watch.buttons()).not.toContain(EN.play);
  });

  it("gives the bigger sizes a warehouse bigger than the window", async () => {
    const { watch } = await playing(5, 2);
    expect(watch.page.state.game.cols).toBe(LEVELS[2].cols);
    expect(watch.page.state.camera.visible).toBeLessThan(LEVELS[2].cols);
  });
});

describe("tapping to step", () => {
  it("walks the keeper towards the cell that was tapped", async () => {
    const { watch, level } = await playing(3);
    const game = watch.page.state.game;
    // Walk in whichever direction is free from where the keeper starts.
    for (let direction = 0; direction < VECTORS.length; direction++) {
      const before = game.player;
      tapStep(watch, direction);
      if (game.player !== before) {
        const vector = VECTORS[direction];
        expect(game.player).toBe(before + vector.dy * level.cols + vector.dx);
        expect(game.moves).toBe(1);
        return;
      }
    }
    throw new Error("the keeper was walled in on all four sides");
  });

  it("does nothing when the tap lands on the keeper itself", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    const point = watch.cellCenter(columnOf(game, game.player), rowOf(game, game.player));
    watch.tap(point.x, point.y);
    expect(game.moves).toBe(0);
  });

  it("ignores taps in the caps above and below the board", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    watch.tap(watch.size / 2, 4);
    watch.tap(watch.size / 2, watch.size - 4);
    expect(game.moves).toBe(0);
  });

  it("keeps the counters in step with the board", async () => {
    const { watch, level } = await playing(3);
    const game = watch.page.state.game;
    for (let direction = 0; direction < VECTORS.length; direction++) {
      tapStep(watch, direction);
      if (game.moves > 0) {
        break;
      }
    }
    expect(watch.texts()).toContain("0/" + level.goals.length + "   " + game.moves);
  });
});

describe("dragging the map", () => {
  it("moves the window without stepping the keeper", async () => {
    const { watch } = await playing(5, 2);
    const game = watch.page.state.game;
    const camera = watch.page.state.camera;
    const cell = watch.page.state.board.cell;
    camera.x = 0;
    camera.y = 0;

    // Dragging left by one cell shows the column one further right.
    const middle = Math.round(watch.size / 2);
    watch.drag(middle, middle, middle - cell, middle, 6);

    expect(camera.x).toBe(1);
    expect(camera.y).toBe(0);
    expect(game.moves).toBe(0);
  });

  it("stops at the edge of the warehouse", async () => {
    const { watch } = await playing(5, 2);
    const camera = watch.page.state.camera;
    const middle = Math.round(watch.size / 2);
    watch.drag(middle, middle, middle + 400, middle + 400, 8);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
  });

  it("is still a drag when the finger comes back to where it started", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    const middle = Math.round(watch.size / 2);
    watch.touchDown(middle, middle);
    watch.touchMove(middle + 90, middle);
    watch.touchUp(middle, middle);
    expect(game.moves).toBe(0);
  });
});

describe("the swipe that leaves the app", () => {
  it("is swallowed while a puzzle is on screen", async () => {
    const { watch } = await playing(3);
    expect(watch.swipe(3)).toBe(true);
    expect(watch.swipe(1)).toBe(true);
  });

  it("is let through from the menus", async () => {
    const watch = await launch({});
    expect(watch.swipe(3)).toBe(false);
  });

  // The page unhooks itself on the way out, but a gesture already on its way in
  // must not be answered by a page that is gone.
  it("is let through by a page that has been destroyed", async () => {
    const { watch } = await playing(3);
    const callback = watch.zos.interaction.gestures.callback;
    watch.page.onDestroy();
    expect(callback(3)).toBe(false);
  });
});

describe("the in-game menu", () => {
  it("offers a way back, a restart, a new puzzle and the difficulty", async () => {
    const { watch } = await playing(3);
    watch.press(EN.menu);
    expect(watch.buttons()).toEqual([EN.resume, EN.restart, EN.new_game, EN.size]);
  });

  it("takes the counters and the play buttons off the screen", async () => {
    const { watch } = await playing(3);
    watch.press(EN.menu);
    expect(watch.buttons()).not.toContain(EN.undo);
    expect(watch.texts()).not.toContain("0/2   0");
  });

  it("puts them back on resume", async () => {
    const { watch, level } = await playing(3);
    watch.press(EN.menu);
    watch.press(EN.resume);
    expect(watch.buttons()).toEqual([EN.undo, EN.menu]);
    expect(watch.texts()).toContain("0/" + level.goals.length + "   0");
  });

  it("ignores taps on the board while it is open", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    watch.press(EN.menu);
    const middle = Math.round(watch.size / 2);
    watch.tap(middle, middle);
    expect(game.moves).toBe(0);
  });

  it("puts the warehouse back the way it was found", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    const boxes = game.boxes.slice();
    for (let direction = 0; direction < VECTORS.length; direction++) {
      tapStep(watch, direction);
    }
    expect(game.moves).toBeGreaterThan(0);

    watch.press(EN.menu);
    watch.press(EN.restart);
    expect(game.moves).toBe(0);
    expect(game.boxes).toEqual(boxes);
    expect(watch.buttons()).toEqual([EN.undo, EN.menu]);
  });

  it("goes back to the start screen for a different difficulty", async () => {
    const { watch } = await playing(3);
    watch.press(EN.menu);
    watch.press(EN.size);
    expect(watch.buttons()).toEqual([EN.size_xs, EN.play]);
    expect(watch.page.state.tiles.length).toBe(0);
  });
});

describe("undo", () => {
  it("takes the last step back", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    for (let direction = 0; direction < VECTORS.length; direction++) {
      tapStep(watch, direction);
      if (game.moves > 0) {
        break;
      }
    }
    const player = game.player;
    watch.press(EN.undo);
    expect(game.moves).toBe(0);
    expect(game.player).not.toBe(player);
  });

  it("does nothing at the start of a puzzle", async () => {
    const { watch } = await playing(3);
    watch.press(EN.undo);
    expect(watch.page.state.game.moves).toBe(0);
  });
});

describe("solving the puzzle", () => {
  // The generator hands every level a solution; tapping it out cell by cell is
  // the whole game played through the real screen, from the first touch to the
  // record being written.
  async function solve(seed) {
    const { watch, level } = await playing(seed);
    for (const direction of level.solution) {
      tapStep(watch, direction);
    }
    return { watch, level };
  }

  it("ends on the solved screen", async () => {
    const { watch } = await solve(3);
    expect(watch.texts()).toContain(EN.solved);
    expect(watch.buttons()).toEqual([EN.new_game, EN.size]);
  });

  it("reports the moves it took and calls the first solve a record", async () => {
    const { watch, level } = await solve(3);
    expect(watch.texts()).toContain(EN.moves + " " + level.solution.length);
    expect(watch.texts()).toContain(EN.new_best);
    expect(watch.zos.storage.behaviour.items[bestKey(0)]).toBe(level.solution.length);
  });

  it("keeps a better record rather than overwriting it with a worse one", async () => {
    const { watch, level } = await playing(3, 0, { stored: { [bestKey(0)]: 1 } });
    for (const direction of level.solution) {
      tapStep(watch, direction);
    }
    expect(watch.texts()).toContain(EN.best + " 1");
    expect(watch.zos.storage.behaviour.items[bestKey(0)]).toBe(1);
  });

  it("stops listening to the board once it is solved", async () => {
    const { watch } = await solve(3);
    const moves = watch.page.state.game.moves;
    const middle = Math.round(watch.size / 2);
    watch.tap(middle, middle);
    expect(watch.page.state.game.moves).toBe(moves);
  });

  it("deals a fresh puzzle from the solved screen", async () => {
    const { watch, level } = await solve(3);
    watch.press(EN.new_game);
    expect(watch.buttons()).toEqual([EN.undo, EN.menu]);
    expect(watch.page.state.game.moves).toBe(0);
    expect(watch.page.state.game.boxes).not.toEqual(level.boxes);
  });
});

describe("a watch whose storage will not play along", () => {
  it("still starts when there is no storage to read", async () => {
    const watch = await launch({ failReads: true });
    expect(watch.buttons()).toContain(EN.play);
    expect(watch.texts()).toContain(EN.best + " -");
  });

  it("remembers the difficulty for the session when writes fail", async () => {
    const watch = await launch({ failWrites: true });
    watch.press(EN.size_xs);
    expect(watch.buttons()).toContain(EN.size_s);
    watch.press(EN.size_s);
    expect(watch.buttons()).toContain(EN.size_m);
  });
});

describe("what actually ends up on the board", () => {
  // Every other test checks the game state; this one checks the pixels. Each
  // window slot is read back out of the widgets and compared against the style
  // the rules say that cell should have, so a wrong index or a missed repaint
  // shows up here rather than on a wrist.
  function expectPainted(watch) {
    const page = watch.page;
    const camera = page.state.camera;
    const window = camera.visible;
    expect(page.state.tiles.length).toBe(window * window);

    for (let i = 0; i < page.state.tiles.length; i++) {
      const tile = page.state.tiles[i];
      const style = tileStyle(
        cellKind(page.state.game, camera.x + tile.column, camera.y + tile.row)
      );
      const where = "slot " + tile.column + "," + tile.row;
      expect(tile.base.props.color, where + " floor").toBe(style.base);
      expect(tile.top.props.color, where + " contents").toBe(style.top);
    }
  }

  it("paints the whole window when a puzzle opens", async () => {
    const { watch } = await playing(3);
    expectPainted(watch);
  });

  it("shows the keeper, the crates and the goals as different things", async () => {
    const { watch } = await playing(3);
    const colors = watch.page.state.tiles.map((tile) => tile.top.props.color);
    expect(new Set(colors).size).toBeGreaterThanOrEqual(4);
  });

  it("keeps the board in step with the keeper", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    for (let direction = 0; direction < VECTORS.length; direction++) {
      tapStep(watch, direction);
      if (game.moves > 0) {
        break;
      }
    }
    expect(game.moves).toBeGreaterThan(0);
    expectPainted(watch);
  });

  it("keeps the board in step with the map", async () => {
    const { watch } = await playing(5, 2);
    const camera = watch.page.state.camera;
    const cell = watch.page.state.board.cell;
    const middle = Math.round(watch.size / 2);
    watch.drag(middle, middle, middle - 2 * cell, middle - 2 * cell, 8);
    expect(camera.x).toBeGreaterThan(0);
    expectPainted(watch);
  });

  it("keeps the board in step with undo", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    for (let direction = 0; direction < VECTORS.length; direction++) {
      tapStep(watch, direction);
    }
    const taken = game.moves;
    watch.press(EN.undo);
    expect(game.moves).toBe(taken - 1);
    expectPainted(watch);
  });

  it("shows every crate home once the puzzle is solved", async () => {
    const { watch, level } = await playing(3);
    for (const direction of level.solution) {
      tapStep(watch, direction);
    }
    expectPainted(watch);
    const done = watch.page.state.tiles.filter(
      (tile) => tile.top.props.color === tileStyle("box_on_goal").top
    );
    expect(done.length).toBeGreaterThanOrEqual(level.goals.length);
  });
});
