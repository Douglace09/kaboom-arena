// Les cartes (partagé entre le navigateur et le serveur).
// Chaque carte existe en deux tailles : « small » (15 × 13, jusqu'à 4 joueurs)
// et « large » (21 × 17, de 5 à 8 joueurs).
// Légende des plans :
//   #  mur fixe               .  case libre (peut recevoir une caisse au hasard)
//   _  case toujours libre     > < ^ v  tapis roulant (sens de la flèche)
//   a b c  portail : les deux cases portant la même lettre sont reliées
//   ~  sable mouvant (ralentit)     o  trou noir (aspire les bombes)
//   A B  porte : les portes A et les portes B se ferment à tour de rôle

export const SIZES = {
  small: { cols: 15, rows: 13 },
  large: { cols: 21, rows: 17 },
};

// Départs : les 4 coins, puis le milieu des 4 bords (grande arène seulement)
export const SPAWNS = {
  small: [{ x: 1, y: 1 }, { x: 13, y: 11 }, { x: 13, y: 1 }, { x: 1, y: 11 }],
  large: [
    { x: 1, y: 1 }, { x: 19, y: 15 }, { x: 19, y: 1 }, { x: 1, y: 15 },
    { x: 10, y: 1 }, { x: 10, y: 15 }, { x: 1, y: 8 }, { x: 19, y: 8 },
  ],
};

export const sizeFor = (playerCount) => (playerCount > 4 ? 'large' : 'small');

// ---------- Outils pour dessiner les grands plans ----------

function blank(size) {
  const { cols, rows } = SIZES[size];
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => (x === 0 || y === 0 || x === cols - 1 || y === rows - 1 ? '#' : '.')),
  );
}
// Piliers sur les cases paires (le motif classique)
function pillars(g, keep = () => true) {
  for (let y = 2; y < g.length - 1; y += 2) for (let x = 2; x < g[0].length - 1; x += 2) if (keep(x, y)) g[y][x] = '#';
  return g;
}
const set = (g, x, y, ch) => {
  if (y > 0 && y < g.length - 1 && x > 0 && x < g[0].length - 1) g[y][x] = ch;
};
function area(g, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, ch);
  return g;
}
// Boucle de tapis roulants (sens horaire ou anti-horaire)
function beltRing(g, x0, y0, x1, y1, clockwise = true) {
  if (clockwise) {
    for (let x = x0; x < x1; x++) set(g, x, y0, '>');
    for (let y = y0; y < y1; y++) set(g, x1, y, 'v');
    for (let x = x1; x > x0; x--) set(g, x, y1, '<');
    for (let y = y1; y > y0; y--) set(g, x0, y, '^');
  } else {
    for (let y = y0; y < y1; y++) set(g, x0, y, 'v');
    for (let x = x0; x < x1; x++) set(g, x, y1, '>');
    for (let y = y1; y > y0; y--) set(g, x1, y, '^');
    for (let x = x1; x > x0; x--) set(g, x, y0, '<');
  }
  return g;
}
const text = (g) => g.map((row) => row.join(''));

// ---------- Les cartes ----------

