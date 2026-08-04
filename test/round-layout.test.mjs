import { describe, it, expect } from "vitest";
import { LABELS } from "../lib/i18n/labels.js";
import { LANGUAGES } from "../lib/i18n/index.js";
import { LEVELS } from "../lib/levels.js";
import { seeded } from "./helpers/ascii-level.mjs";
import { launch } from "./helpers/watch.mjs";

// Both round resolutions the app is built for.
const SCREENS = [466, 480];

const EN = LABELS.en;

// A round watch has no corners: a box that would be fine on a square screen can
// have its ends sliced off by the bezel. Text and buttons are the widgets that
// have to stay whole - the board tiles and the menu scrim are deliberately
// allowed to run to the edge and be clipped.
function corners(box) {
  return [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
}

function readableWidgets(watch) {
  const ui = watch.zos.ui;
  return ui.widgets.filter(
    (created) => created.type === ui.widget.TEXT || created.type === ui.widget.BUTTON
  );
}

function expectOnScreen(watch, where) {
  const radius = watch.size / 2;
  const found = readableWidgets(watch);
  expect(found.length, where + ": nothing readable on screen").toBeGreaterThan(0);

  for (const created of found) {
    const box = created.props;
    const label = where + " '" + box.text + "'";
    expect(box.w, label + " has no width").toBeGreaterThan(0);
    expect(box.h, label + " has no height").toBeGreaterThan(0);
    for (const [x, y] of corners(box)) {
      const dx = x - radius;
      const dy = y - radius;
      expect(Math.sqrt(dx * dx + dy * dy), label + " escapes the bezel").toBeLessThanOrEqual(
        radius
      );
    }
  }
}

// Nothing may overlap either: a counter drawn over a button is unreachable.
function expectNoOverlap(watch, where) {
  const boxes = readableWidgets(watch).map((created) => created.props);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      expect(apart, where + ": '" + a.text + "' overlaps '" + b.text + "'").toBe(true);
    }
  }
}

describe("the round screen", () => {
  for (const screen of SCREENS) {
    describe(screen + "px", () => {
      it("keeps the start screen inside the bezel", async () => {
        const watch = await launch({ screen });
        expectOnScreen(watch, screen + " start");
        expectNoOverlap(watch, screen + " start");
      });

      for (let level = 0; level < LEVELS.length; level++) {
        it("keeps the " + LEVELS[level].id + " game furniture inside the bezel", async () => {
          const watch = await launch({ screen, random: seeded(level * 31 + 5) });
          for (let i = 0; i < level; i++) {
            watch.press(EN[LEVELS[i].label]);
          }
          watch.press(EN.play);

          const where = screen + " " + LEVELS[level].id;
          expectOnScreen(watch, where);
          expectNoOverlap(watch, where);

          // The board itself has to clear the bezel as well, frame and all.
          const board = watch.page.state.board;
          expectOnScreen(watch, where);
          expect(board.x).toBeGreaterThan(0);
          expect(board.y + board.size).toBeLessThan(screen);
        });
      }

      it("keeps the in-game menu inside the bezel", async () => {
        const watch = await launch({ screen, random: seeded(7) });
        watch.press(EN.play);
        watch.press(EN.menu);
        expectOnScreen(watch, screen + " menu");
        expectNoOverlap(watch, screen + " menu");
      });
    });
  }

  // Every language has to fit the same boxes; a label that is too wide is simply
  // clipped by the firmware, which is why keys.js carries a character budget.
  it("lays the start screen out the same whatever the language", async () => {
    for (let code = 0; code < LANGUAGES.length; code++) {
      const watch = await launch({ screen: 466, language: [2, 4, 7, 6, 10][code % 5] });
      expectOnScreen(watch, "language " + code);
      expectNoOverlap(watch, "language " + code);
    }
  });
});
