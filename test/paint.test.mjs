import { describe, it, expect } from "vitest";
import { DOWN, LEFT, RIGHT, UP } from "../lib/directions.js";
import {
  COLOR_BOX,
  COLOR_BOX_DONE,
  COLOR_GOAL,
  COLOR_KEEPER,
  paintArrow,
  paintCell,
  paintMenuIcon,
  paintUndoIcon,
} from "../lib/paint.js";
import {
  CELL_KINDS,
  BOX,
  BOX_ON_GOAL,
  FLOOR,
  GOAL,
  KEEPER,
  KEEPER_ON_GOAL,
  OUTSIDE,
  WALL,
} from "../lib/render.js";

const BOX_AT = { x: 100, y: 200, w: 40, h: 40 };
const TINY = { x: 0, y: 0, w: 25, h: 25 };

function opsOf(list) {
  return list.map((command) => command.op);
}

function colours(list) {
  return list.map((command) => command.color);
}

// Everything a command can be must stay inside the cell it belongs to, or one
// cell would paint over its neighbour.
function expectInside(list, box) {
  for (const command of list) {
    if (command.op === "rect" || command.op === "line") {
      for (const x of [command.x1, command.x2]) {
        expect(x, command.op).toBeGreaterThanOrEqual(box.x);
        expect(x, command.op).toBeLessThanOrEqual(box.x + box.w);
      }
      for (const y of [command.y1, command.y2]) {
        expect(y, command.op).toBeGreaterThanOrEqual(box.y);
        expect(y, command.op).toBeLessThanOrEqual(box.y + box.h);
      }
    } else {
      const reach = command.radius + (command.width || 0) / 2;
      expect(command.x - reach, command.op).toBeGreaterThanOrEqual(box.x);
      expect(command.x + reach, command.op).toBeLessThanOrEqual(box.x + box.w);
      expect(command.y - reach, command.op).toBeGreaterThanOrEqual(box.y);
      expect(command.y + reach, command.op).toBeLessThanOrEqual(box.y + box.h);
    }
  }
}

