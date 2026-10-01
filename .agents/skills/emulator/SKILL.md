---
name: emulator
description: Build the app into the Zepp OS simulator and tell whether the running app is actually the code you just wrote. Use when asked to run the app in the emulator, or when the emulator seems to be showing stale behaviour.
---

# Running in the simulator

The user starts the simulator; the build is pushed into it by the Zeus watcher.

```bash
rm -rf dist          # see below - the watcher cannot recreate it
npm run dev          # answer the device prompt, then it watches for changes
```

## The trap that costs the most time

`zeus dev` fails a rebuild with `EEXIST: file already exists, mkdir dist` when
`dist/` is already there. It prints `build error` and keeps watching, so the log
still looks alive - and the simulator quietly keeps running the previous build.
An earlier `rebuild done` from minutes ago sits right above the failure and
reads like success.

Consequence: **never conclude anything about behaviour without proving the
simulator is running your code.** A wrong conclusion has been drawn here from a
stale screen (a fix was "proven not to work" when it had never been built).

To prove it, change something unmistakable - a colour of an icon, say - rebuild,
and look. If the marker is not on screen, you are looking at an old build; fix
the build before reasoning about anything else.

## Input does not reach the simulator

Synthetic clicks and keystrokes sent to the simulator window do not arrive -
neither mouse events nor `Alt`-menu keys. Screenshots of the window do work
(`PrintWindow` against the "Zepp OS Simulator" window). So you can see the
current screen, but you cannot drive the app: anything needing taps has to be
done by the person at the keyboard.

For screens you cannot reach that way, render them instead - see the
`screen-renders` skill.