export const MAPS = [
  {
    id: 'classique',
    name: 'Classique',
    desc: 'L’arène d’origine, sans piège',
    density: 0.7,
    layouts: {
      small: text(pillars(blank('small'))),
      large: text(pillars(blank('large'))),
    },
  },
  {
    id: 'neon',
    name: 'Néon City',
    desc: 'Des tapis roulants emportent joueurs et bombes',
    density: 0.62,
    layouts: {
      small: text(beltRing(pillars(blank('small')), 3, 3, 11, 9)),
      large: text(beltRing(beltRing(pillars(blank('large')), 3, 3, 17, 13), 7, 7, 13, 9, false)),
    },
  },
  {
    id: 'jungle',
    name: 'Jungle',
    desc: 'Des portails relient les deux côtés de l’arène',
    density: 0.62,
    layouts: {
      small: [
        '###############',
        '#......a......#',
        '#.#.##...##.#.#',
        '#.....#.#.....#',
        '#.##.......##.#',
        '#.#..#.#.#..#.#',
        '#b...#...#...b#',
        '#.#..#.#.#..#.#',
        '#.##.......##.#',
        '#.....#.#.....#',
        '#.#.##...##.#.#',
        '#......a......#',
        '###############',
      ],
      large: [
        '#####################',
        '#...................#',
        '#.##.###.....###.##.#',
        '#.#......#.#......#.#',
        '#...a##.......##b...#',
        '#.#....#.#.#.#....#.#',
        '#.##.#.........#.##.#',
        '#.....#.##.##.#.....#',
        '#...................#',
        '#.....#.##.##.#.....#',
        '#.##.#.........#.##.#',
        '#.#....#.#.#.#....#.#',
        '#...b##.......##a...#',
        '#.#......#.#......#.#',
        '#.##.###.....###.##.#',
        '#...................#',
        '#####################',
      ],
    },
  },
  {
    id: 'banquise',
    name: 'Banquise',
    desc: 'Sol glissant : on freine moins vite',
    density: 0.58,
    layouts: {
      small: [
        '###############',
        '#.............#',
        '#.#...#.#...#.#',
        '#.............#',
        '#...#.....#...#',
        '#.#.........#.#',
        '#.....###.....#',
        '#.#.........#.#',
        '#...#.....#...#',
        '#.............#',
        '#.#...#.#...#.#',
        '#.............#',
        '###############',
      ],
      large: [
        '#####################',
        '#...................#',
        '#.#...#.......#...#.#',
        '#...................#',
        '#...##....#....##...#',
        '#.#...............#.#',
        '#.....#.......#.....#',
        '#.......#####.......#',
        '#...................#',
        '#.......#####.......#',
        '#.....#.......#.....#',
        '#.#...............#.#',
        '#...##....#....##...#',
        '#...................#',
        '#.#...#.......#...#.#',
        '#...................#',
        '#####################',
      ],
    },
  },
  {
    id: 'volcan',
    name: 'Volcan',
    desc: 'Des cases de lave jaillissent par moments',
    density: 0.62,
    layouts: {
      small: text(area(pillars(blank('small')), 6, 5, 8, 7, '_')),
      large: text(area(pillars(blank('large')), 9, 7, 11, 9, '_')),
    },
  },
  {
    id: 'desert',
    name: 'Désert',
    desc: 'Les sables mouvants ralentissent',
    density: 0.6,
    layouts: {
      small: [
        '###############',
        '#.............#',
        '#.#.##...##.#.#',
        '#.....~~~.....#',
        '#.#.#.~~~.#.#.#',
        '#.....#.#.....#',
        '#.~~.......~~.#',
        '#.....#.#.....#',
        '#.#.#.~~~.#.#.#',
        '#.....~~~.....#',
        '#.#.##...##.#.#',
        '#.............#',
        '###############',
      ],
      large: (() => {
        const g = pillars(blank('large'));
        for (const [cx, cy] of [[5, 4], [15, 4], [5, 12], [15, 12], [10, 8]]) area(g, cx - 1, cy - 1, cx + 1, cy + 1, '~');
        return text(g);
      })(),
    },
  },
  {
    id: 'usine',
    name: 'Usine',
    desc: 'Des portes s’ouvrent et se ferment en rythme',
    density: 0.6,
    layouts: {
      small: (() => {
        const g = pillars(blank('small'));
        for (const y of [1, 5, 7, 11]) set(g, 7, y, 'A');
        for (const x of [1, 5, 9, 13]) set(g, x, 6, 'B');
        return text(g);
      })(),
      large: (() => {
        const g = pillars(blank('large'));
        for (const y of [3, 5, 11, 13]) set(g, 10, y, 'A');
        for (const x of [3, 7, 13, 17]) set(g, x, 8, 'B');
        return text(g);
      })(),
    },
  },
  {
    id: 'espace',
    name: 'Espace',
    desc: 'Des trous noirs aspirent les bombes',
    density: 0.58,
    layouts: {
      small: (() => {
        const g = pillars(blank('small'));
        for (const [x, y] of [[4, 4], [10, 4], [4, 8], [10, 8]]) set(g, x, y, 'o');
        set(g, 7, 6, 'o');
        return text(g);
      })(),
      large: (() => {
        const g = pillars(blank('large'));
        for (const [x, y] of [[4, 4], [16, 4], [4, 12], [16, 12], [10, 8]]) set(g, x, y, 'o');
        return text(g);
      })(),
    },
  },
  {
    id: 'plage',
    name: 'Plage',
    desc: 'Des vagues inondent une rangée et noient les bombes',
    density: 0.6,
    layouts: {
      small: [
        '###############',
        '#.............#',
        '#.#..#...#..#.#',
        '#.............#',
        '#.#.#..#..#.#.#',
        '#.............#',
        '#...#.#.#.#...#',
        '#.............#',
        '#.#.#..#..#.#.#',
        '#.............#',
        '#.#..#...#..#.#',
        '#.............#',
        '###############',
      ],
      large: text(pillars(blank('large'), (x, y) => (x / 2 + y / 2) % 2 === 0 || x === 2 || x === 18)),
    },
  },
  {
    id: 'ville',
    name: 'Ville de nuit',
    desc: 'Il fait noir : on ne voit qu’autour de soi',
    density: 0.5,
    layouts: {
      small: [
        '###############',
        '#.............#',
        '#.##.##.##.##.#',
        '#.##.##.##.##.#',
        '#.............#',
        '#.##.##.##.##.#',
        '#.............#',
        '#.##.##.##.##.#',
        '#.............#',
        '#.##.##.##.##.#',
        '#.##.##.##.##.#',
        '#.............#',
        '###############',
      ],
      large: (() => {
        const street = '#...................#';
        const block = '#.##.##.##.##.##.##.#';
        const border = '#####################';
        return [border, street, block, block, street, block, block, street, block, street, block, block, street, block, block, street, border];
      })(),
    },
  },
];

