import { describe, it, expect } from "vitest";
import { formatLevel, parseLevel } from "../lib/level-format.js";
import {
  HEADER_SIZE,
  SECTION_SIZE,
  decodeLevel,
  encodeCollection,
  encodeLevel,
  findSection,
  readHeader,
  recordOffset,
  recordSize,
  wallBytes,
} from "../lib/level-pack.js";
import { generateLevel } from "../lib/generator.js";
import { LEVELS } from "../lib/levels.js";
import { seeded } from "./helpers/ascii-level.mjs";

const SMALL = ["#####", "#@$.#", "#####"];
const WIDE = ["#######", "#@-$-.#", "#--*--#", "#######"];

function roundTrip(picture) {
  const level = parseLevel(picture);
  const bytes = new Uint8Array(recordSize(level.cols, level.rows, level.boxes.length));
  encodeLevel(level, bytes, 0);
  return decodeLevel(bytes, 0, level.cols, level.rows, level.boxes.length);
}

describe("record sizes", () => {
  it("needs one bit per cell for the walls", () => {
    expect(wallBytes(8, 1)).toBe(1);
    expect(wallBytes(9, 1)).toBe(2);
    expect(wallBytes(19, 19)).toBe(46);
  });

  it("is the same for every level of a size, which is what makes seeking work", () => {
    expect(recordSize(9, 9, 2)).toBe(wallBytes(9, 9) + 2 * 2 + 2 * 2 + 2);
    expect(recordSize(19, 19, 7)).toBe(46 + 14 + 14 + 2);
  });

  it("stays small even for the biggest warehouse", () => {
    expect(recordSize(19, 19, 7)).toBeLessThan(100);
  });
});

describe("a single record", () => {
  it("comes back exactly as it went in", () => {
    expect(formatLevel(roundTrip(SMALL))).toEqual(SMALL);
    expect(formatLevel(roundTrip(WIDE))).toEqual(WIDE);
  });

  it("keeps the walls, including the ones off the byte boundary", () => {
    const level = parseLevel(["#########", "#@#-#-#-#", "#--$---.#", "#########"]);
    const bytes = new Uint8Array(recordSize(level.cols, level.rows, 1));
    encodeLevel(level, bytes, 0);
    const back = decodeLevel(bytes, 0, level.cols, level.rows, 1);
    expect(back.walls).toEqual(level.walls);
  });

  it("writes exactly the number of bytes the record size promises", () => {
    const level = parseLevel(WIDE);
    const size = recordSize(level.cols, level.rows, level.boxes.length);
    const bytes = new Uint8Array(size + 8);
    const written = encodeLevel(level, bytes, 0);
    expect(written).toBe(size);
  });

  it("can be written at an offset without disturbing its neighbours", () => {
    const level = parseLevel(SMALL);
    const size = recordSize(level.cols, level.rows, 1);
    const bytes = new Uint8Array(size * 3);
    bytes.fill(0xaa);
    encodeLevel(level, bytes, size);
    const back = decodeLevel(bytes, size, level.cols, level.rows, 1);
    expect(formatLevel(back)).toEqual(SMALL);
    expect(bytes[0]).toBe(0xaa);
    expect(bytes[size * 2]).toBe(0xaa);
  });
});

describe("a packed collection", () => {
  const sections = [
    {
      cols: 5,
      rows: 3,
      boxes: 1,
      levels: [parseLevel(SMALL), parseLevel(["#####", "#$@.#", "#####"])],
    },
    { cols: 7, rows: 4, boxes: 2, levels: [parseLevel(WIDE)] },
  ];
  const bytes = encodeCollection(sections);

  it("starts with a magic number the reader can check", () => {
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("BPM1");
    expect(bytes[4]).toBe(2);
  });

  it("describes every section in the header", () => {
    const header = readHeader(bytes);
    expect(header.length).toBe(2);
    expect(header[0].cols).toBe(5);
    expect(header[0].count).toBe(2);
    expect(header[0].boxes).toBe(1);
    expect(header[1].cols).toBe(7);
    expect(header[1].count).toBe(1);
  });

  it("puts the first section right after the header table", () => {
    const header = readHeader(bytes);
    expect(header[0].offset).toBe(HEADER_SIZE + 2 * SECTION_SIZE);
  });

  it("hands back each level from its computed offset", () => {
    const header = readHeader(bytes);
    const small = header[0];
    for (let i = 0; i < small.count; i++) {
      const level = decodeLevel(bytes, recordOffset(small, i), small.cols, small.rows, small.boxes);
      expect(formatLevel(level)).toEqual(formatLevel(sections[0].levels[i]));
    }
    const wide = header[1];
    const level = decodeLevel(bytes, recordOffset(wide, 0), wide.cols, wide.rows, wide.boxes);
    expect(formatLevel(level)).toEqual(WIDE);
  });

  it("is exactly as big as its contents", () => {
    let expected = HEADER_SIZE + 2 * SECTION_SIZE;
    for (const section of sections) {
      expected += recordSize(section.cols, section.rows, section.boxes) * section.levels.length;
    }
    expect(bytes.length).toBe(expected);
  });

  it("rejects a blob that is not a collection", () => {
    expect(readHeader(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  });

  it("finds a section by the size of its warehouse", () => {
    const header = readHeader(bytes);
    expect(findSection(header, 7).cols).toBe(7);
    expect(findSection(header, 99)).toBeNull();
  });
});

describe("packing real generated levels", () => {
  it("survives a round trip for every difficulty", () => {
    for (const spec of LEVELS) {
      const level = generateLevel(spec, seeded(spec.cols * 13 + 1));
      expect(level, spec.id).not.toBeNull();

      const bytes = new Uint8Array(recordSize(level.cols, level.rows, level.boxes.length));
      encodeLevel(level, bytes, 0);
      const back = decodeLevel(bytes, 0, level.cols, level.rows, level.boxes.length);

      expect(formatLevel(back), spec.id).toEqual(formatLevel(level));
      expect(back.walls, spec.id).toEqual(level.walls);
      expect(back.player, spec.id).toBe(level.player);
    }
  });
});
