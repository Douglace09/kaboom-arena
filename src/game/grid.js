// Génération de l'arène : murs du plan + caisses placées au hasard.
// La taille de l'arène varie (15 × 13 ou 21 × 17) : « dims » garde la taille de la partie
// en cours de calcul (chaque point d'entrée de la logique la règle avant de travailler).
import { CELL } from './constants.js';
import { getMap, SPAWNS } from './maps.js';

export const dims = { cols: 15, rows: 13 };
export function setDims(cols, rows) {
  dims.cols = cols;
  dims.rows = rows;
}

export const idx = (x, y) => y * dims.cols + x;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < dims.cols && y < dims.rows;

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

// Cases laissées libres autour de chaque départ : tout ce qu'on atteint en 3 pas,
// pour pouvoir poser une première bombe et se mettre à l'abri
function safeCells(map, size) {
  const safe = new Set();
  for (const s of SPAWNS[size]) {
    const start = s.y * map.cols + s.x;
    const dist = new Map([[start, 0]]);
    const queue = [start];
    while (queue.length) {
      const c = queue.shift();
      safe.add(c);
      if (dist.get(c) === 3) continue;
      const x = c % map.cols;
      const y = Math.floor(c / map.cols);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = (y + dy) * map.cols + x + dx;
        if (dist.has(n) || map.walls.has(n) || map.holes.has(n)) continue;
        dist.set(n, dist.get(c) + 1);
        queue.push(n);
      }
    }
  }
  return safe;
}

export function generateArena(seed, mapId = 'classique', size = 'small') {
  const map = getMap(mapId, size);
  const rng = createRng(seed);
  const cells = new Array(map.cols * map.rows).fill(CELL.EMPTY);
  const safe = safeCells(map, size);
  for (let i = 0; i < cells.length; i++) {
    const r = rng(); // tiré pour chaque case, pour que le hasard ne dépende que de la graine
    if (map.walls.has(i)) cells[i] = CELL.WALL;
    else if (!safe.has(i) && !map.noBlock.has(i) && r < map.density) cells[i] = CELL.BLOCK;
  }
  return cells;
}