export const MAP_IDS = MAPS.map((m) => m.id);
export const isMap = (id) => MAP_IDS.includes(id);
export const randomMap = (avoid = null) => {
  const list = MAP_IDS.filter((id) => id !== avoid);
  return list[Math.floor(Math.random() * list.length)];
};

const ARROWS = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };
const parsed = new Map();

// Lit un plan une seule fois : murs, cases sans caisse, tapis, portails, sables, portes, trous noirs
export function getMap(id, size = 'small') {
  const key = id + ':' + size;
  if (parsed.has(key)) return parsed.get(key);
  const def = MAPS.find((m) => m.id === id) || MAPS[0];
  const layout = def.layouts[size] || def.layouts.small;
  const { cols, rows } = SIZES[size] || SIZES.small;
  if (layout.length !== rows) throw new Error(`Carte ${def.id} (${size}) : ${layout.length} lignes au lieu de ${rows}`);
  const walls = new Set();
  const noBlock = new Set();
  const belts = new Map(); // case -> { dx, dy }
  const portals = new Map(); // case -> case reliée
  const sand = new Set();
  const holes = new Set();
  const doors = []; // { i, group }
  const letters = {};
  layout.forEach((row, y) => {
    if (row.length !== cols) throw new Error(`Carte ${def.id} (${size}) : ligne ${y} de ${row.length} cases`);
    [...row].forEach((ch, x) => {
      const i = y * cols + x;
      if (ch === '#') walls.add(i);
      else if (ch === '.') return;
      else {
        noBlock.add(i);
        if (ARROWS[ch]) belts.set(i, { dx: ARROWS[ch][0], dy: ARROWS[ch][1] });
        else if (ch === '~') sand.add(i);
        else if (ch === 'o') holes.add(i);
        else if (ch === 'A' || ch === 'B') doors.push({ i, group: ch });
        else if (/[a-z]/.test(ch) && ch !== 'o' && ch !== 'v') (letters[ch] ||= []).push(i);
      }
    });
  });
  for (const [ch, cells] of Object.entries(letters)) {
    if (cells.length !== 2) throw new Error(`Carte ${def.id} : le portail ${ch} doit apparaître 2 fois`);
    portals.set(cells[0], cells[1]);
    portals.set(cells[1], cells[0]);
  }
  const map = { ...def, size, cols, rows, layout, walls, noBlock, belts, portals, sand, holes, doors };
  parsed.set(key, map);
  return map;
}
