// A stand-in for @zos/fs. `assets` holds the files the app was built with, as
// byte arrays, so a test can ship it a real packed collection - or nothing at
// all, which is how a fresh clone with no maps/ behaves.
export const O_RDONLY = 0;

export const assets = { files: {}, failOpen: false, failRead: false };

export function resetAssets() {
  assets.files = {};
  assets.failOpen = false;
  assets.failRead = false;
}

const open = {};
let nextFd = 1;

export function openAssetsSync(options) {
  if (assets.failOpen) {
    throw new Error("cannot open " + options.path);
  }
  const bytes = assets.files[options.path];
  if (!bytes) {
    return -1;
  }
  const fd = nextFd;
  nextFd += 1;
  open[fd] = bytes;
  return fd;
}

export function readSync(options) {
  if (assets.failRead) {
    throw new Error("read failed");
  }
  const bytes = open[options.fd];
  if (!bytes) {
    return 0;
  }
  const settings = options.options || {};
  const position = settings.position || 0;
  const length = settings.length === undefined ? options.buffer.byteLength : settings.length;
  const view = new Uint8Array(options.buffer);

  let read = 0;
  for (let i = 0; i < length && position + i < bytes.length; i++) {
    view[i] = bytes[position + i];
    read += 1;
  }
  return read;
}

export function closeSync(options) {
  delete open[options.fd];
}
