// Écrans par-dessus le jeu : accueil, connexion, salon, fin de manche, podium, pause
import { PLAYER_COLORS } from '../render/colors.js';
import { ITEM_INFO, img, escapeHtml } from './hud.js';

const SCREENS = ['menu', 'connecting', 'lobby', 'round-end', 'podium', 'pause', 'end'];
const $ = (id) => document.getElementById(id);

export function createScreens() {
  const overlay = $('overlay');
  const title = $('result');
  const subtitle = $('subtitle');
  const nameInput = $('name');
  const codeInput = $('code');

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

  function show(name, { title: t = 'Kaboom Arena', sub = '', color = '' } = {}) {
    overlay.hidden = false;
    for (const id of SCREENS) $(id).hidden = id !== name;
    title.textContent = t;
    title.style.color = color;
    subtitle.textContent = sub;
  }

  const memberLine = (m, you, hostId, extra = '') => `<li>
      <span class="dot" style="background:${PLAYER_COLORS[m.color]}"></span>
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
    },
    current() {
      return overlay.hidden ? null : SCREENS.find((id) => !$(id).hidden);
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

    lobby(lobby, you) {
      show('lobby', { title: 'Salon', sub: 'Partage le code ou le lien à tes amis (2 à 4 joueurs)' });
      $('lobby-code').textContent = lobby.code;
      const rows = lobby.members.map((m) => memberLine(m, you, lobby.hostId));
      for (let i = lobby.members.length; i < 4; i++) rows.push('<li class="empty">Place libre</li>');
      $('lobby-players').innerHTML = rows.join('');
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
          <span class="dot" style="background:${PLAYER_COLORS[m.color]}"></span>
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
