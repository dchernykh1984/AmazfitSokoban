# Amazfit Sokoban

**Sokoban** is the classic warehouse puzzle as a **Zepp OS mini app** for round
Amazfit watches. Push every crate onto a goal - crates only ever move away from
you, never towards you, so a crate shoved into a corner is lost. Every level is
generated on the watch, and every one of them can be finished. No phone, no
network, no account.

- **Controls** - four **arrows** in the segments around the board move the
  keeper one cell; **dragging the board** pans the map, pixel for pixel, the way
  a navigator does. The two never collide, because they live in different places
  on the screen. **Undo** takes back the last step, crate and all.
- **Sizes** - XS (9x9, two crates) through XXL (19x19, seven). XS and S fit on
  the screen whole; from M upwards the warehouse is bigger than the window and
  the map has to be dragged. Whichever size you played last is the one that
  opens next time.
- **Where the levels come from** - **Built-in**, from a collection of 4000
  warehouses generated on a computer and put through a real solver, so none of
  them is trivially easy; or **Random**, generated on the watch behind a progress
  bar. Each warehouse is dealt once before any is repeated, and when the whole
  collection has been played the slate is wiped.
- **Always solvable** - levels are never scrambled at random, because most random
  Sokoban positions are dead on arrival. The generator starts from a _solved_
  warehouse and walks the game backwards, **pulling** crates off their goals. A
  pull is the exact inverse of a push, so replaying the pulls in reverse is a
  solution - and every shipped level has had that solution replayed through the
  real rule set before it was written to disk.
- **Pick it up later** - the position is saved after every move, so a 19x19
  warehouse can be finished over several sittings. The whole board is saved, not
  a level number, so a future collection cannot leave you standing in a wall.
- **Best score** - the fewest moves, kept per size **and** per source: a level
  the watch rolled at random is not the same challenge as one that was vetted
  before it shipped.
