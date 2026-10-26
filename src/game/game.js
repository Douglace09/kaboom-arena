// Logique du jeu : déplacements, bombes, explosions, bonus, mort subite.
// Aucun code d'affichage ici : l'état est un simple objet. Le même fichier tourne
// dans le navigateur (modes hors ligne) et sur le serveur (parties en ligne).
import {
  TICK, CELL,
  BOMB_TIMER, FIRE_DURATION, BASE_RANGE, BASE_BOMBS, BASE_SPEED, END_DELAY,
  ITEM_CHANCE, ITEM_WEIGHTS, MAX_BOMBS, MAX_RANGE, MAX_SPEED, SPEED_STEP, SLOW_SPEED,
  KICK_SPEED, FREEZE_TIME, ICE_BOMBS, SHIELD_INVULN, DASH_TIME, DASH_FACTOR, DASH_COOLDOWN,
  SKULL_TIME, SKULL_EFFECTS, SUDDEN_DEATH_AT, SUDDEN_DEATH_STEP, SLOWMO,
  BELT_SPEED, ICE_ACCEL, ICE_FRICTION, ICE_BRAKE, ICE_START,
  LAVA_FIRST, LAVA_EVERY, LAVA_WARN, LAVA_BURN, LAVA_COUNT,
  SAND_SLOW, WATER_SLOW, WAVE_FIRST, WAVE_EVERY, WAVE_WARN, WAVE_FLOOD, DOOR_PERIOD, HOLE_PULL, HOLE_SPEED,
} from './constants.js';
import { getMap, SPAWNS, SIZES, sizeFor } from './maps.js';
import { generateArena, idx, inBounds, createRng, setDims, dims } from './grid.js';
import { SKIN_IDS } from './skins.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NO_INPUT = { dx: 0, dy: 0, bomb: false, special: false };

// Ordre de fermeture de l'arène pendant la mort subite : en spirale depuis les bords
const spirals = {};
function spiral(cols, rows) {
  const key = cols + 'x' + rows;
  if (spirals[key]) return spirals[key];
  const out = [];
  const at = (x, y) => y * cols + x;
  let x0 = 1, y0 = 1, x1 = cols - 2, y1 = rows - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push(at(x, y0));
    for (let y = y0 + 1; y <= y1; y++) out.push(at(x1, y));
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(at(x, y1));
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(at(x0, y));
    x0++; y0++; x1--; y1--;
  }
  return (spirals[key] = out);
}

const mapOf = (state) => getMap(state.map, state.size);
// Règle la taille d'arène utilisée par idx() / inBounds() pour cette partie
export const useArena = (state) => setDims(state.cols, state.rows);

// colors[i] = couleur du joueur i (index dans PLAYER_COLORS) ; par défaut, son numéro
// skins[i] = personnage du joueur i ; shuffleSpawns = départs tirés au hasard ; map = carte
// size = 'small' (15 × 13) ou 'large' (21 × 17) ; par défaut selon le nombre de joueurs
export function createGame({ playerCount = 2, seed = Date.now(), colors = null, skins = null, shuffleSpawns = true, map = 'classique', size = null } = {}) {
  size = size || sizeFor(playerCount);
  const { cols, rows } = SIZES[size];
  setDims(cols, rows);
  const def = getMap(map, size);
  // Départs : d'abord les coins, puis le milieu des bords ; tirés au hasard à chaque manche
  const rng = createRng(seed ^ 0x5bd1e995);
  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const all = SPAWNS[size].map((s, i) => i);
  let slots = all.slice(0, playerCount);
  if (shuffleSpawns) {
    const corners = shuffle(all.slice(0, 4));
    const mids = shuffle(all.slice(4));
    slots = shuffle([...corners, ...mids].slice(0, playerCount));
  }
  return {
    cols,
    rows,
    size,
    map: def.id,
    cells: generateArena(seed, def.id, size),
    doors: def.doors.map((d) => ({ i: d.i, group: d.group, closed: d.group === 'A' })), // usine
    doorGroup: 'A', // groupe de portes fermé en ce moment
    doorTimer: DOOR_PERIOD,
    waves: [], // plage : rangées inondées { row, timer, flooding }
    waveTimer: WAVE_FIRST,
    rng: (seed ^ 0x9e3779b9) >>> 0, // hasard des bonus (même graine = même partie)
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: i,
      color: colors ? colors[i] : i,
      skin: skins?.[i] ?? SKIN_IDS[i % SKIN_IDS.length],
      x: SPAWNS[size][slots[i]].x,
      y: SPAWNS[size][slots[i]].y,
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
      v: 0, // banquise : vitesse de glisse et sa direction
      vx: 0,
      vy: 0,
      portalLock: -1, // case du portail d'arrivée (évite de repartir aussitôt)
    })),
    bombs: [],
    fires: [],
    items: [], // bonus posés au sol : { x, y, type }
    events: [], // ce qui s'est passé (explosions, bonus…), lu puis vidé par l'affichage
    nextId: 1,
    time: 0,
    lava: [], // volcan : cases de lave { x, y, timer, burning }
    lavaTimer: LAVA_FIRST,
    sudden: null, // mort subite : { index, timer } une fois commencée
    phase: 'playing', // 'playing' puis 'over'
    endTimer: null,
    winner: null, // id du gagnant, ou null en cas d'égalité
  };
}

