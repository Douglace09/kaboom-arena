// Point d'entrée : relie la logique, l'affichage, les sons, les commandes, le réseau et les écrans
import './style.css';
import { createGame, update } from './game/game.js';
import { createBot } from './game/bot.js';
import { TICK } from './game/constants.js';
import { SKINS, SKIN_IDS, isSkin, randomSkin } from './game/skins.js';
import { isMap, randomMap, getMap } from './game/maps.js';
import { createRenderer } from './render/renderer.js';
import { renderPortraits } from './render/characters.js';
import { PLAYER_COLORS } from './render/colors.js';
import { createSound } from './audio/sound.js';
import { createKeyboard } from './input/keyboard.js';
import { createTouch } from './input/touch.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createOnline } from './net/online.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

const touch = createTouch();
const renderer = createRenderer($('app'));
const sound = createSound();
const keyboard = createKeyboard();
const hud = createHud();

// Portraits des personnages (dans leur couleur « signature »), pour les menus
const portraits = renderPortraits(SKINS, (id) => PLAYER_COLORS[SKIN_IDS.indexOf(id) % PLAYER_COLORS.length]);
hud.setPortraits(portraits);

let mySkin = isSkin(store.get('kaboom-skin')) ? store.get('kaboom-skin') : 'boulon';
let myMap = isMap(store.get('kaboom-map')) || store.get('kaboom-map') === 'random' ? store.get('kaboom-map') : 'random';
let lastMap = null;
let aiCount = Math.min(7, Math.max(1, Number(store.get('kaboom-ai')) || 1)); // adversaires IA hors ligne
const screens = createScreens({
  portraits,
  onMap(map) {
    sound.play('click');
    if (mode === 'online') return online.setMap(map); // seul l'hôte peut changer la carte
    myMap = map;
    store.set('kaboom-map', map);
    screens.setMenuMap(map);
  },
  onSkin(skin) {
    sound.play('click');
    mySkin = skin;
    store.set('kaboom-skin', skin);
    screens.setMenuSkin(skin);
    if (mode === 'online') online.setSkin(skin);
  },
});
screens.setMenuSkin(mySkin);
screens.setMenuMap(myMap);

// Début de manche : musique de la carte et annonce de son nom
function announceMap(mapId) {
  const m = getMap(mapId);
  sound.setMusic(m.id);
  hud.banner(m.name, m.desc);
}

// Qualité graphique : haute sur ordinateur, basse sur écran tactile (modifiable)
let highQuality = store.get('kaboom-quality') ? store.get('kaboom-quality') === 'high' : !touch.enabled;
renderer.setQuality(highQuality);

const specialName = touch.enabled ? 'SPÉCIAL' : 'E';

// mode : 'menu', 'bot' (contre l'IA), 'local' (2 sur le même clavier) ou 'online'
let mode = 'menu';
let state = createGame({ playerCount: 2, seed: 1, skins: ['boulon', 'mochi'], shuffleSpawns: false }); // arène derrière le menu
let bots = [];
let paused = true;
let endShown = false;

// ---------- Réglages : son et qualité ----------

const SPEAKER_ON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SPEAKER_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9l5 6M21 9l-5 6"/></svg>';

function refreshSettings() {
  screens.setSettings({ muted: sound.muted, high: highQuality });
  $('mute').innerHTML = sound.muted ? SPEAKER_OFF : SPEAKER_ON;
  $('mute').setAttribute('aria-label', sound.muted ? 'Remettre le son' : 'Couper le son');
}
function toggleMute() {
  sound.toggleMute();
  refreshSettings();
}
$('mute').addEventListener('click', toggleMute);
$('toggle-sound').addEventListener('click', toggleMute);
$('toggle-quality').addEventListener('click', () => {
  highQuality = !highQuality;
  store.set('kaboom-quality', highQuality ? 'high' : 'low');
  renderer.setQuality(highQuality);
  refreshSettings();
});
refreshSettings();

