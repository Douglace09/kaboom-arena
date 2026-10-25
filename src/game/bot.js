// IA simple : fuit les explosions, ramasse les bonus, casse des blocs et traque l'adversaire.
// Elle lit l'état du jeu et renvoie des commandes comme un vrai joueur
// ({ dx, dy, bomb, special }) : la logique ne fait aucune différence entre les deux.
import { CELL, BOMB_TIMER, SLOW_SPEED } from './constants.js';
import { idx, inBounds } from './grid.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const IDLE = { dx: 0, dy: 0, bomb: false, special: false };
const ENEMY_DETONATE_TIME = 1.2; // un adversaire avec détonateur peut faire sauter ses bombes à tout moment

// Cases touchées par une bombe posée en (bx, by)
function blastCells(state, bx, by, range) {
  const cells = [idx(bx, by)];
  for (const [dx, dy] of DIRS) {
    for (let r = 1; r <= range; r++) {
      const x = bx + dx * r;
      const y = by + dy * r;
      if (!inBounds(x, y)) break;
      const c = state.cells[idx(x, y)];
      if (c === CELL.WALL || c === CELL.BURNING) break;
      cells.push(idx(x, y));
      if (c === CELL.BLOCK) break;
      if (state.items.some((it) => it.x === x && it.y === y)) break;
      if (state.bombs.some((b) => b.x === x && b.y === y)) break;
    }
  }
  return cells;
}

// Pour chaque case : dans combien de secondes une flamme l'atteindra (Infinity = sûre).
// ownNow = on imagine que l'IA fait sauter ses bombes maintenant (détonateur).
function dangerMap(state, me, { extraBomb = null, ownNow = false } = {}) {
  const danger = new Array(state.cells.length).fill(Infinity);
  for (const f of state.fires) danger[idx(f.x, f.y)] = 0;

  const bombs = extraBomb ? [...state.bombs, extraBomb] : state.bombs;
  const times = bombs.map((b) => {
    const t = Math.max(0, b.timer);
    if (b.owner === me.id) return ownNow ? 0 : t;
    const owner = state.players[b.owner];
    return owner && owner.special === 'detonator' ? Math.min(t, ENEMY_DETONATE_TIME) : t;
  });
  const blasts = bombs.map((b) => blastCells(state, b.x, b.y, b.range));

  // Réactions en chaîne : une bombe touchée explose en même temps que celle qui la touche
  let changed = true;
  while (changed) {
    changed = false;
    bombs.forEach((b, j) => {
      const at = idx(b.x, b.y);
      blasts.forEach((cells, i) => {
        if (times[i] < times[j] && cells.includes(at)) {
          times[j] = times[i];
          changed = true;
        }
      });
    });
  }
  blasts.forEach((cells, i) => {
    for (const c of cells) danger[c] = Math.min(danger[c], times[i]);
  });
  return danger;
}

function walkable(state, me, c) {
  if (state.cells[c] !== CELL.EMPTY) return false;
  const x = c % state.cols;
  const y = Math.floor(c / state.cols);
  if (state.items.some((it) => it.type === 'skull' && it.x === x && it.y === y)) return false; // on évite les malus
  const b = state.bombs.find((b) => b.x === x && b.y === y);
  return !b || b.pass.includes(me.id);
}

// Parcours en largeur depuis la case du joueur.
// strict = ne passe que par des cases sûres ; sinon accepte une case menacée
// si on a le temps de la traverser avant qu'elle explose.
function explore(state, me, start, danger, strict) {
  const step = 1 / (me.skull?.type === 'slow' ? SLOW_SPEED : me.speed);
  const dist = new Map([[start, 0]]);
  const parent = new Map();
  const order = [start];
  for (let k = 0; k < order.length; k++) {
    const c = order[k];
    const x = c % state.cols;
    const y = Math.floor(c / state.cols);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const n = idx(nx, ny);
      if (dist.has(n) || !walkable(state, me, n)) continue;
      const d = dist.get(c) + 1;
      if (strict ? danger[n] !== Infinity : (d + 1) * step + 0.15 >= danger[n]) continue;
      dist.set(n, d);
      parent.set(n, c);
      order.push(n);
    }
  }
  return { dist, parent, order };
}

