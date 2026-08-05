import { describe, it, expect } from "vitest";
import {
  DONE,
  FAILED,
  MAX_ROUNDS,
  RUNNING,
  generationProgress,
  generationResult,
  startGeneration,
  stepGeneration,
} from "../lib/generator-steps.js";
import { LEVELS } from "../lib/levels.js";
import { seeded } from "../lib/random.js";
import { createGame, isSolved, move } from "../lib/sokoban.js";

// Run a generation to completion the way the page does: one slice at a time.
function runToEnd(spec, seed, rounds) {
  const run = startGeneration(spec, seeded(seed), rounds);
  let slices = 0;
  while (run.status === RUNNING && slices < 200) {
    stepGeneration(run);
    slices += 1;
  }
  return { run, slices };
}

describe("starting a generation", () => {
  it("begins running, with nothing done yet", () => {
    const run = startGeneration(LEVELS[0], seeded(1));
    expect(run.status).toBe(RUNNING);
    expect(run.round).toBe(0);
    expect(generationProgress(run)).toBe(0);
    expect(generationResult(run)).toBeNull();
  });

  it("takes a round budget, and has a sensible default", () => {
    expect(startGeneration(LEVELS[0], seeded(1)).rounds).toBe(MAX_ROUNDS);
    expect(startGeneration(LEVELS[0], seeded(1), 5).rounds).toBe(5);
    expect(startGeneration(LEVELS[0], seeded(1), 0).rounds).toBe(MAX_ROUNDS);
  });
});

describe("stepping a generation", () => {
  it("does one attempt per step, so the screen can repaint in between", () => {
    const run = startGeneration(LEVELS[5], seeded(3), 10);
    stepGeneration(run);
    expect(run.round).toBe(1);
    stepGeneration(run);
    expect(run.round).toBeLessThanOrEqual(2);
  });

  it("reports progress that moves rather than jumping at the end", () => {
    const run = startGeneration(LEVELS[5], seeded(9), 8);
    const seen = [generationProgress(run)];
    while (run.status === RUNNING) {
      stepGeneration(run);
      seen.push(generationProgress(run));
    }
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(1);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
  });

  it("finishes, and hands back a level that can be played", () => {
    for (const spec of LEVELS) {
      const { run } = runToEnd(spec, spec.cols * 3 + 1);
      expect(run.status, spec.id).toBe(DONE);

      const level = generationResult(run);
      expect(level, spec.id).not.toBeNull();
      expect(level.cols, spec.id).toBe(spec.cols);
      expect(level.boxes.length, spec.id).toBe(spec.boxes);

      const game = createGame(level);
      for (const direction of level.solution) {
        move(game, direction);
      }
      expect(isSolved(game), spec.id).toBe(true);
    }
  });

  it("usually stops long before it runs out of rounds", () => {
    const { slices } = runToEnd(LEVELS[0], 5);
    expect(slices).toBeLessThan(MAX_ROUNDS);
  });

  it("stops stepping once it is finished", () => {
    const { run } = runToEnd(LEVELS[0], 7);
    const round = run.round;
    stepGeneration(run);
    stepGeneration(run);
    expect(run.round).toBe(round);
  });

  it("says so rather than pretending when nothing can be made", () => {
    const impossible = { cols: 4, rows: 4, boxes: 6, blocks: 0, pulls: 4, minPulls: 1 };
    const run = startGeneration(impossible, seeded(2), 3);
    while (run.status === RUNNING) {
      stepGeneration(run);
    }
    expect(run.status).toBe(FAILED);
    expect(generationResult(run)).toBeNull();
    expect(generationProgress(run)).toBe(1);
  });

  it("hands back the best it found when nothing cleared the bar", () => {
    // One round is rarely enough to clear every bar, but it must still produce
    // a playable warehouse rather than nothing.
    const run = startGeneration(LEVELS[5], seeded(13), 1);
    stepGeneration(run);
    expect(run.status).toBe(DONE);
    expect(generationResult(run)).not.toBeNull();
  });
});
