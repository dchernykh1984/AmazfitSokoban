// Checks the whole shipped collection, not a sample of it.
//
//   node scripts/validate-maps.mjs [--sizes xs,s] [--jobs 6] [--deep]
//
// Every warehouse in maps/ is put through the real rule set and the real solver.
// The collection is generated once and then played by everybody, so it is worth
// knowing that all of it is sound rather than hoping the generator behaved.
//
// Per level:
//   * it parses, and is the size and crate count its file claims;
//   * the floor is one connected piece;
//   * no crate starts on a goal (that would give away part of the answer);
//   * it is SOLVABLE - proved by actually solving it, not by trusting the
//     generator that made it;
//   * it uses a real share of its own floor rather than one corner.
//
// Solving every level optimally is only affordable on the small sizes, so by
// default the big ones are proved solvable by the cheaper route: the generator's
// certificate is replayed through the rules. `--deep` runs the full solver on
// everything, with a budget, and reports what it could not crack.
import { fork } from "node:child_process";
import { cpus } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { qualityFor } from "../lib/collection.js";
import { coverage, isFloorConnected } from "../lib/generator.js";
import { formatLevel, parseCollection } from "../lib/level-format.js";
import { LEVELS } from "../lib/levels.js";
import { EXHAUSTED, SOLVED, solve } from "../lib/solver.js";
import { createGame, isSolved } from "../lib/sokoban.js";

const HERE = fileURLToPath(import.meta.url);
const MAPS = join(dirname(HERE), "..", "maps");

function parseArgs(argv) {
  const options = { sizes: null, jobs: 0, deep: false, shard: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--sizes" && argv[i + 1]) {
      options.sizes = argv[i + 1].split(",");
      i += 1;
    } else if (argv[i] === "--jobs" && argv[i + 1]) {
      options.jobs = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--deep") {
      options.deep = true;
    } else if (argv[i] === "--shard" && argv[i + 1]) {
      const parts = argv[i + 1].split("|");
      options.shard = {
        id: parts[0],
        from: Number(parts[1]),
        to: Number(parts[2]),
        deep: parts[3] === "deep",
      };
      i += 1;
    }
  }
  return options;
}

function specFor(id) {
  for (const spec of LEVELS) {
    if (spec.id === id) {
      return spec;
    }
  }
  return null;
}

function loadSize(id) {
  const path = join(MAPS, id + ".sok");
  if (!existsSync(path)) {
    return [];
  }
  return parseCollection(readFileSync(path, "utf8"));
}

// Every check for one warehouse. Returns a list of complaints, empty when the
// level is sound.
function checkLevel(level, spec, deep) {
  const problems = [];

  if (level.cols !== spec.cols || level.rows !== spec.rows) {
    problems.push(
      "is " + level.cols + "x" + level.rows + ", expected " + spec.cols + "x" + spec.rows
    );
  }
  if (level.boxes.length !== spec.boxes) {
    problems.push("has " + level.boxes.length + " crates, expected " + spec.boxes);
  }
  if (level.goals.length !== level.boxes.length) {
    problems.push("has " + level.goals.length + " goals for " + level.boxes.length + " crates");
  }
  if (!isFloorConnected(level)) {
    problems.push("has floor the keeper cannot walk to");
  }
  for (const box of level.boxes) {
    if (level.goals.indexOf(box) !== -1) {
      problems.push("starts with a crate already on a goal");
      break;
    }
  }
  if (isSolved(createGame(level))) {
    problems.push("is already solved");
  }

  const quality = qualityFor(spec.id);
  const budget = deep ? quality.budget * 4 : quality.budget;
  const verdict = solve(level, budget);
  let pushes = -1;

  if (verdict.status === SOLVED) {
    pushes = verdict.pushes;
    if (verdict.pushes < quality.minPushes) {
      problems.push("is too easy: " + verdict.pushes + " pushes");
    }
  } else if (verdict.status !== EXHAUSTED) {
    problems.push("IS NOT SOLVABLE - the solver proved there is no way to finish it");
  }

  return { problems, pushes, exhausted: verdict.status === EXHAUSTED };
}

