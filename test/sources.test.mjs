import { describe, it, expect } from "vitest";
import { UI_KEYS } from "../lib/i18n/keys.js";
import {
  BUILT_IN,
  DEFAULT_SOURCE,
  GENERATED,
  SOURCES,
  SOURCE_KEY,
  clampSource,
  nextSource,
  sourceLabel,
} from "../lib/sources.js";

describe("the level sources", () => {
  it("offers the shipped collection and generating on the watch", () => {
    expect(SOURCES).toEqual([BUILT_IN, GENERATED]);
  });

  it("starts on the built-in collection, which is the better one", () => {
    expect(DEFAULT_SOURCE).toBe(BUILT_IN);
  });

  it("has a storage key of its own", () => {
    expect(SOURCE_KEY).toBeTruthy();
  });
});

describe("clampSource", () => {
  it("passes a real source through", () => {
    expect(clampSource(BUILT_IN)).toBe(BUILT_IN);
    expect(clampSource(GENERATED)).toBe(GENERATED);
  });

  it("falls back to the default for anything unusable", () => {
    expect(clampSource(undefined)).toBe(DEFAULT_SOURCE);
    expect(clampSource(null)).toBe(DEFAULT_SOURCE);
    expect(clampSource("")).toBe(DEFAULT_SOURCE);
    expect(clampSource("nonsense")).toBe(DEFAULT_SOURCE);
    expect(clampSource(7)).toBe(DEFAULT_SOURCE);
  });
});

describe("nextSource", () => {
  it("flips between the two and comes back", () => {
    expect(nextSource(BUILT_IN)).toBe(GENERATED);
    expect(nextSource(GENERATED)).toBe(BUILT_IN);
    expect(nextSource(nextSource(BUILT_IN))).toBe(BUILT_IN);
  });

  it("starts from the default when what was stored is junk", () => {
    expect(nextSource("nonsense")).toBe(nextSource(DEFAULT_SOURCE));
  });
});

describe("sourceLabel", () => {
  it("names each source with a key the screen can translate", () => {
    for (const source of SOURCES) {
      expect(UI_KEYS).toContain(sourceLabel(source));
    }
    expect(sourceLabel(BUILT_IN)).not.toBe(sourceLabel(GENERATED));
  });

  it("names the default for an unusable source", () => {
    expect(sourceLabel("nonsense")).toBe(sourceLabel(DEFAULT_SOURCE));
  });
});
