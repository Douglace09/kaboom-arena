// Bandeau du haut pendant une manche : joueurs, bonus, manches gagnées, chrono, messages
import { PLAYER_COLORS } from '../render/colors.js';
import { iconCanvas } from '../render/icons.js';
import { SUDDEN_DEATH_AT } from '../game/constants.js';

export const ITEM_INFO = {
  bomb: ['Bombe +', 'Une bombe de plus en même temps'],
  flame: ['Flamme +', 'Explosion plus longue d’une case'],
  speed: ['Vitesse', 'Tu cours plus vite'],
  shield: ['Bouclier', 'Encaisse une explosion'],
  kick: ['Coup de pied', 'Avance contre une bombe pour la pousser'],
  detonator: ['Détonateur', 'Fais sauter tes bombes plus tôt avec Spécial'],
  ice: ['Bombes glacées', '3 bombes qui gèlent 2 s au lieu d’éliminer'],
  dash: ['Dash', 'Sprint éclair avec Spécial'],
  skull: ['Malus', 'Effet gênant pendant 10 s'],
};

const SKULL_NAMES = {
  inverse: 'commandes inversées',
  slow: 'lenteur',
  autobomb: 'bombes en rafale',
  nobomb: 'plus de bombes',
};

const urls = {};
const iconUrl = (type) => (urls[type] ??= iconCanvas(type, 64).toDataURL());
export const img = (type, cls = 'badge') => `<img class="${cls}" src="${iconUrl(type)}" alt="${ITEM_INFO[type][0]}">`;
export const colorOf = (p) => PLAYER_COLORS[p.color ?? p.id];
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function createHud() {
  const playersEl = document.getElementById('players');
  const help = document.getElementById('help');
  const timer = document.getElementById('timer');
  const toast = document.getElementById('toast');

  // Qui est qui : fourni par main.js selon le mode de jeu
  let ctx = {
    nameOf: (id) => `J${id + 1}`,
    isMine: () => true, // ce joueur est-il piloté sur cet appareil ?
    specialKey: () => 'E',
    wins: () => null, // manches gagnées (parties en ligne)
    winsToMatch: 3,
  };
  let last = '';
  let lastTimer = '';
  let toastTimeout = null;

  function showToast(html, color) {
    toast.innerHTML = html;
    toast.style.borderColor = color;
    toast.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => (toast.hidden = true), 1800);
  }

  function winDots(id) {
    const w = ctx.wins(id);
    if (w === null) return '';
    let dots = '';
    for (let i = 0; i < ctx.winsToMatch; i++) dots += `<i class="win ${i < w ? 'on' : ''}"></i>`;
    return `<span class="wins" title="${w} manche(s) gagnée(s)">${dots}</span>`;
  }

  function playerTag(p) {
    const badges = [];
    if (p.shield) badges.push(img('shield'));
    if (p.kick) badges.push(img('kick'));
    if (p.special) badges.push(img(p.special));
    if (p.iceBombs) badges.push(img('ice') + `<small>${p.iceBombs}</small>`);
    if (p.skull) badges.push(img('skull'));
    return `<div class="player-tag ${p.alive ? '' : 'dead'}">
      <span class="dot" style="background:${colorOf(p)}"></span>
      <span class="name">${escapeHtml(ctx.nameOf(p.id))}</span>
      ${winDots(p.id)}
      <span class="stats">${img('bomb')}${p.maxBombs} ${img('flame')}${p.range}</span>
      ${badges.join('')}
    </div>`;
  }

  return {
    setContext(c) {
      ctx = { ...ctx, ...c };
      last = '';
    },
    setHelp(text) {
      help.textContent = text;
    },
    clear() {
      playersEl.innerHTML = '';
      toast.hidden = true;
      last = '';
    },
    update(state) {
      // Chrono avant la mort subite
      const left = Math.max(0, Math.ceil(SUDDEN_DEATH_AT - state.time));
      const timerText = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'MORT SUBITE';
      if (timerText !== lastTimer) {
        lastTimer = timerText;
        timer.textContent = timerText;
        timer.classList.toggle('danger', left <= 10);
      }

      // Bonus ramassés
      for (const e of state.events) {
        if (e.type !== 'pickup') continue;
        const [name] = ITEM_INFO[e.item];
        const mine = ctx.isMine(e.id);
        let text = e.item === 'skull' ? `Malus : ${SKULL_NAMES[e.effect]}` : name;
        if (mine && e.item === 'detonator') text += ` : ${ctx.specialKey(e.id)} pour faire sauter tes bombes`;
        if (mine && e.item === 'dash') text += ` : ${ctx.specialKey(e.id)} pour sprinter`;
        const p = state.players[e.id];
        const who = mine && ctx.soloMine ? '' : `${escapeHtml(ctx.nameOf(e.id))} : `;
        showToast(`${img(e.item)}<span>${who}${text}</span>`, p ? colorOf(p) : '#fff');
      }

      // On ne réécrit le bandeau que si quelque chose a changé
      const key = state.players
        .map((p) => [p.alive, p.maxBombs, p.range, p.shield, p.kick, p.special, p.iceBombs, p.skull?.type, ctx.wins(p.id)].join())
        .join('|');
      if (key === last) return;
      last = key;
      playersEl.innerHTML = state.players.map(playerTag).join('');
    },
  };
}
