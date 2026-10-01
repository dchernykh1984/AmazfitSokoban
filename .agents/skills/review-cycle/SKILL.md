---
name: review-cycle
description: Run a review cycle over a change in this repository - how to find defects that tests miss, how to prove a finding rather than assert it, and how to land the fixes. Use when asked to review a branch, a pull request or a diff here, or to check that a test suite actually holds.
---

# Reviewing a change here

The point of a cycle is to find what the suite does not. Every round of review
in this repository has found something, and almost none of it was found by
reading - it was found by breaking the code and watching what stayed green.

## Mutate before you believe

Take the thing the change claims to protect and break it, one way at a time.
Run the suite after each. A mutation that survives is a hole in the tests, and
it is the finding.

Mutations that have caught real holes here:

- invert a comparison, or replace a guard's condition with `if (true)`
- delete the write in a function whose whole job is to write
- drop an entry-point guard so a script silently does nothing
- change a constant that a layout depends on (a fill fraction, a margin)
- take one extra cell in a range, or one fewer

Run it, record what survived, fix the test, then re-run the mutation and watch
it die. Report the mutations that survived - that is the evidence.

## Simulate the release, do not reason about it

Anything touching versions, the build or CI has to be walked through the whole
sequence, in a scratch copy:

1. a `fix:` lands on main
2. release-please opens a release PR - it bumps `package.json` and `app.json`'s
   `version.name`, but **not** `version.code`
3. that PR's own CI runs: `version:check`, the unit tests, prettier, eslint
4. it merges, the build runs `npm run version:sync` then `zeus build`

Tests that pass today and fail on a release PR have shipped here more than once.
The classic one asserts `version.code === derived(version.name)`, which is false
for exactly one commit per release and would redden every release PR.

## Judge deletions on their merits

When a change removes a test, do not accept the stated reason. Restore it, put
the repository in the state the reason describes, and see whether it really
fails. One removal justified as "would fail on every release PR" turned out to
pass; the removal was still fine, because a stronger assertion had replaced it,
but the reason was wrong and saying so mattered.

## Check the words too

Comments and docs go stale in the same commit that makes them wrong. Worth a
look every time: a README paragraph crediting the old mechanism, a code map
missing a new directory, a list of required checks that does not mention a check
the change just added, a comment describing a workflow step that was replaced.

## Landing the fixes

One commit per finding, one-line Conventional Commits subject. Leave the working
tree clean: restore anything you mutated, and delete scratch copies. Then get
the pipeline green before reporting.

Report each finding as: file and line, why it matters, what you did about it,
and - when the change was copied from a sibling project - whether the same
defect is in the original.
