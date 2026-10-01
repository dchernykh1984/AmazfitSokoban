# Codex project integration

`AGENTS.md` loads project instructions, and `.agents/skills/` exposes the project
procedures. Keep their shared content aligned with the Claude equivalents.

## Activate hooks in this checkout

Codex supports repository hooks in `.codex/hooks.json`. Trust the repository,
then review and allow the exact definitions in `/hooks`. This PR does not change
user-level trust, approvals or machine settings. The Python hooks require Python
3.10 or newer (`python3` on Unix, `py -3` on Windows/PowerShell).

The post-edit hook understands Codex `apply_patch` multi-file, add, update and
move payloads, plus legacy file edits. It checks only existing files resolved
inside this repository, with the ASCII exclusions from pre-commit. Translation
files, generated changelogs and package lockfiles retain their exemptions.
Shell redirections and arbitrary commands do not provide a file edit payload;
run the normal local gate before committing.

The pre-shell hook preserves the Claude guard against `git commit --no-verify`
and unconditional force-push flags. It reuses the existing guard script with a
Codex shell payload and requires Node. This flag guard does not grant approval
for any outward operation.

## Permissions and Git hooks

Claude `permissions.allow`, attribution settings and per-machine settings are
not Codex settings and are not imported. Codex uses its native sandbox and
approval policy, together with the project instructions and existing session
authorization. A hook cannot replace that authorization.

Git pre-commit checks work independently of the coding assistant. Run
`pre-commit install` in each clone; CI runs the configured checks as well. The
`agent-hooks` check runs the patch and repository-boundary regression tests.

Hook API reference: <https://learn.chatgpt.com/docs/hooks>.
