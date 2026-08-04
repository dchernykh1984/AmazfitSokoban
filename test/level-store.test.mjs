import { describe, it, expect } from "vitest";
import { formatLevel, parseLevel } from "../lib/level-format.js";
import { encodeCollection } from "../lib/level-pack.js";
import {
  RECENT_MEMORY,
  bufferReader,
  openCollection,
  pickIndex,
  readLevel,
  rememberIndex,
  sectionFor,
} from "../lib/level-store.js";
import { seeded } from "../lib/random.js";

const SMALL = ["#####", "#@$.#", "#####"];
const OTHER = ["#####", "#.$@#", "#####"];
const WIDE = ["######", "#@$-.#", "######"];

const bytes = encodeCollection([
  { cols: 5, rows: 3, boxes: 1, levels: [parseLevel(SMALL), parseLevel(OTHER)] },
  { cols: 6, rows: 3, boxes: 1, levels: [parseLevel(WIDE)] },
]);
const reader = bufferReader(bytes);

describe("openCollection", () => {
  it("reads the section table without loading the levels", () => {
    const reads = [];
    const counted = (offset, length) => {
      reads.push({ offset, length });
      return reader(offset, length);
    };
    const sections = openCollection(counted);
    expect(sections.length).toBe(2);

    // Every read has to stay inside the header and the section table: not one
    // byte of an actual warehouse is touched until a game asks for one.
    const tableEnd = sections[0].offset;
    for (const read of reads) {
      expect(read.offset + read.length).toBeLessThanOrEqual(tableEnd);
    }
  });

  it("gives up quietly when there is no collection at all", () => {
    expect(openCollection(() => null)).toBeNull();
    expect(openCollection(bufferReader(new Uint8Array(2)))).toBeNull();
  });

  it("gives up quietly when the blob is not a collection", () => {
    const junk = new Uint8Array(64);
    junk[4] = 1;
    expect(openCollection(bufferReader(junk))).toBeNull();
  });

  it("gives up quietly when the reader throws", () => {
    expect(
      openCollection(() => {
        throw new Error("no such file");
      })
    ).toBeNull();
  });

  it("refuses a header that promises empty sections", () => {
    const broken = bytes.slice();
    broken[5 + 3] = 0;
    broken[5 + 4] = 0;
    expect(openCollection(bufferReader(broken))).toBeNull();
  });
});

describe("sectionFor", () => {
  it("finds the section for a warehouse size", () => {
    const sections = openCollection(reader);
    expect(sectionFor(sections, 5).count).toBe(2);
    expect(sectionFor(sections, 6).count).toBe(1);
  });

  it("says so when the collection has no levels of that size", () => {
    expect(sectionFor(openCollection(reader), 99)).toBeNull();
    expect(sectionFor(null, 5)).toBeNull();
  });
});

describe("readLevel", () => {
  const sections = openCollection(reader);

  it("hands back the warehouse stored at that index", () => {
    const section = sectionFor(sections, 5);
    expect(formatLevel(readLevel(reader, section, 0))).toEqual(SMALL);
    expect(formatLevel(readLevel(reader, section, 1))).toEqual(OTHER);
    expect(formatLevel(readLevel(reader, sectionFor(sections, 6), 0))).toEqual(WIDE);
  });

  it("reads only the bytes of that one record", () => {
    const section = sectionFor(sections, 5);
    let asked = 0;
    const counted = (offset, length) => {
      asked += length;
      return reader(offset, length);
    };
    readLevel(counted, section, 1);
    expect(asked).toBe(section.recordSize);
  });

  it("refuses an index that is not in the collection", () => {
    const section = sectionFor(sections, 5);
    expect(readLevel(reader, section, -1)).toBeNull();
    expect(readLevel(reader, section, 99)).toBeNull();
  });

  it("gives up quietly on a short or failing read", () => {
    const section = sectionFor(sections, 5);
    expect(readLevel(() => new Uint8Array(2), section, 0)).toBeNull();
    expect(
      readLevel(
        () => {
          throw new Error("read failed");
        },
        section,
        0
      )
    ).toBeNull();
  });
});

describe("pickIndex", () => {
  const section = { count: 10 };

  it("stays inside the collection", () => {
    const random = seeded(4);
    for (let i = 0; i < 50; i++) {
      const index = pickIndex(section, random, []);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(section.count);
    }
  });

  it("avoids the levels just played", () => {
    const recent = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const random = seeded(9);
    for (let i = 0; i < 30; i++) {
      expect(pickIndex(section, random, recent)).toBe(9);
    }
  });

  it("still hands something back when everything has been seen", () => {
    const recent = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const index = pickIndex(section, seeded(2), recent);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(section.count);
  });

  it("never runs off the end when the generator returns almost one", () => {
    expect(pickIndex(section, () => 0.999999, [])).toBe(9);
    expect(pickIndex(section, () => 1, [])).toBe(9);
    expect(pickIndex(section, () => 0, [])).toBe(0);
  });
});

describe("rememberIndex", () => {
  it("puts the newest first", () => {
    expect(rememberIndex([2, 3], 7)).toEqual([7, 2, 3]);
  });

  it("does not keep the same level twice", () => {
    expect(rememberIndex([7, 2, 3], 7)).toEqual([7, 2, 3]);
  });

  it("forgets the oldest once it is full", () => {
    let recent = [];
    for (let i = 0; i < RECENT_MEMORY + 5; i++) {
      recent = rememberIndex(recent, i);
    }
    expect(recent.length).toBe(RECENT_MEMORY);
    expect(recent[0]).toBe(RECENT_MEMORY + 4);
  });

  it("copes with nothing remembered yet", () => {
    expect(rememberIndex(undefined, 3)).toEqual([3]);
  });
});
