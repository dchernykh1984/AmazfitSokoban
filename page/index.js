import * as hmUI from "@zos/ui";
import { getLanguage } from "@zos/settings";
import { onGesture, offGesture } from "@zos/interaction";
import { setPageBrightTime, resetPageBrightTime } from "@zos/display";
import { LocalStorage } from "@zos/storage";

import { boardLayout, cellRect, insetRect } from "../lib/board.js";
import { generateLevel } from "../lib/generator.js";
import { labelFor, languageFromZeppCode } from "../lib/i18n/index.js";
import { LEVELS, clampLevel, levelSpec, nextLevel } from "../lib/levels.js";
import {
  BOX,
  BOX_ON_GOAL,
  FLOOR,
  GOAL,
  KEEPER,
  KEEPER_ON_GOAL,
  OUTSIDE,
  WALL,
  cellKind,
} from "../lib/render.js";
import { centeredBox, splitRow } from "../lib/round-geometry.js";
import { LEVEL_KEY, bestKey, hasBest, normalizeMoves, updateBest } from "../lib/scores.js";
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
import {
  beginTouch,
  cancelTouch,
  createTouch,
  directionToward,
  endTouch,
  moveTouch,
} from "../lib/touch.js";
import {
  cellFromPoint,
  centerCamera,
  createCamera,
  followCamera,
  panCamera,
} from "../lib/viewport.js";
import { SCREEN_SIZE } from "../utils/config/device.js";
import {
  BOARD_EDGE,
  BRIGHT_TIME_MS,
  BUTTON_HEIGHT_FRACTION,
  CELL_INSET,
  COLOR_ACCENT,
  COLOR_BACKGROUND,
  COLOR_BOARD_EDGE,
  COLOR_BOX,
  COLOR_BOX_DONE,
  COLOR_BUTTON,
  COLOR_BUTTON_PRESSED,
  COLOR_FLOOR,
  COLOR_FLOOR_GOAL,
  COLOR_GOAL,
  COLOR_KEEPER,
  COLOR_MUTED,
  COLOR_TEXT,
  COLOR_WALL,
  FOLLOW_MARGIN,
  INSET_BOX,
  INSET_GOAL,
  INSET_KEEPER,
  MENU_WIDTH_FRACTION,
  SCRIM_ALPHA,
  SCREEN_PADDING,
  STACK_GAP_FRACTION,
  TAP_SLOP_FRACTION,
  TEXT_BIG_FRACTION,
  TEXT_ROW_FRACTION,
  TEXT_SMALL_FRACTION,
  TILE_RADIUS,
} from "../utils/config/constants.js";

// One window layout per difficulty, worked out once: Easy shows seven cells
// across, Hard eleven, so the cells are as big as that difficulty allows.
const BOARDS = LEVELS.map((level) => boardLayout(SCREEN_SIZE, level.visible));

// The menu type scale, derived from the diameter so it holds at both round
// resolutions and does not move when the board behind it changes size.
const TEXT_BIG = Math.round(SCREEN_SIZE * TEXT_BIG_FRACTION);
const TEXT_ROW = Math.round(SCREEN_SIZE * TEXT_ROW_FRACTION);
const TEXT_SMALL = Math.round(SCREEN_SIZE * TEXT_SMALL_FRACTION);
const BUTTON_HEIGHT = Math.round(SCREEN_SIZE * BUTTON_HEIGHT_FRACTION);
const STACK_GAP = Math.round(SCREEN_SIZE * STACK_GAP_FRACTION);
const MENU_WIDTH = Math.round(SCREEN_SIZE * MENU_WIDTH_FRACTION);
const TAP_SLOP = Math.round(SCREEN_SIZE * TAP_SLOP_FRACTION);

