// The text format the level collection is stored in, so a warehouse can be read
// by eye in a diff instead of being an opaque blob.
//
// One character per cell, the same alphabet every Sokoban collection uses, with
// one change: floor is a DASH, not a space. The repository's trailing-whitespace
// hook would quietly eat the right-hand edge of every picture and corrupt the
// collection without anyone noticing.
//
//   #  wall      -  floor     .  goal
//   $  box       *  box on a goal
//   @  keeper    +  keeper on a goal
//
// A collection is levels separated by blank lines; lines starting with ';' are
// comments and are ignored.
export const WALL = "#";
export const FLOOR = "-";
export const GOAL = ".";
export const BOX = "$";
export const BOX_ON_GOAL = "*";
export const KEEPER = "@";
export const KEEPER_ON_GOAL = "+";
export const COMMENT = ";";

const GLYPHS = [WALL, FLOOR, GOAL, BOX, BOX_ON_GOAL, KEEPER, KEEPER_ON_GOAL];

// One warehouse from its picture. Throws rather than guessing: a collection is
// generated once and read forever, so a malformed level must fail loudly at the
// point it is introduced.
export function parseLevel(lines) {
  if (!lines || lines.length === 0) {
    throw new Error("the level has no rows");
  }

  const rows = lines.length;
  const cols = lines[0].length;
  if (cols === 0) {
    throw new Error("the level has no columns");
  }

  const walls = new Array(cols * rows).fill(0);
  const goals = [];
  const boxes = [];
  let player = -1;

  for (let y = 0; y < rows; y++) {
    const line = lines[y];
    if (line.length !== cols) {
      throw new Error("row " + y + " is " + line.length + " wide, expected " + cols);
    }
    for (let x = 0; x < cols; x++) {
      const index = y * cols + x;
      const glyph = line.charAt(x);
      if (GLYPHS.indexOf(glyph) === -1) {
        throw new Error("unknown glyph '" + glyph + "' at " + x + "," + y);
      }
      if (glyph === WALL) {
        walls[index] = 1;
      }
      if (glyph === GOAL || glyph === BOX_ON_GOAL || glyph === KEEPER_ON_GOAL) {
        goals.push(index);
      }
      if (glyph === BOX || glyph === BOX_ON_GOAL) {
        boxes.push(index);
      }
      if (glyph === KEEPER || glyph === KEEPER_ON_GOAL) {
        if (player !== -1) {
          throw new Error("a second keeper at " + x + "," + y);
        }
        player = index;
      }
    }
  }

  if (player === -1) {
    throw new Error("the level has no keeper");
  }
  if (boxes.length !== goals.length) {
    throw new Error("the level has " + boxes.length + " boxes but " + goals.length + " goals");
  }

  return { cols, rows, walls, goals, boxes, player };
}

// The picture of a warehouse, ready to be written out or compared in a test.
export function formatLevel(level) {
  const lines = [];
  for (let y = 0; y < level.rows; y++) {
    let line = "";
    for (let x = 0; x < level.cols; x++) {
      const index = y * level.cols + x;
      const goal = level.goals.indexOf(index) !== -1;
      if (level.walls[index] === 1) {
        line += WALL;
      } else if (level.player === index) {
        line += goal ? KEEPER_ON_GOAL : KEEPER;
      } else if (level.boxes.indexOf(index) !== -1) {
        line += goal ? BOX_ON_GOAL : BOX;
      } else {
        line += goal ? GOAL : FLOOR;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Every level in a collection file. Blank lines separate levels, ';' comments
// are dropped, and trailing blank lines are harmless.
export function parseCollection(text) {
  const levels = [];
  let block = [];

  const lines = String(text).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (line.charAt(0) === COMMENT) {
      continue;
    }
    if (line.length === 0) {
      if (block.length > 0) {
        levels.push(parseLevel(block));
        block = [];
      }
      continue;
    }
    block.push(line);
  }
  if (block.length > 0) {
    levels.push(parseLevel(block));
  }

  return levels;
}

// A collection file. `comments` are written at the top, each prefixed, so the
// file says what it is and what generated it.
export function formatCollection(levels, comments) {
  const out = [];
  const notes = comments || [];
  for (let i = 0; i < notes.length; i++) {
    out.push(COMMENT + " " + notes[i]);
  }
  if (notes.length > 0) {
    out.push("");
  }
  for (let i = 0; i < levels.length; i++) {
    const lines = formatLevel(levels[i]);
    for (let r = 0; r < lines.length; r++) {
      out.push(lines[r]);
    }
    out.push("");
  }
  return out.join("\n");
}
