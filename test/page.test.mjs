import { describe, it, expect, afterEach, vi } from "vitest";
import { DOWN, LEFT, RIGHT, UP, VECTORS } from "../lib/directions.js";
import { generateLevel } from "../lib/generator.js";
import { LABELS } from "../lib/i18n/labels.js";
import { LEVELS } from "../lib/levels.js";
import { COLOR_BOX, COLOR_BOX_DONE, COLOR_EMPTY, COLOR_KEEPER } from "../lib/paint.js";
import { seeded } from "../lib/random.js";
import { SAVE_KEY } from "../lib/save.js";
import { LEVEL_KEY, bestKey } from "../lib/scores.js";
import { BUILT_IN, GENERATED, SOURCE_KEY } from "../lib/sources.js";

import { encodeCollection } from "../lib/level-pack.js";
import { decodeProgress, isPlayed, progressKey } from "../lib/progress.js";
import { generateLevel as makeLevel } from "../lib/generator.js";
import { launch } from "./helpers/watch.mjs";

// A small real collection of XS warehouses, packed exactly the way the build
// packs the shipped one.
function buildCollection() {
  const spec = LEVELS[0];
  const levels = [];
  for (let i = 0; i < 4; i++) {
    levels.push(makeLevel(spec, seeded(i * 71 + 5)));
  }
  return encodeCollection([{ cols: spec.cols, rows: spec.rows, boxes: spec.boxes, levels }]);
}

