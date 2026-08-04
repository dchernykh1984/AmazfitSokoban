// Builds the warehouse collection that ships with the app.
//
//   node scripts/generate-maps.mjs [--counts xs=50,s=50] [--seed 1] [--jobs 6]
//
// Run it by hand when the collection needs regenerating; the result is written
// to maps/<size>.sok as text, so what changed is visible in a diff. The binary
// the watch reads is packed from those files at build time by pack-maps.mjs.
//
// Generating a level is cheap and its solvability is guaranteed by construction,
// so the expensive part is QUALITY control - and specifically the solver, which
// is the only way to know a puzzle is not trivially easy. That cost is what this
// script parallelises: the work is cut into shards, one child process per core,
// and the shards are merged, de-duplicated and trimmed at the end.
//
// Each shard gets its own seed, so the collection is still a pure function of
// `--seed` and `--jobs` and can be regenerated exactly.
import { fork } from "node:child_process";
import { cpus } from "node:os";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DISAGREEMENT, KEEP, fingerprint, judgeLevel, qualityFor } from "../lib/collection.js";
import { generateLevel } from "../lib/generator.js";
import { formatCollection, parseCollection } from "../lib/level-format.js";
import { LEVELS } from "../lib/levels.js";
import { seeded } from "../lib/random.js";
import { createGame, isSolved, move } from "../lib/sokoban.js";

const HERE = fileURLToPath(import.meta.url);
const ROOT = join(dirname(HERE), "..");
const OUT = join(ROOT, "maps");
const SCRATCH = join(ROOT, "tmp", "mapgen");

// How many warehouses of each size to ship. The big sizes get fewer because
// each one costs more to make and nobody is going to play through hundreds of
// them - and the whole collection is still under a megabyte of text.
const COUNTS = { xs: 1000, s: 1000, m: 1000, l: 500, xl: 300, xxl: 200 };

// Shards ask for a little more than their share, so duplicates dropped in the
// merge do not leave the collection short.
const SHARD_SLACK = 1.08;

