// Point d'entrée : relie la logique, l'affichage, les commandes, le réseau et les écrans
import './style.css';
import { createGame, update } from './game/game.js';
import { createBot } from './game/bot.js';
import { TICK } from './game/constants.js';
import { createRenderer } from './render/renderer.js';
import { PLAYER_COLORS } from './render/colors.js';
import { createKeyboard } from './input/keyboard.js';
import { createTouch } from './input/touch.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createOnline } from './net/online.js';

const $ = (id) => document.getElementById(id);
const renderer = createRenderer($('app'));
const keyboard = createKeyboard();
const touch = createTouch();
const hud = createHud();
const screens = createScreens();
const specialName = touch.enabled ? 'SPÉCIAL' : 'E';

// mode : 'menu', 'bot' (contre l'IA), 'local' (2 sur le même clavier) ou 'online'
let mode = 'menu';
let state = createGame({ playerCount: 2, seed: 1 }); // arène affichée derrière le menu
let bot = null;
let paused = true;
let endShown = false;

// ---------- Hors ligne : contre l'IA ou à deux sur le même clavier ----------

function startOffline(m) {
  mode = m;
  if (m === 'bot') {
    hud.setContext({ nameOf: (id) => (id === 1 ? 'IA' : 'Toi'), isMine: (id) => id === 0, soloMine: true, specialKey: () => specialName, wins: () => null });
    hud.setHelp(touch.enabled ? '' : 'ZQSD ou flèches · Bombe : Espace · Spécial : E · Pause : Échap');
  } else {
    hud.setContext({ nameOf: (id) => `J${id + 1}`, isMine: () => true, soloMine: false, specialKey: (id) => (id === 0 ? 'E' : 'Ctrl droit'), wins: () => null });
    hud.setHelp('J1 : ZQSD, Espace, E · J2 : flèches, Entrée, Ctrl droit · Pause : Échap');
  }
  newRound();
}

function newRound() {
  state = createGame({ playerCount: 2, seed: Math.floor(Math.random() * 1e9) });
  bot = mode === 'bot' ? createBot(1) : null;
  paused = false;
  endShown = false;
  screens.hide();
  renderer.reset(state);
  hud.update(state);
}

function myInput() {
  const t = touch.read();
  const k = keyboard.readAny();
  const dir = t.dx || t.dy ? t : k;
  return { dx: dir.dx, dy: dir.dy, bomb: t.bomb || k.bomb, special: t.special || k.special };
}

function offlineInputs() {
  if (mode === 'bot') return [myInput(), bot.think(state)];
  return [keyboard.read(0), keyboard.read(1)];
}

function showOfflineEnd() {
  endShown = true;
  let title = 'Égalité !';
  let color = '';
  if (state.winner !== null) {
    title = mode === 'bot' ? (state.winner === 0 ? 'Tu as gagné !' : "L'IA a gagné !") : `Joueur ${state.winner + 1} gagne !`;
    color = PLAYER_COLORS[state.winner];
  }
  screens.show('end', { title, color });
}

// Pause automatique quand la page perd le focus (hors ligne seulement)
function pause() {
  if ((mode !== 'bot' && mode !== 'local') || paused || state.phase !== 'playing') return;
  paused = true;
  screens.show('pause', { title: 'Pause', sub: 'Le jeu attend que tu reviennes' });
  $('resume').focus();
}
function resume() {
  paused = false;
  screens.hide();
}
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => document.hidden && pause());

function backToMenu(message = '') {
  if (mode === 'online') online.leave();
  mode = 'menu';
  paused = true;
  hud.clear();
  hud.setHelp('');
  screens.show('menu', { sub: message });
}

// ---------- En ligne ----------

const online = createOnline({
  onJoined: () => {},
  onLobby: (lobby) => {
    mode = 'online';
    const you = online.you;
    hud.setContext({
      nameOf: (pid) => lobby.members.find((m) => m.pid === pid)?.name ?? '—',
      isMine: (pid) => pid === online.myPid(),
      soloMine: true,
      specialKey: () => specialName,
      wins: (pid) => lobby.members.find((m) => m.pid === pid)?.wins ?? 0,
      winsToMatch: lobby.winsToMatch,
    });
    hud.setHelp(touch.enabled ? '' : 'ZQSD ou flèches · Bombe : Espace · Spécial : E');
    if (lobby.phase === 'lobby') screens.lobby(lobby, you);
    else if (lobby.phase === 'playing') screens.hide();
    else if (lobby.phase === 'roundEnd') screens.roundEnd(lobby, you);
    else if (lobby.phase === 'podium') screens.podium(lobby, you);
  },
  onError: (message) => {
    if (mode === 'online' && online.lobby) return; // déjà dans un salon : on ignore
    backToMenu(message);
  },
  onClose: () => backToMenu('Connexion perdue avec le serveur.'),
});

