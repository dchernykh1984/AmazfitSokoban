import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { syncedAppJson, versionCode } from "../scripts/sync-app-version.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join("scripts", "sync-app-version.mjs");
const read = (file) => JSON.parse(readFileSync(join(ROOT, file), "utf8"));

// Run the script the way npm and CI run it - as a process, for its exit code -
// against a throwaway checkout holding nothing but the two files it reads. The
// exported helpers above are the arithmetic; this is the contract the required
// `version:check` gate is built on, and it is not visible from an import.
function runScript({ released, name, code }, ...args) {
  const dir = mkdtempSync(join(tmpdir(), "app-version-"));
  try {
    mkdirSync(join(dir, "scripts"));
    copyFileSync(join(ROOT, SCRIPT), join(dir, SCRIPT));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: released }, null, 2) + "\n");
    const app = read("app.json");
    app.app.version = { code, name };
    writeFileSync(join(dir, "app.json"), JSON.stringify(app, null, 2) + "\n");

    const run = spawnSync(process.execPath, [join(dir, SCRIPT), ...args], { encoding: "utf8" });
    return {
      status: run.status,
      output: run.stdout + run.stderr,
      version: JSON.parse(readFileSync(join(dir, "app.json"), "utf8")).app.version,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("versionCode", () => {
  it("packs a semver into one integer", () => {
    expect(versionCode("0.0.1")).toBe(1);
    expect(versionCode("0.3.1")).toBe(301);
    expect(versionCode("1.0.0")).toBe(10000);
    expect(versionCode("2.14.7")).toBe(21407);
  });

  // The store refuses an upload whose code is not above the last one, so the
  // ordering has to survive every bump, including the ones that carry.
  it("grows with every version bump, without exception", () => {
    const ordered = [
      "0.0.1",
      "0.0.99",
      "0.1.0",
      "0.1.1",
      "0.9.99",
      "0.10.0",
      "0.99.99",
      "1.0.0",
      "1.0.1",
      "2.0.0",
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(versionCode(ordered[i]), ordered[i] + " after " + ordered[i - 1]).toBeGreaterThan(
        versionCode(ordered[i - 1])
      );
    }
  });

  // Two digits each is all the packing has room for. Going quiet here would ship
  // a code that sorts below one already in the store, and the store would reject
  // the upload with nothing to explain it.
  it("refuses a version it cannot pack rather than wrapping round", () => {
    expect(() => versionCode("0.100.0")).toThrow(/under 100/);
    expect(() => versionCode("0.0.100")).toThrow(/under 100/);
    expect(versionCode("0.99.99")).toBe(9999);
  });

  it("refuses anything that is not a plain three-part version", () => {
    for (const bad of ["1.2", "1.2.3.4", "v1.2.3", "1.2.3-rc.1", "", "next"]) {
      expect(() => versionCode(bad), bad).toThrow();
    }
  });
});

describe("writing the version into app.json", () => {
  const APP = readFileSync(join(ROOT, "app.json"), "utf8");

  it("puts both numbers in", () => {
    const written = JSON.parse(syncedAppJson(APP, "1.2.3"));
    expect(written.app.version).toEqual({ name: "1.2.3", code: 10203 });
  });

  // The file is edited by hand and read in diffs, so a version bump has to show
  // up as the two lines it is - not as a reformat of the whole document.
  it("changes nothing else about the file", () => {
    const written = syncedAppJson(APP, "1.2.3");
    const before = APP.split("\n");
    const after = written.split("\n");

    expect(after.length).toBe(before.length);
    const changed = after.filter((line, i) => line !== before[i]);
    expect(changed.length).toBe(2);
    expect(changed.join(" ")).toContain("1.2.3");
  });

  it("leaves everything but the version untouched", () => {
    const before = JSON.parse(APP);
    const after = JSON.parse(syncedAppJson(APP, "9.9.9"));
    expect(after.app.appId).toBe(before.app.appId);
    expect(after.app.appName).toBe(before.app.appName);
    expect(after.targets).toEqual(before.targets);
    expect(after.permissions).toEqual(before.permissions);
  });

  it("is idempotent", () => {
    const once = syncedAppJson(APP, "1.2.3");
    expect(syncedAppJson(once, "1.2.3")).toBe(once);
  });
});

describe("running the script", () => {
  // The one case the pull-request gate exists for: someone bumped package.json,
  // or edited app.json, and the two drifted apart. A guard that says yes here is
  // worth nothing, and nothing else in this file would notice.
  it("fails the check when app.json is behind the release", () => {
    const run = runScript({ released: "0.4.0", name: "0.3.0", code: 300 }, "--check");
    expect(run.status).toBe(1);
    expect(run.output).toContain("0.3.0");
    expect(run.output).toContain("0.4.0");
    expect(run.version).toEqual({ name: "0.3.0", code: 300 });
  });

  // The state of every release PR: release-please has written the name, and the
  // code is still the previous release's until the build recomputes it. Failing
  // here would block every release.
  it("passes the check when only the code is behind", () => {
    const run = runScript({ released: "0.4.0", name: "0.4.0", code: 300 }, "--check");
    expect(run.status).toBe(0);
    expect(run.version).toEqual({ name: "0.4.0", code: 300 });
  });

  it("writes both numbers when it is not just checking", () => {
    const run = runScript({ released: "0.4.0", name: "0.3.0", code: 300 });
    expect(run.status).toBe(0);
    expect(run.version).toEqual({ name: "0.4.0", code: 400 });
  });

  it("refuses a release version it cannot pack into a code", () => {
    const run = runScript({ released: "0.100.0", name: "0.99.0", code: 9900 });
    expect(run.status).not.toBe(0);
    expect(run.output).toContain("under 100");
    expect(run.version).toEqual({ name: "0.99.0", code: 9900 });
  });
});

describe("the versions this repo actually ships", () => {
  // What the store and the watch show has to be the version that was released.
  // Only the name: release-please writes that into app.json when it opens a
  // release PR, and the code is recomputed from it at build time.
  it("says the same version in app.json as in package.json", () => {
    expect(read("app.json").app.version.name).toBe(read("package.json").version);
  });

  // Not the code, deliberately. release-please writes the name when it opens a
  // release PR and cannot compute the code, so on that one commit the code is
  // still the previous release's - and the build recomputes it before the bundle
  // is made. Asserting on it here would fail every release PR's own CI.
  it("has a code that at least parses as one", () => {
    const version = read("app.json").app.version;
    expect(Number.isInteger(version.code)).toBe(true);
    expect(version.code).toBeGreaterThan(0);
    expect(versionCode(version.name)).toBeGreaterThanOrEqual(version.code);
  });

  it("still has the registered store identity", () => {
    const app = read("app.json").app;
    expect(app.appId).toBe(1122456);
    expect(app.appName).toBe("Box Pusher");
  });
});
