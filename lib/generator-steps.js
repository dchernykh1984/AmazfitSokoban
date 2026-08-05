// Generating a level a slice at a time, so the watch can show progress.
//
// JavaScript on a watch is single-threaded: while `generateLevel` runs, nothing
// repaints. A spinner would sit frozen and "Generating..." would only appear
// after the work was already finished, which is worse than showing nothing.
//
// So the work is turned inside out. This is a small state machine: the caller
// asks for one attempt, gets told how far along it is, hands control back to the
// firmware so the screen can repaint, and comes round again on a timer. The
// generator itself is untouched - each attempt is a whole `generateLevel` call
// with a single-attempt budget, and the machine simply keeps trying until one is
// good enough.
import { generateLevel } from "./generator.js";

export const RUNNING = "running";
export const DONE = "done";
export const FAILED = "failed";

// How many attempts a size gets before the best one so far is accepted. Matches
// what the one-shot generator allows itself, so the on-watch result is the same
// quality as the offline one.
export const MAX_ROUNDS = 24;

export function startGeneration(spec, random, rounds) {
  return {
    spec,
    random: typeof random === "function" ? random : Math.random,
    rounds: typeof rounds === "number" && rounds > 0 ? rounds : MAX_ROUNDS,
    round: 0,
    best: null,
    status: RUNNING,
  };
}

// How far along, from 0 to 1. Shown as a bar, so it has to move on every round
// rather than jump at the end.
export function generationProgress(run) {
  if (run.status !== RUNNING) {
    return 1;
  }
  return Math.min(1, run.round / run.rounds);
}

// Do one attempt and report back. Returns the run, so a caller can chain.
//
// A level is accepted as soon as one clears the bar; otherwise the best attempt
// is kept and the machine tries again. When the rounds run out, the best one is
// used - and if not a single attempt produced anything, the run fails and the
// caller is expected to say so rather than open an empty board.
export function stepGeneration(run) {
  if (run.status !== RUNNING) {
    return run;
  }

  run.round += 1;
  const level = generateLevel(run.spec, run.random);

  if (level !== null) {
    if (run.best === null || quality(level) > quality(run.best)) {
      run.best = level;
    }
    if (isGoodEnough(level, run.spec)) {
      run.status = DONE;
      return run;
    }
  }

  if (run.round >= run.rounds) {
    run.status = run.best === null ? FAILED : DONE;
  }
  return run;
}

// The level a finished run produced, or null when it failed.
export function generationResult(run) {
  return run.status === DONE ? run.best : null;
}

// A level worth stopping for: every crate off its goal, and enough of the floor
// actually in play.
function isGoodEnough(level, spec) {
  if (level.coverage !== undefined && level.coverage < 0.45) {
    return false;
  }
  for (let i = 0; i < level.boxes.length; i++) {
    if (level.goals.indexOf(level.boxes[i]) !== -1) {
      return false;
    }
  }
  return level.solution !== null && level.solution.length > 0 && spec.boxes > 0;
}

// Used only to keep the better of two attempts when none of them clear the bar.
function quality(level) {
  const displaced = level.boxes.filter((index) => level.goals.indexOf(index) === -1).length;
  const coverage = level.coverage === undefined ? 0 : level.coverage;
  return displaced * 1000 + coverage * 100;
}