// How a cell is painted: the floor tile under it, and the thing standing on it
// drawn inset on top. When the two colours match, nothing is standing there.
const TILE_STYLES = {};
TILE_STYLES[OUTSIDE] = { base: COLOR_BACKGROUND, top: COLOR_BACKGROUND, inset: 0, round: false };
TILE_STYLES[WALL] = { base: COLOR_WALL, top: COLOR_WALL, inset: 0, round: false };
TILE_STYLES[FLOOR] = { base: COLOR_FLOOR, top: COLOR_FLOOR, inset: 0, round: false };
TILE_STYLES[GOAL] = { base: COLOR_FLOOR_GOAL, top: COLOR_GOAL, inset: INSET_GOAL, round: true };
TILE_STYLES[BOX] = { base: COLOR_FLOOR, top: COLOR_BOX, inset: INSET_BOX, round: false };
TILE_STYLES[BOX_ON_GOAL] = {
  base: COLOR_FLOOR_GOAL,
  top: COLOR_BOX_DONE,
  inset: INSET_BOX,
  round: false,
};
TILE_STYLES[KEEPER] = { base: COLOR_FLOOR, top: COLOR_KEEPER, inset: INSET_KEEPER, round: true };
TILE_STYLES[KEEPER_ON_GOAL] = {
  base: COLOR_FLOOR_GOAL,
  top: COLOR_KEEPER,
  inset: INSET_KEEPER,
  round: true,
};

// A widget that failed to take a setting is not worth crashing a game over, and
// a watch that has no storage should still play - just without remembering. The
// in-memory copy keeps the best alive for the rest of the session.
const memory = {};

// The raw stored value, or undefined when there is nothing stored. Kept separate
// from readNumber because "never set" and "set to zero" mean different things to
// the difficulty level.
function readValue(storage, key) {
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      // Fall through to the in-memory copy.
    }
  }
  return memory[key];
}

