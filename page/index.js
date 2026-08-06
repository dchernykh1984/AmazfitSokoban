import * as hmUI from "@zos/ui";
import { getLanguage } from "@zos/settings";
import { onGesture, offGesture } from "@zos/interaction";
import { setPageBrightTime, resetPageBrightTime } from "@zos/display";
import { LocalStorage } from "@zos/storage";
import { O_RDONLY, closeSync, openAssetsSync, readSync } from "@zos/fs";

import { boardLayout } from "../lib/board.js";
import {
  ARROWS,
  BOARD,
  MENU,
  UNDO,
  controlLayout,
  hitTest,
  isDirectionHit,
} from "../lib/controls.js";
import { generateLevel } from "../lib/generator.js";
import {
  DONE,
  RUNNING,
  generationProgress,
  generationResult,
  startGeneration,
  stepGeneration,
} from "../lib/generator-steps.js";
import { labelFor, languageFromZeppCode } from "../lib/i18n/index.js";
import { LEVELS, clampLevel, levelSpec, nextLevel } from "../lib/levels.js";
import { COLOR_EMPTY, paintArrow, paintCell, paintMenuIcon, paintUndoIcon } from "../lib/paint.js";
import { cellKind } from "../lib/render.js";
import { centeredBox } from "../lib/round-geometry.js";
import { openCollection, readLevel, sectionFor } from "../lib/level-store.js";
import {
  decodeProgress,
  encodeProgress,
  markPlayed,
  pickUnplayed,
  progressKey,
} from "../lib/progress.js";
import { SAVE_KEY, decodeSave, encodeSave } from "../lib/save.js";
import { LEVEL_KEY, bestKey, hasBest, normalizeMoves, updateBest } from "../lib/scores.js";
import {
  BUILT_IN,
  SOURCES,
  SOURCE_KEY,
  clampSource,
  nextSource,
  sourceLabel,
} from "../lib/sources.js";
import {
  boxesOnGoals,
  columnOf,
  createGame,
  isSolved,
  move,
  restart,
  rowOf,
  undo,
} from "../lib/sokoban.js";
import { beginTouch, cancelTouch, createTouch, endTouch, moveTouch } from "../lib/touch.js";
import {
  cellBox,
  centerCamera,
  createCamera,
  followCamera,
  panCamera,
  visibleCells,
} from "../lib/viewport.js";
import { SCREEN_SIZE } from "../utils/config/device.js";
import {
  BRIGHT_TIME_MS,
  BUTTON_HEIGHT_FRACTION,
  COLOR_ACCENT,
  COLOR_BACKGROUND,
  COLOR_BOARD_EDGE,
  COLOR_BUTTON,
  COLOR_BUTTON_PRESSED,
  COLOR_MUTED,
  COLOR_TEXT,
  FOLLOW_MARGIN,
  MENU_WIDTH_FRACTION,
  SCRIM_ALPHA,
  SCREEN_PADDING,
  STACK_GAP_FRACTION,
  TAP_SLOP_FRACTION,
  TEXT_BIG_FRACTION,
  TEXT_ROW_FRACTION,
  TEXT_SMALL_FRACTION,
} from "../utils/config/constants.js";

// One window layout and one control layout per size, worked out once.
const BOARDS = LEVELS.map((level) => boardLayout(SCREEN_SIZE, level.visible));
const LAYOUTS = BOARDS.map((board) => controlLayout(SCREEN_SIZE, board));

// The menu type scale, derived from the diameter so it holds at both round
// resolutions and does not move when the board behind it changes size.
const TEXT_BIG = Math.round(SCREEN_SIZE * TEXT_BIG_FRACTION);
const TEXT_ROW = Math.round(SCREEN_SIZE * TEXT_ROW_FRACTION);
const TEXT_SMALL = Math.round(SCREEN_SIZE * TEXT_SMALL_FRACTION);
const BUTTON_HEIGHT = Math.round(SCREEN_SIZE * BUTTON_HEIGHT_FRACTION);
const STACK_GAP = Math.round(SCREEN_SIZE * STACK_GAP_FRACTION);
const MENU_WIDTH = Math.round(SCREEN_SIZE * MENU_WIDTH_FRACTION);
const TAP_SLOP = Math.round(SCREEN_SIZE * TAP_SLOP_FRACTION);

const BOARD_EDGE_WIDTH = 3;
const PROGRESS_HEIGHT = Math.round(SCREEN_SIZE * 0.09);