// Réglages du volume : un curseur pour la musique, un pour les bruitages
// (présents dans le menu principal et dans le menu de partie, toujours synchronisés)
const VOLUMES = [
  { key: 'music', label: 'Musique', get: () => sound.musicLevel, set: (v) => sound.setMusicLevel(v) },
  { key: 'sfx', label: 'Effets', get: () => sound.sfxLevel, set: (v) => sound.setSfxLevel(v) },
];
for (const box of document.querySelectorAll('.volumes')) {
  box.innerHTML = VOLUMES.map(
    (v) => `<label class="volume"><span>${v.label}</span><input type="range" min="0" max="100" step="5" data-vol="${v.key}" aria-label="Volume ${v.label.toLowerCase()}"><output data-vol-out="${v.key}"></output></label>`
  ).join('');
}
function refreshVolumes() {
  for (const v of VOLUMES) {
    const pct = Math.round(v.get() * 100);
    for (const el of document.querySelectorAll(`[data-vol="${v.key}"]`)) el.value = pct;
    for (const el of document.querySelectorAll(`[data-vol-out="${v.key}"]`)) el.textContent = `${pct} %`;
  }
}
document.addEventListener('input', (e) => {
  const v = VOLUMES.find((x) => x.key === e.target.dataset?.vol);
  if (!v) return;
  v.set(Number(e.target.value) / 100);
  if (sound.muted && Number(e.target.value) > 0) toggleMute(); // monter le son le remet
  refreshVolumes();
});
document.addEventListener('change', (e) => {
  if (e.target.dataset?.vol === 'sfx') sound.play('pickup'); // petit son pour tester le volume
});
refreshVolumes();

// La musique démarre au premier clic ou à la première touche (règle des navigateurs)
const startAudio = () => sound.startMusic();
window.addEventListener('pointerdown', startAudio, { once: true });
window.addEventListener('keydown', startAudio, { once: true });
// Petit clic sur les boutons de menu
$('overlay').addEventListener('click', (e) => {
  if (e.target.closest('button') && !e.target.closest('[data-skin]')) sound.play('click');
});

// ---------- Hors ligne : contre l'IA ou à deux sur le même clavier ----------

function startOffline(m) {
  mode = m;
  if (m === 'bot') {
    hud.setContext({ nameOf: (id) => (id === 0 ? 'Toi' : aiCount > 1 ? `IA ${id}` : 'IA'), isMine: (id) => id === 0, soloMine: true, specialKey: () => specialName, wins: () => null });
    hud.setHelp(touch.enabled ? '' : 'ZQSD ou flèches · Bombe : Espace · Spécial : E · Menu : Échap');
  } else {
    hud.setContext({ nameOf: (id) => `J${id + 1}`, isMine: () => true, soloMine: false, specialKey: (id) => (id === 0 ? 'E' : 'Ctrl droit'), wins: () => null });
    hud.setHelp('J1 : ZQSD, Espace, E · J2 : flèches, Entrée, Ctrl droit · Menu : Échap');
  }
  newRound();
}

function newRound() {
  const count = mode === 'bot' ? 1 + aiCount : 2;
  const skins = [mySkin];
  if (mode === 'bot') for (let i = 1; i < count; i++) skins.push(randomSkin(skins));
  else skins.push(SKIN_IDS[(SKIN_IDS.indexOf(mySkin) + 1) % SKIN_IDS.length]);
  const map = myMap === 'random' ? randomMap(lastMap) : myMap;
  lastMap = map;
  state = createGame({ playerCount: count, seed: Math.floor(Math.random() * 1e9), skins, map });
  announceMap(map);
  bots = mode === 'bot' ? Array.from({ length: count - 1 }, (_, i) => createBot(i + 1)) : [];
  renderer.setFollow(touch.enabled ? 0 : null);
  renderer.setViewers(mode === 'local' ? [0, 1] : [0]);
  paused = false;
  endShown = false;
  screens.hide();
  $('game-menu').hidden = false;
  renderer.reset(state);
  hud.clear();
  hud.update(state);
}

function myInput() {
  const t = touch.read();
  const k = keyboard.readAny();
  const dir = t.dx || t.dy ? t : k;
  return { dx: dir.dx, dy: dir.dy, ax: dir.ax || 0, ay: dir.ay || 0, bomb: t.bomb || k.bomb, special: t.special || k.special };
}

function offlineInputs() {
  if (mode === 'bot') return [myInput(), ...bots.map((b) => b.think(state))];
  return [keyboard.read(0), keyboard.read(1)];
}

function showOfflineEnd() {
  endShown = true;
  let title = 'Égalité !';
  let color = '';
  if (state.winner !== null) {
    title = mode === 'bot' ? (state.winner === 0 ? 'Tu as gagné !' : aiCount > 1 ? `L'IA ${state.winner} a gagné !` : "L'IA a gagné !") : `Joueur ${state.winner + 1} gagne !`;
    color = PLAYER_COLORS[state.players[state.winner].color];
  }
  if (state.winner !== null && !(mode === 'bot' && state.winner !== 0)) sound.play('win');
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
  if (mode === 'online') {
    // En ligne : on revient à l'écran qui correspond à l'état du salon
    const lobby = online.lobby;
    if (lobby?.phase === 'roundEnd') screens.roundEnd(lobby, online.you);
    else if (lobby?.phase === 'podium') screens.podium(lobby, online.you);
    else screens.hide();
    return;
  }
  paused = false;
  if (state.phase === 'over') showOfflineEnd();
  else screens.hide();
}
// Menu de partie (bouton en haut à droite ou Échap) : volume, reprendre, quitter
function openGameMenu() {
  if (mode === 'menu') return;
  refreshVolumes();
  if (mode === 'online') {
    screens.show('pause', { title: 'Menu', sub: 'La partie continue pendant ce temps' });
  } else {
    paused = true;
    screens.show('pause', { title: 'Pause' });
  }
  $('resume').focus();
}
$('game-menu').addEventListener('click', openGameMenu);
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => document.hidden && pause());

