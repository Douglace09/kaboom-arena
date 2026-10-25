// Écrans par-dessus le jeu : accueil, connexion, salon, fin de manche, podium, pause
import { PLAYER_COLORS } from '../render/colors.js';
import { SKINS } from '../game/skins.js';
import { ITEM_INFO, img, escapeHtml } from './hud.js';

const SCREENS = ['menu', 'connecting', 'lobby', 'round-end', 'podium', 'pause', 'end'];
const $ = (id) => document.getElementById(id);

export function createScreens({ portraits = {}, onSkin } = {}) {
  const overlay = $('overlay');
  const card = overlay.querySelector('.card');
  const title = $('result');
  const subtitle = $('subtitle');
  const nameInput = $('name');
  const codeInput = $('code');
  let current = null;

  // Légende des bonus
  $('legend').innerHTML = Object.entries(ITEM_INFO)
    .map(([type, [name, desc]]) => `<div class="legend-item">${img(type, 'legend-icon')}<div><b>${name}</b><span>${desc}</span></div></div>`)
    .join('');

  // Pseudo retenu d'une visite à l'autre (si le navigateur le permet)
  try {
    nameInput.value = localStorage.getItem('kaboom-name') || '';
  } catch {}
  nameInput.addEventListener('change', () => {
    try {
      localStorage.setItem('kaboom-name', nameInput.value.trim());
    } catch {}
  });
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '');
  });

  // Lien d'invitation : ?salon=ABCD pré-remplit le code
  const invited = new URLSearchParams(location.search).get('salon');
  if (invited) codeInput.value = invited.toUpperCase().slice(0, 4);

  // Sélecteur de personnage (accueil et salon)
  function renderPicker(el, selected) {
    el.innerHTML = SKINS.map(
      (s) => `<button type="button" class="skin ${s.id === selected ? 'on' : ''}" data-skin="${s.id}" aria-pressed="${s.id === selected}">
        ${portraits[s.id] ? `<img src="${portraits[s.id]}" alt="">` : '<span class="ph"></span>'}
        <b>${s.name}</b><small>${s.kind}</small>
      </button>`,
    ).join('');
  }
  for (const el of [$('skin-picker'), $('lobby-skins')]) {
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-skin]');
      if (btn) onSkin?.(btn.dataset.skin);
    });
  }

  function show(name, { title: t = 'Kaboom Arena', sub = '', color = '' } = {}) {
    const changed = overlay.hidden || current !== name;
    overlay.hidden = false;
    for (const id of SCREENS) $(id).hidden = id !== name;
    title.textContent = t;
    title.style.color = color;
    subtitle.textContent = sub;
    current = name;
    // Petite animation d'entrée quand on change d'écran
    if (changed) {
      card.classList.remove('enter');
      void card.offsetWidth;
      card.classList.add('enter');
    }
  }

  const avatar = (skin, color) =>
    portraits[skin]
      ? `<img class="avatar" src="${portraits[skin]}" alt="" style="border-color:${color}">`
      : `<span class="dot" style="background:${color}"></span>`;

  const memberLine = (m, you, hostId, extra = '') => `<li>
      ${avatar(m.skin, PLAYER_COLORS[m.color])}
      <span class="who">${escapeHtml(m.name)}${m.id === you ? ' <em>(toi)</em>' : ''}</span>
      ${m.id === hostId ? '<span class="tag">Hôte</span>' : ''}
      ${m.bot ? '<span class="tag">IA</span>' : ''}
      ${extra}
    </li>`;

  const winDots = (w, total) => {
    let s = '<span class="wins">';
    for (let i = 0; i < total; i++) s += `<i class="win ${i < w ? 'on' : ''}"></i>`;
    return s + '</span>';
  };

  return {
    show,
    hide() {
      overlay.hidden = true;
      current = null;
    },
    current() {
      return overlay.hidden ? null : current;
    },
    get name() {
      return nameInput.value.trim() || 'Joueur';
    },
    get code() {
      return codeInput.value.trim();
    },
    focusName() {
      nameInput.focus();
    },
    setMenuSkin(skin) {
      renderPicker($('skin-picker'), skin);
    },
    setSettings({ muted, high }) {
      $('toggle-sound').textContent = muted ? 'Son : coupé' : 'Son : activé';
      $('toggle-quality').textContent = high ? 'Graphismes : qualité haute' : 'Graphismes : qualité basse';
    },

    lobby(lobby, you) {
      show('lobby', { title: 'Salon', sub: 'Partage le code ou le lien à tes amis (2 à 4 joueurs)' });
      $('lobby-code').textContent = lobby.code;
      const rows = lobby.members.map((m) => memberLine(m, you, lobby.hostId));
      for (let i = lobby.members.length; i < 4; i++) rows.push('<li class="empty">Place libre</li>');
      $('lobby-players').innerHTML = rows.join('');
      const me = lobby.members.find((m) => m.id === you);
      renderPicker($('lobby-skins'), me?.skin);
      const isHost = lobby.hostId === you;
      $('host-controls').hidden = !isHost;
      $('lobby-wait').hidden = isHost;
      $('start').disabled = lobby.members.length < 2;
      $('start').textContent = lobby.members.length < 2 ? 'Il faut au moins 2 joueurs' : 'Lancer la partie';
      $('add-bot').disabled = lobby.members.length >= 4;
      $('remove-bot').disabled = !lobby.members.some((m) => m.bot);
    },

    roundEnd(lobby, you) {
      const w = lobby.members.find((m) => m.id === lobby.lastRoundWinner);
      show('round-end', {
        title: w ? `${w.name} gagne la manche ${lobby.round} !` : `Manche ${lobby.round} : égalité !`,
        color: w ? PLAYER_COLORS[w.color] : '',
        sub: `Premier à ${lobby.winsToMatch} manches`,
      });
      $('round-scores').innerHTML = [...lobby.members]
        .sort((a, b) => b.wins - a.wins)
        .map((m) => memberLine(m, you, null, winDots(m.wins, lobby.winsToMatch)))
        .join('');
    },

    podium(lobby, you) {
      const ranking = [...lobby.members].sort((a, b) => b.wins - a.wins);
      const champ = ranking[0];
      show('podium', {
        title: champ.id === you ? 'Tu remportes la partie !' : `${champ.name} remporte la partie !`,
        color: PLAYER_COLORS[champ.color],
      });
      const places = ['1er', '2e', '3e', '4e'];
      $('podium-list').innerHTML = ranking
        .map((m, i) => `<li class="place-${i + 1}">
          <span class="rank">${places[i]}</span>
          ${avatar(m.skin, PLAYER_COLORS[m.color])}
          <span class="who">${escapeHtml(m.name)}${m.id === you ? ' <em>(toi)</em>' : ''}</span>
          <span class="score">${m.wins} manche${m.wins > 1 ? 's' : ''}</span>
        </li>`)
        .join('');
      const isHost = lobby.hostId === you;
      $('rematch').hidden = !isHost;
      $('rematch-wait').hidden = isHost;
    },
  };
}
