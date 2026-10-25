// Logique du jeu : déplacements, bombes, explosions, bonus, mort subite.
// Aucun code d'affichage ici : l'état est un simple objet. Le même fichier tourne
// dans le navigateur (modes hors ligne) et sur le serveur (parties en ligne).
import {
  COLS, ROWS, TICK, CELL, SPAWNS,
  BOMB_TIMER, FIRE_DURATION, BASE_RANGE, BASE_BOMBS, BASE_SPEED, END_DELAY,
  ITEM_CHANCE, ITEM_WEIGHTS, MAX_BOMBS, MAX_RANGE, MAX_SPEED, SPEED_STEP, SLOW_SPEED,
  KICK_SPEED, FREEZE_TIME, ICE_BOMBS, SHIELD_INVULN, DASH_TIME, DASH_FACTOR, DASH_COOLDOWN,
  SKULL_TIME, SKULL_EFFECTS, SUDDEN_DEATH_AT, SUDDEN_DEATH_STEP,
} from './constants.js';
import { generateArena, idx, inBounds } from './grid.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NO_INPUT = { dx: 0, dy: 0, bomb: false, special: false };

// Ordre de fermeture de l'arène pendant la mort subite : en spirale depuis les bords
const SPIRAL = (() => {
  const out = [];
  let x0 = 1, y0 = 1, x1 = COLS - 2, y1 = ROWS - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push(idx(x, y0));
    for (let y = y0 + 1; y <= y1; y++) out.push(idx(x1, y));
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(idx(x, y1));
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(idx(x0, y));
    x0++; y0++; x1--; y1--;
  }
  return out;
})();

// colors[i] = couleur du joueur i (index dans PLAYER_COLORS) ; par défaut, son numéro
export function createGame({ playerCount = 2, seed = Date.now(), colors = null } = {}) {
  return {
    cols: COLS,
    rows: ROWS,
    cells: generateArena(seed),
    rng: (seed ^ 0x9e3779b9) >>> 0, // hasard des bonus (même graine = même partie)
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: i,
      color: colors ? colors[i] : i,
      x: SPAWNS[i].x,
      y: SPAWNS[i].y,
      faceX: 0,
      faceY: 1,
      moving: false,
      alive: true,
      maxBombs: BASE_BOMBS,
      range: BASE_RANGE,
      speed: BASE_SPEED,
      shield: false,
      kick: false,
      special: null, // 'detonator' (détonateur) ou 'dash' : un seul à la fois
      iceBombs: 0, // bombes glacées restantes
      skull: null, // malus en cours : { type, timer }
      frozen: 0, // temps de gel restant
      invuln: 0, // invincibilité restante
      dashTimer: 0,
      dashCooldown: 0,
    })),
    bombs: [],
    fires: [],
    items: [], // bonus posés au sol : { x, y, type }
    events: [], // ce qui s'est passé (explosions, bonus…), lu puis vidé par l'affichage
    nextId: 1,
    time: 0,
    sudden: null, // mort subite : { index, timer } une fois commencée
    phase: 'playing', // 'playing' puis 'over'
    endTimer: null,
    winner: null, // id du gagnant, ou null en cas d'égalité
  };
}

// Fait avancer la partie d'un pas. inputs[i] = { dx, dy, bomb, special } pour le joueur i
export function update(state, inputs, dt = TICK) {
  if (state.phase === 'over') return;
  state.time += dt;

  for (const p of state.players) {
    if (!p.alive) continue;
    tickTimers(p, dt);
    p.moving = false;
    if (p.frozen > 0) continue;

    let { dx, dy, bomb, special } = { ...NO_INPUT, ...inputs[p.id] };
    if (p.skull?.type === 'inverse') { dx = -dx; dy = -dy; }
    if (p.skull?.type === 'autobomb') bomb = true;
    if (p.skull?.type === 'nobomb') bomb = false;

    if (special) useSpecial(state, p);
    if (p.dashTimer > 0 && !dx && !dy) { dx = p.faceX; dy = p.faceY; }
    movePlayer(state, p, dx, dy, dt);
    if (bomb) placeBomb(state, p);
    pickItem(state, p);
  }

  for (const b of state.bombs) {
    // On peut sortir de sa bombe, mais dès qu'on a quitté sa case elle bloque
    b.pass = b.pass.filter((id) => inCell(state.players[id], b.x, b.y));
    if (b.slide) slideBomb(state, b, dt);
    b.timer -= dt;
  }

  updateFires(state, dt);
  resolveExplosions(state);
  checkHits(state);
  suddenDeath(state, dt);
  checkEnd(state, dt);
}

