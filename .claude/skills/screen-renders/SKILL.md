---
name: screen-renders
description: Produce pictures of the app's screens without a watch, by running the page against the test doubles and turning the recorded draw calls into images. Use when asked for screenshots of screens you cannot reach in the simulator, or for store images.
---

# Rendering the screens without a device

Input does not reach the simulator, so screens behind a tap - the menus, the
solved screen, the generation progress - cannot be captured from it. They can be
rendered instead, from the same code that draws on the watch.

## How it works

`test/helpers/watch.mjs` launches `page/index.js` against the `@zos/*` doubles.
The canvas double records every draw call rather than drawing it, and widgets
keep the properties they were given. So a throwaway test can drive the page
(`press`, `tapControl`, `drag`) into any state and then read the picture out of
`watch.drawn()` and `watch.zos.ui.widgets`.

Turn those records into SVG: `rect`, `disc`, `ring` and `line` map onto SVG
shapes one for one; `setPaint` carries the stroke width for the shapes that
follow it; TEXT and BUTTON widgets become a rounded rect and a centred label.
Rasterise the SVG with headless Chrome at whatever size is needed.

Keep the renderer out of the repository - a file under `tmp/` (git-ignored), or
a scratch directory. A stray `*.test.mjs` there gets picked up by the suite and
fails it.

## What this is and is not

Every rectangle, circle and stroke is a call the app really made, so geometry,
colour and layout are exact. The typeface is not: the watch renders text with
its own font, the render uses the machine's. Say so when handing the pictures
over, and prefer a real screenshot when one can be taken.
