// A stand-in for @zos/device. 466 is the smaller of the two round resolutions the
// app is built for, so the tests lay the board out the tightest way it ships.
export const device = { width: 466, height: 466 };

export function getDeviceInfo() {
  return { width: device.width, height: device.height };
}