// Fait avancer la partie d'un pas. inputs[i] = { dx, dy, bomb, special } pour le joueur i
export function update(state, inputs, dt = TICK) {
  if (state.phase === 'over') return;
  useArena(state);
  const realDt = dt;
  if (state.endTimer !== null) dt *= SLOWMO; // ralenti après la dernière élimination
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
    movePlayer(state, p, dx, dy, dt, false);
    if (bomb) placeBomb(state, p);
  }

  updateDoors(state, dt);

  // Mécaniques de la carte : tapis roulants et portails (même pour un joueur gelé)
  for (const p of state.players) {
    if (!p.alive) continue;
    applyBelt(state, p, dt);
    applyPortal(state, p);
    pickItem(state, p);
  }

  for (const b of state.bombs) {
    // On peut sortir de sa bombe, mais dès qu'on a quitté sa case elle bloque
    b.pass = b.pass.filter((id) => inCell(state.players[id], b.x, b.y));
    if (!b.slide) startBeltSlide(state, b);
    if (!b.slide) startHolePull(state, b);
    if (b.slide) slideBomb(state, b, dt);
    b.timer -= dt;
  }
  state.bombs = state.bombs.filter((b) => !b.gone); // avalées par un trou noir ou noyées

  updateWaves(state, dt);
  updateLava(state, dt);
  updateFires(state, dt);
  resolveExplosions(state);
  checkHits(state);
  suddenDeath(state, dt);
  checkEnd(state, realDt);
}

// Prédiction côté joueur (parties en ligne) : on déplace son propre personnage tout de
// suite, sans attendre la réponse du serveur. Seul le déplacement est prédit ; le serveur
// reste la référence et corrige la position à chaque message.
export function predictMove(state, p, input, dt = TICK) {
  useArena(state);
  if (state.endTimer != null) dt *= SLOWMO;
  p.moving = false;
  if (!p.alive) return;
  if (!(p.frozen > 0)) {
    let { dx, dy } = input;
    if (p.skull?.type === 'inverse') { dx = -dx; dy = -dy; }
    movePlayer(state, p, dx, dy, dt, true);
  }
  applyBelt(state, p, dt);
  applyPortal(state, p);
}

