# Agent context

What a fresh Claude Code session needs to know to work on this project. Tracked
on purpose - `.gitignore` keeps out only `settings.local.json`, which holds
per-machine command approvals and absolute paths.

| Path                  | What it is                                                         |
| --------------------- | ------------------------------------------------------------------ |
| `../CLAUDE.md`        | How to work here: the agreements, the commands, the platform traps |
| `skills/`             | Procedures worth following step by step                            |
| `hooks/guard-git.mjs` | Refuses the git flags that skip this project's safety nets         |
| `settings.json`       | Shared permissions and the hook wiring                             |
| `settings.local.json` | Per-machine, git-ignored, not for sharing                          |

## The skills

- **review-cycle** - finding what the tests miss: mutate the code, simulate the
  release, judge deleted tests on their merits
- **release-and-verify** - merging through release-please, approving the bot's
  blocked workflows, and reading the shipped version out of the `.zab`
- **emulator** - building into the simulator, and proving the running app is
  actually your code
- **store-submission** - the store's image sizes and field limits, and what a
  reviewer rejected for
- **screen-renders** - pictures of screens the simulator will not let you reach

Nothing here holds credentials, tokens or machine paths. Keep it that way: this
directory is public with the rest of the repository.