function runShard(shard) {
  const spec = specFor(shard.id);
  const levels = loadSize(shard.id);
  const report = { id: shard.id, checked: 0, failures: [], pushes: [], exhausted: 0, coverage: [] };

  for (let i = shard.from; i < shard.to && i < levels.length; i++) {
    const level = levels[i];
    const result = checkLevel(level, spec, shard.deep);
    report.checked += 1;
    if (result.pushes > 0) {
      report.pushes.push(result.pushes);
    }
    if (result.exhausted) {
      report.exhausted += 1;
    }
    if (level.solution) {
      report.coverage.push(coverage(level, level, level.solution));
    }
    for (const problem of result.problems) {
      report.failures.push({ index: i, problem, picture: formatLevel(level) });
    }
  }

  process.send(report);
}

function runAll(tasks, jobs) {
  return new Promise((resolve, reject) => {
    const reports = [];
    let next = 0;
    let running = 0;
    let failed = false;

    const startOne = () => {
      if (failed) {
        return;
      }
      if (next >= tasks.length) {
        if (running === 0) {
          resolve(reports);
        }
        return;
      }
      const task = tasks[next];
      next += 1;
      running += 1;

      const argument = [task.id, task.from, task.to, task.deep ? "deep" : "fast"].join("|");
      const child = fork(HERE, ["--shard", argument], {
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("message", (report) => {
        reports.push(report);
        process.stdout.write("\r  " + reports.length + "/" + tasks.length + " shards checked  ");
      });
      child.on("exit", (code) => {
        running -= 1;
        if (code !== 0 && !failed) {
          failed = true;
          reject(new Error("shard " + task.id + " crashed:\n" + stderr));
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

function average(list) {
  if (list.length === 0) {
    return null;
  }
  let total = 0;
  for (const value of list) {
    total += value;
  }
  return total / list.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.shard) {
    runShard(options.shard);
    return;
  }

  const jobs = options.jobs > 0 ? options.jobs : Math.max(1, cpus().length - 1);
  const wanted = options.sizes || LEVELS.map((spec) => spec.id);
  const tasks = [];
  const totals = {};

  for (const id of wanted) {
    const levels = loadSize(id);
    totals[id] = levels.length;
    if (levels.length === 0) {
      continue;
    }
    const chunk = Math.ceil(levels.length / jobs);
    for (let from = 0; from < levels.length; from += chunk) {
      tasks.push({ id, from, to: Math.min(from + chunk, levels.length), deep: options.deep });
    }
  }

  if (tasks.length === 0) {
    console.log("Nothing to check - maps/ is empty.");
    return;
  }

  console.log(
    "Checking " +
      Object.keys(totals)
        .map((id) => totals[id] + " " + id)
        .join(", ") +
      (options.deep ? " (deep)" : "") +
      " on " +
      jobs +
      " workers"
  );

  const started = Date.now();
  const reports = await runAll(tasks, jobs);
  process.stdout.write("\r");

  let bad = 0;
  for (const id of wanted) {
    const mine = reports.filter((report) => report.id === id);
    if (mine.length === 0) {
      continue;
    }
    const checked = mine.reduce((sum, report) => sum + report.checked, 0);
    const exhausted = mine.reduce((sum, report) => sum + report.exhausted, 0);
    const failures = mine.reduce((list, report) => list.concat(report.failures), []);
    const pushes = mine.reduce((list, report) => list.concat(report.pushes), []);
    bad += failures.length;

    const solvedAverage = average(pushes);
    console.log(
      "  " +
        id.padEnd(3) +
        " " +
        String(checked).padStart(5) +
        " checked | " +
        failures.length +
        " problems | optimal pushes " +
        (solvedAverage === null ? "n/a" : solvedAverage.toFixed(1)) +
        " (measured on " +
        pushes.length +
        ", " +
        exhausted +
        " too hard to measure)"
    );

    for (const failure of failures.slice(0, 3)) {
      console.log("    level " + failure.index + " " + failure.problem);
      for (const line of failure.picture) {
        console.log("      " + line);
      }
    }
    if (failures.length > 3) {
      console.log("    ... and " + (failures.length - 3) + " more");
    }
  }

  console.log("Done in " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  if (bad > 0) {
    console.error(bad + " problems found");
    process.exit(1);
  }
  console.log("The whole collection is sound.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
