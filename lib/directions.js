// The four grid directions, shared by the rule set, the level generator and the
// touch handling. Kept in their own module because all three need them and none
// of them should have to depend on the others.

// Directions are indexes into VECTORS. The order is clockwise, so the opposite of
// a direction is `(direction + 2) % 4`.
export const UP = 0;
export const RIGHT = 1;
export const DOWN = 2;
export const LEFT = 3;

export const VECTORS = [
  { dx: 0, dy: -1 }, // UP
  { dx: 1, dy: 0 }, // RIGHT
  { dx: 0, dy: 1 }, // DOWN
  { dx: -1, dy: 0 }, // LEFT
];

export const DIRECTIONS = [UP, RIGHT, DOWN, LEFT];

export function isDirection(direction) {
  return Number.isInteger(direction) && direction >= 0 && direction < VECTORS.length;
}

export function opposite(direction) {
  return (direction + 2) % 4;
}
