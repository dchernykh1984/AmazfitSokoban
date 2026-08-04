// Levels written as pictures, so a test says what it means.
//
// The characters are the ones every Sokoban level collection uses, with one
// change: floor is a dash rather than a space, because the repository's
// trailing-whitespace hook would quietly eat the right-hand edge of a picture.
//
//   #  wall      -  floor     .  goal
//   $  box       *  box on a goal
//   @  keeper    +  keeper on a goal

const WALL = "#";
const FLOOR = "-";
const GOAL = ".";
const BOX = "$";
const BOX_ON_GOAL = "*";
const KEEPER = "@";
const KEEPER_ON_GOAL = "+";

// The picture as a level. Set `keeperOptional` when the test only cares about the
// walls - the level generator works on a bare shape long before anyone stands in
// it.
export function parseLevel(picture, keeperOptional) {
  const lines = picture.map((line) => line.split(""));
  const rows = lines.length;
  const cols = lines[0].length;

  const walls = new Array(cols * rows).fill(0);
  const goals = [];
  const boxes = [];
  let player = -1;

  for (let y = 0; y < rows; y++) {
    if (lines[y].length !== cols) {
      throw new Error("row " + y + " is " + lines[y].length + " wide, expected " + cols);
    }
    for (let x = 0; x < cols; x++) {
      const index = y * cols + x;
      const glyph = lines[y][x];
      if (glyph === WALL) {
        walls[index] = 1;
      } else if (glyph === GOAL) {
        goals.push(index);
      } else if (glyph === BOX) {
        boxes.push(index);
      } else if (glyph === BOX_ON_GOAL) {
        goals.push(index);
        boxes.push(index);
      } else if (glyph === KEEPER || glyph === KEEPER_ON_GOAL) {
        if (player !== -1) {
          throw new Error("the picture has a second keeper at " + x + "," + y);
        }
        if (glyph === KEEPER_ON_GOAL) {
          goals.push(index);
        }
        player = index;
      } else if (glyph !== FLOOR) {
        throw new Error("unknown glyph '" + glyph + "' at " + x + "," + y);
      }
    }
  }

  if (player === -1 && !keeperOptional) {
    throw new Error("the picture has no keeper");
  }
  return { cols, rows, walls, goals, boxes, player };
}

// Just the walls, for the parts of the generator that build a room before anyone
// is put in it.
export function parseShape(picture) {
  const level = parseLevel(picture, true);
  return { cols: level.cols, rows: level.rows, walls: level.walls };
}

// The reverse, so a test can assert on a whole position instead of poking at
// indexes one at a time.
export function drawLevel(game) {
  const lines = [];
  for (let y = 0; y < game.rows; y++) {
    let line = "";
    for (let x = 0; x < game.cols; x++) {
      const index = y * game.cols + x;
      const goal = game.goals.indexOf(index) !== -1;
      if (game.walls[index] === 1) {
        line += WALL;
      } else if (game.player === index) {
        line += goal ? KEEPER_ON_GOAL : KEEPER;
      } else if (game.boxes.indexOf(index) !== -1) {
        line += goal ? BOX_ON_GOAL : BOX;
      } else {
        line += goal ? GOAL : FLOOR;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Re-exported so a test can seed a generator without reaching past the helpers.
export { seeded } from "../../lib/random.js";