// The packed collection, built from maps/*.sok by scripts/pack-maps.mjs.
const LEVELS_FILE = "levels.bin";

// A widget that failed to take a setting is not worth crashing a game over, and
// a watch that has no storage should still play - just without remembering.
const memory = {};

// The in-memory copy is consulted whenever storage has nothing to say, not only
// when there is no storage at all: a watch that reads fine but refuses to write
// would otherwise forget the record between two screens of one session.
function readValue(storage, key) {
  if (storage) {
    try {
      const stored = storage.getItem(key);
      if (stored !== null && stored !== undefined && stored !== "") {
        return stored;
      }
    } catch {
      // Fall through to the in-memory copy.
    }
  }
  return memory[key];
}

function readNumber(storage, key) {
  return normalizeMoves(readValue(storage, key));
}

function readText(storage, key) {
  const value = readValue(storage, key);
  return value === undefined || value === null ? "" : String(value);
}

function writeText(storage, key, value) {
  memory[key] = value;
  if (storage) {
    try {
      storage.setItem(key, value);
    } catch {
      // The in-memory copy above still holds for this session.
    }
  }
}

// Read `length` bytes at `offset` out of the packed collection in the app's
// assets. The file is opened for each read rather than held open: a read happens
// twice per game, and a descriptor left open across a suspend is worth less than
// the microseconds it saves.
function assetReader(offset, length) {
  let fd = null;
  try {
    fd = openAssetsSync({ path: LEVELS_FILE, flag: O_RDONLY });
    if (fd === undefined || fd === null || fd < 0) {
      return null;
    }
    const buffer = new ArrayBuffer(length);
    const read = readSync({ fd, buffer, options: { length, position: offset } });
    if (read < length) {
      return null;
    }
    return new Uint8Array(buffer);
  } catch {
    return null;
  } finally {
    if (fd !== null && fd !== undefined && fd >= 0) {
      try {
        closeSync({ fd });
      } catch {
        // Nothing useful to do about a descriptor that will not close.
      }
    }
  }
}

function writeNumber(storage, key, value) {
  memory[key] = value;
  if (storage) {
    try {
      storage.setItem(key, value);
    } catch {
      // The in-memory copy above still holds for this session.
    }
  }
}

