# Amazfit Sokoban

**Sokoban** is the classic warehouse puzzle as a **Zepp OS mini app** for round
Amazfit watches. Push every crate onto a goal - crates only ever move away from
you, never towards you, so a crate shoved into a corner is lost. Every level is
generated on the watch, and every one of them can be finished. No phone, no
network, no account.

- **Controls** - **tap** anywhere on the board to take one step towards the cell
  you touched, and **drag** the board to move the map around, the way a navigator
  pans. The two never collide: once your finger has travelled further than a
  fingertip the touch is a drag and will not also step. **Undo** takes back the
  last step, crate and all.
- **Difficulty** - Easy (7x7, two crates), Normal (10x10, three) or Hard (13x13,
  four), picked on the start screen. Easy fits on the screen whole; from Normal
  upwards the warehouse is bigger than the window and the map has to be dragged.
  Whichever difficulty you played last is the one that opens next time.
- **Random, but always solvable** - levels are never scrambled at random, because
  most random Sokoban positions are dead on arrival. The generator starts from a
  _solved_ warehouse and walks the game backwards, **pulling** crates off their
  goals. A pull is the exact inverse of a push, so replaying the pulls in reverse
  is a solution - one that comes with the level and that the unit tests replay for
  every difficulty on every seed.
- **Best score** - the fewest moves you have solved that difficulty in, kept in
  on-watch storage. Sokoban scores the other way round from most games: less wins.
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
npm run preview   # QR-preview on a device via the Zepp app in Developer Mode
npm run build     # produce the .zab store bundle
```

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
  levels.js              the three difficulties and what they ask the generator for
  directions.js          the four grid directions
  board.js               the window onto the warehouse, inscribed in the round screen
  round-geometry.js      chord maths that keeps text and buttons off the bezel
  viewport.js            the camera: centring, following, panning, hit-testing
  touch.js               tap versus drag, and which way a tap steps
  render.js              what stands on a cell, and the colours it is drawn in
  scores.js              the persisted best, per difficulty
  i18n/                  keys.js (the contract), labels.js (11 tables), index.js
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
test can reach it without a watch, and `page/index.js` only turns that into widgets
and reacts to touches. The board is a fixed grid of widgets that the camera moves
over, and a step or a drag recolours only the cells that changed, so panning keeps
up with a finger instead of rebuilding a hundred widgets a frame.

The screen is tested too, not just the rules. The `@zos/*` modules only exist
inside a Zepp OS build, so `vitest.config.mjs` resolves them to doubles that record
the widgets the page creates and let a test press, drag and lift a finger on them.
The end-to-end case taps out a whole generated puzzle cell by cell - the same
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
