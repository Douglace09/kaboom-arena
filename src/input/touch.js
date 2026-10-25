// Contrôles tactiles provisoires (croix + bouton bombe + petit bouton spécial),
// affichés seulement sur écran tactile. Le joystick virtuel arrivera à l'étape 5.
const VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function createTouch() {
  const enabled = window.matchMedia('(pointer: coarse)').matches;
  let dir = null;
  let bomb = false;
  let special = false;

  if (enabled) {
    const pad = document.createElement('div');
    pad.id = 'touch';
    pad.innerHTML = `
      <div class="dpad">
        <button data-dir="up" aria-label="Haut">▲</button>
        <button data-dir="left" aria-label="Gauche">◀</button>
        <button data-dir="right" aria-label="Droite">▶</button>
        <button data-dir="down" aria-label="Bas">▼</button>
      </div>
      <div class="actions">
        <button class="special-btn" aria-label="Action spéciale">SPÉCIAL</button>
        <button class="bomb-btn" aria-label="Poser une bombe">BOMBE</button>
      </div>`;
    document.body.appendChild(pad);

    pad.querySelectorAll('[data-dir]').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        dir = btn.dataset.dir;
      });
      const release = () => {
        if (dir === btn.dataset.dir) dir = null;
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    });
    pad.querySelector('.bomb-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      bomb = true;
    });
    pad.querySelector('.special-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      special = true;
    });
  }

  return {
    enabled,
    read() {
      const [dx, dy] = dir ? VECTORS[dir] : [0, 0];
      const out = { dx, dy, bomb, special };
      bomb = special = false;
      return out;
    },
  };
}