function backToMenu(message = '') {
  if (mode === 'online') online.leave();
  mode = 'menu';
  paused = true;
  hud.clear();
  hud.setHelp('');
  sound.setMusic('menu');
  screens.setMenuSkin(mySkin);
  screens.setMenuMap(myMap);
  $('game-menu').hidden = true;
  screens.show('menu', { sub: message });
}

// ---------- En ligne ----------

let lastLobbyPhase = null;
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
    hud.setHelp(touch.enabled ? '' : 'ZQSD ou flèches · Bombe : Espace · Spécial : E · Menu : Échap');
    // Jingle quand j'ai gagné la manche
    const me = lobby.members.find((m) => m.id === you);
    if ((lobby.phase === 'roundEnd' || lobby.phase === 'podium') && lastLobbyPhase === 'playing' && lobby.lastRoundWinner === me?.id) sound.play('win');
    lastLobbyPhase = lobby.phase;
    $('game-menu').hidden = lobby.phase === 'lobby';
    const menuOpen = screens.current() === 'pause';
    if (lobby.phase === 'lobby') {
      screens.lobby(lobby, you);
      sound.setMusic('menu');
    }
    else if (lobby.phase === 'playing') {
      if (!menuOpen) screens.hide(); // on ne ferme pas le menu ouvert par le joueur
    }
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

$('create').addEventListener('click', () => goOnline(() => online.create(screens.name, mySkin)));
$('join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (screens.code.length !== 4) {
    screens.show('menu', { sub: 'Le code du salon fait 4 lettres.' });
    $('code').focus();
    return;
  }
  goOnline(() => online.join(screens.code, screens.name, mySkin));
});
$('cancel-connect').addEventListener('click', () => backToMenu());
$('leave-lobby').addEventListener('click', () => backToMenu());
$('leave-podium').addEventListener('click', () => backToMenu());
$('leave-round').addEventListener('click', () => backToMenu());
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
function refreshAi() {
  $('ai-count').textContent = aiCount;
  $('ai-note').textContent = aiCount + 1 > 4 ? 'grande arène' : 'petite arène';
  $('ai-minus').disabled = aiCount <= 1;
  $('ai-plus').disabled = aiCount >= 7;
  store.set('kaboom-ai', String(aiCount));
}
$('ai-minus').addEventListener('click', () => {
  aiCount = Math.max(1, aiCount - 1);
  refreshAi();
});
$('ai-plus').addEventListener('click', () => {
  aiCount = Math.min(7, aiCount + 1);
  refreshAi();
});
refreshAi();
$('mode-local').addEventListener('click', () => startOffline('local'));
if (touch.enabled) $('mode-local').hidden = true; // un seul jeu de commandes à l'écran
$('replay').addEventListener('click', newRound);
$('change-mode').addEventListener('click', () => backToMenu());
$('resume').addEventListener('click', resume);
$('quit').addEventListener('click', () => backToMenu());

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Escape' && mode !== 'menu') {
    if (screens.current() === 'pause') resume();
    else if (!screens.current() || mode === 'online') openGameMenu();
  }
  if (mode !== 'bot' && mode !== 'local') return;
  if (e.code === 'KeyR' && state.phase === 'over') newRound();
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
          renderer.setFollow(touch.enabled ? online.myPid() : null);
          renderer.setViewers([online.myPid()]);
          renderer.reset(view);
          hud.clear();
          announceMap(view.map);
        }
        renderer.render(view, now / 1000);
        hud.update(view);
        touch.setSpecial(view.players[online.myPid()]?.special ?? null);
        sound.events(view.events, (id) => id === online.myPid());
        return;
      }
    }

    renderer.render(state, now / 1000);
    if (mode === 'bot' || mode === 'local') {
      if (!paused) hud.update(state);
      touch.setSpecial(state.players[0]?.special ?? null);
      sound.events(state.events, (id) => mode === 'local' || id === 0);
      if (state.phase === 'over' && !endShown) showOfflineEnd();
    }
    state.events.length = 0; // événements lus par l'affichage, l'interface et les sons
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
