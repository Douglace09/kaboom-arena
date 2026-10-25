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
};

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
  const music = new Howl({ src: [`${BASE}music.mp3`], loop: true, volume: 0.32, html5: false });
  let muted = load('kaboom-muted') === '1';
  let musicOn = false;
  Howler.mute(muted);

  // Évite qu'un même son se superpose trop (ex. 6 explosions en chaîne au même instant)
  const lastPlayed = {};
  function play(name, { rate = 1, volume } = {}) {
    const s = sounds[name];
    if (!s) return;
    const now = performance.now();
    if (now - (lastPlayed[name] || 0) < 45) return;
    lastPlayed[name] = now;
    const id = s.play();
    s.rate(rate, id);
    if (volume !== undefined) s.volume(volume, id);
  }

  return {
    play,
    get muted() {
      return muted;
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
      music.play();
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
        }
      }
    },
  };
}
