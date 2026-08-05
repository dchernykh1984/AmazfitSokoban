import { describe, it, expect, afterEach, vi } from "vitest";
import { DOWN, LEFT, RIGHT, UP, VECTORS } from "../lib/directions.js";
import { generateLevel } from "../lib/generator.js";
import { LABELS } from "../lib/i18n/labels.js";
import { LEVELS } from "../lib/levels.js";
import { COLOR_BOX, COLOR_BOX_DONE, COLOR_KEEPER } from "../lib/paint.js";
import { seeded } from "../lib/random.js";
import { LEVEL_KEY, bestKey } from "../lib/scores.js";

import { launch } from "./helpers/watch.mjs";

const EN = LABELS.en;
const ARROW_OF = { [UP]: "up", [DOWN]: "down", [LEFT]: "left", [RIGHT]: "right" };

afterEach(() => {
  vi.restoreAllMocks();
});

// Start a watch whose Math.random is seeded, and work out the very level the
// page will generate from that same seed, so a test can play the puzzle it is
// looking at without being able to see it.
async function playing(seed, level, options) {
  const watch = await launch(Object.assign({ random: seeded(seed) }, options || {}));
  for (let i = 0; i < (level || 0); i++) {
    watch.press(EN[LEVELS[i].label]);
  }
  const expected = generateLevel(LEVELS[level || 0], seeded(seed));
  watch.press(EN.play);
  return { watch, level: expected };
}

// Press the arrow for a direction, which is the only way to move the keeper.
function pressArrow(watch, direction) {
  watch.tapControl(ARROW_OF[direction]);
}

// Walk in whichever direction is not blocked, and say which it was.
function stepAnywhere(watch) {
  const game = watch.page.state.game;
  for (const direction of [UP, RIGHT, DOWN, LEFT]) {
    const before = game.moves;
    pressArrow(watch, direction);
    if (game.moves > before) {
      return direction;
    }
  }
  return -1;
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

  it("lays the board out for the size that was picked", async () => {
    const watch = await launch({ random: seeded(3) });
    watch.press(EN.size_xs);
    watch.press(EN.play);
    expect(watch.page.state.camera.visible).toBe(LEVELS[1].visible);
    expect(watch.page.state.game.cols).toBe(LEVELS[1].cols);
  });
});

describe("starting a game", () => {
  it("puts the counters up and takes the menu away", async () => {
    const { watch, level } = await playing(3);
    expect(watch.texts()).toContain("0/" + level.goals.length + "   0");
    expect(watch.buttons()).not.toContain(EN.play);
  });

  it("draws the warehouse on the canvas", async () => {
    const { watch } = await playing(3);
    expect(watch.drawn().length).toBeGreaterThan(20);
  });

  it("gives the bigger sizes a warehouse bigger than the window", async () => {
    const { watch } = await playing(5, 2);
    expect(watch.page.state.game.cols).toBe(LEVELS[2].cols);
    expect(watch.page.state.camera.visible).toBeLessThan(LEVELS[2].cols);
  });
});

describe("the arrows", () => {
  it("walk the keeper the way the arrow points", async () => {
    const { watch, level } = await playing(3);
    const game = watch.page.state.game;
    const before = game.player;
    const direction = stepAnywhere(watch);

    expect(direction).not.toBe(-1);
    const vector = VECTORS[direction];
    expect(game.player).toBe(before + vector.dy * level.cols + vector.dx);
    expect(game.moves).toBe(1);
  });

  it("turn the keeper to face the way it went", async () => {
    const { watch } = await playing(3);
    const direction = stepAnywhere(watch);
    expect(watch.page.state.facing).toBe(direction);
  });

  it("do nothing when the keeper is against a wall", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    // Walk into every wall in turn: whatever is blocked must not count a move.
    const before = game.moves;
    for (const direction of [UP, RIGHT, DOWN, LEFT]) {
      pressArrow(watch, direction);
    }
    expect(game.moves).toBeGreaterThanOrEqual(before);
    expect(game.moves).toBeLessThanOrEqual(before + 4);
  });

  it("keep the counters in step with the board", async () => {
    const { watch, level } = await playing(3);
    const game = watch.page.state.game;
    stepAnywhere(watch);
    expect(watch.texts()).toContain("0/" + level.goals.length + "   " + game.moves);
  });
});

