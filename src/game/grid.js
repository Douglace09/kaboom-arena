// Génération de l'arène : murs fixes + blocs destructibles placés au hasard
import { COLS, ROWS, CELL, SPAWNS, BLOCK_DENSITY } from './constants.js';

export const idx = (x, y) => y * COLS + x;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

// Générateur aléatoire à graine : même graine = même arène (utile pour le réseau)
export function createRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cases laissées libres autour de chaque coin de départ, pour pouvoir
// poser une première bombe et se mettre à l'abri
const SAFE_OFFSETS = [
  [0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [2, 1], [1, 2],
];

export function generateArena(seed) {
  const rng = createRng(seed);
  const cells = new Array(COLS * ROWS).fill(CELL.EMPTY);

  const safe = new Set();
  for (const s of SPAWNS) {
    const sx = s.x < COLS / 2 ? 1 : -1;
    const sy = s.y < ROWS / 2 ? 1 : -1;
    for (const [dx, dy] of SAFE_OFFSETS) safe.add(idx(s.x + dx * sx, s.y + dy * sy));
  }

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      if (border || pillar) cells[idx(x, y)] = CELL.WALL;
      else if (!safe.has(idx(x, y)) && rng() < BLOCK_DENSITY) cells[idx(x, y)] = CELL.BLOCK;
    }
  }
  return cells;
}