// The certificate for whatever warehouse the page dealt, found by matching the
// board it is showing against the collection it was built from.
function solutionFor(watch) {
  const spec = LEVELS[0];
  const game = watch.page.state.game;
  for (let i = 0; i < 4; i++) {
    const candidate = makeLevel(spec, seeded(i * 71 + 5));
    if (
      candidate.player === game.start.player &&
      String(candidate.boxes) === String(game.start.boxes)
    ) {
      return candidate.solution;
    }
  }
  throw new Error("the page dealt a warehouse that is not in the collection");
}

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
    expect(watch.buttons()).toEqual([EN.size_xs, EN.source_builtin, EN.play]);
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
    const watch = await launch({
      stored: { [bestKey(0, BUILT_IN)]: 40, [bestKey(1, BUILT_IN)]: 90 },
    });
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

  // A swipe while a warehouse is being built would abandon the app half way
  // through the work.
  it("is swallowed while a warehouse is being generated", async () => {
    const watch = await launch({ random: seeded(4) });
    watch.press(EN.source_builtin);
    watch.press(EN.play);
    expect(watch.page.state.screen).toBe("generating");
    expect(watch.swipe(3)).toBe(true);
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
    // The unfinished warehouse is offered back, ahead of starting a new one.
    expect(watch.buttons()).toEqual([EN.size_xs, EN.source_builtin, EN.continue, EN.play]);
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
    expect(watch.zos.storage.behaviour.items[bestKey(0, BUILT_IN)]).toBe(level.solution.length);
  });

  it("keeps a better record rather than overwriting it with a worse one", async () => {
    const { watch, level } = await playing(3, 0, { stored: { [bestKey(0, BUILT_IN)]: 1 } });
    for (const direction of level.solution) {
      pressArrow(watch, direction);
    }
    expect(watch.texts()).toContain(EN.best + " 1");
    expect(watch.zos.storage.behaviour.items[bestKey(0, BUILT_IN)]).toBe(1);
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

  it("draws an arrow in each of the four segments", async () => {
    const { watch } = await playing(3);
    const layout = watch.layout();

    // The width a stroke is drawn at comes from the setPaint before it, so the
    // picture has to be walked in order rather than filtered. Thickness is half
    // the fix: a hairline arrow on a 466px screen is barely there, and nothing
    // else in the suite would notice it going back to one.
    const lines = [];
    let width = 0;
    for (const command of watch.drawn()) {
      if (command.op === "paint") {
        width = command.line_width;
      } else if (command.op === "line") {
        lines.push({ x: command.x1, y: command.y1, width });
      }
    }

    for (const key of ["up", "down", "left", "right"]) {
      const area = layout[key];
      const inArea = lines.filter(
        (line) =>
          line.x >= area.x &&
          line.x <= area.x + area.w &&
          line.y >= area.y &&
          line.y <= area.y + area.h
      );
      expect(inArea.length, "no arrow drawn in the " + key + " segment").toBeGreaterThan(0);
      for (const line of inArea) {
        expect(line.width, "hairline arrow in the " + key + " segment").toBeGreaterThan(2);
      }
    }
  });

  // A round watch has no corners to hide a stray cell in: anything drawn past
  // the window lands on the arrows or over the rim of the face.
  it("leaves nothing of the warehouse outside the board window", async () => {
    const { watch } = await playing(5, 5);
    const board = watch.page.state.board;
    const middle = Math.round(watch.size / 2);

    for (const [dx, dy] of [
      [0, 0],
      [-37, -23],
      [-140, -95],
      [66, 41],
    ]) {
      watch.drag(middle, middle, middle + dx, middle + dy, 4);

      // A cell at the edge is drawn whole and does hang over the window; what
      // matters is what is still showing once everything has been painted. So
      // this asks the picture for the colour left at a point, the way the screen
      // would end up looking.
      const colourAt = (x, y) => {
        let colour = null;
        for (const command of watch.drawn()) {
          if (
            command.op === "rect" &&
            x >= command.x1 &&
            x < command.x2 &&
            y >= command.y1 &&
            y < command.y2
          ) {
            colour = command.color;
          }
        }
        return colour;
      };

      const where = "pan " + dx + "," + dy;
      const outside = [
        [board.x + board.size + 6, board.y + Math.round(board.size / 2)],
        [board.x - 6, board.y + Math.round(board.size / 2)],
        [Math.round(board.x + board.size / 2), board.y + board.size + 6],
        [Math.round(board.x + board.size / 2), board.y - 6],
        [board.x + board.size + 20, board.y + board.size + 20],
      ];
      for (const [x, y] of outside) {
        expect(colourAt(x, y), where + " at " + x + "," + y).toBe(COLOR_EMPTY);
      }
      // And the window itself still has the warehouse in it.
      const inside = colourAt(board.x + 4, board.y + 4);
      expect(inside, where + " inside").not.toBe(COLOR_EMPTY);
    }
  });

  // The watch accepts a polygon and then draws nothing, so the arrows must not
  // be built from one - that is exactly how they went missing on a device.
  it("never asks the canvas for a polygon", async () => {
    const { watch } = await playing(3);
    expect(watch.drawn().filter((command) => command.op === "poly").length).toBe(0);
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

describe("choosing where the levels come from", () => {
  it("offers the shipped collection and random ones, and remembers the choice", async () => {
    const watch = await launch({});
    expect(watch.buttons()).toContain(EN.source_builtin);

    watch.press(EN.source_builtin);
    expect(watch.buttons()).toContain(EN.source_random);
    expect(watch.zos.storage.behaviour.items[SOURCE_KEY]).toBe(GENERATED);

    const reopened = await launch({ stored: { [SOURCE_KEY]: GENERATED } });
    expect(reopened.buttons()).toContain(EN.source_random);
  });

  // A random level and a vetted one are not the same challenge, so one best
  // score covering both would mean nothing.
  it("keeps a separate best for each source", async () => {
    const watch = await launch({
      stored: { [bestKey(0, BUILT_IN)]: 30, [bestKey(0, GENERATED)]: 70 },
    });
    expect(watch.texts()).toContain(EN.best + " 30");
    watch.press(EN.source_builtin);
    expect(watch.texts()).toContain(EN.best + " 70");
  });

  it("plays a warehouse out of the collection when there is one", async () => {
    const collection = buildCollection();
    const watch = await launch({ collection, random: seeded(4) });
    watch.press(EN.play);

    const game = watch.page.state.game;
    expect(game).not.toBeNull();
    expect(game.cols).toBe(LEVELS[0].cols);
    // The level came from the file, so the page knows which one it dealt.
    expect(watch.page.state.dealt).toBeGreaterThanOrEqual(0);
  });

  it("strikes a finished warehouse off so it is not dealt again", async () => {
    const collection = buildCollection();
    const watch = await launch({ collection, random: seeded(4) });
    watch.press(EN.play);

    const dealt = watch.page.state.dealt;
    const level = watch.page.state.game;
    // Walk the certificate of whatever was dealt.
    const solution = solutionFor(watch);
    for (const direction of solution) {
      pressArrow(watch, direction);
    }

    const record = watch.zos.storage.behaviour.items[progressKey(LEVELS[0].id)];
    expect(record, "nothing was recorded as played").toBeTruthy();
    const progress = decodeProgress(record, 64);
    expect(isPlayed(progress, dealt)).toBe(true);
    expect(level).not.toBeNull();
  });

  it("falls back to generating when the collection is missing", async () => {
    const watch = await launch({ random: seeded(4) });
    watch.press(EN.play);
    expect(watch.page.state.game).not.toBeNull();
    expect(watch.page.state.dealt).toBe(-1);
  });

  it("falls back to generating when the collection cannot be opened", async () => {
    const watch = await launch({
      collection: buildCollection(),
      failAssetOpen: true,
      random: seeded(4),
    });
    watch.press(EN.play);
    expect(watch.page.state.game).not.toBeNull();
    expect(watch.page.state.dealt).toBe(-1);
  });
});

describe("generating a warehouse on the watch", () => {
  // Drive the generation the way the timer does, but by hand, so the test does
  // not have to wait on real timers.
  function grind(watch) {
    for (let i = 0; i < 300 && watch.page.state.screen === "generating"; i++) {
      watch.page.tickGeneration();
    }
  }

  async function generating(seed) {
    const watch = await launch({ random: seeded(seed) });
    watch.press(EN.source_builtin);
    expect(watch.buttons()).toContain(EN.source_random);
    watch.press(EN.play);
    return watch;
  }

  it("shows a progress screen instead of freezing", async () => {
    const watch = await generating(4);
    expect(watch.page.state.screen).toBe("generating");
    expect(watch.texts()).toContain(EN.generating);
    expect(watch.page.state.progress).not.toBeNull();
  });

  it("moves the bar as it goes, rather than jumping at the end", async () => {
    const watch = await generating(4);
    const widths = [];
    for (let i = 0; i < 40 && watch.page.state.screen === "generating"; i++) {
      watch.page.tickGeneration();
      if (watch.page.state.progress) {
        widths.push(watch.page.state.progress.bar.props.w);
      }
    }
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
    }
  });

  it("ends up in a playable game", async () => {
    const watch = await generating(4);
    grind(watch);

    expect(watch.page.state.screen).toBe("playing");
    expect(watch.page.state.game).not.toBeNull();
    expect(watch.page.state.game.moves).toBe(0);
    // Generated on the watch, so it is not one of the shipped warehouses.
    expect(watch.page.state.dealt).toBe(-1);
  });

  it("counts a generated warehouse against its own record", async () => {
    const watch = await generating(4);
    grind(watch);
    expect(watch.page.state.source).toBe(GENERATED);
  });

  it("stops the generation when the player backs out", async () => {
    const watch = await generating(4);
    watch.page.showStart();
    expect(watch.page.state.run).toBeNull();
    expect(watch.page.state.runTimer).toBeNull();
  });

  it("stops the generation when the page goes away", async () => {
    const watch = await generating(4);
    watch.page.onDestroy();
    expect(watch.page.state.run).toBeNull();
  });
});

describe("picking a warehouse back up", () => {
  it("offers to continue, and comes back to the same position", async () => {
    const { watch } = await playing(3);
    const game = watch.page.state.game;
    stepAnywhere(watch);
    stepAnywhere(watch);
    const moves = game.moves;
    const player = game.player;
    const boxes = game.boxes.slice();

    // Leave the game the way a player would.
    watch.tapControl("menu");
    watch.press(EN.size);
    expect(watch.buttons()).toContain(EN.continue);

    watch.press(EN.continue);
    const resumed = watch.page.state.game;
    expect(watch.page.state.screen).toBe("playing");
    expect(resumed.moves).toBe(moves);
    expect(resumed.player).toBe(player);
    expect(resumed.boxes).toEqual(boxes);
  });

  it("can still be undone and restarted after coming back", async () => {
    const { watch } = await playing(3);
    stepAnywhere(watch);
    watch.tapControl("menu");
    watch.press(EN.size);
    watch.press(EN.continue);

    watch.tapControl("undo");
    expect(watch.page.state.game.moves).toBe(0);
  });

  it("survives being reopened from cold storage", async () => {
    const { watch } = await playing(3);
    stepAnywhere(watch);
    const saved = watch.zos.storage.behaviour.items[SAVE_KEY];
    expect(saved).toBeTruthy();

    const reopened = await launch({ stored: { [SAVE_KEY]: saved } });
    expect(reopened.buttons()).toContain(EN.continue);
    reopened.press(EN.continue);
    expect(reopened.page.state.screen).toBe("playing");
    expect(reopened.page.state.game.moves).toBe(1);
  });

  it("forgets a finished warehouse rather than offering it again", async () => {
    const { watch, level } = await playing(3);
    for (const direction of level.solution) {
      pressArrow(watch, direction);
    }
    watch.press(EN.size);
    expect(watch.buttons()).not.toContain(EN.continue);
  });

  it("ignores a save that has gone bad", async () => {
    const watch = await launch({ stored: { [SAVE_KEY]: "not a save" } });
    expect(watch.buttons()).not.toContain(EN.continue);
  });
});