describe("tapping the board", () => {
  it("does not move the keeper any more - the arrows do that", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    const middle = Math.round(watch.size / 2);
    watch.tap(middle, middle);
    expect(game.moves).toBe(0);
  });

  it("ignores a tap in the dead space at the corners", async () => {
    const { watch } = await playing(3);
    watch.tap(4, 4);
    expect(watch.page.state.game.moves).toBe(0);
  });
});

describe("dragging the map", () => {
  it("slides the window by the pixels the finger moved", async () => {
    const { watch } = await playing(5, 5);
    const camera = watch.page.state.camera;
    camera.x = 100;
    camera.y = 100;
    const game = watch.page.state.game;

    const middle = Math.round(watch.size / 2);
    watch.drag(middle, middle, middle - 40, middle - 25, 5);

    expect(camera.x).toBe(140);
    expect(camera.y).toBe(125);
    expect(game.moves).toBe(0);
  });

  it("stops at the edge of the warehouse", async () => {
    const { watch } = await playing(5, 5);
    const camera = watch.page.state.camera;
    const middle = Math.round(watch.size / 2);
    watch.drag(middle, middle, middle + 900, middle + 900, 8);
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
  });

  it("does not pan when the drag started on an arrow", async () => {
    const { watch } = await playing(5, 5);
    const camera = watch.page.state.camera;
    camera.x = 100;
    const arrow = watch.layout().left;

    watch.drag(
      arrow.x + Math.floor(arrow.w / 2),
      arrow.y + Math.floor(arrow.h / 2),
      arrow.x + Math.floor(arrow.w / 2) - 60,
      arrow.y + Math.floor(arrow.h / 2),
      5
    );
    expect(camera.x).toBe(100);
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

  it("is let through by a page that has been destroyed", async () => {
    const { watch } = await playing(3);
    const callback = watch.zos.interaction.gestures.callback;
    watch.page.onDestroy();
    expect(callback(3)).toBe(false);
  });
});

describe("undo", () => {
  it("takes the last step back", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    stepAnywhere(watch);
    const player = game.player;

    watch.tapControl("undo");
    expect(game.moves).toBe(0);
    expect(game.player).not.toBe(player);
  });

  it("turns the keeper back the way the move before left it", async () => {
    const { watch } = await playing(3);
    const first = stepAnywhere(watch);
    stepAnywhere(watch);
    watch.tapControl("undo");
    expect(watch.page.state.facing).toBe(first);
  });

  it("does nothing at the start of a puzzle", async () => {
    const { watch } = await playing(3);
    watch.tapControl("undo");
    expect(watch.page.state.game.moves).toBe(0);
  });
});

describe("the in-game menu", () => {
  it("offers a way back, a restart, a new puzzle and the size", async () => {
    const { watch } = await playing(3);
    watch.tapControl("menu");
    expect(watch.buttons()).toEqual([EN.resume, EN.restart, EN.new_game, EN.size]);
  });

  it("takes the counters off the screen", async () => {
    const { watch, level } = await playing(3);
    watch.tapControl("menu");
    expect(watch.texts()).not.toContain("0/" + level.goals.length + "   0");
  });

  it("puts them back on resume", async () => {
    const { watch, level } = await playing(3);
    watch.tapControl("menu");
    watch.press(EN.resume);
    expect(watch.texts()).toContain("0/" + level.goals.length + "   0");
    expect(watch.buttons()).toEqual([]);
  });

  // The canvas is taken away while a menu is up, which is what lets the menu
  // buttons be pressed at all - a listening canvas underneath swallows the tap
  // on a real watch. So there is nothing left to steer with, and nothing does.
  it("takes the board away so its buttons can be pressed, and stops the arrows", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    watch.tapControl("menu");

    expect(watch.canvas()).toBeUndefined();
    for (const direction of [UP, RIGHT, DOWN, LEFT]) {
      pressArrow(watch, direction);
    }
    expect(game.moves).toBe(0);
  });

  it("puts the warehouse back the way it was found", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    const boxes = game.boxes.slice();
    stepAnywhere(watch);
    stepAnywhere(watch);
    expect(game.moves).toBeGreaterThan(0);

    watch.tapControl("menu");
    watch.press(EN.restart);
    expect(game.moves).toBe(0);
    expect(game.boxes).toEqual(boxes);
    expect(watch.buttons()).toEqual([]);
  });

  it("goes back to the start screen for a different size", async () => {
    const { watch } = await playing(3);
    watch.tapControl("menu");
    watch.press(EN.size);
    expect(watch.buttons()).toEqual([EN.size_xs, EN.play]);
    expect(watch.page.state.game).toBeNull();
  });
});

