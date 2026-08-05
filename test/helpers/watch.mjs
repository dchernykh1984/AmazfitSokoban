// A fake watch to run page/index.js on.
//
// `launch` gives every test a completely fresh copy of the page and of the
// @zos/* doubles it talks to (vitest.config.mjs aliases the firmware modules at
// resolution time), then drives it the way a finger would: press, move, lift,
// swipe, and tap the buttons that are actually on screen.
import { vi } from "vitest";

const ZOS = ["ui", "settings", "interaction", "display", "storage", "device"];

export async function launch(options) {
  const settings = options || {};

  // A fresh module registry, so the page's state, its widgets and the doubles'
  // recorded calls never leak from one test into the next.
  vi.resetModules();

  const zos = {};
  for (const name of ZOS) {
    zos[name] = await import("../doubles/zos/" + name + ".js");
  }

  const size = settings.screen || 466;
  zos.device.device.width = size;
  zos.device.device.height = size;
  zos.settings.language.code = settings.language === undefined ? 2 : settings.language;

  zos.storage.resetStorage();
  Object.assign(zos.storage.behaviour.items, settings.stored || {});
  zos.storage.behaviour.failReads = Boolean(settings.failReads);
  zos.storage.behaviour.failWrites = Boolean(settings.failWrites);

  if (settings.random) {
    vi.spyOn(Math, "random").mockImplementation(settings.random);
  }

  let page = null;
  globalThis.Page = (definition) => {
    page = definition;
  };
  await import("../../page/index.js");
  if (page === null) {
    throw new Error("page/index.js did not register a page");
  }

  const watch = {
    page,
    zos,
    size,

    // ---- reading the screen ----

    widgetsOfType(type) {
      return zos.ui.widgets.filter((created) => created.type === type);
    },

    texts() {
      return this.widgetsOfType(zos.ui.widget.TEXT).map((created) => created.props.text);
    },

    buttons() {
      return this.widgetsOfType(zos.ui.widget.BUTTON).map((created) => created.props.text);
    },

    button(label) {
      return this.widgetsOfType(zos.ui.widget.BUTTON).find(
        (created) => created.props.text === label
      );
    },

    press(label) {
      const target = this.button(label);
      if (!target) {
        throw new Error("no button labelled '" + label + "' on screen: " + this.buttons());
      }
      target.props.click_func();
      return this;
    },

    // The canvas the page draws on and hangs its touch listeners on.
    backdrop() {
      return zos.ui.widgets.find((created) => created.listeners[zos.ui.event.CLICK_DOWN]);
    },

    canvas() {
      return this.backdrop();
    },

    // Everything the page has drawn since the last clear.
    drawn() {
      const canvas = this.canvas();
      return canvas ? canvas.drawn : [];
    },

    // Where the controls are, straight from the page.
    layout() {
      return page.state.layout;
    },

    // Tap the middle of a named control: "up", "down", "left", "right",
    // "undo" or "menu".
    tapControl(name) {
      const area = page.state.layout[name];
      if (!area) {
        throw new Error("no control called " + name);
      }
      return this.tap(area.x + Math.floor(area.w / 2), area.y + Math.floor(area.h / 2));
    },

    // ---- touching it ----

    touchDown(x, y) {
      const surface = this.backdrop();
      if (surface) {
        surface.fire(zos.ui.event.CLICK_DOWN, { x, y });
      }
      return this;
    },

    touchMove(x, y) {
      const surface = this.backdrop();
      if (surface) {
        surface.fire(zos.ui.event.MOVE, { x, y });
      }
      return this;
    },

    touchUp(x, y) {
      const surface = this.backdrop();
      if (surface) {
        surface.fire(zos.ui.event.CLICK_UP, { x, y });
      }
      return this;
    },

    tap(x, y) {
      return this.touchDown(x, y).touchUp(x, y);
    },

    drag(fromX, fromY, toX, toY, steps) {
      const count = steps || 4;
      this.touchDown(fromX, fromY);
      for (let i = 1; i <= count; i++) {
        this.touchMove(
          Math.round(fromX + ((toX - fromX) * i) / count),
          Math.round(fromY + ((toY - fromY) * i) / count)
        );
      }
      return this.touchUp(toX, toY);
    },

    swipe(gesture) {
      return zos.interaction.gestures.callback(gesture);
    },

    // The middle of a board cell, in screen pixels, as the window is looking at
    // the warehouse right now. The camera offset is in pixels.
    cellCenter(column, row) {
      const board = page.state.board;
      const camera = page.state.camera;
      const half = Math.floor(camera.cell / 2);
      return {
        x: board.x + column * camera.cell - camera.x + half,
        y: board.y + row * camera.cell - camera.y + half,
      };
    },
  };

  page.build();
  return watch;
}
