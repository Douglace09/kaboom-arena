// Un salon : liste des joueurs, manches, score, et la partie qui tourne sur le serveur.
// La logique du jeu est exactement celle du navigateur (dossier src/game).
import { createGame, update, eliminate } from '../src/game/game.js';
import { createBot } from '../src/game/bot.js';
import { TICK } from '../src/game/constants.js';

export const MAX_PLAYERS = 4;
export const WINS_TO_MATCH = 3; // le premier à 3 manches gagne
const SNAP_EVERY = 3; // un état envoyé tous les 3 pas = 20 fois par seconde
const ROUND_PAUSE = 3.5; // secondes entre deux manches
const BOT_NAMES = ['Robo', 'Pixel', 'Turbo', 'Zébulon'];
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I ni O, faciles à confondre

export function makeCode(taken) {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
    if (!taken.has(code)) return code;
  }
}

export function cleanName(name) {
  const n = String(name || '').replace(/[<>&"']/g, '').trim().slice(0, 14);
  return n || 'Joueur';
}

const r3 = (v) => Math.round(v * 1000) / 1000;

export class Room {
  constructor(code) {
    this.code = code;
    this.members = []; // { id, name, color, bot, ws, brain, queue, held, lastSeq, wins, pid }
    this.nextMemberId = 1;
    this.hostId = null;
    this.phase = 'lobby'; // 'lobby' | 'playing' | 'roundEnd' | 'podium'
    this.state = null;
    this.round = 0;
    this.lastRoundWinner = null;
    this.timer = 0;
    this.tickCount = 0;
    this.pendingEvents = [];
    this.lastCells = '';
  }

  get humans() {
    return this.members.filter((m) => !m.bot);
  }

  freeColor() {
    for (let c = 0; c < MAX_PLAYERS; c++) if (!this.members.some((m) => m.color === c)) return c;
    return 0;
  }

  // ---------- Entrées / sorties ----------

  addHuman(ws, name) {
    if (this.phase !== 'lobby') return { error: 'La partie a déjà commencé dans ce salon.' };
    if (this.members.length >= MAX_PLAYERS) return { error: 'Ce salon est complet (4 joueurs).' };
    const m = this.newMember({ name: cleanName(name), ws, bot: false });
    if (this.hostId === null) this.hostId = m.id;
    return { member: m };
  }

  addBot() {
    if (this.phase !== 'lobby' || this.members.length >= MAX_PLAYERS) return;
    const used = new Set(this.members.map((m) => m.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || 'IA';
    this.newMember({ name, ws: null, bot: true });
    this.broadcastLobby();
  }

  removeBot() {
    if (this.phase !== 'lobby') return;
    const bot = [...this.members].reverse().find((m) => m.bot);
    if (bot) this.removeMember(bot);
  }

  newMember({ name, ws, bot }) {
    const m = {
      id: this.nextMemberId++, name, color: this.freeColor(), bot, ws,
      brain: null, queue: [], held: { dx: 0, dy: 0 }, lastSeq: -1, wins: 0, pid: null,
    };
    this.members.push(m);
    return m;
  }

  removeMember(m) {
    const i = this.members.indexOf(m);
    if (i < 0) return;
    this.members.splice(i, 1);
    if (this.state && m.pid !== null && this.phase === 'playing') eliminate(this.state, m.pid);
    if (this.hostId === m.id) this.hostId = this.humans[0]?.id ?? null;
    // Plus assez de monde pour continuer : retour au salon
    if (this.phase !== 'lobby' && this.members.length < 2) this.backToLobby();
    this.broadcastLobby();
  }

  isEmpty() {
    return this.humans.length === 0;
  }

  // ---------- Partie ----------

  start(member) {
    if (member.id !== this.hostId || this.phase !== 'lobby' || this.members.length < 2) return;
    for (const m of this.members) m.wins = 0;
    this.round = 0;
    this.startRound();
  }

  rematch(member) {
    if (member.id !== this.hostId || this.phase !== 'podium') return;
    this.backToLobby();
    this.start(member);
  }

  backToLobby() {
    this.phase = 'lobby';
    this.state = null;
    for (const m of this.members) {
      m.pid = null;
      m.wins = 0;
    }
  }

  startRound() {
    this.round++;
    this.members.forEach((m, i) => {
      m.pid = i;
      m.brain = m.bot ? createBot(i) : null;
      m.queue = [];
      m.held = { dx: 0, dy: 0 };
      m.lastSeq = -1;
    });
    this.state = createGame({
      playerCount: this.members.length,
      seed: Math.floor(Math.random() * 1e9),
      colors: this.members.map((m) => m.color),
    });
    this.phase = 'playing';
    this.lastCells = '';
    this.pendingEvents = [];
    this.lastRoundWinner = null;
    this.broadcastLobby();
    this.sendSnapshot();
  }

  input(member, msg) {
    if (this.phase !== 'playing' || member.pid === null) return;
    const dir = (v) => (v === 1 || v === -1 ? v : 0);
    let dx = dir(msg.dx);
    let dy = dir(msg.dy);
    if (dx && dy) dy = 0;
    member.queue.push({ seq: Number(msg.seq) || 0, dx, dy, bomb: !!msg.bomb, special: !!msg.special });
    if (member.queue.length > 30) member.queue.shift();
  }

  // Commande du joueur pour ce pas : une commande reçue par pas, comme chez lui
  nextInput(m) {
    if (m.bot) return m.brain.think(this.state);
    let inp = m.queue.shift();
    if (!inp) return { ...m.held, bomb: false, special: false };
    // Retard accumulé (connexion irrégulière) : on rattrape en fusionnant
    while (m.queue.length > 3) {
      const next = m.queue.shift();
      inp = { ...next, bomb: inp.bomb || next.bomb, special: inp.special || next.special };
    }
    m.held = { dx: inp.dx, dy: inp.dy };
    m.lastSeq = inp.seq;
    return inp;
  }

  // Un pas de 1/60 s
  step() {
    if (this.phase === 'roundEnd') {
      this.timer -= TICK;
      if (this.timer <= 0) this.startRound();
      return;
    }
    if (this.phase !== 'playing') return;

    const inputs = [];
    for (const m of this.members) inputs[m.pid] = this.nextInput(m);
    update(this.state, inputs, TICK);
    this.pendingEvents.push(...this.state.events);
    this.state.events.length = 0;

    this.tickCount++;
    if (this.state.phase === 'over') {
      this.sendSnapshot();
      this.endRound();
    } else if (this.tickCount % SNAP_EVERY === 0) {
      this.sendSnapshot();
    }
  }

  endRound() {
    const winner = this.members.find((m) => m.pid === this.state.winner) || null;
    if (winner) winner.wins++;
    this.lastRoundWinner = winner ? winner.id : null;
    if (winner && winner.wins >= WINS_TO_MATCH) {
      this.phase = 'podium';
    } else {
      this.phase = 'roundEnd';
      this.timer = ROUND_PAUSE;
    }
    this.broadcastLobby();
  }

  // ---------- Messages ----------

  send(m, msg) {
    if (m.ws && m.ws.readyState === 1) m.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  broadcast(msg) {
    const text = JSON.stringify(msg);
    for (const m of this.members) this.send(m, text);
  }

  broadcastLobby() {
    this.broadcast({
      t: 'lobby',
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      round: this.round,
      winsToMatch: WINS_TO_MATCH,
      lastRoundWinner: this.lastRoundWinner,
      roundPause: ROUND_PAUSE,
      members: this.members.map((m) => ({
        id: m.id, name: m.name, color: m.color, bot: m.bot, wins: m.wins, pid: m.pid,
      })),
    });
  }

  sendSnapshot() {
    const s = this.state;
    const cells = s.cells.join('');
    const changed = cells !== this.lastCells;
    this.lastCells = cells;
    const acks = {};
    for (const m of this.members) if (!m.bot) acks[m.pid] = m.lastSeq;
    this.broadcast({
      t: 'snap',
      round: this.round,
      time: r3(s.time),
      phase: s.phase,
      winner: s.winner,
      sudden: !!s.sudden,
      cells: changed ? s.cells : undefined,
      players: s.players.map((p) => ({
        ...p, x: r3(p.x), y: r3(p.y),
        frozen: r3(p.frozen), invuln: r3(p.invuln), dashTimer: r3(p.dashTimer), dashCooldown: r3(p.dashCooldown),
      })),
      bombs: s.bombs.map((b) => ({ ...b, timer: r3(b.timer), slide: b.slide && { ...b.slide, progress: r3(b.slide.progress) } })),
      fires: s.fires.map((f) => ({ ...f, timer: r3(f.timer) })),
      items: s.items,
      events: this.pendingEvents,
      acks,
    });
    this.pendingEvents = [];
  }
}