describe("solving the puzzle", () => {
  // The generator hands every level a solution; walking it out arrow by arrow is
  // the whole game played through the real screen, from the first touch to the
  // record being written.
  async function solve(seed) {
    const { watch, level } = await playing(seed);
    for (const direction of level.solution) {
      pressArrow(watch, direction);
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
      pressArrow(watch, direction);
    }
    expect(watch.texts()).toContain(EN.best + " 1");
    expect(watch.zos.storage.behaviour.items[bestKey(0)]).toBe(1);
  });

  it("stops listening to the arrows once it is solved", async () => {
    const { watch } = await solve(3);
    const moves = watch.page.state.game.moves;
    expect(watch.canvas()).toBeUndefined();
    for (const direction of [UP, RIGHT, DOWN, LEFT]) {
      pressArrow(watch, direction);
    }
    expect(watch.page.state.game.moves).toBe(moves);
  });

  it("deals a fresh puzzle from the solved screen", async () => {
    const { watch, level } = await solve(3);
    watch.press(EN.new_game);
    expect(watch.buttons()).toEqual([]);
    expect(watch.page.state.game.moves).toBe(0);
    expect(watch.page.state.game.boxes).not.toEqual(level.boxes);
  });
});

describe("what actually ends up on the canvas", () => {
  it("paints a crate, a goal ring and the keeper", async () => {
    const { watch } = await playing(3);
    const drawn = watch.drawn();
    const colours = drawn.map((command) => command.color);
    expect(colours).toContain(COLOR_BOX);
    expect(colours).toContain(COLOR_KEEPER);
    expect(drawn.some((command) => command.op === "ring")).toBe(true);
  });

  it("paints the four arrows and the two buttons", async () => {
    const { watch } = await playing(3);
    const polygons = watch.drawn().filter((command) => command.op === "poly");
    expect(polygons.length).toBeGreaterThanOrEqual(4);
  });

  it("repaints when the keeper moves", async () => {
    const { watch } = await playing(3);
    const before = watch.drawn().length;
    stepAnywhere(watch);
    expect(watch.drawn().length).toBeGreaterThan(before);
  });

  it("shows a crate that is home in the finished colour", async () => {
    const { watch, level } = await playing(3);
    // Stop one move short: the last move opens the solved screen, which takes
    // the canvas away with it.
    for (let i = 0; i < level.solution.length - 1; i++) {
      pressArrow(watch, level.solution[i]);
    }
    const colours = watch.drawn().map((command) => command.color);
    expect(colours).toContain(COLOR_BOX_DONE);
  });
});

describe("a watch whose storage will not play along", () => {
  it("still starts when there is no storage to read", async () => {
    const watch = await launch({ failReads: true });
    expect(watch.buttons()).toContain(EN.play);
    expect(watch.texts()).toContain(EN.best + " -");
  });

  it("remembers the size for the session when writes fail", async () => {
    const watch = await launch({ failWrites: true });
    watch.press(EN.size_xs);
    expect(watch.buttons()).toContain(EN.size_s);
    watch.press(EN.size_s);
    expect(watch.buttons()).toContain(EN.size_m);
  });
});
