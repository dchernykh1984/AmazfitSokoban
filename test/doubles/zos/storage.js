// A stand-in for @zos/storage. `behaviour` lets a test make the watch's storage
// misbehave the way real ones do: absent entirely, readable but not writable, or
// throwing on both.
export const behaviour = {
  items: {},
  failReads: false,
  failWrites: false,
};

export function resetStorage() {
  behaviour.items = {};
  behaviour.failReads = false;
  behaviour.failWrites = false;
}

export class LocalStorage {
  getItem(key) {
    if (behaviour.failReads) {
      throw new Error("storage read failed");
    }
    return Object.prototype.hasOwnProperty.call(behaviour.items, key) ? behaviour.items[key] : null;
  }

  setItem(key, value) {
    if (behaviour.failWrites) {
      throw new Error("storage write failed");
    }
    behaviour.items[key] = value;
  }
}
