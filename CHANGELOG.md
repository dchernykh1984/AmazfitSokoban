# Changelog

## [0.3.1](https://github.com/dchernykh1984/AmazfitSokoban/compare/amazfit-sokoban-v0.3.0...amazfit-sokoban-v0.3.1) (2026-08-06)


### Bug Fixes

* draw all four arrows at one size and one weight ([12679e5](https://github.com/dchernykh1984/AmazfitSokoban/commit/12679e535366ed608d9ed2351df0378b51f1f1e6))
* draw the arrows as big as the tightest button will take ([cb727fd](https://github.com/dchernykh1984/AmazfitSokoban/commit/cb727fd8f16a938d76b25c3b63efabe1dc3d0d4c))
* draw the movement arrows with a primitive the watch renders ([22a04f2](https://github.com/dchernykh1984/AmazfitSokoban/commit/22a04f24b0a58cc81e75409bb8ed6445c7132742))
* give undo and the menu the weight of the arrow beside them ([ddd7571](https://github.com/dchernykh1984/AmazfitSokoban/commit/ddd7571d73863f4ccd988b5c73e29dcbaecee82f))
* keep every arrow the same shape in a button that is not square ([c0d2a43](https://github.com/dchernykh1984/AmazfitSokoban/commit/c0d2a4343dfc52cd8a1014f9e69bc09c244d9405))
* keep every control big enough for a fingertip ([4ab0c11](https://github.com/dchernykh1984/AmazfitSokoban/commit/4ab0c11099034aeaecd51823e8a452a9ab4aa933))
* keep the warehouse inside its window and off the watch rim ([9cb21f6](https://github.com/dchernykh1984/AmazfitSokoban/commit/9cb21f6951bd1660ad7e49cf8a0b8f43957074b5))
* put dead space between the down arrow and undo or the menu ([075429b](https://github.com/dchernykh1984/AmazfitSokoban/commit/075429b000e7339c1192e18aa0ec295cad006708))
* put the counters where the whole line fits on a round screen ([6f6cb73](https://github.com/dchernykh1984/AmazfitSokoban/commit/6f6cb73459b139b6d87fe6d70a290224a3b8ff6c))
* size an arrow from the room its button really has ([734b69d](https://github.com/dchernykh1984/AmazfitSokoban/commit/734b69db346c9e60eef77c54db5c3cb30d0e933b))

## [0.3.0](https://github.com/dchernykh1984/AmazfitSokoban/compare/amazfit-sokoban-v0.2.0...amazfit-sokoban-v0.3.0) (2026-08-05)


### Features

* add the generated warehouse collection ([a90604c](https://github.com/dchernykh1984/AmazfitSokoban/commit/a90604cfec578346706b0371700c5ea57e8e1531))
* build the shipped collection with an offline quality gate ([314d151](https://github.com/dchernykh1984/AmazfitSokoban/commit/314d151e17ef182cbece08bbf73610a512ff8728))
* check and solve the collection from the command line ([0b6c318](https://github.com/dchernykh1984/AmazfitSokoban/commit/0b6c318a61d1fa637a9bfdc1a6aa517164930b4c))
* deal every warehouse once before repeating any ([13352ed](https://github.com/dchernykh1984/AmazfitSokoban/commit/13352ed23ed66df17015fc9b4b0f99f2643cf31e))
* draw crates, goal rings and a keeper that faces its push ([07d913d](https://github.com/dchernykh1984/AmazfitSokoban/commit/07d913d834bbad1f5e330d20a8a30f35246db17f))
* draw the arrows and the undo and menu icons ([f63c1d2](https://github.com/dchernykh1984/AmazfitSokoban/commit/f63c1d27b335095936063e96cf6d64d7645c28f1))
* draw the game on a canvas and steer it with the arrows ([450fb29](https://github.com/dchernykh1984/AmazfitSokoban/commit/450fb29efa208feeabcb3b84591c60f86dcec5a0))
* find the fewest pushes a warehouse can be finished in ([6c9c893](https://github.com/dchernykh1984/AmazfitSokoban/commit/6c9c893c50cac587635498aaa4b3ac0cb5793127))
* generate a warehouse in slices behind a progress bar ([8514afc](https://github.com/dchernykh1984/AmazfitSokoban/commit/8514afc6a484f8ecc1a63e30483992729187adad))
* grow the warehouse to six sizes from xs to xxl ([0cba718](https://github.com/dchernykh1984/AmazfitSokoban/commit/0cba7180ce606c49548670abc2c1367be3438bdb))
* lay the four arrows out in the segments around the board ([b555aa2](https://github.com/dchernykh1984/AmazfitSokoban/commit/b555aa272333d4c81bd67f34ecff2330c43e8c08))
* pack the collection into a binary the watch can seek in ([030b5c1](https://github.com/dchernykh1984/AmazfitSokoban/commit/030b5c196655768d61775cdc985a4ff0352177c2))
* play the shipped collection and keep a best per source ([d589e34](https://github.com/dchernykh1984/AmazfitSokoban/commit/d589e34e628ce56731444c3f099d9cb747d024ed))
* read one warehouse from the collection without loading it ([214ffc7](https://github.com/dchernykh1984/AmazfitSokoban/commit/214ffc7e715d03c3cbfbd3337c602339a8167cc5))
* rebuild the collection with the new quality bars ([a60dba0](https://github.com/dchernykh1984/AmazfitSokoban/commit/a60dba068c96a9a6db293253911449aaa909b677))
* reject empty maps, shallow puzzles and a walled-in keeper ([5132054](https://github.com/dchernykh1984/AmazfitSokoban/commit/5132054a1589bafdce4d7c539f8087014c538594))
* save the game so a big warehouse can be finished later ([ec44bab](https://github.com/dchernykh1984/AmazfitSokoban/commit/ec44bab0658c4e2e7206c83ebd21726c19144c54))
* spread the goals so no corner of the warehouse is dead ([499ee97](https://github.com/dchernykh1984/AmazfitSokoban/commit/499ee97c73186f92776454e5c8d0c1ecf0cd5b56))
* store warehouses in a text format a diff can show ([64a93bd](https://github.com/dchernykh1984/AmazfitSokoban/commit/64a93bdb0b52d88d057edbd45ef859d05c370e49))


### Bug Fixes

* stop the validator claiming levels it never proved solvable ([172159f](https://github.com/dchernykh1984/AmazfitSokoban/commit/172159f55b01f304c7158fbac0fd87302c8b67de))
* swallow swipes while a warehouse is being generated ([ea41d3d](https://github.com/dchernykh1984/AmazfitSokoban/commit/ea41d3d64f3af43276aff1fa8aed6094eeb77664))
* take the canvas down so menu buttons can be pressed ([a2b9a52](https://github.com/dchernykh1984/AmazfitSokoban/commit/a2b9a524b5bfd92fe6b04b9a0b8ef9d1d3661e78))


### Performance Improvements

* build the collection on every core at once ([f881c1a](https://github.com/dchernykh1984/AmazfitSokoban/commit/f881c1a664ef9f6f1b1ba07f787aa070d25b95b2))
* repaint only the cells a step actually changed ([caa4721](https://github.com/dchernykh1984/AmazfitSokoban/commit/caa4721f083418197ed8517c256c2c164aaea07f))
* stop re-parsing the save after every move ([9ded26f](https://github.com/dchernykh1984/AmazfitSokoban/commit/9ded26fef91dbcf2e63eae4ea747d5af0e97bf87))

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