Page({
  state: {
    language: "en",
    level: 0,
    source: BUILT_IN,
    best: 0,
    // The packed collection: its section table, and which level was dealt, so a
    // finished puzzle can be struck off the list.
    collection: null,
    dealt: -1,
    // Whether there is a game left unfinished. The game itself is only decoded
    // when the player actually asks to continue.
    hasSave: false,
    // The generation in flight, and the widgets showing how it is going.
    run: null,
    runTimer: null,
    progress: null,
    screen: "start",
    storage: null,
    destroyed: false,
    // The puzzle, where the window is looking at it, and which way the keeper
    // last pushed - which is the direction it is drawn facing.
    game: null,
    board: BOARDS[0],
    layout: LAYOUTS[0],
    camera: null,
    facing: -1,
    // Input, and where the map was when the current drag started.
    touch: null,
    panFrom: { x: 0, y: 0 },
    // Widgets. The whole game screen is one canvas; the menus are widgets laid
    // over it, because a button that lights up when pressed is worth having.
    canvas: null,
    counter: null,
    menu: [],
  },

  build() {
    try {
      this.state.language = languageFromZeppCode(getLanguage());
    } catch {
      // Some firmwares do not expose the setting; English rather than a blank
      // screen from a throw inside build().
    }

    try {
      this.state.storage = new LocalStorage();
    } catch {
      // No storage on this device: play on, remembering only for this session.
    }

    try {
      setPageBrightTime({ brightTime: BRIGHT_TIME_MS });
    } catch {
      // Not fatal: the watch just keeps its own timeout.
    }

    this.state.touch = createTouch(TAP_SLOP);
    this.state.source = clampSource(readText(this.state.storage, SOURCE_KEY));
    this.useSize(readValue(this.state.storage, LEVEL_KEY));
    this.state.best = readNumber(this.state.storage, this.bestKeyNow());

    // The section table is the only part of the collection ever held in memory;
    // a level is read straight out of the file when a game starts.
    this.state.collection = openCollection(assetReader);
    this.state.hasSave = decodeSave(readText(this.state.storage, SAVE_KEY)) !== null;

    this.drawCanvas();
    onGesture({ callback: (gesture) => this.onGesture(gesture) });
    this.showStart();
  },

  onDestroy() {
    this.state.destroyed = true;
    this.stopGeneration();
    try {
      offGesture();
    } catch {
      // Nothing left to unhook.
    }
    try {
      resetPageBrightTime();
    } catch {
      // The setting is dropped with the page anyway.
    }
  },

  // The board and the controls are laid out per size, because a bigger warehouse
  // is shown through a window of smaller cells.
  stopGeneration() {
    if (this.state.runTimer !== null) {
      clearTimeout(this.state.runTimer);
      this.state.runTimer = null;
    }
    this.state.run = null;
  },

  useSize(level) {
    this.state.level = clampLevel(level);
    this.state.board = BOARDS[this.state.level];
    this.state.layout = LAYOUTS[this.state.level];
  },

  // ---------------------------------------------------------------- input ----

  // Dragging the map is a long swipe, and Zepp OS reads long swipes as system
  // gestures: right leaves the app, down and up open the system panels. Any of
  // them lands mid-puzzle and takes the position with it, so while a game is on
  // screen every gesture is swallowed and the menu button is the way out.
  onGesture() {
    if (this.state.destroyed) {
      return false;
    }
    // Also swallowed while a warehouse is being generated: a stray swipe there
    // would leave the app half way through building a level.
    return this.state.screen === "playing" || this.state.screen === "generating";
  },

  // The canvas is the whole screen: it draws the board and the controls, and it
  // is what every touch lands on.
  //
  // It is DELETED whenever a menu opens, and rebuilt when the game comes back.
  // That is not tidiness - it is required. On a real watch a canvas that is
  // listening swallows the touch even when a button is drawn on top of it, so
  // leaving it up makes every menu button dead. Found on the simulator, where
  // the start screen would not respond to anything at all.
  drawCanvas() {
    if (this.state.canvas) {
      return;
    }
    const canvas = hmUI.createWidget(hmUI.widget.CANVAS, {
      x: 0,
      y: 0,
      w: SCREEN_SIZE,
      h: SCREEN_SIZE,
    });
    canvas.addEventListener(hmUI.event.CLICK_DOWN, (info) => this.onTouchDown(info));
    canvas.addEventListener(hmUI.event.MOVE, (info) => this.onTouchMove(info));
    canvas.addEventListener(hmUI.event.CLICK_UP, (info) => this.onTouchUp(info));
    canvas.addEventListener(hmUI.event.MOVE_OUT, () => cancelTouch(this.state.touch));
    this.state.canvas = canvas;
  },

  onTouchDown(info) {
    if (this.state.destroyed || this.state.screen !== "playing") {
      return;
    }
    beginTouch(this.state.touch, info.x, info.y);
    this.state.panFrom = { x: this.state.camera.x, y: this.state.camera.y };
  },

  // Only a drag that STARTED on the board pans the map: a finger sliding off an
  // arrow must not drag the warehouse out from under it.
  onTouchMove(info) {
    if (this.state.destroyed || this.state.screen !== "playing") {
      return;
    }
    const moved = moveTouch(this.state.touch, info.x, info.y);
    if (!moved.dragging) {
      return;
    }
    if (hitTest(this.state.layout, this.state.touch.startX, this.state.touch.startY) !== BOARD) {
      return;
    }

    const camera = this.state.camera;
    const wasX = camera.x;
    const wasY = camera.y;
    panCamera(camera, this.state.panFrom, moved.dx, moved.dy);
    if (camera.x !== wasX || camera.y !== wasY) {
      this.paintBoard();
    }
  },

  // A tap acts on whatever control it landed on. A drag never acts at all - it
  // has already moved the map.
  onTouchUp(info) {
    if (this.state.destroyed || this.state.screen !== "playing") {
      return;
    }
    const end = endTouch(this.state.touch, info.x, info.y);
    if (!end.tap) {
      return;
    }

    const hit = hitTest(this.state.layout, end.x, end.y);
    if (isDirectionHit(hit)) {
      this.step(hit);
    } else if (hit === UNDO) {
      this.undoStep();
    } else if (hit === MENU) {
      this.showMenu();
    }
  },

  step(direction) {
    const game = this.state.game;
    const wasPlayer = game.player;
    const wasBoxes = game.boxes.slice();

    if (!move(game, direction).moved) {
      return;
    }
    this.state.facing = direction;
    this.repaintAfterMove(wasPlayer, wasBoxes);
    this.paintCounter();

    if (isSolved(game)) {
      this.showSolved();
      return;
    }
    this.saveGame();
  },

  // Undo also turns the keeper back the way the previous move left it, so the
  // figure never faces a direction the game is not in.
  undoStep() {
    if (this.state.screen !== "playing") {
      return;
    }
    const game = this.state.game;
    const wasPlayer = game.player;
    const wasBoxes = game.boxes.slice();
    if (!undo(game)) {
      return;
    }
    const history = this.state.game.history;
    this.state.facing = history.length > 0 ? history[history.length - 1].direction : -1;
    this.repaintAfterMove(wasPlayer, wasBoxes);
    this.paintCounter();
    this.saveGame();
  },

  // Written after every move rather than on the way out: a watch can kill an app
  // without ever calling onDestroy, and a position lost that way is exactly the
  // one worth keeping.
  saveGame() {
    if (this.state.game === null) {
      return;
    }
    const source = SOURCES.indexOf(this.state.source);
    const text = encodeSave(this.state.level, source < 0 ? 0 : source, this.state.game);
    writeText(this.state.storage, SAVE_KEY, text);
    // Only a flag is kept, not a decoded copy: this runs after every single
    // move, and parsing back the string that was just written would be pure
    // waste. The start screen only needs to know whether there IS a save; it
    // reads the real one when the player asks to continue.
    this.state.hasSave = true;
  },

  // A finished warehouse is not worth coming back to.
  forgetSave() {
    writeText(this.state.storage, SAVE_KEY, "");
    this.state.hasSave = false;
  },

  // A step changes three cells at most - where the keeper was, where it is, and
  // where a crate went - so repainting the whole window would be a hundred times
  // the work for nothing. The exception is a step that scrolls the map, where
  // everything moves and the lot has to be redrawn.
  repaintAfterMove(wasPlayer, wasBoxes) {
    const camera = this.state.camera;
    const wasX = camera.x;
    const wasY = camera.y;
    this.lookAtKeeper();

    if (camera.x !== wasX || camera.y !== wasY) {
      this.paintBoard();
      return;
    }

    const game = this.state.game;
    const touched = [wasPlayer, game.player];
    for (let i = 0; i < wasBoxes.length; i++) {
      if (wasBoxes[i] !== game.boxes[i]) {
        touched.push(wasBoxes[i], game.boxes[i]);
      }
    }
    for (let i = 0; i < touched.length; i++) {
      this.paintOneCell(columnOf(game, touched[i]), rowOf(game, touched[i]));
    }
  },

  paintOneCell(column, row) {
    const camera = this.state.camera;
    const box = cellBox(camera, this.state.board, column, row);
    this.runCommands(paintCell(cellKind(this.state.game, column, row), box, this.state.facing));
  },

  // Scroll the map only when the keeper gets close to the edge of the window, so
  // a map you deliberately dragged elsewhere is left where you put it.
  lookAtKeeper() {
    const game = this.state.game;
    followCamera(
      this.state.camera,
      columnOf(game, game.player),
      rowOf(game, game.player),
      FOLLOW_MARGIN
    );
  },

  // ---------------------------------------------------------------- screens ----

  showStart() {
    this.stopGeneration();
    this.state.screen = "start";
    this.state.game = null;
    this.clearCounter();

    const spec = levelSpec(this.state.level);
    const best = this.state.best;
    const items = [
      { kind: "text", height: TEXT_BIG, color: COLOR_TEXT, text: this.text("title") },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "text",
        height: TEXT_ROW,
        color: COLOR_MUTED,
        text: this.text("best") + " " + (hasBest(best) ? best : "-"),
      },
      { kind: "gap", height: STACK_GAP },
      { kind: "text", height: TEXT_SMALL, color: COLOR_MUTED, text: this.text("size") },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text(spec.label),
        onClick: () => this.cycleSize(),
      },
      { kind: "gap", height: STACK_GAP },
      { kind: "text", height: TEXT_SMALL, color: COLOR_MUTED, text: this.text("source") },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text(sourceLabel(this.state.source)),
        onClick: () => this.cycleSource(),
      },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("play"),
        onClick: () => this.startGame(),
      },
    ];

    // A warehouse left unfinished is the first thing offered: the big sizes take
    // more than one sitting, and losing that position would be the whole point
    // of saving it.
    if (this.state.hasSave) {
      items.splice(items.length - 1, 0, {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("continue"),
        onClick: () => this.resumeSaved(),
      });
      items.splice(items.length - 1, 0, { kind: "gap", height: STACK_GAP });
    }

    this.drawMenu(items);
  },

  // Pick the unfinished warehouse back up exactly where it was left.
  resumeSaved() {
    const saved = decodeSave(readText(this.state.storage, SAVE_KEY));
    if (!saved) {
      // The save went bad between the start screen being drawn and the button
      // being pressed. Better a fresh start screen than a broken board.
      this.state.hasSave = false;
      this.showStart();
      return;
    }

    this.useSize(saved.level);
    this.state.source = clampSource(SOURCES[saved.source]);
    this.state.best = readNumber(this.state.storage, this.bestKeyNow());
    this.state.dealt = -1;

    this.clearMenu();
    this.drawCanvas();
    this.state.screen = "playing";
    this.state.game = saved.game;
    this.state.facing =
      saved.game.history.length > 0
        ? saved.game.history[saved.game.history.length - 1].direction
        : -1;
    this.state.camera = createCamera(
      saved.game.cols,
      saved.game.rows,
      levelSpec(this.state.level).visible,
      this.state.board.cell
    );
    centerCamera(
      this.state.camera,
      columnOf(saved.game, saved.game.player),
      rowOf(saved.game, saved.game.player)
    );
    cancelTouch(this.state.touch);

    this.paintBoard();
    this.paintCounter();
  },

  // The record is kept per size AND per source: a level the watch rolled is not
  // the same challenge as one that was solved and vetted before it shipped.
  bestKeyNow() {
    return bestKey(this.state.level, this.state.source);
  },

  cycleSource() {
    this.state.source = nextSource(this.state.source);
    writeText(this.state.storage, SOURCE_KEY, this.state.source);
    this.state.best = readNumber(this.state.storage, this.bestKeyNow());
    this.showStart();
  },

  // Walk to the next size and remember it, so the game reopens the way it was
  // left. Each size keeps its own best, so that is reloaded too.
  cycleSize() {
    this.useSize(nextLevel(this.state.level));
    writeNumber(this.state.storage, LEVEL_KEY, this.state.level);
    this.state.best = readNumber(this.state.storage, this.bestKeyNow());
    this.showStart();
  },

  // A warehouse from the shipped collection when there is one, otherwise one
  // generated here and now. A collection that is missing or damaged silently
  // falls back to generating, so the game always has something to play.
  dealLevel(spec) {
    this.state.dealt = -1;
    if (this.state.source !== BUILT_IN) {
      return generateLevel(spec, Math.random);
    }

    const section = sectionFor(this.state.collection, spec.cols);
    if (section === null) {
      return generateLevel(spec, Math.random);
    }

    const progress = this.readProgress(spec, section.count);
    const pick = pickUnplayed(progress, Math.random);
    const level = readLevel(assetReader, section, pick.index);
    if (level === null) {
      return generateLevel(spec, Math.random);
    }

    this.state.dealt = pick.index;
    if (pick.wrapped) {
      // Every warehouse of this size has been finished; the slate was just
      // wiped, so save the fresh one rather than the full one.
      this.writeProgress(spec, progress);
    }
    return level;
  },

  readProgress(spec, count) {
    return decodeProgress(readText(this.state.storage, progressKey(spec.id)), count);
  },

  writeProgress(spec, progress) {
    writeText(this.state.storage, progressKey(spec.id), encodeProgress(progress));
  },

  // Strike the finished warehouse off the list, so it is not dealt again until
  // every other one of its size has been played.
  markDealtSolved() {
    if (this.state.dealt < 0 || this.state.source !== BUILT_IN) {
      return;
    }
    const spec = levelSpec(this.state.level);
    const section = sectionFor(this.state.collection, spec.cols);
    if (section === null) {
      return;
    }
    const progress = this.readProgress(spec, section.count);
    markPlayed(progress, this.state.dealt);
    this.writeProgress(spec, progress);
  },

  startGame() {
    const spec = levelSpec(this.state.level);

    // Generating on the watch takes long enough to be worth showing, and a
    // frozen screen would be the alternative: nothing repaints while a
    // single-threaded generator runs. So it is done a slice at a time behind a
    // progress bar. Reading one out of the shipped collection is instant and
    // needs none of this.
    if (this.state.source !== BUILT_IN) {
      this.showGenerating(spec);
      return;
    }

    const level = this.dealLevel(spec);
    if (level === null || level === undefined) {
      return;
    }

    this.beginGame(spec, level, -1);
  },

  // Put a warehouse on screen and start playing it.
  beginGame(spec, level, facing) {
    this.clearMenu();
    this.drawCanvas();
    this.state.screen = "playing";
    this.state.game = createGame(level);
    this.state.facing = facing;
    this.state.camera = createCamera(level.cols, level.rows, spec.visible, this.state.board.cell);
    centerCamera(
      this.state.camera,
      columnOf(this.state.game, level.player),
      rowOf(this.state.game, level.player)
    );
    cancelTouch(this.state.touch);

    this.paintBoard();
    this.paintCounter();
    this.saveGame();
  },

  // The progress screen, and the timer that drives the generation. Each tick
  // does one attempt and then hands control back, which is what lets the bar
  // actually move.
  showGenerating(spec) {
    this.state.screen = "generating";
    this.state.run = startGeneration(spec, Math.random);
    this.clearCounter();
    this.drawMenu([
      { kind: "text", height: TEXT_ROW, color: COLOR_TEXT, text: this.text("generating") },
      { kind: "gap", height: STACK_GAP },
      { kind: "progress" },
    ]);

    // The first attempt is scheduled rather than run here: doing it inline would
    // finish a small warehouse before the screen had ever been painted, and the
    // player would see the progress screen flash past for no reason.
    this.state.runTimer = setTimeout(() => this.tickGeneration(), 1);
  },

  tickGeneration() {
    if (this.state.destroyed || this.state.screen !== "generating" || this.state.run === null) {
      return;
    }

    stepGeneration(this.state.run);
    this.paintProgress(generationProgress(this.state.run));

    if (this.state.run.status === RUNNING) {
      this.state.runTimer = setTimeout(() => this.tickGeneration(), 1);
      return;
    }

    const level = this.state.run.status === DONE ? generationResult(this.state.run) : null;
    this.state.run = null;
    this.state.runTimer = null;

    if (level === null) {
      // Nothing usable came out. Say so rather than opening an empty board.
      this.showStart();
      return;
    }
    this.beginGame(levelSpec(this.state.level), level, -1);
  },

  paintProgress(fraction) {
    if (!this.state.progress) {
      return;
    }
    const full = this.state.progress.full;
    this.state.progress.bar.setProperty(hmUI.prop.MORE, {
      x: full.x,
      y: full.y,
      w: Math.max(1, Math.round(full.w * fraction)),
      h: full.h,
      radius: Math.round(full.h / 2),
      color: COLOR_ACCENT,
    });
  },

  // Same warehouse, back at the start. What Sokoban needs when a crate has been
  // pushed into a corner and undo is too far back to be worth it.
  restartGame() {
    if (this.state.game === null) {
      return;
    }
    restart(this.state.game);
    this.state.facing = -1;
    centerCamera(
      this.state.camera,
      columnOf(this.state.game, this.state.game.player),
      rowOf(this.state.game, this.state.game.player)
    );
    this.resumeGame();
  },

  showMenu() {
    if (this.state.screen !== "playing") {
      return;
    }
    this.state.screen = "menu";
    this.clearCounter();
    this.drawMenu([
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("resume"),
        onClick: () => this.resumeGame(),
      },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("restart"),
        onClick: () => this.restartGame(),
      },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("new_game"),
        onClick: () => this.startGame(),
      },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("size"),
        onClick: () => this.showStart(),
      },
    ]);
  },

  resumeGame() {
    if (this.state.game === null) {
      return;
    }
    this.clearMenu();
    this.drawCanvas();
    this.state.screen = "playing";
    cancelTouch(this.state.touch);
    this.paintBoard();
    this.paintCounter();
  },

  // The solved warehouse stays on screen under the panel, because seeing where
  // the last crate went is half the reward.
  showSolved() {
    this.state.screen = "solved";
    this.clearCounter();

    const moves = this.state.game.moves;
    const result = updateBest(this.state.best, moves);
    this.state.best = result.best;
    if (result.isRecord) {
      writeNumber(this.state.storage, this.bestKeyNow(), result.best);
    }
    this.markDealtSolved();
    this.forgetSave();

    this.drawMenu([
      { kind: "text", height: TEXT_BIG, color: COLOR_ACCENT, text: this.text("solved") },
      { kind: "gap", height: STACK_GAP },
      { kind: "text", height: TEXT_ROW, color: COLOR_TEXT, text: this.text("moves") + " " + moves },
      {
        kind: "text",
        height: TEXT_ROW,
        color: result.isRecord ? COLOR_ACCENT : COLOR_MUTED,
        text: result.isRecord ? this.text("new_best") : this.text("best") + " " + result.best,
      },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("new_game"),
        onClick: () => this.startGame(),
      },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("size"),
        onClick: () => this.showStart(),
      },
    ]);
  },

  // ---------------------------------------------------------------- drawing ----

  // Run the primitives a lib/paint function produced. The page knows these four
  // shapes and nothing else about how the game looks. There is deliberately no
  // polygon among them: the watch takes one and draws nothing.
  runCommands(commands) {
    const canvas = this.state.canvas;
    if (!canvas) {
      return;
    }
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.op === "rect") {
        canvas.drawRect({
          x1: command.x1,
          y1: command.y1,
          x2: command.x2,
          y2: command.y2,
          color: command.color,
        });
      } else if (command.op === "disc") {
        canvas.drawCircle({
          center_x: command.x,
          center_y: command.y,
          radius: command.radius,
          color: command.color,
        });
      } else if (command.op === "ring") {
        canvas.setPaint({ color: command.color, line_width: command.width });
        canvas.strokeCircle({
          center_x: command.x,
          center_y: command.y,
          radius: command.radius,
          color: command.color,
        });
      } else if (command.op === "line") {
        canvas.setPaint({ color: command.color, line_width: command.width || 2 });
        canvas.drawLine({
          x1: command.x1,
          y1: command.y1,
          x2: command.x2,
          y2: command.y2,
          color: command.color,
        });
      }
    }
  },

  paintBackground() {
    this.runCommands([
      { op: "rect", x1: 0, y1: 0, x2: SCREEN_SIZE, y2: SCREEN_SIZE, color: COLOR_EMPTY },
    ]);
  },

  // The warehouse, drawn cell by cell through the window. Only the cells the
  // camera can see are drawn, and the offset is in pixels, so the map slides
  // under the finger rather than jumping a whole cell at a time.
  paintBoard() {
    const game = this.state.game;
    const camera = this.state.camera;
    const board = this.state.board;
    if (game === null || camera === null) {
      return;
    }

    this.paintBackground();

    const range = visibleCells(camera);
    for (let row = range.fromY; row <= range.toY; row++) {
      for (let column = range.fromX; column <= range.toX; column++) {
        const box = cellBox(camera, board, column, row);
        this.runCommands(paintCell(cellKind(game, column, row), box, this.state.facing));
      }
    }

    this.paintWindowEdge();
    this.paintControls();
  },

  // Paint over whatever hung out of the window, then draw the frame around it.
  //
  // A cell at the edge is only partly inside the window and is drawn whole -
  // there is no clipping on this canvas, it is the entire screen - so without
  // this the warehouse spills a strip of crates and floor across the arrows and
  // over the rim of a round face. Doing it as four rectangles afterwards costs
  // four draws and keeps every cell pixel-exact, which cropping them one by one
  // would not: a crate is a circle and a keeper is a disc, and neither survives
  // being cut in half by arithmetic.
  paintWindowEdge() {
    const board = this.state.board;
    const right = board.x + board.size;
    const bottom = board.y + board.size;
    const edge = BOARD_EDGE_WIDTH;

    this.runCommands([
      { op: "rect", x1: 0, y1: 0, x2: SCREEN_SIZE, y2: board.y, color: COLOR_EMPTY },
      { op: "rect", x1: 0, y1: bottom, x2: SCREEN_SIZE, y2: SCREEN_SIZE, color: COLOR_EMPTY },
      { op: "rect", x1: 0, y1: board.y, x2: board.x, y2: bottom, color: COLOR_EMPTY },
      { op: "rect", x1: right, y1: board.y, x2: SCREEN_SIZE, y2: bottom, color: COLOR_EMPTY },

      { op: "rect", x1: board.x - edge, y1: board.y - edge, x2: right + edge, y2: board.y, color: COLOR_BOARD_EDGE }, // prettier-ignore
      { op: "rect", x1: board.x - edge, y1: bottom, x2: right + edge, y2: bottom + edge, color: COLOR_BOARD_EDGE }, // prettier-ignore
      {
        op: "rect",
        x1: board.x - edge,
        y1: board.y,
        x2: board.x,
        y2: bottom,
        color: COLOR_BOARD_EDGE,
      },
      { op: "rect", x1: right, y1: board.y, x2: right + edge, y2: bottom, color: COLOR_BOARD_EDGE },
    ]);
  },

  // The arrows and the two buttons, drawn after the board so a cell that hangs
  // over the edge of the window cannot paint over them.
  paintControls() {
    const layout = this.state.layout;
    for (let i = 0; i < ARROWS.length; i++) {
      const arrow = ARROWS[i];
      this.runCommands(paintArrow(arrow.direction, layout[arrow.key], COLOR_TEXT));
    }
    this.runCommands(paintUndoIcon(layout.undo, COLOR_TEXT));
    this.runCommands(paintMenuIcon(layout.menu, COLOR_TEXT));
  },

  // Crates home out of the total, and how many moves that has taken. A widget
  // rather than canvas text, because it is re-lettered on every step and a
  // widget can be handed a new string without repainting anything.
  paintCounter() {
    const game = this.state.game;
    if (game === null) {
      return;
    }
    const text = boxesOnGoals(game) + "/" + game.goals.length + "   " + game.moves;

    if (this.state.counter) {
      this.state.counter.setProperty(hmUI.prop.MORE, { text });
      return;
    }

    const area = this.state.layout.counter;
    this.state.counter = this.createText(area, Math.round(area.h * 0.86), COLOR_TEXT, text);
  },

  clearCounter() {
    if (this.state.counter) {
      hmUI.deleteWidget(this.state.counter);
      this.state.counter = null;
    }
  },

  // A vertical stack of texts and buttons, centred on the screen over a scrim so
  // it stays readable on top of a half-solved warehouse.
  drawMenu(items) {
    this.clearMenu();
    this.removeCanvas();

    this.state.progress = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "progress") {
        items[i].height = PROGRESS_HEIGHT;
      }
    }

    let height = 0;
    for (let i = 0; i < items.length; i++) {
      height += items[i].height;
    }

    this.state.menu.push(
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: SCREEN_SIZE,
        h: SCREEN_SIZE,
        color: COLOR_BACKGROUND,
        alpha: SCRIM_ALPHA,
      })
    );

    let y = Math.max(0, Math.round((SCREEN_SIZE - height) / 2));
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "gap") {
        const box = centeredBox(SCREEN_SIZE, y, item.height, MENU_WIDTH, SCREEN_PADDING);
        if (item.kind === "button") {
          this.state.menu.push(this.createButton(box, item.text, item.onClick));
        } else if (item.kind === "progress") {
          this.state.menu.push(this.createProgressTrack(box));
        } else {
          this.state.menu.push(
            this.createText(box, Math.round(item.height * 0.76), item.color, item.text)
          );
        }
      }
      y += item.height;
    }
  },

  // A progress bar as two rectangles: the track, and the bar that grows over it.
  createProgressTrack(box) {
    const height = Math.max(6, Math.round(box.h * 0.5));
    const full = { x: box.x, y: box.y + Math.round((box.h - height) / 2), w: box.w, h: height };

    const track = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: full.x,
      y: full.y,
      w: full.w,
      h: full.h,
      radius: Math.round(full.h / 2),
      color: COLOR_BUTTON,
    });
    const bar = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: full.x,
      y: full.y,
      w: 1,
      h: full.h,
      radius: Math.round(full.h / 2),
      color: COLOR_ACCENT,
    });

    this.state.progress = { full, bar };
    this.state.menu.push(track);
    return bar;
  },

  createText(box, size, color, text) {
    return hmUI.createWidget(hmUI.widget.TEXT, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      color,
      text_size: size,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
      text,
    });
  },

  createButton(box, text, onClick) {
    return hmUI.createWidget(hmUI.widget.BUTTON, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      radius: Math.round(box.h / 2),
      normal_color: COLOR_BUTTON,
      press_color: COLOR_BUTTON_PRESSED,
      color: COLOR_TEXT,
      text_size: Math.round(box.h * 0.42),
      text,
      click_func: onClick,
    });
  },

  clearMenu() {
    for (let i = 0; i < this.state.menu.length; i++) {
      hmUI.deleteWidget(this.state.menu[i]);
    }
    this.state.menu = [];
  },

  // Take the canvas away so the buttons underneath a menu can actually be
  // pressed. Everything it was showing is redrawn when the game resumes.
  removeCanvas() {
    if (this.state.canvas) {
      hmUI.deleteWidget(this.state.canvas);
      this.state.canvas = null;
    }
  },

  text(key) {
    return labelFor(this.state.language, key);
  },
});
