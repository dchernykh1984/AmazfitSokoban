// The binary the watch actually reads. The collection is stored in the
// repository as text (lib/level-format.js) so a diff is readable; this module
// packs that text into the blob that ships inside the app, and unpacks a single
// warehouse out of it again.
//
// The point of the layout is that a level can be found by ARITHMETIC, without
// reading the file: every record in a section is the same size, so record N
// starts at `section.offset + N * section.recordSize`. The watch reads exactly
// those bytes at that offset and nothing else, so a collection of any size costs
// no memory at all.
//
//   header   "BPM1", section count
//   section  cols, rows, boxes, level count, record size, offset   (per size)
//   record   wall bitmap, goals, boxes, keeper
//
// Coordinates are a byte each rather than a flat cell index: a 19x19 warehouse
// has 361 cells, which does not fit in one byte, and two small bytes are simpler
// than packing nine bits.

export const MAGIC = "BPM1";
export const HEADER_SIZE = 5; // 4 magic + 1 section count
export const SECTION_SIZE = 11; // cols, rows, boxes, count(2), record(2), offset(4)

export function wallBytes(cols, rows) {
  return Math.ceil((cols * rows) / 8);
}

// Every record in a section is this long, which is what makes a level findable
// by multiplication instead of by scanning.
export function recordSize(cols, rows, boxes) {
  return wallBytes(cols, rows) + boxes * 2 + boxes * 2 + 2;
}

function writeUint16(bytes, at, value) {
  bytes[at] = (value >> 8) & 0xff;
  bytes[at + 1] = value & 0xff;
}

function readUint16(bytes, at) {
  return (bytes[at] << 8) | bytes[at + 1];
}

function writeUint32(bytes, at, value) {
  bytes[at] = (value >>> 24) & 0xff;
  bytes[at + 1] = (value >>> 16) & 0xff;
  bytes[at + 2] = (value >>> 8) & 0xff;
  bytes[at + 3] = value & 0xff;
}

function readUint32(bytes, at) {
  return ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
}

// One warehouse written into `bytes` at `at`. Returns the number of bytes used,
// which is always `recordSize` for that size.
export function encodeLevel(level, bytes, at) {
  const boxCount = level.boxes.length;
  const masked = wallBytes(level.cols, level.rows);

  for (let i = 0; i < masked; i++) {
    bytes[at + i] = 0;
  }
  for (let index = 0; index < level.cols * level.rows; index++) {
    if (level.walls[index] === 1) {
      bytes[at + (index >> 3)] |= 1 << (index & 7);
    }
  }

  let cursor = at + masked;
  const goals = level.goals.slice().sort((a, b) => a - b);
  for (let i = 0; i < boxCount; i++) {
    bytes[cursor] = goals[i] % level.cols;
    bytes[cursor + 1] = Math.floor(goals[i] / level.cols);
    cursor += 2;
  }
  const boxes = level.boxes.slice().sort((a, b) => a - b);
  for (let i = 0; i < boxCount; i++) {
    bytes[cursor] = boxes[i] % level.cols;
    bytes[cursor + 1] = Math.floor(boxes[i] / level.cols);
    cursor += 2;
  }
  bytes[cursor] = level.player % level.cols;
  bytes[cursor + 1] = Math.floor(level.player / level.cols);
  cursor += 2;

  return cursor - at;
}

// The warehouse stored at `at`. The caller supplies the shape, because that
// lives in the section header rather than in every record.
export function decodeLevel(bytes, at, cols, rows, boxCount) {
  const masked = wallBytes(cols, rows);
  const walls = new Array(cols * rows).fill(0);
  for (let index = 0; index < cols * rows; index++) {
    if ((bytes[at + (index >> 3)] & (1 << (index & 7))) !== 0) {
      walls[index] = 1;
    }
  }

  let cursor = at + masked;
  const goals = [];
  for (let i = 0; i < boxCount; i++) {
    goals.push(bytes[cursor + 1] * cols + bytes[cursor]);
    cursor += 2;
  }
  const boxes = [];
  for (let i = 0; i < boxCount; i++) {
    boxes.push(bytes[cursor + 1] * cols + bytes[cursor]);
    cursor += 2;
  }
  const player = bytes[cursor + 1] * cols + bytes[cursor];

  return { cols, rows, walls, goals, boxes, player };
}

// The whole collection. `sections` is one entry per size:
//   { cols, rows, boxes, levels }
export function encodeCollection(sections) {
  let total = HEADER_SIZE + sections.length * SECTION_SIZE;
  const layout = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const size = recordSize(section.cols, section.rows, section.boxes);
    layout.push({ size, offset: total, count: section.levels.length });
    total += size * section.levels.length;
  }

  const bytes = new Uint8Array(total);
  for (let i = 0; i < MAGIC.length; i++) {
    bytes[i] = MAGIC.charCodeAt(i);
  }
  bytes[4] = sections.length;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const at = HEADER_SIZE + i * SECTION_SIZE;
    bytes[at] = section.cols;
    bytes[at + 1] = section.rows;
    bytes[at + 2] = section.boxes;
    writeUint16(bytes, at + 3, layout[i].count);
    writeUint16(bytes, at + 5, layout[i].size);
    writeUint32(bytes, at + 7, layout[i].offset);

    let cursor = layout[i].offset;
    for (let l = 0; l < section.levels.length; l++) {
      cursor += encodeLevel(section.levels[l], bytes, cursor);
    }
  }

  return bytes;
}

// The section table, read from the first bytes of the file. This is all the
// watch needs in memory; everything else is fetched by offset on demand.
export function readHeader(bytes) {
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) {
      return null;
    }
  }
  const count = bytes[4];
  const sections = [];
  for (let i = 0; i < count; i++) {
    const at = HEADER_SIZE + i * SECTION_SIZE;
    sections.push({
      cols: bytes[at],
      rows: bytes[at + 1],
      boxes: bytes[at + 2],
      count: readUint16(bytes, at + 3),
      recordSize: readUint16(bytes, at + 5),
      offset: readUint32(bytes, at + 7),
    });
  }
  return sections;
}

// Where record `index` of a section begins, so the watch can seek straight to it.
export function recordOffset(section, index) {
  return section.offset + index * section.recordSize;
}

export function findSection(sections, cols) {
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].cols === cols) {
      return sections[i];
    }
  }
  return null;
}
