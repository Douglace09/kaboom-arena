// Sons et musique avec Howler.js. Les fichiers sont dans public/sounds
// (générés par synthèse : aucun son externe, aucun droit à payer).
import { Howl, Howler } from 'howler';

const BASE = import.meta.env.BASE_URL + 'sounds/';
const SFX = {
  bomb: 0.55,
  explosion: 0.7,
  pickup: 0.5,
  skull: 0.5,
  death: 0.6,
  kick: 0.5,
  dash: 0.45,
  freeze: 0.5,
  shield: 0.55,
  detonate: 0.5,
  wall: 0.35,
  sudden: 0.5,
  win: 0.6,
  click: 0.4,
  lava: 0.55,
  rumble: 0.5,
  portal: 0.45,
  door: 0.35,
  swallow: 0.5,
  splash: 0.5,
  wave: 0.5,
};

// Musique de chaque carte (le menu et la carte Classique gardent la musique d'origine)
const MUSIC = {
  menu: 'music',
  classique: 'music',
  neon: 'music-neon',
  jungle: 'music-jungle',
  banquise: 'music-banquise',
  volcan: 'music-volcan',
  desert: 'music-desert',
  usine: 'music-usine',
  espace: 'music-espace',
  plage: 'music-plage',
  ville: 'music-ville',
};
const MUSIC_VOLUME = 0.32;

function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function createSound() {
  const sounds = {};
  for (const [name, volume] of Object.entries(SFX)) {
    sounds[name] = new Howl({ src: [`${BASE}${name}.mp3`], volume, preload: true });
  }
  const tracks = {}; // chargées seulement quand on en a besoin
  const track = (file) => (tracks[file] ||= new Howl({ src: [`${BASE}${file}.mp3`], loop: true, volume: 0 }));
  let muted = load('kaboom-muted') === '1';
  // Volumes réglables (0 à 1), gardés d'une visite à l'autre
  const level = (key) => {
    const v = Number(load(key));
    return load(key) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  };
  let musicLevel = level('kaboom-music');
  let sfxLevel = level('kaboom-sfx');
  let musicOn = false;
  let wanted = 'menu';
  let playing = null;

  // Fondu enchaîné d'une musique à l'autre
  function applyMusic() {
    if (!musicOn) return;
    const file = MUSIC[wanted] || 'music';
    if (playing === file) return;
    if (playing) {
      const old = track(playing);
      old.fade(old.volume(), 0, 600);
      setTimeout(() => old.volume() === 0 && old.pause(), 650);
    }
    const next = track(file);
    if (!next.playing()) next.play();
    next.fade(next.volume(), MUSIC_VOLUME * musicLevel, 800);
    playing = file;
  }
  Howler.mute(muted);

  // Évite qu'un même son se superpose trop (ex. 6 explosions en chaîne au même instant)
  const lastPlayed = {};
  function play(name, { rate = 1, volume } = {}) {
    const s = sounds[name];
    if (!s) return;
    const now = performance.now();
    if (now - (lastPlayed[name] || 0) < 45) return;
    lastPlayed[name] = now;
    if (sfxLevel <= 0) return;
    const id = s.play();
    s.rate(rate, id);
    s.volume((volume ?? SFX[name]) * sfxLevel, id);
  }

  return {
    play,
    get muted() {
      return muted;
    },
    get musicLevel() {
      return musicLevel;
    },
    get sfxLevel() {
      return sfxLevel;
    },
    // Volume de la musique (0 à 1)
    setMusicLevel(v) {
      musicLevel = v;
      store('kaboom-music', String(v));
      if (playing) {
        const t = track(playing);
        t.fade(t.volume(), MUSIC_VOLUME * v, 120);
      }
    },
    // Volume des bruitages (0 à 1)
    setSfxLevel(v) {
      sfxLevel = v;
      store('kaboom-sfx', String(v));
    },
    toggleMute() {
      muted = !muted;
      Howler.mute(muted);
      store('kaboom-muted', muted ? '1' : '0');
      return muted;
    },
    // La musique ne peut démarrer qu'après un clic ou une touche (règle des navigateurs)
    startMusic() {
      if (musicOn) return;
      musicOn = true;
      applyMusic();
    },
    // Choisit la musique : 'menu' ou l'identifiant d'une carte
    setMusic(id) {
      wanted = id;
      applyMusic();
    },
    // Joue les sons correspondant aux événements de la partie
    events(events, isMine) {
      for (const e of events) {
        switch (e.type) {
          case 'bomb':
            play('bomb', { rate: 0.95 + Math.random() * 0.1 });
            break;
          case 'explosion':
            play('explosion', { rate: 0.9 + Math.random() * 0.2 });
            break;
          case 'pickup':
            play(e.item === 'skull' ? 'skull' : 'pickup', { volume: isMine(e.id) ? SFX.pickup : SFX.pickup * 0.5 });
            break;
          case 'death':
            play('death');
            break;
          case 'kick':
            play('kick');
            break;
          case 'dash':
            play('dash');
            break;
          case 'freeze':
            play('freeze');
            break;
          case 'shield':
            play('shield');
            break;
          case 'detonate':
            play('detonate');
            break;
          case 'wall':
            play('wall', { rate: 0.9 + Math.random() * 0.2 });
            break;
          case 'sudden':
            play('sudden');
            break;
          case 'lava':
            play('lava', { rate: 0.9 + Math.random() * 0.2 });
            break;
          case 'lavaWarn':
            play('rumble');
            break;
          case 'portal':
            play('portal');
            break;
          case 'door':
            play('door');
            break;
          case 'swallow':
            play('swallow');
            break;
          case 'splash':
            play('splash', { rate: 0.9 + Math.random() * 0.2 });
            break;
          case 'wave':
            play('wave');
            break;
          case 'waveWarn':
            play('rumble', { rate: 1.4 });
            break;
        }
      }
    },
  };
}
