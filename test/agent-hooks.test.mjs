import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = join(ROOT, ".claude", "hooks", "guard-git.mjs");

// The hook blocks tool calls, so a false positive stops work dead - and its
// first version did exactly that, refusing the command that was writing the
// documentation about the flags. Run it the way Claude Code runs it: the tool
// call as JSON on stdin, the verdict as an exit code.
function verdict(command) {
  try {
    execFileSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_input: { command } }),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return 0;
  } catch (error) {
    return error.status;
  }
}

// Split so the flags never appear whole in this file's own source: the hook is
// wired into the very shell this repository is edited from.
const NO_VERIFY = "--no" + "-verify";
const FORCE = "--for" + "ce";

describe("the git guard hook", () => {
  it("refuses a commit that skips the hooks", () => {
    expect(verdict("git commit " + NO_VERIFY + ' -m "x"')).toBe(2);
    expect(verdict('git commit -n -m "x"')).toBe(2);
  });

  it("refuses a force push, however it is spelled", () => {
    expect(verdict("git push " + FORCE + " origin main")).toBe(2);
    expect(verdict("git push -f")).toBe(2);
  });

  it("allows a lease, which cannot clobber someone else's work", () => {
    expect(verdict("git push " + FORCE + "-with-lease")).toBe(0);
  });

  it("leaves ordinary commands alone", () => {
    expect(verdict("SKIP=commitizen git commit -m x")).toBe(0);
    expect(verdict("git push -u origin some-branch")).toBe(0);
    expect(verdict("npm test")).toBe(0);
  });

  // Writing about the flags is not using them. Heredocs carry documentation,
  // commit messages and pull request bodies, and matching inside one would make
  // this project impossible to document from the shell.
  it("ignores the flags when they are only text in a heredoc", () => {
    const doc = "cat > f.md <<'EOF'\nRefuses git commit " + NO_VERIFY + "\nEOF\nnpm test";
    expect(verdict(doc)).toBe(0);
  });

  it("still sees a real command after a heredoc", () => {
    const mixed = "cat > f.md <<'EOF'\ntext\nEOF\ngit push " + FORCE;
    expect(verdict(mixed)).toBe(2);
  });

  it("says nothing about a call it cannot parse", () => {
    expect(verdict("")).toBe(0);
  });
});
