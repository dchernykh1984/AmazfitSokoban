// The game in progress, written to watch storage and read back.
//
// A big warehouse is not finished in one sitting, so closing the app must not
// throw the position away. What is saved is the WHOLE position, not a pointer
// into the shipped collection: a level number would go stale the moment the
// collection changed in a later version, and the player would come back to find
// themselves standing in a wall with the crates outside the map.
//
// The starting positions are kept alongside the current ones, because Restart
// has to work after a reload and the undo history is capped - it cannot always
// be rewound all the way to the beginning.
//
// Stored as hex: the watch runtime cannot be relied on to have btoa, and hex is
// two characters a byte either way.
import { VECTORS } from "./directions.js";

export const SAVE_VERSION = 1;
export const SAVE_KEY = "game";

// How much of the undo history is worth keeping across a restart. Undo is for
// taking back a mistake you just made; anything older is what Restart is for,
// and a few hundred moves is already more than anybody rewinds.
export const HISTORY_LIMIT = 800;

const HEX = "0123456789abcdef";

function toHex(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] & 0xff;
    text += HEX.charAt(byte >> 4) + HEX.charAt(byte & 15);
  }
  return text;
}

function fromHex(text) {
  if (typeof text !== "string" || text.length < 2 || text.length % 2 !== 0) {
    return null;
  }
  const bytes = new Array(text.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const high = HEX.indexOf(text.charAt(i * 2));
    const low = HEX.indexOf(text.charAt(i * 2 + 1));
    if (high === -1 || low === -1) {
      return null;
    }
    bytes[i] = (high << 4) | low;
  }
  return bytes;
}

function pushCell(bytes, index, cols) {
  bytes.push(index % cols);
  bytes.push(Math.floor(index / cols));
}

function readCell(bytes, at, cols) {
  return bytes[at + 1] * cols + bytes[at];
}

// Everything needed to carry on: which size and source were being played, the
// warehouse itself, where it started, where it is now, and how it got there.
export function encodeSave(level, source, game) {
  const cols = game.cols;
  const rows = game.rows;
  const boxes = game.boxes.length;
  const bytes = [SAVE_VERSION, level & 0xff, source & 0xff, cols, rows, boxes];

  const wallBytes = Math.ceil((cols * rows) / 8);
  const mask = new Array(wallBytes).fill(0);
  for (let index = 0; index < cols * rows; index++) {
    if (game.walls[index] === 1) {
      mask[index >> 3] |= 1 << (index & 7);
    }
  }
  for (let i = 0; i < wallBytes; i++) {
    bytes.push(mask[i]);
  }

  for (let i = 0; i < boxes; i++) {
    pushCell(bytes, game.goals[i], cols);
  }
  for (let i = 0; i < boxes; i++) {
    pushCell(bytes, game.start.boxes[i], cols);
  }
  pushCell(bytes, game.start.player, cols);
  for (let i = 0; i < boxes; i++) {
    pushCell(bytes, game.boxes[i], cols);
  }
  pushCell(bytes, game.player, cols);

  bytes.push((game.moves >> 8) & 0xff, game.moves & 0xff);
  bytes.push((game.pushes >> 8) & 0xff, game.pushes & 0xff);

  // Only the tail of the history is kept, newest last, so undo still works for
  // the moves that are worth taking back.
  const history = game.history.slice(Math.max(0, game.history.length - HISTORY_LIMIT));
  bytes.push((history.length >> 8) & 0xff, history.length & 0xff);
  for (let i = 0; i < history.length; i++) {
    bytes.push((history[i].direction & 3) | (history[i].pushed ? 4 : 0));
  }

  return toHex(bytes);
}

// The saved game, or null when there is nothing usable stored. Anything that
// does not add up - a version from the future, a truncated string, a warehouse
// whose numbers contradict each other - reads as "no save" rather than as a
// broken game, because a wrong board is worse than a fresh one.
export function decodeSave(text) {
  const bytes = fromHex(text);
  if (bytes === null || bytes.length < 6) {
    return null;
  }
  if (bytes[0] !== SAVE_VERSION) {
    return null;
  }

  const level = bytes[1];
  const source = bytes[2];
  const cols = bytes[3];
  const rows = bytes[4];
  const boxes = bytes[5];
  if (cols < 3 || rows < 3 || boxes < 1) {
    return null;
  }

  const wallBytes = Math.ceil((cols * rows) / 8);
  let at = 6;
  if (bytes.length < at + wallBytes + boxes * 6 + 4 + 4 + 2) {
    return null;
  }

  const walls = new Array(cols * rows).fill(0);
  for (let index = 0; index < cols * rows; index++) {
    if ((bytes[at + (index >> 3)] & (1 << (index & 7))) !== 0) {
      walls[index] = 1;
    }
  }
  at += wallBytes;

  const goals = [];
  for (let i = 0; i < boxes; i++) {
    goals.push(readCell(bytes, at, cols));
    at += 2;
  }
  const startBoxes = [];
  for (let i = 0; i < boxes; i++) {
    startBoxes.push(readCell(bytes, at, cols));
    at += 2;
  }
  const startPlayer = readCell(bytes, at, cols);
  at += 2;
  const currentBoxes = [];
  for (let i = 0; i < boxes; i++) {
    currentBoxes.push(readCell(bytes, at, cols));
    at += 2;
  }
  const player = readCell(bytes, at, cols);
  at += 2;

  const moves = (bytes[at] << 8) | bytes[at + 1];
  const pushes = (bytes[at + 2] << 8) | bytes[at + 3];
  at += 4;

  const historyLength = (bytes[at] << 8) | bytes[at + 1];
  at += 2;
  if (historyLength > HISTORY_LIMIT || bytes.length < at + historyLength) {
    return null;
  }
  const history = [];
  for (let i = 0; i < historyLength; i++) {
    const packed = bytes[at + i];
    const direction = packed & 3;
    if (direction >= VECTORS.length) {
      return null;
    }
    history.push({ direction, pushed: (packed & 4) !== 0 });
  }

  const cells = cols * rows;
  const sane = (index) => index >= 0 && index < cells;
  if (!sane(player) || !sane(startPlayer)) {
    return null;
  }
  for (let i = 0; i < boxes; i++) {
    if (!sane(goals[i]) || !sane(startBoxes[i]) || !sane(currentBoxes[i])) {
      return null;
    }
  }

  return {
    level,
    source,
    game: {
      cols,
      rows,
      walls,
      goals,
      boxes: currentBoxes,
      player,
      start: { boxes: startBoxes, player: startPlayer },
      moves,
      pushes,
      history,
    },
  };
}