// Prédiction côté joueur (parties en ligne) : on déplace son propre personnage tout de
// suite, sans attendre la réponse du serveur. Seul le déplacement est prédit ; le serveur
// reste la référence et corrige la position à chaque message.
export function predictMove(state, p, input, dt = TICK) {
  p.moving = false;
  if (!p.alive || p.frozen > 0) return;
  let { dx, dy } = input;
  if (p.skull?.type === 'inverse') { dx = -dx; dy = -dy; }
  if (p.dashTimer > 0 && !dx && !dy) { dx = p.faceX; dy = p.faceY; }
  if (!dx && !dy) return;
  p.faceX = dx;
  p.faceY = dy;
  const dist = speedOf(p) * dt;
  if (dx) moveAxis(state, p, 'x', 'y', dx, dist);
  else moveAxis(state, p, 'y', 'x', dy, dist);
}

// Élimine un joueur (par exemple quand il quitte la partie en ligne)
export function eliminate(state, id) {
  const p = state.players[id];
  if (p && p.alive) kill(state, p);
}

function tickTimers(p, dt) {
  p.frozen = Math.max(0, p.frozen - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.dashTimer = Math.max(0, p.dashTimer - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (p.skull) {
    p.skull.timer -= dt;
    if (p.skull.timer <= 0) p.skull = null;
  }
}

// ---------- Déplacement ----------

function speedOf(p) {
  const base = p.skull?.type === 'slow' ? SLOW_SPEED : p.speed;
  return p.dashTimer > 0 ? base * DASH_FACTOR : base;
}

function movePlayer(state, p, dx, dy, dt) {
  if (!dx && !dy) return;
  p.faceX = dx;
  p.faceY = dy;
  tryKick(state, p, dx, dy);
  const dist = speedOf(p) * dt;
  if (dx) moveAxis(state, p, 'x', 'y', dx, dist);
  else moveAxis(state, p, 'y', 'x', dy, dist);
}

// Déplacement sur un axe, avec « glissement » automatique dans les virages
function moveAxis(state, p, main, side, dir, dist) {
  const beforeMain = p[main];
  const beforeSide = p[side];
  const cMain = Math.round(p[main]);
  const cSide = Math.round(p[side]);
  const ax = main === 'x' ? cMain + dir : cSide;
  const ay = main === 'x' ? cSide : cMain + dir;
  const aheadFree = !isBlocked(state, p, ax, ay);

  // Pas aligné sur le couloir : on se recentre si le passage devant est libre
  const off = p[side] - cSide;
  if (Math.abs(off) > 1e-4) {
    if (!aheadFree) return;
    const shift = Math.min(dist, Math.abs(off));
    p[side] -= Math.sign(off) * shift;
    dist -= shift;
  }
  if (dist > 0) {
    p[side] = cSide;
    let next = p[main] + dir * dist;
    if (!aheadFree) {
      // obstacle devant : on peut aller jusqu'au centre de la case, pas plus loin
      next = dir > 0 ? Math.min(next, Math.max(cMain, p[main])) : Math.max(next, Math.min(cMain, p[main]));
    }
    p[main] = next;
  }
  p.moving = p[main] !== beforeMain || p[side] !== beforeSide;
}

function isBlocked(state, p, x, y) {
  if (!inBounds(x, y)) return true;
  if (state.cells[idx(x, y)] !== CELL.EMPTY) return true;
  const b = bombAt(state, x, y);
  return !!b && !b.pass.includes(p.id);
}

// Le joueur est-il sur cette case (au sens de la case la plus proche) ?
const inCell = (p, x, y) => p.alive && Math.round(p.x) === x && Math.round(p.y) === y;
const touches = (p, x, y) => p.alive && Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1;
const bombAt = (state, x, y) => state.bombs.find((b) => b.x === x && b.y === y);

// ---------- Bombes ----------

function placeBomb(state, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  if (bombAt(state, x, y)) return;
  const active = state.bombs.filter((b) => b.owner === p.id).length;
  if (active >= p.maxBombs) return;
  const ice = p.iceBombs > 0;
  if (ice) p.iceBombs--;
  const pass = state.players.filter((o) => inCell(o, x, y)).map((o) => o.id);
  state.bombs.push({
    id: state.nextId++, x, y, owner: p.id, timer: BOMB_TIMER, range: p.range,
    pass, ice, slide: null,
  });
}

// Action spéciale : faire exploser ses bombes tout de suite (détonateur), ou sprinter.
// Avec le détonateur, les bombes explosent quand même seules au bout de BOMB_TIMER.
function useSpecial(state, p) {
  if (p.special === 'detonator') {
    let any = false;
    for (const b of state.bombs) {
      if (b.owner === p.id) {
        b.timer = 0;
        any = true;
      }
    }
    if (any) state.events.push({ type: 'detonate', id: p.id });
  } else if (p.special === 'dash' && p.dashCooldown <= 0) {
    p.dashTimer = DASH_TIME;
    p.dashCooldown = DASH_COOLDOWN;
    state.events.push({ type: 'dash', id: p.id });
  }
}

// ---------- Coup de pied ----------

function canSlideInto(state, b, x, y) {
  if (!inBounds(x, y) || state.cells[idx(x, y)] !== CELL.EMPTY) return false;
  if (state.bombs.some((o) => o !== b && o.x === x && o.y === y)) return false;
  return !state.players.some((p) => touches(p, x, y));
}

function tryKick(state, p, dx, dy) {
  if (!p.kick) return;
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  // il faut être dans l'axe et collé à la bombe
  if (Math.abs(p.x - cx) > 0.15 || Math.abs(p.y - cy) > 0.15) return;
  const b = bombAt(state, cx + dx, cy + dy);
  if (!b || b.slide || b.pass.includes(p.id)) return;
  if (!canSlideInto(state, b, b.x + dx, b.y + dy)) return;
  b.slide = { dx, dy, progress: 0 };
  state.events.push({ type: 'kick', x: b.x, y: b.y });
}

function slideBomb(state, b, dt) {
  const s = b.slide;
  s.progress += KICK_SPEED * dt;
  while (b.slide && s.progress >= 1) {
    const nx = b.x + s.dx;
    const ny = b.y + s.dy;
    // quelque chose est apparu sur la route entre-temps : la bombe s'arrête
    if (state.cells[idx(nx, ny)] !== CELL.EMPTY || state.bombs.some((o) => o !== b && o.x === nx && o.y === ny)) {
      b.slide = null;
      break;
    }
    b.x = nx;
    b.y = ny;
    s.progress -= 1;
    b.pass = state.players.filter((o) => inCell(o, b.x, b.y)).map((o) => o.id);
    if (!canSlideInto(state, b, b.x + s.dx, b.y + s.dy)) b.slide = null;
  }
}

// ---------- Explosions ----------

function fireMap(state) {
  return new Map(state.fires.map((f) => [idx(f.x, f.y), f]));
}

// Explose les bombes arrivées à zéro, et celles touchées par une flamme (réaction en chaîne)
function resolveExplosions(state) {
  for (;;) {
    const fire = fireMap(state);
    for (const b of state.bombs) if (fire.has(idx(b.x, b.y))) b.timer = 0;
    const bomb = state.bombs.find((b) => b.timer <= 0);
    if (!bomb) break;
    state.bombs.splice(state.bombs.indexOf(bomb), 1);
    explode(state, bomb);
  }
}

function explode(state, b) {
  addFire(state, b.x, b.y, b.ice);
  for (const [dx, dy] of DIRS) {
    for (let r = 1; r <= b.range; r++) {
      const x = b.x + dx * r;
      const y = b.y + dy * r;
      if (!inBounds(x, y)) break;
      const i = idx(x, y);
      const c = state.cells[i];
      if (c === CELL.WALL || c === CELL.BURNING) break;
      if (c === CELL.BLOCK) {
        state.cells[i] = CELL.BURNING; // le bloc brûle puis disparaît
        addFire(state, x, y, b.ice);
        break;
      }
      addFire(state, x, y, b.ice);
      const item = state.items.findIndex((it) => it.x === x && it.y === y);
      if (item >= 0) {
        state.items.splice(item, 1); // un bonus au sol est détruit et arrête la flamme
        break;
      }
      if (bombAt(state, x, y)) break; // cette bombe explosera à son tour
    }
  }
  state.events.push({ type: 'explosion', x: b.x, y: b.y, ice: b.ice });
}

function addFire(state, x, y, ice) {
  const f = state.fires.find((f) => f.x === x && f.y === y);
  if (f) {
    f.timer = FIRE_DURATION;
    f.ice = f.ice && ice; // une flamme normale l'emporte sur la glace
  } else {
    state.fires.push({ x, y, timer: FIRE_DURATION, ice });
  }
}

function updateFires(state, dt) {
  for (const f of state.fires) {
    f.timer -= dt;
    if (f.timer <= 0) {
      const i = idx(f.x, f.y);
      if (state.cells[i] === CELL.BURNING) {
        state.cells[i] = CELL.EMPTY;
        if (rand(state) < ITEM_CHANCE) state.items.push({ x: f.x, y: f.y, type: randomItem(state) });
      }
    }
  }
  state.fires = state.fires.filter((f) => f.timer > 0);
}

// ---------- Bonus ----------

// Hasard reproductible stocké dans l'état (pour que l'hôte et les autres restent d'accord)
function rand(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randomItem(state) {
  const total = ITEM_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rand(state) * total;
  for (const [type, w] of ITEM_WEIGHTS) {
    r -= w;
    if (r < 0) return type;
  }
  return ITEM_WEIGHTS[0][0];
}

function pickItem(state, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const i = state.items.findIndex((it) => it.x === x && it.y === y);
  if (i < 0) return;
  const { type } = state.items[i];
  state.items.splice(i, 1);
  applyItem(state, p, type);
  state.events.push({ type: 'pickup', id: p.id, item: type, effect: type === 'skull' ? p.skull.type : null });
}

function applyItem(state, p, type) {
  switch (type) {
    case 'bomb': p.maxBombs = Math.min(MAX_BOMBS, p.maxBombs + 1); break;
    case 'flame': p.range = Math.min(MAX_RANGE, p.range + 1); break;
    case 'speed': p.speed = Math.min(MAX_SPEED, p.speed + SPEED_STEP); break;
    case 'shield': p.shield = true; break;
    case 'kick': p.kick = true; break;
    case 'detonator': p.special = 'detonator'; break;
    case 'dash': p.special = 'dash'; break;
    case 'ice': p.iceBombs = ICE_BOMBS; break;
    case 'skull':
      p.skull = { type: SKULL_EFFECTS[Math.floor(rand(state) * SKULL_EFFECTS.length)], timer: SKULL_TIME };
      break;
  }
}

// ---------- Éliminations, mort subite et fin de manche ----------

function kill(state, p) {
  p.alive = false;
  state.events.push({ type: 'death', id: p.id });
}

function checkHits(state) {
  const fire = fireMap(state);
  for (const p of state.players) {
    if (!p.alive) continue;
    const f = fire.get(idx(Math.round(p.x), Math.round(p.y)));
    if (!f || p.invuln > 0) continue;
    if (f.ice) {
      if (p.frozen <= 0) {
        p.frozen = FREEZE_TIME;
        state.events.push({ type: 'freeze', id: p.id });
      }
    } else if (p.shield) {
      p.shield = false;
      p.invuln = SHIELD_INVULN;
      state.events.push({ type: 'shield', id: p.id });
    } else {
      kill(state, p);
    }
  }
}

function suddenDeath(state, dt) {
  if (state.time < SUDDEN_DEATH_AT) return;
  if (!state.sudden) {
    state.sudden = { index: 0, timer: 0 };
    state.events.push({ type: 'sudden' });
  }
  const s = state.sudden;
  s.timer -= dt;
  while (s.timer <= 0 && s.index < SPIRAL.length) {
    const c = SPIRAL[s.index++];
    if (state.cells[c] === CELL.WALL) continue;
    s.timer += SUDDEN_DEATH_STEP;
    const x = c % COLS;
    const y = Math.floor(c / COLS);
    state.cells[c] = CELL.WALL;
    state.bombs = state.bombs.filter((b) => b.x !== x || b.y !== y);
    state.items = state.items.filter((it) => it.x !== x || it.y !== y);
    state.fires = state.fires.filter((f) => f.x !== x || f.y !== y);
    for (const p of state.players) if (inCell(p, x, y)) kill(state, p); // le bouclier ne protège pas
    state.events.push({ type: 'wall', x, y });
  }
}

function checkEnd(state, dt) {
  const alive = state.players.filter((p) => p.alive);
  if (state.endTimer === null && alive.length <= 1) state.endTimer = END_DELAY;
  if (state.endTimer === null) return;
  state.endTimer -= dt;
  if (state.endTimer <= 0) {
    state.phase = 'over';
    state.winner = alive.length === 1 ? alive[0].id : null;
  }
}