describe("paintCell", () => {
  it("draws something for every kind the rules can produce", () => {
    for (const kind of CELL_KINDS) {
      const commands = paintCell(kind, BOX_AT, RIGHT);
      expect(commands.length, kind).toBeGreaterThan(0);
      for (const command of commands) {
        expect(["rect", "ring", "disc", "line"], kind).toContain(command.op);
        expect(typeof command.color, kind).toBe("number");
      }
    }
  });

  it("keeps every cell inside its own square, at any size", () => {
    for (const kind of CELL_KINDS) {
      for (const box of [BOX_AT, TINY, { x: 7, y: 9, w: 46, h: 46 }]) {
        expectInside(paintCell(kind, box, DOWN), box);
      }
    }
  });

  it("paints an off-board cell as plain background", () => {
    const commands = paintCell(OUTSIDE, BOX_AT, RIGHT);
    expect(commands.length).toBe(1);
    expect(commands[0].op).toBe("rect");
  });

  it("gives a wall a lighter edge so the maze reads at a glance", () => {
    const commands = paintCell(WALL, BOX_AT, RIGHT);
    expect(opsOf(commands)).toEqual(["rect", "rect"]);
    expect(commands[0].color).not.toBe(commands[1].color);
  });

  it("marks a goal with a ring rather than a pit", () => {
    const commands = paintCell(GOAL, BOX_AT, RIGHT);
    expect(opsOf(commands)).toContain("ring");
    expect(colours(commands)).toContain(COLOR_GOAL);
  });

  it("draws a crate as a bordered box with bracing", () => {
    const commands = paintCell(BOX, BOX_AT, RIGHT);
    expect(colours(commands)).toContain(COLOR_BOX);
    // Two diagonals across the crate.
    expect(commands.filter((command) => command.op === "line").length).toBe(2);
  });

  it("colours a crate that is home differently, and keeps the ring under it", () => {
    const done = paintCell(BOX_ON_GOAL, BOX_AT, RIGHT);
    expect(colours(done)).toContain(COLOR_BOX_DONE);
    expect(colours(done)).not.toContain(COLOR_BOX);
    expect(opsOf(done)).toContain("ring");
  });

  it("draws the keeper as a disc with a marker", () => {
    const commands = paintCell(KEEPER, BOX_AT, RIGHT);
    const discs = commands.filter((command) => command.op === "disc");
    expect(discs.length).toBe(2);
    expect(discs[0].color).toBe(COLOR_KEEPER);
  });

  it("turns the keeper to face the way it last pushed", () => {
    const marker = (facing) => {
      const discs = paintCell(KEEPER, BOX_AT, facing).filter((c) => c.op === "disc");
      return { x: discs[1].x, y: discs[1].y };
    };
    const centre = { x: BOX_AT.x + 20, y: BOX_AT.y + 20 };

    expect(marker(UP).y).toBeLessThan(centre.y);
    expect(marker(DOWN).y).toBeGreaterThan(centre.y);
    expect(marker(LEFT).x).toBeLessThan(centre.x);
    expect(marker(RIGHT).x).toBeGreaterThan(centre.x);
    expect(marker(UP).x).toBe(centre.x);
    expect(marker(LEFT).y).toBe(centre.y);
  });

  it("still draws a keeper that has not pushed anything yet", () => {
    const commands = paintCell(KEEPER, BOX_AT, -1);
    expect(commands.filter((command) => command.op === "disc").length).toBe(2);
  });

  it("keeps the goal ring visible under the keeper standing on it", () => {
    const commands = paintCell(KEEPER_ON_GOAL, BOX_AT, UP);
    expect(opsOf(commands)).toContain("ring");
    expect(colours(commands)).toContain(COLOR_KEEPER);
  });

  it("draws plain floor with no furniture on it", () => {
    const commands = paintCell(FLOOR, BOX_AT, RIGHT);
    expect(opsOf(commands)).toEqual(["rect", "rect"]);
  });

  it("never collapses a shape to nothing on the smallest cells", () => {
    for (const kind of [BOX, BOX_ON_GOAL, KEEPER, GOAL]) {
      for (const command of paintCell(kind, { x: 0, y: 0, w: 18, h: 18 }, UP)) {
        if (command.op === "rect") {
          expect(command.x2 - command.x1, kind).toBeGreaterThan(0);
          expect(command.y2 - command.y1, kind).toBeGreaterThan(0);
        } else if (command.op !== "line") {
          expect(command.radius, kind).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("the drawn controls", () => {
  const BUTTON = { x: 40, y: 400, w: 60, h: 50 };
  const WHITE = 0xffffff;

  // Drawn as a chevron of two thick strokes, NOT as a polygon: `drawPoly` is
  // accepted by the watch and then draws nothing, which is how the arrows came
  // to be missing on a real device while every line-drawn icon showed up.
  it("draws each arrow as two thick strokes, never a polygon", () => {
    for (const direction of [UP, RIGHT, DOWN, LEFT]) {
      const commands = paintArrow(direction, BUTTON, WHITE);
      expect(commands.length, String(direction)).toBe(2);
      for (const command of commands) {
        expect(command.op, String(direction)).toBe("line");
        expect(command.color, String(direction)).toBe(WHITE);
        expect(command.width, String(direction)).toBeGreaterThan(2);
      }
    }
  });

  it("uses no primitive the watch has been seen to ignore", () => {
    const drawable = ["rect", "ring", "disc", "line"];
    for (const direction of [UP, RIGHT, DOWN, LEFT]) {
      for (const command of paintArrow(direction, BUTTON, WHITE)) {
        expect(drawable, String(direction)).toContain(command.op);
      }
    }
    for (const command of paintUndoIcon(BUTTON, WHITE).concat(paintMenuIcon(BUTTON, WHITE))) {
      expect(drawable).toContain(command.op);
    }
  });

  // Pointing the right way is not enough to be an arrow. A single stroke drawn
  // twice, two arms on the same side of the tip, one arm a third the length of
  // the other, a chevron nudged off the button's axis - all of them point the
  // right way and none of them look like an arrow, so the shape itself is what
  // gets checked here.
  it("draws a real chevron, not any old pair of strokes", () => {
    const arms = (direction) => {
      const [first, second] = paintArrow(direction, BUTTON, WHITE);
      const tip = { x: first.x2, y: first.y2 };
      return { tip, a: { x: first.x1, y: first.y1 }, b: { x: second.x2, y: second.y2 } };
    };
    const centre = { x: BUTTON.x + BUTTON.w / 2, y: BUTTON.y + BUTTON.h / 2 };

    for (const [direction, along, across] of [
      [UP, "y", "x"],
      [DOWN, "y", "x"],
      [LEFT, "x", "y"],
      [RIGHT, "x", "y"],
    ]) {
      const { tip, a, b } = arms(direction);
      const name = "arrow " + direction;

      // The arms straddle the tip: one each side, not both on one side.
      expect(Math.sign(a[across] - tip[across]), name + " arms on one side").toBe(
        -Math.sign(b[across] - tip[across])
      );
      expect(a[across], name + " has no width").not.toBe(tip[across]);

      // Both arms trail the tip by the same amount, so the arrow is symmetric.
      expect(a[along], name + " arms uneven").toBe(b[along]);
      expect(Math.abs(a[across] - tip[across]), name + " lopsided").toBe(
        Math.abs(b[across] - tip[across])
      );

      // And it is centred on the button across its pointing axis.
      expect(Math.abs(tip[across] - centre[across]), name + " off centre").toBeLessThanOrEqual(1);

      // Big enough to see: the arms reach a real fraction of the button.
      const span = Math.abs(a[across] - b[across]);
      expect(span, name + " too small").toBeGreaterThanOrEqual(Math.min(BUTTON.w, BUTTON.h) * 0.35);
      expect(Math.abs(a[along] - tip[along]), name + " flat").toBeGreaterThanOrEqual(span * 0.4);
    }
  });

  it("points each arrow the way it is named", () => {
    // The two strokes meet at the tip, which is the point they share.
    const tip = (direction) => {
      const [first, second] = paintArrow(direction, BUTTON, WHITE);
      expect(first.x2).toBe(second.x1);
      expect(first.y2).toBe(second.y1);
      return { x: first.x2, y: first.y2 };
    };
    const centre = { x: BUTTON.x + BUTTON.w / 2, y: BUTTON.y + BUTTON.h / 2 };

    expect(tip(UP).y).toBeLessThan(centre.y);
    expect(tip(DOWN).y).toBeGreaterThan(centre.y);
    expect(tip(LEFT).x).toBeLessThan(centre.x);
    expect(tip(RIGHT).x).toBeGreaterThan(centre.x);
  });

  it("keeps every control inside its button", () => {
    // A stroke is centred on its endpoints, so half of its width hangs outside
    // them: an icon whose endpoints only just reach the edge still spills over
    // it. The shapes the real layout hands out are far from square - a wide
    // shallow strip for the up arrow, tall narrow ones for the sides - and those
    // are exactly the shapes that push a control out of its button.
    const buttons = [BUTTON, { x: 10, y: 20, w: 162, h: 34 }, { x: 10, y: 20, w: 51, h: 110 }];

    const inside = (commands, button) => {
      for (const command of commands) {
        const spill = (command.width || 2) / 2;
        for (const x of [command.x1, command.x2]) {
          expect(x - spill).toBeGreaterThanOrEqual(button.x);
          expect(x + spill).toBeLessThanOrEqual(button.x + button.w);
        }
        for (const y of [command.y1, command.y2]) {
          expect(y - spill).toBeGreaterThanOrEqual(button.y);
          expect(y + spill).toBeLessThanOrEqual(button.y + button.h);
        }
      }
    };

    for (const button of buttons) {
      for (const direction of [UP, RIGHT, DOWN, LEFT]) {
        inside(paintArrow(direction, button, WHITE), button);
      }
    }
    inside(paintUndoIcon(BUTTON, WHITE), BUTTON);
    inside(paintMenuIcon(BUTTON, WHITE), BUTTON);
  });

  it("gives undo and the menu the weight the arrows are drawn at", () => {
    for (const commands of [paintUndoIcon(BUTTON, WHITE, 5), paintMenuIcon(BUTTON, WHITE, 5)]) {
      for (const command of commands) {
        expect(command.width).toBe(5);
      }
    }
    // The menu bars have to stay apart once they are thick.
    const bars = paintMenuIcon(BUTTON, WHITE, 7)
      .map((command) => command.y1)
      .sort((a, b) => a - b);
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i] - bars[i - 1]).toBeGreaterThan(7);
    }
  });

  it("draws undo as an arrow bending back", () => {
    const commands = paintUndoIcon(BUTTON, WHITE);
    expect(commands.length).toBeGreaterThanOrEqual(3);
    for (const command of commands) {
      expect(command.op).toBe("line");
    }
  });

  it("draws the menu as three stacked bars", () => {
    const commands = paintMenuIcon(BUTTON, WHITE);
    expect(commands.length).toBe(3);
    const heights = commands.map((command) => command.y1);
    expect(new Set(heights).size).toBe(3);
    for (const command of commands) {
      expect(command.y1).toBe(command.y2);
    }
  });
});
