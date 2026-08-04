// A stand-in for @zos/display, recording the screen-timeout calls so a test can
// check the page asks for a longer one and hands it back.
export const display = { brightTime: null, reset: 0 };

export function setPageBrightTime(options) {
  display.brightTime = options.brightTime;
}

export function resetPageBrightTime() {
  display.brightTime = null;
  display.reset += 1;
}