function readNumber(storage, key) {
  return normalizeMoves(readValue(storage, key));
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
    best: 0,
    screen: "start",
    storage: null,
    destroyed: false,
    // The puzzle and where the window is looking at it.
    game: null,
    board: BOARDS[0],
    camera: null,
    // Input, and where the map was when the current drag started.
    touch: null,
    panFrom: { x: 0, y: 0 },
    // Widgets, grouped by lifetime: the backdrop lives as long as the page, the
    // frame and tiles as long as a game, and the counters, the buttons and the
    // menu as long as a screen.
    frame: null,
    tiles: [],
    painted: [],
    hud: null,
    buttons: [],
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

    // A puzzle is stared at for minutes at a time, and a screen that blacks out
    // mid-thought loses the position. Handed back in onDestroy.
    try {
      setPageBrightTime({ brightTime: BRIGHT_TIME_MS });
    } catch {
      // Not fatal: the watch just keeps its own timeout.
    }

    this.state.touch = createTouch(TAP_SLOP);
    this.state.level = clampLevel(readValue(this.state.storage, LEVEL_KEY));
    this.state.best = readNumber(this.state.storage, bestKey(this.state.level));
    this.state.board = BOARDS[this.state.level];

    this.drawBackdrop();
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

  // ---------------------------------------------------------------- input ----

  // Dragging the map is a long swipe, and Zepp OS reads long swipes as system
  // gestures: right leaves the app, down and up open the system panels. Any of
  // them lands mid-puzzle and takes the position with it, so while a game is on
  // screen every gesture is swallowed and the menu button is the way out. The
  // menus deliberately let them through, which is how you leave.
  onGesture() {
    if (this.state.destroyed) {
      return false;
    }
    return this.state.screen === "playing";
  },

  // The backdrop is created before anything else, so it sits under the whole
  // screen, and it is the only widget that listens for touches: the tiles and the
  // menus are painted over it and carry no listeners of their own, which is what
  // keeps a drag working wherever on the board it starts.
  drawBackdrop() {
    const backdrop = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_SIZE,
      h: SCREEN_SIZE,
      color: COLOR_BACKGROUND,
    });
    backdrop.addEventListener(hmUI.event.CLICK_DOWN, (info) => this.onTouchDown(info));
    backdrop.addEventListener(hmUI.event.MOVE, (info) => this.onTouchMove(info));
    backdrop.addEventListener(hmUI.event.CLICK_UP, (info) => this.onTouchUp(info));
    backdrop.addEventListener(hmUI.event.MOVE_OUT, () => cancelTouch(this.state.touch));
  },

  onTouchDown(info) {
    if (this.state.destroyed || this.state.screen !== "playing") {
      return;
    }
    beginTouch(this.state.touch, info.x, info.y);
    this.state.panFrom = { x: this.state.camera.x, y: this.state.camera.y };
  },

  onTouchMove(info) {
    if (this.state.destroyed || this.state.screen !== "playing") {
      return;
    }
    const moved = moveTouch(this.state.touch, info.x, info.y);
    if (!moved.dragging) {
      return;
    }
    panCamera(this.state.camera, this.state.panFrom, moved.dx, moved.dy, this.state.board.cell);
    this.paintBoard();
  },

  // A tap steps the keeper towards the cell it landed on. Taps outside the board
  // - on the buttons in the caps above and below it - map to no cell and are left
  // to the buttons themselves.
  onTouchUp(info) {
    if (this.state.destroyed || this.state.screen !== "playing") {
      return;
    }
    const end = endTouch(this.state.touch, info.x, info.y);
    if (!end.tap) {
      return;
    }
    const cell = cellFromPoint(this.state.camera, this.state.board, end.x, end.y);
    if (cell === null) {
      return;
    }
    const game = this.state.game;
    const direction = directionToward(
      columnOf(game, game.player),
      rowOf(game, game.player),
      cell.x,
      cell.y
    );
    if (direction !== -1) {
      this.step(direction);
    }
  },

  step(direction) {
    if (!move(this.state.game, direction).moved) {
      return;
    }
    this.lookAtKeeper();
    this.paintBoard();
    this.paintHud();
    if (isSolved(this.state.game)) {
      this.showSolved();
    }
  },

  undoStep() {
    if (this.state.screen !== "playing" || !undo(this.state.game)) {
      return;
    }
    this.lookAtKeeper();
    this.paintBoard();
    this.paintHud();
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
    this.clearHud();
    this.clearTiles();

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
      { kind: "text", height: TEXT_SMALL, color: COLOR_MUTED, text: this.text("level") },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text(spec.label),
        onClick: () => this.cycleLevel(),
      },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("play"),
        onClick: () => this.startGame(),
      },
      { kind: "gap", height: STACK_GAP },
      { kind: "text", height: TEXT_SMALL, color: COLOR_MUTED, text: this.text("hint_move") },
      { kind: "text", height: TEXT_SMALL, color: COLOR_MUTED, text: this.text("hint_pan") },
    ]);
  },

  // Walk to the next difficulty and remember it, so the game reopens the way it
  // was left. Each difficulty keeps its own best, so that is reloaded too.
  cycleLevel() {
    this.state.level = nextLevel(this.state.level);
    writeNumber(this.state.storage, LEVEL_KEY, this.state.level);
    this.state.best = readNumber(this.state.storage, bestKey(this.state.level));
    this.state.board = BOARDS[this.state.level];
    this.showStart();
  },

  // A fresh random warehouse at the current difficulty. Generation is built to
  // always succeed, but it is allowed to give up rather than hang, so a failure
  // leaves the start screen up instead of an empty board.
  startGame() {
    const spec = levelSpec(this.state.level);
    const level = generateLevel(spec, Math.random);
    if (level === null) {
      return;
    }

    this.clearMenu();
    this.state.screen = "playing";
    this.state.board = BOARDS[this.state.level];
    this.state.game = createGame(level);
    this.state.camera = createCamera(level.cols, level.rows, spec.visible);
    centerCamera(
      this.state.camera,
      columnOf(this.state.game, level.player),
      rowOf(this.state.game, level.player)
    );
    cancelTouch(this.state.touch);

    this.buildTiles();
    this.paintBoard();
    this.paintHud();
    this.showPlayButtons();
  },

  // Same warehouse, back at the start. What Sokoban needs when a box has been
  // pushed into a corner and undo is too far back to be worth it.
  restartGame() {
    if (this.state.game === null) {
      return;
    }
    restart(this.state.game);
    centerCamera(
      this.state.camera,
      columnOf(this.state.game, this.state.game.player),
      rowOf(this.state.game, this.state.game.player)
    );
    this.resumeGame();
    this.paintBoard();
  },

  showMenu() {
    if (this.state.screen !== "playing") {
      return;
    }
    this.state.screen = "menu";
    this.clearHud();
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
        text: this.text("level"),
        onClick: () => this.showStart(),
      },
    ]);
  },

  resumeGame() {
    if (this.state.game === null) {
      return;
    }
    this.clearMenu();
    this.state.screen = "playing";
    cancelTouch(this.state.touch);
    this.paintHud();
    this.showPlayButtons();
  },

  // The solved warehouse stays on screen under the panel, because seeing where
  // the last crate went is half the reward.
  showSolved() {
    this.state.screen = "solved";
    this.clearHud();

    const moves = this.state.game.moves;
    const result = updateBest(this.state.best, moves);
    this.state.best = result.best;
    if (result.isRecord) {
      writeNumber(this.state.storage, bestKey(this.state.level), result.best);
    }

    this.drawMenu([
      { kind: "text", height: TEXT_BIG, color: COLOR_ACCENT, text: this.text("solved") },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "text",
        height: TEXT_ROW,
        color: COLOR_TEXT,
        text: this.text("moves") + " " + moves,
      },
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
        text: this.text("level"),
        onClick: () => this.showStart(),
      },
    ]);
  },

  // ---------------------------------------------------------------- drawing ----

  // One widget pair per window slot, created once per game and then only ever
  // recoloured. Panning a map by rebuilding a hundred widgets per frame would
  // never keep up with a finger; moving the window over a fixed grid does.
  buildTiles() {
    this.clearTiles();
    const board = this.state.board;

    this.state.frame = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: board.x - BOARD_EDGE,
      y: board.y - BOARD_EDGE,
      w: board.size + 2 * BOARD_EDGE,
      h: board.size + 2 * BOARD_EDGE,
      radius: BOARD_EDGE * 3,
      color: COLOR_BOARD_EDGE,
    });

    for (let row = 0; row < board.cells; row++) {
      for (let column = 0; column < board.cells; column++) {
        const tile = cellRect(board, column, row, CELL_INSET);
        const base = hmUI.createWidget(hmUI.widget.FILL_RECT, {
          x: tile.x,
          y: tile.y,
          w: tile.w,
          h: tile.h,
          radius: TILE_RADIUS,
          color: COLOR_BACKGROUND,
        });
        const top = hmUI.createWidget(hmUI.widget.FILL_RECT, {
          x: tile.x,
          y: tile.y,
          w: tile.w,
          h: tile.h,
          radius: TILE_RADIUS,
          color: COLOR_BACKGROUND,
        });
        this.state.tiles.push({ base, top, box: tile, column, row });
        this.state.painted.push(null);
      }
    }
  },

  // Repaint only the slots whose contents changed. A step changes three or four
  // of them; a drag of the map changes a stripe down one side.
  paintBoard() {
    const game = this.state.game;
    const camera = this.state.camera;
    const board = this.state.board;
    if (game === null || camera === null) {
      return;
    }

    for (let i = 0; i < this.state.tiles.length; i++) {
      const tile = this.state.tiles[i];
      const kind = cellKind(game, camera.x + tile.column, camera.y + tile.row);
      if (this.state.painted[i] === kind) {
        continue;
      }
      this.state.painted[i] = kind;

      const style = TILE_STYLES[kind];
      tile.base.setProperty(hmUI.prop.MORE, {
        x: tile.box.x,
        y: tile.box.y,
        w: tile.box.w,
        h: tile.box.h,
        radius: TILE_RADIUS,
        color: style.base,
      });

      const top = insetRect(board, tile.column, tile.row, style.inset, CELL_INSET);
      tile.top.setProperty(hmUI.prop.MORE, {
        x: top.x,
        y: top.y,
        w: top.w,
        h: top.h,
        radius: style.round ? Math.floor(top.w / 2) : TILE_RADIUS,
        color: style.top,
      });
    }
  },

  // The counters in the cap above the board: crates home out of the total, and
  // how many moves that has taken.
  // The widget is created once per game and then only ever re-lettered: a step
  // changes the counters, and deleting and rebuilding a widget on every step is
  // far more work than handing it a new string.
  paintHud() {
    const game = this.state.game;
    if (game === null) {
      return;
    }

    const text = boxesOnGoals(game) + "/" + game.goals.length + "   " + game.moves;
    if (this.state.hud) {
      this.state.hud.setProperty(hmUI.prop.MORE, { text });
      return;
    }

    const board = this.state.board;
    const height = Math.round(board.y * 0.5);
    const box = centeredBox(
      SCREEN_SIZE,
      Math.round(board.y * 0.28),
      height,
      board.size,
      SCREEN_PADDING
    );
    this.state.hud = this.createText(box, Math.round(height * 0.74), COLOR_TEXT, text);
  },

  // Undo and Menu, side by side in the cap below the board. They exist only while
  // a game is actually running, so they cannot be tapped through a menu that is
  // covering them.
  showPlayButtons() {
    this.clearButtons();
    const board = this.state.board;
    const bottom = board.y + board.size;
    const cap = SCREEN_SIZE - bottom;
    const height = Math.round(cap * 0.62);
    const row = centeredBox(
      SCREEN_SIZE,
      bottom + Math.round(cap * 0.12),
      height,
      MENU_WIDTH,
      SCREEN_PADDING
    );

    const boxes = splitRow(row, 2, STACK_GAP);
    this.state.buttons.push(this.createButton(boxes[0], this.text("undo"), () => this.undoStep()));
    this.state.buttons.push(this.createButton(boxes[1], this.text("menu"), () => this.showMenu()));
  },

  // A vertical stack of texts and buttons, centred on the screen over a scrim so
  // it stays readable on top of a half-solved warehouse.
  drawMenu(items) {
    this.clearMenu();
    this.clearButtons();

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

  // ---------------------------------------------------------------- teardown ----

  clearTiles() {
    for (let i = 0; i < this.state.tiles.length; i++) {
      hmUI.deleteWidget(this.state.tiles[i].base);
      hmUI.deleteWidget(this.state.tiles[i].top);
    }
    this.state.tiles = [];
    this.state.painted = [];
    if (this.state.frame) {
      hmUI.deleteWidget(this.state.frame);
      this.state.frame = null;
    }
  },

  // Take the counters and the play buttons off the screen. Called whenever a menu
  // opens over the board, so nothing of the game's own furniture is left showing
  // through - or tappable - underneath it.
  clearHud() {
    if (this.state.hud) {
      hmUI.deleteWidget(this.state.hud);
      this.state.hud = null;
    }
    this.clearButtons();
  },

  clearButtons() {
    for (let i = 0; i < this.state.buttons.length; i++) {
      hmUI.deleteWidget(this.state.buttons[i]);
    }
    this.state.buttons = [];
  },

  clearMenu() {
    for (let i = 0; i < this.state.menu.length; i++) {
      hmUI.deleteWidget(this.state.menu[i]);
    }
    this.state.menu = [];
  },

  text(key) {
    return labelFor(this.state.language, key);
  },
});
