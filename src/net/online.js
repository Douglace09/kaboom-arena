// Connexion au serveur de jeu.
// - Envoie les commandes du joueur 60 fois par seconde.
// - Reçoit l'état de la partie 20 fois par seconde.
// - Prédiction : ton personnage bouge tout de suite chez toi, puis le serveur corrige.
// - Interpolation : les autres joueurs sont affichés avec 0,1 s de retard, de façon fluide.
import { SERVER_URL } from './config.js';
import { predictMove } from '../game/game.js';
import { TICK } from '../game/constants.js';

const INTERP_DELAY = 0.1; // retard d'affichage des autres joueurs (s)
const CONNECT_TIMEOUT = 90000; // un serveur Render endormi met jusqu'à ~1 min à se réveiller

export function createOnline({ onLobby, onJoined, onError, onClose }) {
  let ws = null;
  let you = null; // mon identifiant dans le salon
  let lobby = null;
  let cells = null;
  let snaps = []; // [{ t, s }] derniers états reçus
  let round = -1;
  let pending = []; // commandes envoyées mais pas encore confirmées par le serveur
  let seq = 0;
  let predicted = null; // mon personnage prédit
  let offset = { x: 0, y: 0 }; // petite correction lissée après un message du serveur
  let events = [];
  let roundChanged = false;

  const now = () => performance.now() / 1000;
  const myPid = () => lobby?.members.find((m) => m.id === you)?.pid ?? null;

  function connect() {
    return new Promise((resolve, reject) => {
      if (ws && ws.readyState === WebSocket.OPEN) return resolve();
      const socket = new WebSocket(SERVER_URL);
      ws = socket;
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('Le serveur ne répond pas.'));
      }, CONNECT_TIMEOUT);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Impossible de joindre le serveur.'));
      };
      socket.onclose = () => {
        if (ws !== socket) return;
        ws = null;
        const wasIn = lobby !== null;
        reset();
        if (wasIn) onClose();
      };
      socket.onmessage = (e) => handle(JSON.parse(e.data));
    });
  }

  function reset() {
    you = null;
    lobby = null;
    cells = null;
    snaps = [];
    round = -1;
    pending = [];
    predicted = null;
    events = [];
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function handle(msg) {
    switch (msg.t) {
      case 'joined':
        you = msg.you;
        onJoined(msg);
        break;
      case 'lobby':
        lobby = msg;
        onLobby(msg);
        break;
      case 'error':
        onError(msg.message);
        break;
      case 'snap':
        handleSnap(msg);
        break;
    }
  }

  function handleSnap(m) {
    if (m.cells) cells = m.cells;
    if (!cells) return;
    if (m.round !== round) {
      round = m.round;
      snaps = [];
      pending = [];
      predicted = null;
      offset = { x: 0, y: 0 };
      roundChanged = true;
    }
    const s = { ...m, cells };
    snaps.push({ t: now(), s });
    if (snaps.length > 30) snaps.shift();
    events.push(...m.events);

    // Réconciliation : on repart de la position donnée par le serveur et on rejoue
    // les commandes qu'il n'a pas encore traitées
    const pid = myPid();
    const me = pid !== null ? m.players[pid] : null;
    if (!me) return;
    const ack = m.acks?.[pid] ?? -1;
    pending = pending.filter((i) => i.seq > ack);
    const p = structuredClone(me);
    for (const inp of pending) predictMove(s, p, inp, TICK);
    if (predicted) {
      offset.x += predicted.x - p.x;
      offset.y += predicted.y - p.y;
      if (Math.hypot(offset.x, offset.y) > 1.5) offset = { x: 0, y: 0 }; // gros écart : on se recale direct
    }
    predicted = p;
  }

  return {
    connect,
    get you() {
      return you;
    },
    get lobby() {
      return lobby;
    },
    myPid,
    async create(name, skin) {
      await connect();
      send({ t: 'create', name, skin });
    },
    async join(code, name, skin) {
      await connect();
      send({ t: 'join', code, name, skin });
    },
    setSkin: (skin) => send({ t: 'skin', skin }),
    setMap: (map) => send({ t: 'map', map }),
    start: () => send({ t: 'start' }),
    rematch: () => send({ t: 'rematch' }),
    addBot: () => send({ t: 'addBot' }),
    removeBot: () => send({ t: 'removeBot' }),
    leave() {
      send({ t: 'leave' });
      const socket = ws;
      ws = null;
      reset();
      if (socket) socket.close();
    },

    // À appeler 60 fois par seconde pendant une manche
    sendInput(input) {
      if (!lobby || lobby.phase !== 'playing') return;
      seq++;
      send({ t: 'input', seq, dx: input.dx, dy: input.dy, bomb: input.bomb, special: input.special });
      pending.push({ seq, dx: input.dx, dy: input.dy });
      if (pending.length > 120) pending.shift();
      const latest = snaps[snaps.length - 1];
      if (latest && predicted) predictMove(latest.s, predicted, input, TICK);
    },

    // Nouvelle manche depuis le dernier appel ?
    takeRoundChange() {
      const r = roundChanged;
      roundChanged = false;
      return r;
    },

    // État à afficher pour cette image
    view(dt) {
      if (!snaps.length) return null;
      const latest = snaps[snaps.length - 1].s;
      const t = now() - INTERP_DELAY;
      let a = snaps[0];
      let b = snaps[snaps.length - 1];
      for (let i = snaps.length - 1; i > 0; i--) {
        if (snaps[i - 1].t <= t) {
          a = snaps[i - 1];
          b = snaps[i];
          break;
        }
      }
      const k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
      const pid = myPid();
      const decay = Math.exp(-dt * 12);
      offset.x *= decay;
      offset.y *= decay;

      const players = latest.players.map((p, i) => {
        if (i === pid && predicted) {
          return { ...p, x: predicted.x + offset.x, y: predicted.y + offset.y, faceX: predicted.faceX, faceY: predicted.faceY, moving: predicted.moving };
        }
        const pa = a.s.players[i];
        const pb = b.s.players[i];
        if (!pa || !pb) return p;
        return { ...p, x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, moving: pa.x !== pb.x || pa.y !== pb.y };
      });
      const out = { ...latest, players, events };
      events = [];
      return out;
    },
  };
}