async function goOnline(action) {
  screens.show('connecting', { title: 'Connexion au serveur…' });
  try {
    await action();
  } catch (err) {
    if (screens.current() === 'connecting') backToMenu(`${err.message} Réessaie dans un instant.`);
  }
}

$('create').addEventListener('click', () => goOnline(() => online.create(screens.name)));
$('join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (screens.code.length !== 4) {
    screens.show('menu', { sub: 'Le code du salon fait 4 lettres.' });
    $('code').focus();
    return;
  }
  goOnline(() => online.join(screens.code, screens.name));
});
$('cancel-connect').addEventListener('click', () => backToMenu());
$('leave-lobby').addEventListener('click', () => backToMenu());
$('leave-podium').addEventListener('click', () => backToMenu());
$('start').addEventListener('click', () => online.start());
$('rematch').addEventListener('click', () => online.rematch());
$('add-bot').addEventListener('click', () => online.addBot());
$('remove-bot').addEventListener('click', () => online.removeBot());
$('copy-link').addEventListener('click', async () => {
  const link = `${location.origin}${location.pathname}?salon=${online.lobby?.code ?? ''}`;
  const btn = $('copy-link');
  try {
    await navigator.clipboard.writeText(link);
    btn.textContent = 'Lien copié !';
  } catch {
    btn.textContent = link; // copie impossible : on affiche le lien à recopier
  }
  setTimeout(() => (btn.textContent = "Copier le lien d'invitation"), 2500);
});

// ---------- Boutons hors ligne et clavier ----------

$('mode-bot').addEventListener('click', () => startOffline('bot'));
$('mode-local').addEventListener('click', () => startOffline('local'));
if (touch.enabled) $('mode-local').hidden = true; // un seul jeu de commandes à l'écran
$('replay').addEventListener('click', newRound);
$('change-mode').addEventListener('click', () => backToMenu());
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', () => backToMenu());

window.addEventListener('keydown', (e) => {
  if (mode !== 'bot' && mode !== 'local') return;
  if (e.code === 'KeyR' && state.phase === 'over') newRound();
  if (e.code === 'Escape') {
    if (!paused) pause();
    else if (screens.current() === 'pause') resume();
  }
});

// ---------- Boucle principale ----------

let last = performance.now();
let acc = 0;

function frame(now) {
  // On redemande l'image suivante en premier : même si une erreur survient,
  // le jeu continue de tourner au lieu de se figer
  requestAnimationFrame(frame);
  try {
    const dt = Math.min((now - last) / 1000, 0.25);
    acc += dt;
    last = now;

    let steps = 0;
    while (acc >= TICK && steps < 5) {
      if (mode === 'online') online.sendInput(myInput());
      else if (!paused) update(state, offlineInputs(), TICK);
      acc -= TICK;
      steps++;
    }
    if (steps === 5) acc = 0; // l'appareil rame : on ne tente pas de rattraper

    if (mode === 'online') {
      const view = online.view(dt);
      if (view) {
        if (online.takeRoundChange()) {
          renderer.reset(view);
          hud.clear();
        }
        renderer.render(view, now / 1000);
        hud.update(view);
        return;
      }
    }

    renderer.render(state, now / 1000);
    if (mode === 'bot' || mode === 'local') {
      if (!paused) hud.update(state);
      if (state.phase === 'over' && !endShown) showOfflineEnd();
    }
    state.events.length = 0; // événements lus par l'affichage et l'interface
  } catch (err) {
    state.events.length = 0;
    showError(err);
  }
}

// Affiche l'erreur à l'écran (une seule fois) pour pouvoir me la recopier
let errorShown = false;
function showError(err) {
  console.error(err);
  if (errorShown) return;
  errorShown = true;
  const box = document.createElement('div');
  box.id = 'error';
  box.textContent = `Erreur : ${err && err.message ? err.message : err}`;
  document.body.appendChild(box);
}
window.addEventListener('error', (e) => showError(e.error || e.message));

renderer.reset(state);
screens.show('menu');
if (new URLSearchParams(location.search).get('salon')) screens.focusName();
requestAnimationFrame(frame);
