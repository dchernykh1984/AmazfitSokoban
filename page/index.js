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
import { LEVEL_KEY, bestKey, hasBest, normalizeMoves, updateBest } from "../lib/scores.js";
import { BUILT_IN, SOURCE_KEY, clampSource, nextSource, sourceLabel } from "../lib/sources.js";
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

    this.drawCanvas();
    onGesture({ callback: (gesture) => this.onGesture(gesture) });
    this.showStart();
  },

  onDestroy() {
    this.state.destroyed = true;
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
    return this.state.screen === "playing";
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
    if (!move(this.state.game, direction).moved) {
      return;
    }
    this.state.facing = direction;
    this.lookAtKeeper();
    this.paintBoard();
    this.paintCounter();
    if (isSolved(this.state.game)) {
      this.showSolved();
    }
  },

  // Undo also turns the keeper back the way the previous move left it, so the
  // figure never faces a direction the game is not in.
  undoStep() {
    if (this.state.screen !== "playing" || !undo(this.state.game)) {
      return;
    }
    const history = this.state.game.history;
    this.state.facing = history.length > 0 ? history[history.length - 1].direction : -1;
    this.lookAtKeeper();
    this.paintBoard();
    this.paintCounter();
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
    this.state.screen = "start";
    this.state.game = null;
    this.clearCounter();

    const spec = levelSpec(this.state.level);
    const best = this.state.best;
    this.drawMenu([
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
    ]);
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
    const level = this.dealLevel(spec);
    if (level === null || level === undefined) {
      return;
    }

    this.clearMenu();
    this.drawCanvas();
    this.state.screen = "playing";
    this.state.game = createGame(level);
    this.state.facing = -1;
    this.state.camera = createCamera(level.cols, level.rows, spec.visible, this.state.board.cell);
    centerCamera(
      this.state.camera,
      columnOf(this.state.game, level.player),
      rowOf(this.state.game, level.player)
    );
    cancelTouch(this.state.touch);

    this.paintBoard();
    this.paintControls();
    this.paintCounter();
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
    this.paintControls();
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

  // Run the primitives a lib/paint function produced. The page knows these five
  // shapes and nothing else about how the game looks.
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
        canvas.setPaint({ color: command.color, line_width: 2 });
        canvas.drawLine({
          x1: command.x1,
          y1: command.y1,
          x2: command.x2,
          y2: command.y2,
          color: command.color,
        });
      } else if (command.op === "poly") {
        canvas.drawPoly({ data_array: command.points, color: command.color });
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
    this.runCommands([
      {
        op: "rect",
        x1: board.x - BOARD_EDGE_WIDTH,
        y1: board.y - BOARD_EDGE_WIDTH,
        x2: board.x + board.size + BOARD_EDGE_WIDTH,
        y2: board.y + board.size + BOARD_EDGE_WIDTH,
        color: COLOR_BOARD_EDGE,
      },
    ]);

    const range = visibleCells(camera);
    for (let row = range.fromY; row <= range.toY; row++) {
      for (let column = range.fromX; column <= range.toX; column++) {
        const box = cellBox(camera, board, column, row);
        this.runCommands(paintCell(cellKind(game, column, row), box, this.state.facing));
      }
    }

    this.paintControls();
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
        } else {
          this.state.menu.push(
            this.createText(box, Math.round(item.height * 0.76), item.color, item.text)
          );
        }
      }
      y += item.height;
    }
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
