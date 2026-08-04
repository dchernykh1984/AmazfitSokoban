// Packs the text collection in maps/ into the binary the watch reads.
//
//   node scripts/pack-maps.mjs
//
// Runs automatically before dev, preview and build, so nobody has to remember
// it. The text files are the source of truth and live in the repository; the
// binary is a build artefact and is git-ignored.
//
// It also acts as a gate: a warehouse in maps/ that does not match the size it
// is filed under would produce a level the watch decodes into nonsense, so the
// packer refuses to write anything rather than shipping it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCollection } from "../lib/level-format.js";
import { encodeCollection } from "../lib/level-pack.js";
import { LEVELS } from "../lib/levels.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAPS = join(ROOT, "maps");
const TARGET = join(ROOT, "assets", "common.r", "levels.bin");

function loadSize(spec) {
  const path = join(MAPS, spec.id + ".sok");
  if (!existsSync(path)) {
    return [];
  }

  const levels = parseCollection(readFileSync(path, "utf8"));
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    if (level.cols !== spec.cols || level.rows !== spec.rows) {
      throw new Error(
        spec.id +
          " level " +
          i +
          " is " +
          level.cols +
          "x" +
          level.rows +
          ", expected " +
          spec.cols +
          "x" +
          spec.rows
      );
    }
    if (level.boxes.length !== spec.boxes) {
      throw new Error(
        spec.id + " level " + i + " has " + level.boxes.length + " crates, expected " + spec.boxes
      );
    }
  }
  return levels;
}

function main() {
  const sections = [];
  let total = 0;

  for (const spec of LEVELS) {
    const levels = loadSize(spec);
    if (levels.length === 0) {
      console.log("  " + spec.id.padEnd(3) + " no levels - skipped");
      continue;
    }
    sections.push({ cols: spec.cols, rows: spec.rows, boxes: spec.boxes, levels });
    total += levels.length;
    console.log("  " + spec.id.padEnd(3) + " " + String(levels.length).padStart(5) + " warehouses");
  }

  if (sections.length === 0) {
    // Not an error: a fresh clone can build and run the app without the
    // collection, it just has to generate its levels on the watch.
    console.log("No collection in maps/ - the app will generate its own levels.");
    return;
  }

  const bytes = encodeCollection(sections);
  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, bytes);
  console.log(
    "Packed " + total + " warehouses into assets/common.r/levels.bin (" + bytes.length + " bytes)"
  );
}

main();
