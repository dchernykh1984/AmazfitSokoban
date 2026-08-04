// Prints one warehouse from the collection and solves it.
//
//   node scripts/solve-map.mjs xs 12          one level, drawn and solved
//   node scripts/solve-map.mjs m 3 --quiet    just the numbers
//
// Handy when a level looks wrong and you want to see what the solver makes of
// it, without wiring anything up: it is the same solver the offline quality gate
// uses and the same rule set the watch plays by.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { qualityFor } from "../lib/collection.js";
import { coverage } from "../lib/generator.js";
import { formatLevel, parseCollection } from "../lib/level-format.js";
import { LEVELS } from "../lib/levels.js";
import { SOLVED, solve } from "../lib/solver.js";

const MAPS = join(dirname(fileURLToPath(import.meta.url)), "..", "maps");

function usage() {
  console.log("usage: node scripts/solve-map.mjs <size> <index> [--quiet] [--budget N]");
  console.log("  sizes: " + LEVELS.map((spec) => spec.id).join(", "));
  process.exit(1);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    usage();
  }

  const id = argv[0];
  const index = Number(argv[1]);
  const quiet = argv.indexOf("--quiet") !== -1;
  const budgetAt = argv.indexOf("--budget");
  const budget = budgetAt !== -1 ? Number(argv[budgetAt + 1]) : qualityFor(id).budget * 8;

  const path = join(MAPS, id + ".sok");
  if (!existsSync(path)) {
    console.error("no collection at " + path);
    process.exit(1);
  }

  const levels = parseCollection(readFileSync(path, "utf8"));
  if (!Number.isFinite(index) || index < 0 || index >= levels.length) {
    console.error("index must be between 0 and " + (levels.length - 1));
    process.exit(1);
  }

  const level = levels[index];
  if (!quiet) {
    console.log(id + " level " + index + " of " + levels.length);
    for (const line of formatLevel(level)) {
      console.log("  " + line);
    }
  }

  const started = Date.now();
  const result = solve(level, budget);
  const seconds = ((Date.now() - started) / 1000).toFixed(2);

  console.log(
    "  status " +
      result.status +
      (result.status === SOLVED ? ", " + result.pushes + " pushes" : "") +
      ", " +
      result.states +
      " states, " +
      seconds +
      "s"
  );
  if (level.solution) {
    console.log(
      "  certificate coverage " + (coverage(level, level, level.solution) * 100).toFixed(0) + "%"
    );
  }
}

main();
