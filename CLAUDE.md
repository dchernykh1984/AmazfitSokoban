# Working on Box Pusher

A Sokoban puzzle for round Amazfit watches (Zepp OS mini app, appId 1122456,
"Box Pusher" in the store). `README.md` explains what the code is and how it is
laid out; this file is about how to work on it. Procedures that are long enough
to need steps live in `.claude/skills/`.

## How to work here

**A reported problem is an invitation to discuss, not a licence to fix.** When
something is described as broken or wrong, say what you think is going on and
wait for an explicit go-ahead before touching the code. Rushing to patch has
been the single biggest source of wasted effort in this repository.

**Do what was asked, and stop there.** No opportunistic cleanups, no "while I
was in there", no chasing red marks that bother nobody. If you notice something
worth doing, mention it and let the decision be made.

**Ask before installing anything** or changing machine-wide configuration.

**Never run remote git operations on your own** - no push, no merge, no branch
deletion, no force-push - unless you were asked for that specific action.

Answer in the language the request was written in.

## Commits

Conventional Commits, one-line subject, imperative mood, no body unless it earns
its place. The commitizen hook enforces the format in CI.

One commit per finding when working through review comments: it makes the
history readable and lets a single fix be reverted on its own.

## Running the checks

```bash
npm test                 # vitest, the whole suite
npx eslint .
npx prettier --check .
npm run version:check    # app.json still names the version being released
```

Three pre-commit hooks cannot run on a Windows machine under an app-control
policy (`WinError 4551`): `commitizen`, `end-of-file-fixer` and
`check-added-large-files`. Skip those three by name and let CI run them:

```bash
SKIP=commitizen,end-of-file-fixer,check-added-large-files git commit -m "..."
SKIP=check-added-large-files,commitizen,end-of-file-fixer git push
```

Never use `--no-verify`: it disables every hook, including the ones that work.

## House style

Source and config files stay ASCII, `lib/i18n/` excepted - a pre-commit hook
enforces it over `.js`, `.mjs`, `.json`, `.yml` and `.md`.

Comments explain **why**, not what. A comment that restates the code earns
nothing; one that records the constraint behind a number, or the bug a line
prevents, saves the next person an hour. Match the density of the file you are
editing.

Tests are written to fail for a reason. Before believing a new test, break the
thing it covers and watch it fail - most tests that pass on a broken
implementation were written against the wrong thing.

## Things this platform does that will surprise you

- **`drawPoly` accepts a polygon and draws nothing.** No error, no warning. The
  movement arrows once shipped invisible because of it. Only `drawRect`,
  `drawCircle`, `strokeCircle` and `drawLine` are known to render; the arrows
  are chevrons of two thick lines for exactly this reason.
- **The canvas does not clip.** It is the whole screen, so anything drawn past
  the board window lands on the controls or over the rim of a round face.
  `paintWindowEdge` paints that overspill out before the controls go down.
- **The screen is round.** A row near the top or bottom is limited by the chord
  of the circle at its own height, not by the screen width - see
  `lib/round-geometry.js`. Corners of a widget can fall outside the bezel.
- **Two version numbers.** `app.json` carries `version.name` (shown to people)
  and `version.code` (an integer the store demands increase). release-please
  writes only the name; `scripts/sync-app-version.mjs` derives both at build
  time. `README.md` has the full story.

## Releases

`release-please` maintains a version-bump PR and tags a release when it merges.
Only `feat:` and `fix:` commits produce a release - a branch of `test:` and
`docs:` merges without one, which is correct and not a failure.

See `.claude/skills/release-and-verify/SKILL.md` before driving a release, and
`.claude/skills/store-submission/SKILL.md` before preparing a store listing.