export function createBot(id) {
  let bombCooldown = 0.8;
  let target = null;
  let lastTime = 0;

  function moveToward(state, me, start, goal, parent) {
    const cx = Math.round(me.x);
    const cy = Math.round(me.y);
    if (goal === start) {
      // déjà sur la bonne case : on se recentre
      if (Math.abs(me.x - cx) > 0.08) return { ...IDLE, dx: Math.sign(cx - me.x) };
      if (Math.abs(me.y - cy) > 0.08) return { ...IDLE, dy: Math.sign(cy - me.y) };
      return IDLE;
    }
    let next = goal;
    while (parent.get(next) !== start) next = parent.get(next);
    const nx = next % state.cols;
    const ny = Math.floor(next / state.cols);
    if (nx !== cx) return { ...IDLE, dx: Math.sign(nx - cx) };
    return { ...IDLE, dy: Math.sign(ny - cy) };
  }

  // Intérêt d'une bombe posée sur la case c (blocs et adversaires touchés)
  function bombValue(state, me, c) {
    const cells = blastCells(state, c % state.cols, Math.floor(c / state.cols), me.range);
    let blocks = 0;
    let enemies = 0;
    for (const t of cells) if (state.cells[t] === CELL.BLOCK) blocks++;
    for (const o of state.players) {
      if (o.id !== me.id && o.alive && cells.includes(idx(Math.round(o.x), Math.round(o.y)))) enemies++;
    }
    return { blocks, enemies };
  }

  // Intérêt d'aller sur la case c : un bonus à ramasser, ou une bombe utile à poser
  function cellScore(state, me, c, d = 0) {
    const x = c % state.cols;
    const y = Math.floor(c / state.cols);
    let near = Infinity;
    for (const o of state.players) {
      if (o.id !== me.id && o.alive) near = Math.min(near, Math.abs(o.x - x) + Math.abs(o.y - y));
    }
    const towardEnemy = near === Infinity ? 0 : near * 0.3; // creuser vers l'adversaire
    let best = null;
    if (state.items.some((it) => it.x === x && it.y === y && it.type !== 'skull')) best = d - 4;
    const v = bombValue(state, me, c);
    if (v.blocks || v.enemies) {
      const s = d - v.enemies * 5 - v.blocks * 0.5 + towardEnemy;
      best = best === null ? s : Math.min(best, s);
    }
    return best;
  }

  function canEscapeAfterBomb(state, me, start) {
    const fake = {
      x: start % state.cols, y: Math.floor(start / state.cols), owner: me.id,
      timer: BOMB_TIMER, range: me.range, pass: [me.id],
    };
    const danger = dangerMap(state, me, { extraBomb: fake });
    const { order } = explore(state, me, start, danger, false);
    return order.some((c) => danger[c] === Infinity);
  }

  return {
    think(state) {
      const me = state.players[id];
      const dt = state.time - lastTime;
      lastTime = state.time;
      bombCooldown -= dt;
      if (!me || !me.alive || me.frozen > 0) return IDLE;

      const start = idx(Math.round(me.x), Math.round(me.y));
      const danger = dangerMap(state, me);

      // 1. En danger : rejoindre la case sûre la plus proche (avec un dash si possible)
      if (danger[start] !== Infinity) {
        target = null;
        const { order, parent } = explore(state, me, start, danger, false);
        const safe = order.find((c) => danger[c] === Infinity);
        const goal = safe !== undefined ? safe : order.reduce((a, c) => (danger[c] > danger[a] ? c : a), start);
        const move = moveToward(state, me, start, goal, parent);
        const dash = me.special === 'dash' && me.dashCooldown <= 0 && danger[start] < 1 && (move.dx || move.dy);
        return { ...move, special: dash };
      }

      // 2. Détonateur : on fait sauter ses bombes dès qu'on est à l'abri
      if (me.special === 'detonator' && state.bombs.some((b) => b.owner === me.id)) {
        const boom = dangerMap(state, me, { ownNow: true });
        if (boom[start] === Infinity) return { ...IDLE, special: true };
      }

      const { order, parent, dist } = explore(state, me, start, danger, true);

      // 3. Poser une bombe si elle sert à quelque chose et qu'on peut s'enfuir
      const centered = Math.abs(me.x - Math.round(me.x)) < 0.15 && Math.abs(me.y - Math.round(me.y)) < 0.15;
      const myBombs = state.bombs.filter((b) => b.owner === me.id).length;
      if (bombCooldown <= 0 && centered && myBombs < me.maxBombs && me.skull?.type !== 'nobomb') {
        const v = bombValue(state, me, start);
        if ((v.blocks || v.enemies) && canEscapeAfterBomb(state, me, start)) {
          bombCooldown = 0.5 + Math.random() * 0.6; // petit temps de réaction, pour rester battable
          target = null;
          return { ...IDLE, bomb: true };
        }
      }

      // 4. Choisir où aller : bonus, ou case d'où poser une bombe utile (adversaire en priorité)
      if (target === null || !dist.has(target) || target === start || cellScore(state, me, target) === null) {
        const candidates = [];
        for (const c of order) {
          if (c === start) continue;
          const s = cellScore(state, me, c, dist.get(c));
          if (s !== null) candidates.push({ c, s: s + Math.random() * 2 });
        }
        candidates.sort((a, b) => a.s - b.s);
        target = candidates.length ? candidates[0].c : null;
      }
      if (target !== null) return moveToward(state, me, start, target, parent);
      return moveToward(state, me, start, start, parent); // rester centré
    },
  };
}