function parseArgs(argv) {
  const options = { counts: {}, seed: 1, jobs: 0, shard: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--seed" && argv[i + 1]) {
      options.seed = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--jobs" && argv[i + 1]) {
      options.jobs = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--shard" && argv[i + 1]) {
      const parts = argv[i + 1].split("|");
      options.shard = {
        id: parts[0],
        count: Number(parts[1]),
        seed: Number(parts[2]),
        out: parts[3],
      };
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

// Replay the generator's own solution through the rules and check it finishes.
function certificateSolves(level) {
  if (!level.solution || level.solution.length === 0) {
    return false;
  }
  const game = createGame(level);
  for (let i = 0; i < level.solution.length; i++) {
    if (!move(game, level.solution[i]).moved) {
      return false;
    }
  }
  return isSolved(game);
}

function specFor(id) {
  for (const spec of LEVELS) {
    if (spec.id === id) {
      return spec;
    }
  }
  throw new Error("no such size: " + id);
}

// ------------------------------------------------------------------ worker ---

// One shard: generate `count` good warehouses and write them out. Runs in a
// child process; the parent merges the pieces.
function runShard(shard) {
  const spec = specFor(shard.id);
  const quality = qualityFor(spec.id);
  const random = seeded(shard.seed);
  const levels = [];
  const seen = {};
  let easy = 0;
  const ceiling = shard.count * 60 + 500;

  for (let attempts = 0; levels.length < shard.count && attempts < ceiling; attempts++) {
    const level = generateLevel(spec, random);
    if (level === null) {
      continue;
    }
    const key = fingerprint(level);
    if (seen[key]) {
      continue;
    }

    // Prove this exact warehouse can be finished before it goes in the file.
    // The generator builds a certificate as it scrambles; replaying it through
    // the real rule set is cheap and is the only solvability guarantee the big
    // sizes get, because the solver cannot crack those inside any sane budget.
    if (!certificateSolves(level)) {
      throw new Error(
        spec.id + ": the generator produced a level its own solution does not finish"
      );
    }

    const verdict = judgeLevel(level, quality);
    if (verdict.verdict === DISAGREEMENT) {
      throw new Error(spec.id + ": the solver and the generator disagree on a level");
    }
    if (verdict.verdict !== KEEP) {
      easy += 1;
      continue;
    }

    seen[key] = true;
    levels.push(level);
  }

  writeFileSync(shard.out, formatCollection(levels), "utf8");
  process.send({ id: shard.id, made: levels.length, easy });
}

// ------------------------------------------------------------------ parent ---

function plan(options) {
  const jobs = options.jobs > 0 ? options.jobs : Math.max(1, cpus().length - 1);
  const tasks = [];

  for (let i = 0; i < LEVELS.length; i++) {
    const spec = LEVELS[i];
    const wanted = options.counts[spec.id] || COUNTS[spec.id];
    if (!wanted) {
      continue;
    }
    // Cut every size into as many shards as there are workers, so a long size
    // is not left running on its own at the end while the others idle.
    const shards = Math.max(1, Math.min(jobs, Math.ceil(wanted / 25)));
    const each = Math.ceil((wanted / shards) * SHARD_SLACK);
    for (let s = 0; s < shards; s++) {
      tasks.push({
        id: spec.id,
        count: each,
        seed: options.seed * 100000 + i * 1000 + s,
        out: join(SCRATCH, spec.id + "." + s + ".sok"),
      });
    }
  }

  return { jobs, tasks };
}

function runAll(tasks, jobs) {
  return new Promise((resolve, reject) => {
    const results = [];
    let next = 0;
    let running = 0;
    let failed = false;

    const startOne = () => {
      if (failed) {
        return;
      }
      if (next >= tasks.length) {
        if (running === 0) {
          resolve(results);
        }
        return;
      }

      const task = tasks[next];
      next += 1;
      running += 1;

      const argument = [task.id, task.count, task.seed, task.out].join("|");
      const child = fork(HERE, ["--shard", argument], {
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("message", (message) => {
        results.push(message);
        process.stdout.write("\r  " + results.length + "/" + tasks.length + " shards done   ");
      });
      child.on("exit", (code) => {
        running -= 1;
        if (code !== 0 && !failed) {
          failed = true;
          reject(new Error("shard " + task.id + " failed:\n" + stderr));
          return;
        }
        startOne();
      });
    };

    for (let i = 0; i < jobs && i < tasks.length; i++) {
      startOne();
    }
  });
}

function merge(spec, tasks, wanted) {
  const levels = [];
  const seen = {};
  let duplicates = 0;

  for (const task of tasks) {
    if (task.id !== spec.id || !existsSync(task.out)) {
      continue;
    }
    for (const level of parseCollection(readFileSync(task.out, "utf8"))) {
      const key = fingerprint(level);
      if (seen[key]) {
        duplicates += 1;
        continue;
      }
      seen[key] = true;
      if (levels.length < wanted) {
        levels.push(level);
      }
    }
  }

  return { levels, duplicates };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.shard) {
    runShard(options.shard);
    return;
  }

  mkdirSync(OUT, { recursive: true });
  rmSync(SCRATCH, { recursive: true, force: true });
  mkdirSync(SCRATCH, { recursive: true });

  const { jobs, tasks } = plan(options);
  console.log(
    "Building the collection: seed " +
      options.seed +
      ", " +
      tasks.length +
      " shards on " +
      jobs +
      " workers"
  );

  const started = Date.now();
  await runAll(tasks, jobs);
  process.stdout.write("\r");

  for (const spec of LEVELS) {
    const wanted = options.counts[spec.id] || COUNTS[spec.id];
    if (!wanted) {
      continue;
    }
    const { levels, duplicates } = merge(spec, tasks, wanted);
    const text = formatCollection(levels, [
      "Box Pusher levels - size " + spec.id + " (" + spec.cols + "x" + spec.rows + ")",
      "GENERATED by scripts/generate-maps.mjs - do not edit by hand",
      "seed " + options.seed + ", " + levels.length + " warehouses, " + spec.boxes + " crates each",
    ]);
    writeFileSync(join(OUT, spec.id + ".sok"), text, "utf8");
    console.log(
      "  " +
        spec.id.padEnd(3) +
        " " +
        String(levels.length).padStart(5) +
        " warehouses" +
        (duplicates > 0 ? " (" + duplicates + " duplicates dropped)" : "") +
        (levels.length < wanted ? "  WARNING: wanted " + wanted : "")
    );
  }

  rmSync(SCRATCH, { recursive: true, force: true });
  console.log("Done in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
