// Builds the warehouse collection that ships with the app.
//
//   node scripts/generate-maps.mjs [--counts xs=50,s=50] [--seed 1]
//
// Run it by hand when the collection needs regenerating; the result is written
// to maps/<size>.sok as text, so what changed is visible in a diff. The binary
// the watch reads is packed from those files at build time by pack-maps.mjs.
//
// Generating a level is cheap and its solvability is guaranteed by construction,
// so the expensive, interesting part of this script is QUALITY control. Three
// filters, in rising order of cost:
//
//   1. coverage - the generator already refuses a level that only uses a corner
//      of its own floor, and the value is re-checked here;
//   2. duplicates - the same warehouse twice in a collection is a waste;
//   3. the solver - the only way to know a puzzle is not trivially easy is to
//      find its shortest solution. On the small sizes that is quick. On the big
//      ones the state space explodes, so the solver gets a budget: a level it
//      cannot crack quickly is, by definition, not a level that is too easy.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DISAGREEMENT, KEEP, fingerprint, judgeLevel, qualityFor } from "../lib/collection.js";
import { generateLevel } from "../lib/generator.js";
import { formatCollection } from "../lib/level-format.js";
import { LEVELS } from "../lib/levels.js";
import { seeded } from "../lib/random.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "maps");

// How many warehouses of each size to ship. The big sizes get fewer because
// each one costs more to make and nobody is going to play through hundreds of
// them - and the whole collection is still only a couple of hundred kilobytes.
const COUNTS = { xs: 1000, s: 1000, m: 1000, l: 500, xl: 300, xxl: 200 };

function parseArgs(argv) {
  const options = { counts: {}, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--seed" && argv[i + 1]) {
      options.seed = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--counts" && argv[i + 1]) {
      for (const pair of argv[i + 1].split(",")) {
        const [id, value] = pair.split("=");
        options.counts[id] = Number(value);
      }
      i += 1;
    }
  }
  return options;
}

function buildSize(spec, wanted, seed) {
  const random = seeded(seed);
  const quality = qualityFor(spec.id);
  const levels = [];
  const seen = {};
  const rejected = { easy: 0, duplicate: 0, failed: 0 };
  let attempts = 0;
  let solved = 0;
  let pushTotal = 0;

  const started = Date.now();
  // A generous ceiling: without one a bad spec would spin here for ever.
  const ceiling = wanted * 60 + 500;

  while (levels.length < wanted && attempts < ceiling) {
    attempts += 1;
    const level = generateLevel(spec, random);
    if (level === null) {
      rejected.failed += 1;
      continue;
    }

    const key = fingerprint(level);
    if (seen[key]) {
      rejected.duplicate += 1;
      continue;
    }

    const verdict = judgeLevel(level, quality);
    if (verdict.verdict === DISAGREEMENT) {
      // The generator promised this level was solvable and the solver could not
      // finish it. One of the two is wrong; stopping is the only safe answer.
      throw new Error(spec.id + ": the solver and the generator disagree on a level");
    }
    if (verdict.verdict !== KEEP) {
      rejected.easy += 1;
      continue;
    }

    seen[key] = true;
    levels.push(level);
    if (verdict.pushes > 0) {
      solved += 1;
      pushTotal += verdict.pushes;
    }

    if (levels.length % 100 === 0 || levels.length === wanted) {
      const done = ((levels.length / wanted) * 100).toFixed(0);
      process.stdout.write(
        "\r  " + spec.id + ": " + levels.length + "/" + wanted + " (" + done + "%)   "
      );
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  process.stdout.write("\r");
  const average = solved > 0 ? (pushTotal / solved).toFixed(1) : "n/a";
  console.log(
    "  " +
      spec.id.padEnd(3) +
      " " +
      String(levels.length).padStart(4) +
      " levels in " +
      seconds +
      "s | tried " +
      attempts +
      " | rejected: " +
      rejected.easy +
      " easy, " +
      rejected.duplicate +
      " duplicate, " +
      rejected.failed +
      " failed | optimal pushes " +
      average +
      " (measured on " +
      solved +
      ")"
  );

  if (levels.length < wanted) {
    console.log("  " + spec.id + ": WARNING - only got " + levels.length + " of " + wanted);
  }
  return levels;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(OUT, { recursive: true });

  console.log("Building the warehouse collection (seed " + options.seed + ")");
  for (let i = 0; i < LEVELS.length; i++) {
    const spec = LEVELS[i];
    const wanted = options.counts[spec.id] || COUNTS[spec.id];
    if (!wanted) {
      continue;
    }

    const levels = buildSize(spec, wanted, options.seed * 1000 + i);
    const text = formatCollection(levels, [
      "Box Pusher levels - size " + spec.id + " (" + spec.cols + "x" + spec.rows + ")",
      "GENERATED by scripts/generate-maps.mjs - do not edit by hand",
      "seed " + options.seed + ", " + levels.length + " warehouses, " + spec.boxes + " crates each",
    ]);
    writeFileSync(join(OUT, spec.id + ".sok"), text, "utf8");
  }
  console.log("Written to maps/");
}

main();
