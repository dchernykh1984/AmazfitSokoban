# Changelog

## [0.2.0](https://github.com/dchernykh1984/AmazfitSokoban/compare/amazfit-sokoban-v0.1.0...amazfit-sokoban-v0.2.0) (2026-08-04)


### Features

* add the sokoban rule set as pure tested logic ([1220a9e](https://github.com/dchernykh1984/AmazfitSokoban/commit/1220a9e6e74f1bbe8835e952495076bd1e0c9442))
* fit the board and the map camera to a round screen ([205f419](https://github.com/dchernykh1984/AmazfitSokoban/commit/205f419e1027f1e7e13e87ca520ceddbdfc92d83))
* generate random levels that are always solvable ([719f56a](https://github.com/dchernykh1984/AmazfitSokoban/commit/719f56ad9945bc6a8977e44aed668ffd1ca930b8))
* localize the on-watch text into eleven languages ([f6ed916](https://github.com/dchernykh1984/AmazfitSokoban/commit/f6ed91613d48dc22c6c4c2ff2e72bb6aff347988))
* name what stands on each cell for the renderer ([b7dac62](https://github.com/dchernykh1984/AmazfitSokoban/commit/b7dac620561e7ce12fc502622a64d754517bff55))
* play sokoban on the watch screen ([8d51a05](https://github.com/dchernykh1984/AmazfitSokoban/commit/8d51a05682c45291f9c13259fcc875bb73398e6f))
* read taps as steps and drags as map panning ([9e64064](https://github.com/dchernykh1984/AmazfitSokoban/commit/9e64064324b71998dc0489165a32ff1070444ff4))
* register the app as Box Pusher with its store app id ([8803b7e](https://github.com/dchernykh1984/AmazfitSokoban/commit/8803b7ea87ef47c673e514914d4558b210e7f17b))
* remember the fewest moves per difficulty ([7727328](https://github.com/dchernykh1984/AmazfitSokoban/commit/772732857f765f38510b287c337f395efa8dbf96))


### Bug Fixes

* fall back to the in-memory best when storage has nothing stored ([78cb825](https://github.com/dchernykh1984/AmazfitSokoban/commit/78cb825c23d973558eb8f3b654059b7475241fc7))
* let the solved warehouse show through the menu scrim ([f5620aa](https://github.com/dchernykh1984/AmazfitSokoban/commit/f5620aa74b07c9822c84f7f04bf631fd3fa324fb))
* never hand back a warehouse that is already solved ([6dba489](https://github.com/dchernykh1984/AmazfitSokoban/commit/6dba489200c5931875f50ef5b2733a9dedbfcc0a))
* only count back a push that undo could actually reverse ([b44381b](https://github.com/dchernykh1984/AmazfitSokoban/commit/b44381b40f1bafef68233c6457c48d2eb1534750))
* swallow every swipe while a puzzle is on screen ([2daaef5](https://github.com/dchernykh1984/AmazfitSokoban/commit/2daaef53711fc73b86b8e0756253d32b66408aa6))


### Performance Improvements

* re-letter the counters instead of rebuilding them each step ([14fc83c](https://github.com/dchernykh1984/AmazfitSokoban/commit/14fc83c343d2223898d124da21ccf46efac22fcd))
* repaint the board only when a drag actually moves the map ([1f2beac](https://github.com/dchernykh1984/AmazfitSokoban/commit/1f2beac8e0ac83db348d08076542a13d21ae7a06))
