// Serveur de jeu Kaboom Arena (à héberger sur Render, en « Web Service »).
// Il crée les salons, reçoit les commandes des joueurs, fait tourner la partie
// et renvoie l'état du jeu à tout le monde.
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Room, makeCode } from './room.js';
import { TICK } from '../src/game/constants.js';

const PORT = process.env.PORT || 3000;
const rooms = new Map(); // code -> Room

// Une simple page texte : Render s'en sert pour vérifier que le serveur répond
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`Kaboom Arena : serveur en ligne (${rooms.size} salon(s))`);
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });

wss.on('connection', (ws) => {
  let room = null;
  let member = null;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  const reply = (msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

  function leave() {
    if (!room || !member) return;
    room.removeMember(member);
    if (room.isEmpty()) rooms.delete(room.code);
    room = null;
    member = null;
  }

  function enter(target, name, skin) {
    const res = target.addHuman(ws, name, skin);
    if (res.error) return reply({ t: 'error', message: res.error });
    room = target;
    member = res.member;
    reply({ t: 'joined', code: room.code, you: member.id });
    room.broadcastLobby();
  }

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    switch (msg.t) {
      case 'create': {
        leave();
        const code = makeCode(rooms);
        const r = new Room(code);
        rooms.set(code, r);
        enter(r, msg.name, msg.skin);
        break;
      }
      case 'join': {
        leave();
        const r = rooms.get(String(msg.code || '').toUpperCase().trim());
        if (!r) return reply({ t: 'error', message: 'Aucun salon avec ce code. Vérifie les 4 lettres.' });
        enter(r, msg.name, msg.skin);
        break;
      }
      case 'skin':
        if (room && member) room.setSkin(member, msg.skin);
        break;
      case 'input':
        if (room && member) room.input(member, msg);
        break;
      case 'start':
        if (room && member) room.start(member);
        break;
      case 'rematch':
        if (room && member) room.rematch(member);
        break;
      case 'addBot':
        if (room && member && member.id === room.hostId) room.addBot();
        break;
      case 'removeBot':
        if (room && member && member.id === room.hostId) room.removeBot();
        break;
      case 'leave':
        leave();
        break;
    }
  });

  ws.on('close', leave);
});

// Détecte les joueurs dont la connexion a coupé sans prévenir
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

// Boucle de jeu commune : 60 pas par seconde pour tous les salons
let last = performance.now();
let acc = 0;
setInterval(() => {
  const now = performance.now();
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;
  while (acc >= TICK) {
    for (const r of rooms.values()) r.step();
    acc -= TICK;
  }
}, 5);

server.listen(PORT, () => console.log(`Serveur Kaboom Arena prêt sur le port ${PORT}`));
