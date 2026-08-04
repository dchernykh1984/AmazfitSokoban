// Which warehouses of the built-in collection have already been finished.
//
// Handing out levels at random means playing the same one twice long before
// seeing half of them - the birthday problem bites hard - so every solved level
// is marked and the picker only ever offers one that has not been played. When
// the last one falls, the slate is wiped and the collection starts again.
//
// One bit per level: a thousand levels cost 125 bytes, all six sizes together
// well under a kilobyte, which is nothing to keep in watch storage. It is stored
// as hex rather than base64 because the watch runtime cannot be relied on to
// have btoa, and hex is two characters a byte either way.

const HEX = "0123456789abcdef";

export function createProgress(count) {
  const size = Math.max(0, Math.floor(count));
  return { count: size, bits: new Array(Math.ceil(size / 8)).fill(0) };
}

export function isPlayed(progress, index) {
  if (!progress || index < 0 || index >= progress.count) {
    return false;
  }
  return (progress.bits[index >> 3] & (1 << (index & 7))) !== 0;
}

export function markPlayed(progress, index) {
  if (progress && index >= 0 && index < progress.count) {
    progress.bits[index >> 3] |= 1 << (index & 7);
  }
  return progress;
}

export function playedCount(progress) {
  if (!progress) {
    return 0;
  }
  let total = 0;
  for (let index = 0; index < progress.count; index++) {
    if (isPlayed(progress, index)) {
      total += 1;
    }
  }
  return total;
}

export function allPlayed(progress) {
  return Boolean(progress) && progress.count > 0 && playedCount(progress) === progress.count;
}

export function resetProgress(progress) {
  for (let i = 0; i < progress.bits.length; i++) {
    progress.bits[i] = 0;
  }
  return progress;
}

// A level that has not been finished yet, picked at random from those that are
// left. Once every level has been played the record is wiped and the collection
// comes round again, so the game never runs out of warehouses.
//
// Returns { index, wrapped }: `wrapped` says the slate was just cleared, which
// is worth knowing because it means a full pass through the collection is done.
export function pickUnplayed(progress, random) {
  if (!progress || progress.count <= 0) {
    return { index: 0, wrapped: false };
  }

  let wrapped = false;
  if (allPlayed(progress)) {
    resetProgress(progress);
    wrapped = true;
  }

  const start = Math.min(progress.count - 1, Math.max(0, Math.floor(random() * progress.count)));
  for (let i = 0; i < progress.count; i++) {
    const index = (start + i) % progress.count;
    if (!isPlayed(progress, index)) {
      return { index, wrapped };
    }
  }
  return { index: start, wrapped };
}

// The record as a string for storage, and back again. `count` is supplied on the
// way back because the collection decides how many levels there are, not the
// saved string - a collection that grew between versions must not be read as if
// it were still the old size.
export function encodeProgress(progress) {
  let text = "";
  for (let i = 0; i < progress.bits.length; i++) {
    const byte = progress.bits[i] & 0xff;
    text += HEX.charAt(byte >> 4) + HEX.charAt(byte & 15);
  }
  return text;
}

export function decodeProgress(text, count) {
  const progress = createProgress(count);
  if (typeof text !== "string") {
    return progress;
  }
  for (let i = 0; i < progress.bits.length; i++) {
    const high = HEX.indexOf(text.charAt(i * 2));
    const low = HEX.indexOf(text.charAt(i * 2 + 1));
    if (high === -1 || low === -1) {
      break;
    }
    progress.bits[i] = (high << 4) | low;
  }

  // A shorter collection than the record was written for would leave bits set
  // past the end, and `allPlayed` would then never be true again.
  for (let index = progress.count; index < progress.bits.length * 8; index++) {
    progress.bits[index >> 3] &= ~(1 << (index & 7));
  }
  return progress;
}

export function progressKey(sizeId) {
  return "played_" + sizeId;
}
