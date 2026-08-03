import { describe, it, expect } from "vitest";
import { DOWN, LEFT, RIGHT, UP } from "../lib/directions.js";
import {
  DEFAULT_SLOP,
  beginTouch,
  cancelTouch,
  createTouch,
  directionToward,
  endTouch,
  moveTouch,
} from "../lib/touch.js";

describe("createTouch", () => {
  it("starts idle with the default slop", () => {
    const touch = createTouch();
    expect(touch.slop).toBe(DEFAULT_SLOP);
    expect(touch.active).toBe(false);
    expect(touch.dragging).toBe(false);
  });

  it("takes a slop of its own, but not a nonsensical one", () => {
    expect(createTouch(30).slop).toBe(30);
    expect(createTouch(0).slop).toBe(0);
    expect(createTouch(-5).slop).toBe(DEFAULT_SLOP);
    expect(createTouch("wide").slop).toBe(DEFAULT_SLOP);
  });
});

describe("a tap", () => {
  it("is a press and a lift in the same place", () => {
    const touch = createTouch(10);
    beginTouch(touch, 100, 120);
    const end = endTouch(touch, 100, 120);
    expect(end.tap).toBe(true);
    expect(end.x).toBe(100);
    expect(end.y).toBe(120);
  });

  it("forgives a finger that wobbles inside the slop", () => {
    const touch = createTouch(10);
    beginTouch(touch, 100, 100);
    expect(moveTouch(touch, 104, 103).dragging).toBe(false);
    expect(endTouch(touch, 106, 104).tap).toBe(true);
  });

  it("leaves the touch idle afterwards", () => {
    const touch = createTouch(10);
    beginTouch(touch, 10, 10);
    endTouch(touch, 10, 10);
    expect(touch.active).toBe(false);
  });
});

describe("a drag", () => {
  it("starts once the finger has travelled further than the slop", () => {
    const touch = createTouch(10);
    beginTouch(touch, 100, 100);
    expect(moveTouch(touch, 105, 100).dragging).toBe(false);
    const far = moveTouch(touch, 140, 100);
    expect(far.dragging).toBe(true);
    expect(far.dx).toBe(40);
    expect(far.dy).toBe(0);
  });

  it("stays a drag even if the finger comes back where it started", () => {
    const touch = createTouch(10);
    beginTouch(touch, 100, 100);
    moveTouch(touch, 200, 100);
    const end = endTouch(touch, 100, 100);
    expect(end.dragging).toBe(true);
    expect(end.tap).toBe(false);
  });

  it("measures from where the finger went down", () => {
    const touch = createTouch(10);
    beginTouch(touch, 50, 60);
    moveTouch(touch, 90, 60);
    const end = endTouch(touch, 20, 100);
    expect(end.dx).toBe(-30);
    expect(end.dy).toBe(40);
  });
});

describe("a touch that was never pressed", () => {
  it("reports nothing on a move", () => {
    const touch = createTouch(10);
    expect(moveTouch(touch, 10, 10)).toEqual({ dragging: false, dx: 0, dy: 0 });
  });

  it("is neither a tap nor a drag on a lift", () => {
    const touch = createTouch(10);
    const end = endTouch(touch, 10, 10);
    expect(end.tap).toBe(false);
    expect(end.dragging).toBe(false);
  });

  it("is what cancelling leaves behind", () => {
    const touch = createTouch(10);
    beginTouch(touch, 10, 10);
    moveTouch(touch, 200, 200);
    cancelTouch(touch);
    expect(touch.active).toBe(false);
    expect(endTouch(touch, 200, 200).tap).toBe(false);
  });
});

describe("directionToward", () => {
  it("steps towards the tapped cell on its dominant axis", () => {
    expect(directionToward(5, 5, 9, 6)).toBe(RIGHT);
    expect(directionToward(5, 5, 1, 6)).toBe(LEFT);
    expect(directionToward(5, 5, 6, 9)).toBe(DOWN);
    expect(directionToward(5, 5, 6, 1)).toBe(UP);
  });

  it("handles the four cells next door", () => {
    expect(directionToward(5, 5, 6, 5)).toBe(RIGHT);
    expect(directionToward(5, 5, 4, 5)).toBe(LEFT);
    expect(directionToward(5, 5, 5, 6)).toBe(DOWN);
    expect(directionToward(5, 5, 5, 4)).toBe(UP);
  });

  it("gives an exact diagonal to the horizontal", () => {
    expect(directionToward(5, 5, 8, 8)).toBe(RIGHT);
    expect(directionToward(5, 5, 2, 2)).toBe(LEFT);
  });

  it("does nothing when the keeper itself is tapped", () => {
    expect(directionToward(5, 5, 5, 5)).toBe(-1);
  });
});
