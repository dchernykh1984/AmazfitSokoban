import { describe, it, expect } from "vitest";
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
import { DOWN, LEFT, RIGHT, UP } from "../lib/directions.js";
import { LEVELS } from "../lib/levels.js";

const SCREENS = [466, 480];

function layoutFor(screen, visible) {
  const board = boardLayout(screen, visible);
  return { board, layout: controlLayout(screen, board) };
}

function centreOf(area) {
  return { x: area.x + Math.floor(area.w / 2), y: area.y + Math.floor(area.h / 2) };
}

describe("controlLayout", () => {
  it("puts an arrow in each of the four segments around the board", () => {
    const { board, layout } = layoutFor(466, 11);

    expect(layout.left.x + layout.left.w).toBeLessThanOrEqual(board.x);
    expect(layout.right.x).toBeGreaterThanOrEqual(board.x + board.size);
    expect(layout.up.y + layout.up.h).toBeLessThanOrEqual(board.y);
    expect(layout.down.y).toBeGreaterThanOrEqual(board.y + board.size);
  });

  it("puts the counters above the up arrow in the top segment", () => {
    for (const screen of SCREENS) {
      for (const spec of LEVELS) {
        const { board, layout } = layoutFor(screen, spec.visible);
        const where = screen + " " + spec.id;
        expect(layout.counter.y, where).toBeGreaterThanOrEqual(0);
        expect(layout.counter.y + layout.counter.h, where).toBeLessThanOrEqual(layout.up.y);
        expect(layout.up.y + layout.up.h, where).toBeLessThanOrEqual(board.y);
        expect(layout.counter.h, where).toBeGreaterThan(10);
      }
    }
  });

  it("lines undo, down and menu up in the bottom segment", () => {
    const { layout } = layoutFor(466, 11);
    expect(layout.undo.y).toBe(layout.down.y);
    expect(layout.menu.y).toBe(layout.down.y);
    expect(layout.undo.x + layout.undo.w).toBeLessThanOrEqual(layout.down.x);
    expect(layout.down.x + layout.down.w).toBeLessThanOrEqual(layout.menu.x);
  });

  it("gives every control something to hit", () => {
    for (const screen of SCREENS) {
      for (const spec of LEVELS) {
        const { layout } = layoutFor(screen, spec.visible);
        for (const key of ["up", "down", "left", "right", "undo", "menu", "board"]) {
          expect(layout[key].w, screen + " " + spec.id + " " + key).toBeGreaterThan(10);
          expect(layout[key].h, screen + " " + spec.id + " " + key).toBeGreaterThan(10);
        }
      }
    }
  });

  it("keeps every control on the screen", () => {
    for (const screen of SCREENS) {
      for (const spec of LEVELS) {
        const { layout } = layoutFor(screen, spec.visible);
        for (const key of ["up", "down", "left", "right", "undo", "menu", "board"]) {
          const area = layout[key];
          const where = screen + " " + spec.id + " " + key;
          expect(area.x, where).toBeGreaterThanOrEqual(0);
          expect(area.y, where).toBeGreaterThanOrEqual(0);
          expect(area.x + area.w, where).toBeLessThanOrEqual(screen);
          expect(area.y + area.h, where).toBeLessThanOrEqual(screen);
        }
      }
    }
  });

  it("keeps every control inside the round bezel", () => {
    for (const screen of SCREENS) {
      for (const spec of LEVELS) {
        const { layout } = layoutFor(screen, spec.visible);
        const radius = screen / 2;
        for (const key of ["up", "down", "left", "right", "undo", "menu", "counter"]) {
          const area = layout[key];
          const corners = [
            [area.x, area.y],
            [area.x + area.w, area.y],
            [area.x, area.y + area.h],
            [area.x + area.w, area.y + area.h],
          ];
          for (const [x, y] of corners) {
            const dx = x - radius;
            const dy = y - radius;
            const distance = Math.sqrt(dx * dx + dy * dy);
            expect(distance, screen + " " + spec.id + " " + key).toBeLessThanOrEqual(radius);
          }
        }
      }
    }
  });

  it("never lets two controls overlap", () => {
    for (const screen of SCREENS) {
      for (const spec of LEVELS) {
        const { layout } = layoutFor(screen, spec.visible);
        const keys = ["up", "down", "left", "right", "undo", "menu", "board"];
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            const a = layout[keys[i]];
            const b = layout[keys[j]];
            const apart =
              a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
            expect(apart, screen + " " + spec.id + ": " + keys[i] + " and " + keys[j]).toBe(true);
          }
        }
      }
    }
  });
});

describe("hitTest", () => {
  const { board, layout } = layoutFor(466, 11);

  it("finds each arrow under its own centre", () => {
    expect(hitTest(layout, centreOf(layout.up).x, centreOf(layout.up).y)).toBe(UP);
    expect(hitTest(layout, centreOf(layout.down).x, centreOf(layout.down).y)).toBe(DOWN);
    expect(hitTest(layout, centreOf(layout.left).x, centreOf(layout.left).y)).toBe(LEFT);
    expect(hitTest(layout, centreOf(layout.right).x, centreOf(layout.right).y)).toBe(RIGHT);
  });

  it("finds undo and the menu", () => {
    expect(hitTest(layout, centreOf(layout.undo).x, centreOf(layout.undo).y)).toBe(UNDO);
    expect(hitTest(layout, centreOf(layout.menu).x, centreOf(layout.menu).y)).toBe(MENU);
  });

  it("calls the middle of the board the board", () => {
    expect(hitTest(layout, board.x + board.size / 2, board.y + board.size / 2)).toBe(BOARD);
    expect(hitTest(layout, board.x + 1, board.y + 1)).toBe(BOARD);
  });

  it("reports nothing for the dead space between controls", () => {
    expect(hitTest(layout, 2, 2)).toBeNull();
    expect(hitTest(layout, 463, 463)).toBeNull();
  });

  it("answers the same for every point inside a control", () => {
    for (const arrow of ARROWS) {
      const area = layout[arrow.key];
      for (const [x, y] of [
        [area.x, area.y],
        [area.x + area.w - 1, area.y],
        [area.x, area.y + area.h - 1],
        [area.x + area.w - 1, area.y + area.h - 1],
      ]) {
        expect(hitTest(layout, x, y), arrow.key).toBe(arrow.direction);
      }
    }
  });
});

describe("isDirectionHit", () => {
  it("tells a step apart from a button", () => {
    for (const arrow of ARROWS) {
      expect(isDirectionHit(arrow.direction)).toBe(true);
    }
    expect(isDirectionHit(UNDO)).toBe(false);
    expect(isDirectionHit(MENU)).toBe(false);
    expect(isDirectionHit(BOARD)).toBe(false);
    expect(isDirectionHit(null)).toBe(false);
  });
});
