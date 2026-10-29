// Commandes tactiles (téléphone, tablette) :
// - joystick virtuel : pose le pouce n'importe où sur la moitié gauche de l'écran,
//   le joystick apparaît sous le doigt ; si le pouce va plus loin que le bord du joystick,
//   le joystick le suit (changer de sens ne demande alors qu'un petit geste) ;
//   tenu en biais, il donne aussi une direction « de secours » : si la voie est bloquée,
//   le personnage tourne tout seul dans l'autre direction ;
// - à droite, un gros bouton BOMBE et un petit bouton pour l'action spéciale.
// Le jeu se joue sur une grille : le joystick donne l'une des 4 directions.
import { iconCanvas } from '../render/icons.js';

const RADIUS = 52; // distance max du pouce par rapport au centre (px)
const DEAD = 10; // zone morte au centre (px)
const STICKY = 1.25; // l'autre axe doit être 25 % plus fort pour changer de direction (évite les tremblements)
const ALT_RATIO = 0.3; // en biais à plus de ~17° : on donne aussi la direction de secours

export function createTouch() {
  const enabled = window.matchMedia('(pointer: coarse)').matches;
  let dx = 0;
  let dy = 0;
  let ax = 0;
  let ay = 0;
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
        <div class="stick-base">
          <i class="arrow up"></i><i class="arrow down"></i><i class="arrow left"></i><i class="arrow right"></i>
          <div class="stick-knob"></div>
        </div>
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
      dx = dy = ax = ay = 0;
      showDir();
    }
    // Flèche allumée = direction actuelle
    const arrows = { up: base.querySelector('.up'), down: base.querySelector('.down'), left: base.querySelector('.left'), right: base.querySelector('.right') };
    function showDir() {
      arrows.up.classList.toggle('on', dy < 0);
      arrows.down.classList.toggle('on', dy > 0);
      arrows.left.classList.toggle('on', dx < 0);
      arrows.right.classList.toggle('on', dx > 0);
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
        // Le pouce dépasse : le joystick le suit
        cx += ox - (ox / d) * RADIUS;
        cy += oy - (oy / d) * RADIUS;
        ox = (ox / d) * RADIUS;
        oy = (oy / d) * RADIUS;
        const r = zone.getBoundingClientRect();
        base.style.left = `${cx - r.left}px`;
        base.style.top = `${cy - r.top}px`;
      }
      knob.style.transform = `translate(${ox}px, ${oy}px)`;
      if (d < DEAD) {
        dx = dy = ax = ay = 0;
        showDir();
        return;
      }
      const absX = Math.abs(ox);
      const absY = Math.abs(oy);
      // On garde la direction actuelle tant que l'autre axe ne domine pas nettement
      const horizontal = dx !== 0 ? absX * STICKY >= absY : dy !== 0 ? absX >= absY * STICKY : absX >= absY;
      const nx = horizontal ? Math.sign(ox) : 0;
      const ny = horizontal ? 0 : Math.sign(oy);
      if (nx !== dx || ny !== dy) vibrate(6);
      dx = nx;
      dy = ny;
      // Direction de secours : l'axe secondaire, s'il est assez marqué
      ax = !horizontal && absX > absY * ALT_RATIO ? Math.sign(ox) : 0;
      ay = horizontal && absY > absX * ALT_RATIO ? Math.sign(oy) : 0;
      showDir();
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
      const out = { dx, dy, ax, ay, bomb, special };
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
