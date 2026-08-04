// Getting one warehouse out of the packed collection.
//
// The collection can hold thousands of levels, and none of them are loaded: the
// store is handed a READER - a function that returns `length` bytes from
// `offset` - and asks it for the header once and then for a single record when a
// game starts. On the watch that reader is a file descriptor into the app's
// assets; in a test it is a Uint8Array. Neither this module nor anything it
// touches knows the difference, which is what makes the whole path testable.
import { HEADER_SIZE, SECTION_SIZE, decodeLevel, readHeader, recordOffset } from "./level-pack.js";

// How many recently played levels to remember, so the same warehouse does not
// come round again immediately. Small on purpose: the point is to avoid an
// obvious repeat, not to guarantee a full cycle through thousands of levels.
export const RECENT_MEMORY = 12;

// Read the section table. Returns null when there is no collection, when it is
// too short to hold a header, or when it is not a collection at all - all of
// which the caller answers the same way, by generating a level instead.
export function openCollection(reader) {
  let head;
  try {
    head = reader(0, HEADER_SIZE);
  } catch {
    return null;
  }
  if (!head || head.length < HEADER_SIZE) {
    return null;
  }

  const count = head[4];
  if (count <= 0) {
    return null;
  }

  let table;
  try {
    table = reader(0, HEADER_SIZE + count * SECTION_SIZE);
  } catch {
    return null;
  }
  if (!table || table.length < HEADER_SIZE + count * SECTION_SIZE) {
    return null;
  }

  const sections = readHeader(table);
  if (sections === null) {
    return null;
  }
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].count <= 0 || sections[i].recordSize <= 0) {
      return null;
    }
  }
  return sections;
}

export function sectionFor(sections, cols) {
  if (!sections) {
    return null;
  }
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].cols === cols) {
      return sections[i];
    }
  }
  return null;
}

// A level number that is not one of the last few played. Falls back to a plain
// random pick when almost everything has been seen, so a small collection still
// hands something back rather than looping.
export function pickIndex(section, random, recent) {
  const count = section.count;
  const seen = recent || [];
  const roll = () => Math.min(count - 1, Math.max(0, Math.floor(random() * count)));

  const start = roll();
  if (seen.length >= count) {
    return start;
  }
  // Walk on from a random point rather than re-rolling: with a big collection
  // the first cell is almost always free, and with a nearly exhausted small one
  // this still finds the level that has not been played instead of giving up
  // after a few unlucky rolls.
  for (let i = 0; i < count; i++) {
    const index = (start + i) % count;
    if (seen.indexOf(index) === -1) {
      return index;
    }
  }
  return start;
}

// The last few level numbers, newest first, trimmed to RECENT_MEMORY.
export function rememberIndex(recent, index) {
  const list = [index];
  const previous = recent || [];
  for (let i = 0; i < previous.length && list.length < RECENT_MEMORY; i++) {
    if (previous[i] !== index) {
      list.push(previous[i]);
    }
  }
  return list;
}

// The warehouse at `index`, read straight out of the file at its computed
// offset. Returns null when the read fails or comes up short, so a damaged
// collection degrades into "generate one instead" rather than a crash.
export function readLevel(reader, section, index) {
  if (index < 0 || index >= section.count) {
    return null;
  }
  let bytes;
  try {
    bytes = reader(recordOffset(section, index), section.recordSize);
  } catch {
    return null;
  }
  if (!bytes || bytes.length < section.recordSize) {
    return null;
  }
  return decodeLevel(bytes, 0, section.cols, section.rows, section.boxes);
}

// A reader over bytes already in memory. The watch uses a file-backed one; this
// is what the tests and the packer use.
export function bufferReader(bytes) {
  return function read(offset, length) {
    if (offset < 0 || offset + length > bytes.length) {
      return null;
    }
    return bytes.subarray(offset, offset + length);
  };
}