// Élimine un joueur (par exemple quand il quitte la partie en ligne)
export function eliminate(state, id) {
  useArena(state);
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

function speedOf(state, p) {
  let base = p.skull?.type === 'slow' ? SLOW_SPEED : p.speed;
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  if (mapOf(state).sand.has(idx(cx, cy))) base *= SAND_SLOW; // désert : sables mouvants
  if (state.waves?.some((w) => w.flooding && w.row === cy)) base *= WATER_SLOW; // plage : rangée inondée
  return p.dashTimer > 0 ? base * DASH_FACTOR : base;
}

// predict = prédiction côté joueur : on ne pousse pas les bombes (le serveur s'en charge)
function movePlayer(state, p, dx, dy, dt, predict) {
  if (p.dashTimer > 0 && !dx && !dy) { dx = p.faceX; dy = p.faceY; }
  if (state.map === 'banquise') return moveOnIce(state, p, dx, dy, dt, predict);
  if (!dx && !dy) return;
  p.faceX = dx;
  p.faceY = dy;
  if (!predict) tryKick(state, p, dx, dy);
  step(state, p, dx, dy, speedOf(state, p) * dt);
}

function step(state, p, dx, dy, dist) {
  if (dx) moveAxis(state, p, 'x', 'y', dx, dist);
  else moveAxis(state, p, 'y', 'x', dy, dist);
}

// Banquise : on prend de l'élan, on glisse quand on lâche, on freine en appuyant dans l'autre sens
function moveOnIce(state, p, dx, dy, dt, predict) {
  const max = speedOf(state, p);
  if (dx || dy) {
    p.faceX = dx;
    p.faceY = dy;
    if (!predict) tryKick(state, p, dx, dy);
    if (p.v > 0 && dx === p.vx && dy === p.vy) {
      p.v = Math.min(max, p.v + ICE_ACCEL * dt);
    } else if (p.v > 0 && dx === -p.vx && dy === -p.vy) {
      p.v = Math.max(0, p.v - ICE_BRAKE * dt);
    } else {
      // Nouveau départ ou virage : seulement si le passage est libre, sinon on continue de glisser
      const cx = Math.round(p.x);
      const cy = Math.round(p.y);
      if (!isBlocked(state, p, cx + dx, cy + dy) || p.v === 0) {
        p.v = p.v > 0 ? Math.max(ICE_START, p.v * 0.7) : ICE_START;
        p.vx = dx;
        p.vy = dy;
      }
    }
  } else {
    p.v = Math.max(0, p.v - ICE_FRICTION * dt);
  }
  if (p.dashTimer > 0) p.v = max;
  if (p.v <= 0 || (!p.vx && !p.vy)) return;
  const bx = p.x;
  const by = p.y;
  step(state, p, p.vx, p.vy, p.v * dt);
  if (p.x === bx && p.y === by) p.v = 0; // contre un obstacle : on s'arrête
  p.moving = p.v > 0.3;
}

// Néon City : un tapis roulant emporte le joueur
function applyBelt(state, p, dt) {
  const map = mapOf(state);
  if (!map.belts.size) return;
  const belt = map.belts.get(idx(Math.round(p.x), Math.round(p.y)));
  if (!belt) return;
  const moving = p.moving;
  step(state, p, belt.dx, belt.dy, BELT_SPEED * dt);
  p.moving = moving;
}

// Jungle : en arrivant au centre d'un portail, on ressort par le portail relié
function applyPortal(state, p) {
  const map = mapOf(state);
  if (!map.portals.size) return;
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  const here = idx(cx, cy);
  if (p.portalLock !== -1 && here !== p.portalLock) p.portalLock = -1;
  const dest = map.portals.get(here);
  if (dest === undefined || p.portalLock !== -1) return;
  if (Math.abs(p.x - cx) > 0.25 || Math.abs(p.y - cy) > 0.25) return;
  p.x = dest % dims.cols;
  p.y = Math.floor(dest / dims.cols);
  p.portalLock = dest;
  state.events.push({ type: 'portal', id: p.id, from: here, to: dest });
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
  const i = idx(x, y);
  if (state.cells[i] !== CELL.EMPTY) return true;
  if (mapOf(state).holes.has(i)) return true; // on ne marche pas dans un trou noir
  if (doorClosed(state, i)) return true;
  const b = bombAt(state, x, y);
  return !!b && !b.pass.includes(p.id);
}

// Usine : cette case est-elle une porte fermée ?
const doorClosed = (state, i) => !!state.doors?.some((d) => d.i === i && d.closed);

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
  state.events.push({ type: 'bomb', id: p.id, x, y });
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
  if (doorClosed(state, idx(x, y))) return false;
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

// Néon City : une bombe posée sur un tapis roulant avance avec lui
function startBeltSlide(state, b) {
  const map = mapOf(state);
  if (!map.belts.size) return;
  const belt = map.belts.get(idx(b.x, b.y));
  if (belt && canSlideInto(state, b, b.x + belt.dx, b.y + belt.dy)) {
    b.slide = { dx: belt.dx, dy: belt.dy, progress: 0, speed: BELT_SPEED };
  }
}

// Espace : un trou noir à 1 ou 2 cases en ligne droite attire la bombe
function startHolePull(state, b) {
  const map = mapOf(state);
  if (!map.holes.size) return;
  for (const [dx, dy] of DIRS) {
    for (let r = 1; r <= HOLE_PULL; r++) {
      const x = b.x + dx * r;
      const y = b.y + dy * r;
      if (!inBounds(x, y)) break;
      const i = idx(x, y);
      if (map.holes.has(i)) {
        if (canSlideInto(state, b, b.x + dx, b.y + dy) || r === 1) {
          b.slide = { dx, dy, progress: 0, speed: HOLE_SPEED, pull: true };
          return;
        }
        break;
      }
      if (state.cells[i] !== CELL.EMPTY || doorClosed(state, i) || bombAt(state, x, y)) break;
    }
  }
}

function slideBomb(state, b, dt) {
  const s = b.slide;
  s.progress += (s.speed ?? KICK_SPEED) * dt;
  while (b.slide && s.progress >= 1) {
    const nx = b.x + s.dx;
    const ny = b.y + s.dy;
    // quelque chose est apparu sur la route entre-temps : la bombe s'arrête
    if (state.cells[idx(nx, ny)] !== CELL.EMPTY || doorClosed(state, idx(nx, ny)) || state.bombs.some((o) => o !== b && o.x === nx && o.y === ny)) {
      b.slide = null;
      break;
    }
    b.x = nx;
    b.y = ny;
    s.progress -= 1;
    // Espace : la bombe tombe dans le trou noir et disparaît sans exploser
    if (mapOf(state).holes.has(idx(b.x, b.y))) {
      b.gone = true;
      b.slide = null;
      state.events.push({ type: 'swallow', x: b.x, y: b.y });
      break;
    }
    // Jungle : une bombe poussée dans un portail ressort de l'autre côté
    const dest = mapOf(state).portals.get(idx(b.x, b.y));
    if (dest !== undefined) {
      const tx = dest % dims.cols;
      const ty = Math.floor(dest / dims.cols);
      if (!state.bombs.some((o) => o !== b && o.x === tx && o.y === ty)) {
        b.x = tx;
        b.y = ty;
      }
    }
    b.pass = state.players.filter((o) => inCell(o, b.x, b.y)).map((o) => o.id);
    if (s.speed && !s.pull) b.slide = null; // tapis : on avance case par case
    else if (s.pull && mapOf(state).holes.has(idx(b.x + s.dx, b.y + s.dy))) continue; // le trou est juste devant
    else if (!canSlideInto(state, b, b.x + s.dx, b.y + s.dy)) b.slide = null;
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
      if (c === CELL.WALL || c === CELL.BURNING || doorClosed(state, i)) break;
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

function addFire(state, x, y, ice, duration = FIRE_DURATION) {
  const f = state.fires.find((f) => f.x === x && f.y === y);
  if (f) {
    f.timer = Math.max(f.timer, duration);
    f.ice = f.ice && ice; // une flamme normale l'emporte sur la glace
  } else {
    state.fires.push({ x, y, timer: duration, ice });
  }
}

// Volcan : des cases rougeoient, puis la lave jaillit (elle brûle comme une explosion)
function updateLava(state, dt) {
  if (state.map !== 'volcan') return;
  for (const l of state.lava) {
    l.timer -= dt;
    if (!l.burning && l.timer <= 0) {
      l.burning = true;
      l.timer = LAVA_BURN;
      addFire(state, l.x, l.y, false, LAVA_BURN);
      const item = state.items.findIndex((it) => it.x === l.x && it.y === l.y);
      if (item >= 0) state.items.splice(item, 1);
      state.events.push({ type: 'lava', x: l.x, y: l.y });
    }
  }
  state.lava = state.lava.filter((l) => !l.burning || l.timer > 0);

  state.lavaTimer -= dt;
  if (state.lavaTimer > 0) return;
  state.lavaTimer = LAVA_EVERY;
  const taken = new Set(state.lava.map((l) => idx(l.x, l.y)));
  const free = [];
  state.cells.forEach((c, i) => {
    if (c !== CELL.EMPTY || taken.has(i)) return;
    const x = i % dims.cols;
    const y = Math.floor(i / dims.cols);
    if (state.bombs.some((b) => b.x === x && b.y === y)) return;
    free.push(i);
  });
  const scale = state.size === 'large' ? 1.8 : 1;
  const count = Math.min(free.length, Math.round((LAVA_COUNT + Math.floor(state.time / 40)) * scale));
  for (let k = 0; k < count; k++) {
    const j = Math.floor(rand(state) * free.length);
    const i = free.splice(j, 1)[0];
    state.lava.push({ x: i % dims.cols, y: Math.floor(i / dims.cols), timer: LAVA_WARN, burning: false });
  }
  if (count) state.events.push({ type: 'lavaWarn' });
}

// Usine : les portes A et B se ferment à tour de rôle (une porte occupée attend d'être libre)
function updateDoors(state, dt) {
  if (!state.doors?.length) return;
  state.doorTimer -= dt;
  if (state.doorTimer <= 0) {
    state.doorTimer += DOOR_PERIOD;
    state.doorGroup = state.doorGroup === 'A' ? 'B' : 'A';
    state.events.push({ type: 'door' });
  }
  for (const d of state.doors) {
    const want = d.group === state.doorGroup;
    if (!want) {
      d.closed = false;
    } else if (!d.closed) {
      const x = d.i % dims.cols;
      const y = Math.floor(d.i / dims.cols);
      const busy = state.players.some((p) => touches(p, x, y)) || bombAt(state, x, y) || state.cells[d.i] !== CELL.EMPTY;
      if (!busy) d.closed = true;
    }
  }
}

// Plage : une vague prévient (la rangée scintille), puis inonde la rangée :
// on y avance moins vite et les bombes qui s'y trouvent sont noyées
function updateWaves(state, dt) {
  if (state.map !== 'plage') return;
  for (const w of state.waves) {
    w.timer -= dt;
    if (!w.flooding && w.timer <= 0) {
      w.flooding = true;
      w.timer = WAVE_FLOOD;
      state.events.push({ type: 'wave', row: w.row });
    }
    if (w.flooding) {
      for (const b of state.bombs) {
        if (b.y === w.row && !b.gone) {
          b.gone = true;
          state.events.push({ type: 'splash', x: b.x, y: b.y });
        }
      }
    }
  }
  state.bombs = state.bombs.filter((b) => !b.gone);
  state.waves = state.waves.filter((w) => !w.flooding || w.timer > 0);

  state.waveTimer -= dt;
  if (state.waveTimer > 0) return;
  state.waveTimer = WAVE_EVERY;
  const taken = new Set(state.waves.map((w) => w.row));
  const rows = [];
  for (let y = 1; y < dims.rows - 1; y++) {
    if (taken.has(y)) continue;
    let free = 0;
    for (let x = 1; x < dims.cols - 1; x++) if (state.cells[idx(x, y)] !== CELL.WALL) free++;
    if (free >= 5) rows.push(y);
  }
  const count = Math.min(rows.length, state.size === 'large' ? 2 : 1);
  for (let k = 0; k < count; k++) {
    const row = rows.splice(Math.floor(rand(state) * rows.length), 1)[0];
    state.waves.push({ row, timer: WAVE_WARN, flooding: false });
  }
  if (count) state.events.push({ type: 'waveWarn' });
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
  const order = spiral(dims.cols, dims.rows);
  while (s.timer <= 0 && s.index < order.length) {
    const c = order[s.index++];
    if (state.cells[c] === CELL.WALL) continue;
    s.timer += state.size === 'large' ? SUDDEN_DEATH_STEP * 0.6 : SUDDEN_DEATH_STEP;
    const x = c % dims.cols;
    const y = Math.floor(c / dims.cols);
    state.cells[c] = CELL.WALL;
    state.bombs = state.bombs.filter((b) => b.x !== x || b.y !== y);
    state.items = state.items.filter((it) => it.x !== x || it.y !== y);
    state.fires = state.fires.filter((f) => f.x !== x || f.y !== y);
    state.lava = state.lava.filter((l) => l.x !== x || l.y !== y);
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
