---
name: release-and-verify
description: Take a merged change through release-please to a published release and prove what shipped, including approving the bot's blocked workflows and reading the version out of the .zab bundle. Use when asked to merge a pull request, cut a release, or check what a release actually contains.
---

# Getting a release out, and proving it

Nothing here is automatic end to end: the release PR's workflows sit blocked
until approved, and the only proof of what shipped is inside the bundle.

## The sequence

1. Confirm the PR's checks are green (`gh pr checks <N>`). Do not merge past a
   red one - if it failed on infrastructure rather than content, re-run that job
   (`gh run rerun <id> --failed`) and wait.
2. Merge. The ruleset allows rebase only, and requires a review that no one is
   going to give, so merges here are `gh pr merge <N> --rebase --admin
--delete-branch`. **Only when the merge was actually asked for.**
3. Wait for release-please to open its release PR - about a minute after the
   push. Only `feat:` and `fix:` commits produce one; a branch of `test:` and
   `docs:` merges without a release, which is correct.
4. Read its diff. It must bump `package.json` **and** `app.json`'s
   `version.name`. If the `app.json` line is missing, stop: `extra-files` in
   `release-please-config.json` is not doing its job.
5. Approve its workflows. They sit at `conclusion: action_required` because the
   PR comes from a bot:
   `gh run list --limit 6 --json databaseId,status,conclusion,name,headBranch`
   then `gh api -X POST repos/<owner>/<repo>/actions/runs/<id>/approve` for each.
6. Wait for the checks, merge the release PR the same way, wait for the tag, then
   wait again for the build workflow to attach the `.zab`.

## Prove what shipped

A `.zab` is a zip. `manifest.json` inside it lists one entry per platform, each
with `version: {code, name}`. Read it and assert that **every** entry carries
the version you expect - not the first one, all of them. The inner `.zpk` files
are encrypted, so the manifest is the readable source of truth.

The repository will show `version.code` one release behind at this point. That
is by design: release-please cannot compute the code, `version:check` gates on
the name alone, and the build recomputes the code. The bundle carrying the new
code is the proof that the build-time step fired.

## An expected oddity

An `osv-scanner` row reporting "skipping" is normal in these repositories and is
not a failure; the real scan is `osv-scan / osv-scan`.
