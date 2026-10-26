// Commandes tactiles (téléphone, tablette) :
// - joystick virtuel : pose le pouce n'importe où sur la moitié gauche de l'écran,
//   le joystick apparaît sous le doigt et suit ses mouvements ;
// - à droite, un gros bouton BOMBE et un petit bouton pour l'action spéciale.
// Le jeu se joue sur une grille : le joystick donne l'une des 4 directions.
import { iconCanvas } from '../render/icons.js';

const RADIUS = 52; // distance max du pouce par rapport au centre (px)
const DEAD = 14; // zone morte au centre (px)
const STICKY = 1.3; // l'autre axe doit être 30 % plus fort pour changer de direction (évite les tremblements)

export function createTouch() {
  const enabled = window.matchMedia('(pointer: coarse)').matches;
  let dx = 0;
  let dy = 0;
  let bomb = false;
  let special = false;
  let specialType = undefined;

  const vibrate = (ms) => {
    try {
      navigator.vibrate?.(ms);
    } catch {}
  };

  let specialBtn = null;
  if (enabled) {
    const pad = document.createElement('div');
    pad.id = 'touch';
    pad.innerHTML = `
      <div class="stick-zone" aria-label="Zone du joystick : pose ton pouce et glisse pour te déplacer">
        <div class="stick-base"><div class="stick-knob"></div></div>
      </div>
      <div class="actions">
        <button class="special-btn" aria-label="Action spéciale"></button>
        <button class="bomb-btn" aria-label="Poser une bombe">BOMBE</button>
      </div>`;
    document.body.appendChild(pad);

    const zone = pad.querySelector('.stick-zone');
    const base = pad.querySelector('.stick-base');
    const knob = pad.querySelector('.stick-knob');
    let pointer = null;
    let cx = 0;
    let cy = 0;

    // Position de repos du joystick (en bas à gauche), visible pour montrer où jouer
    function rest() {
      base.classList.remove('active');
      base.style.left = '';
      base.style.top = '';
      knob.style.transform = '';
      dx = dy = 0;
    }

    zone.addEventListener('pointerdown', (e) => {
      if (pointer !== null) return;
      e.preventDefault();
      pointer = e.pointerId;
      zone.setPointerCapture(pointer);
      const r = zone.getBoundingClientRect();
      // Le joystick apparaît sous le pouce, sans dépasser de l'écran
      cx = Math.min(Math.max(e.clientX, r.left + RADIUS + 14), r.right - RADIUS - 14);
      cy = Math.min(Math.max(e.clientY, r.top + RADIUS + 14), r.bottom - RADIUS - 14);
      base.style.left = `${cx - r.left}px`;
      base.style.top = `${cy - r.top}px`;
      base.classList.add('active');
      move(e);
    });

    function move(e) {
      if (e.pointerId !== pointer) return;
      let ox = e.clientX - cx;
      let oy = e.clientY - cy;
      const d = Math.hypot(ox, oy);
      if (d > RADIUS) {
        ox = (ox / d) * RADIUS;
        oy = (oy / d) * RADIUS;
      }
      knob.style.transform = `translate(${ox}px, ${oy}px)`;
      if (d < DEAD) {
        dx = dy = 0;
        return;
      }
      const ax = Math.abs(ox);
      const ay = Math.abs(oy);
      // On garde la direction actuelle tant que l'autre axe ne domine pas nettement
      const horizontal = dx !== 0 ? ax * STICKY >= ay : dy !== 0 ? ax >= ay * STICKY : ax >= ay;
      const nx = horizontal ? Math.sign(ox) : 0;
      const ny = horizontal ? 0 : Math.sign(oy);
      if (nx !== dx || ny !== dy) vibrate(6);
      dx = nx;
      dy = ny;
    }
    zone.addEventListener('pointermove', move);
    const end = (e) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      rest();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);

    const press = (btn, fn) =>
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        fn();
      });
    for (const btn of pad.querySelectorAll('.actions button')) {
      const up = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    }
    press(pad.querySelector('.bomb-btn'), () => {
      bomb = true;
      vibrate(15);
    });
    specialBtn = pad.querySelector('.special-btn');
    press(specialBtn, () => {
      special = true;
      vibrate(10);
    });
    // Empêche le zoom par double appui et le menu du long appui
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return {
    enabled,
    read() {
      const out = { dx, dy, bomb, special };
      bomb = special = false;
      return out;
    },
    // Affiche l'icône du bonus spécial du joueur (dash ou détonateur), ou grise le bouton
    setSpecial(type) {
      if (!specialBtn || type === specialType) return;
      specialType = type;
      specialBtn.classList.toggle('empty', !type);
      specialBtn.innerHTML = type ? `<img src="${iconCanvas(type, 64).toDataURL()}" alt="">` : '';
      specialBtn.setAttribute('aria-label', type === 'dash' ? 'Dash' : type === 'detonator' ? 'Détonateur' : 'Action spéciale (aucun bonus)');
    },
  };
}