- **Languages** - the on-watch text is localized into the same 11 languages as the
  sibling [AmazfitRaceStats](https://github.com/dchernykh1984/AmazfitRaceStats) app:
  English, Russian, German, French, Italian, Spanish, Portuguese, Dutch, Polish,
  Czech and Kazakh. Zepp OS has no device-language code for Kazakh, so that table is
  carried ready but never auto-selected; unknown languages fall back to English.

## Devices

Round watches only, built for both round resolutions: **466** (GTR 4, Active 2
Round, Balance, Cheetah, ...) and **480** (T-Rex 3, Balance 2, ...). The board is
the largest square inscribed in the circle, with the counters in the cap above it
and the buttons in the cap below, so both sizes get the same game with correctly
sized cells. Square devices are intentionally out of scope.

## Setup

```bash
git clone https://github.com/dchernykh1984/AmazfitSokoban.git
cd AmazfitSokoban
npm install
```

## Develop

```bash
npm test          # run the unit tests (Vitest)
npm run lint      # ESLint
npm run format    # rewrite files with Prettier
npm run dev       # run in the Zepp OS simulator
npm run preview   # QR-preview on a device via the Zepp app in Developer Mode
npm run build     # produce the .zab store bundle
```

### The level tools

The warehouses the app ships with are generated on a computer, not on the watch,
so they can be put through a real solver first. Everything needed to rebuild and
check them lives in `scripts/`, so none of it has to be rewritten on the next
machine:

```bash
npm run maps                              # rebuild the whole collection (~8 min on 8 cores)
node scripts/generate-maps.mjs --counts xs=50 --seed 2 --jobs 4
npm run pack                              # pack maps/*.sok into the binary the watch reads
node scripts/validate-maps.mjs            # check every shipped warehouse
node scripts/validate-maps.mjs --deep --sizes m,l
node scripts/solve-map.mjs xs 12          # draw one warehouse and solve it
```

| Script              | What it does                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-maps.mjs` | Builds `maps/<size>.sok`. Splits the work across every core, one child process per shard, and merges, de-duplicates and trims the result. Deterministic: same `--seed` and `--jobs`, same collection.            |
| `pack-maps.mjs`     | Turns `maps/*.sok` into `assets/common.r/levels.bin`. Runs automatically before `dev`, `preview` and `build`.                                                                                                    |
| `validate-maps.mjs` | Puts every warehouse through the real rule set and the real solver: size, crate count, connected floor, no crate starting on a goal, actually solvable, not trivially easy. Exits non-zero if anything is wrong. |
| `solve-map.mjs`     | Draws a single warehouse and solves it - for when a level looks odd and you want the solver's opinion.                                                                                                           |

The text in `maps/` is the source of truth and is committed, so a change to the
collection shows up as a readable diff. The packed binary is a build artefact and
is git-ignored.

`preview` and `build` fetch the [Zeus CLI](https://docs.zepp.com/docs/guides/quick-start/)
on demand (`npx`), so it is not tracked as a dependency; the first run downloads it.
The Zeus CLI needs **Node 18 or 20** - on newer Node it fails to resolve its own
modules. The app itself ships **no runtime dependencies**: it uses only the `@zos/*`
modules the watch provides.

### Layout of the code

```
app.json                 manifest (round 466 + 480, one page module)
app.js                   app entry
lib/                     PURE, unit-tested logic (no Zepp OS imports)
  sokoban.js             the rule set: walking, pushing, undo, solved
  generator.js           random levels built backwards from a solved warehouse
  generator-steps.js     the same, one slice at a time, so a bar can move
  solver.js              the optimal solver used offline to reject easy levels
  collection.js          the offline quality gate
  levels.js              the six sizes and what they ask the generator for
  sources.js             built-in collection or generated on the watch
  level-format.js        the .sok text the collection is stored in
  level-pack.js          the binary the watch seeks into
  level-store.js         reading one warehouse without loading the rest
  progress.js            which warehouses have been finished
  save.js                the game in progress, for picking up later
  directions.js          the four grid directions
  board.js               the window onto the warehouse, inscribed in the circle
  round-geometry.js      chord maths that keeps text and buttons off the bezel
  viewport.js            the camera, in pixels: centring, following, panning
  controls.js            where the arrows sit, and what is under a finger
  touch.js               tap versus drag
  render.js              what stands on a cell
  paint.js               what that looks like, as drawing primitives
  scores.js              the persisted best, per size and source
  i18n/                  keys.js (the contract), labels.js (11 tables), index.js
maps/                    the shipped collection, as readable text
scripts/                 generate, pack, validate and solve (see above)
page/index.js            the watch screen: drawing, touches, the screens
page/index.r.layout.js   the layout module Zepp OS requires per page
utils/config/            device.js (screen size), constants.js (chrome, layout fractions)
assets/common.r/icon.png the app icon
test/                    Vitest unit tests
  doubles/zos/           stand-ins for the firmware modules, so the page is testable
  helpers/               ASCII level pictures and the fake watch the page runs on
vitest.config.mjs        aliases @zos/* onto those doubles
```

The split is deliberate: every rule and every measurement lives in `lib/`, where a
test can reach it without a watch, and `page/index.js` only turns that into
widgets and reacts to touches.

The whole game screen is a **single canvas**. That is what makes the map slide
under a finger pixel by pixel instead of jumping a cell at a time, lets the
crates and the keeper be drawn rather than shipped as images at six sizes, and
keeps the touch handling to one surface with a pure hit-test behind it. The
canvas is taken down whenever a menu opens, because a listening canvas swallows
taps meant for the buttons drawn over it.

The screen is tested too, not just the rules. The `@zos/*` modules only exist
inside a Zepp OS build, so `vitest.config.mjs` resolves them to doubles that
record what the page drew and let a test press, drag and lift a finger on it. The
end-to-end case walks a whole generated warehouse out arrow by arrow - the same
solution the generator proves - and checks the record that lands in storage.

### In the store

The app is registered in the [Zepp developer console](https://console.zepp.com/) as
**Box Pusher**, `appId` **1122456**, which is what `app.json` carries. The id has to
be the registered one: the dev preview is cloud-mediated, and an unregistered appId
makes the watch install the app but silently refuse to launch its screen. The
repository, the npm package and the release artifacts keep the `AmazfitSokoban` name;
"Box Pusher" is the store listing and what the watch shows in its app list.

## Pre-commit hooks (contributors)

```bash
uv tool install pre-commit   # or: pipx install pre-commit
pre-commit install
```

After that the hooks run automatically: Prettier and ESLint and a non-ASCII guard on
commit, Conventional Commits validation on the commit message, and the unit tests on
push. The non-ASCII guard skips `lib/i18n/`, which legitimately holds translated
text.

## Continuous integration and releases

Every pull request must pass the required checks: Prettier, ESLint, the unit tests,
`actionlint`, commitizen (Conventional Commits), and an OSV dependency scan.

Releases are automated with `release-please`: it maintains a version-bump PR from the
Conventional Commits and, when merged, tags a GitHub Release. The release build
workflow then produces the `.zab` store bundle and attaches it, deriving the Zepp
`version.name` / `version.code` from `package.json`. Uploading the `.zab` to the Zepp
App Store stays manual, because Zepp has no public publish API.

## License

Released under the [MIT License](LICENSE).
