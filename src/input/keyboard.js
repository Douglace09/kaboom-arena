// Clavier.
// On utilise la position physique des touches : ZQSD sur clavier AZERTY = WASD sur QWERTY.
const LAYOUTS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: ['Space'], special: ['ShiftLeft', 'KeyE'] }, // J1 (E en plus : 5 appuis sur Maj ouvrent les « touches rémanentes » de Windows)
  {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    bomb: ['Enter', 'NumpadEnter'], special: ['ShiftRight', 'ControlRight'],
  }, // J2
];

const VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function createKeyboard() {
  const held = LAYOUTS.map(() => []); // directions maintenues, la plus récente en dernier
  const bombPressed = LAYOUTS.map(() => false);
  const specialPressed = LAYOUTS.map(() => false);
  let lastLayout = 0; // dernier jeu de touches utilisé (pour le mode solo)

  function dirOf(layout, code) {
    return ['up', 'down', 'left', 'right'].find((d) => layout[d] === code);
  }

  // On ignore les touches tapées dans un champ (pseudo, code du salon)
  const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    LAYOUTS.forEach((layout, i) => {
      const dir = dirOf(layout, e.code);
      if (dir) {
        e.preventDefault();
        if (!held[i].includes(dir)) held[i].push(dir);
        lastLayout = i;
      }
      if (layout.bomb.includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) bombPressed[i] = true;
      }
      if (layout.special.includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) specialPressed[i] = true;
      }
    });
  });

  window.addEventListener('keyup', (e) => {
    LAYOUTS.forEach((layout, i) => {
      const dir = dirOf(layout, e.code);
      if (dir) held[i] = held[i].filter((d) => d !== dir);
    });
  });

  // Fenêtre qui perd le focus : on relâche tout
  window.addEventListener('blur', () => held.forEach((h) => (h.length = 0)));

  function dirVector(i) {
    const dir = held[i][held[i].length - 1];
    return dir ? VECTORS[dir] : null;
  }
  // Autre direction tenue en même temps, perpendiculaire à la principale (ex. droite + haut)
  function altVector(i) {
    const main = dirVector(i);
    if (!main) return [0, 0];
    for (let k = held[i].length - 2; k >= 0; k--) {
      const v = VECTORS[held[i][k]];
      if ((v[0] !== 0) !== (main[0] !== 0)) return v;
    }
    return [0, 0];
  }

  return {
    // Commandes du joueur i pour ce pas de jeu ; les appuis « bombe » et « spécial » sont consommés
    read(i) {
      if (!LAYOUTS[i]) return { dx: 0, dy: 0, bomb: false, special: false };
      const [dx, dy] = dirVector(i) || [0, 0];
      const [ax, ay] = altVector(i);
      const bomb = bombPressed[i];
      const special = specialPressed[i];
      bombPressed[i] = specialPressed[i] = false;
      return { dx, dy, ax, ay, bomb, special };
    },
    // Mode solo : les deux jeux de touches pilotent le même joueur
    readAny() {
      const li = dirVector(lastLayout) ? lastLayout : 1 - lastLayout;
      const v = dirVector(li) || [0, 0];
      const a = altVector(li);
      const bomb = bombPressed[0] || bombPressed[1];
      const special = specialPressed[0] || specialPressed[1];
      bombPressed.fill(false);
      specialPressed.fill(false);
      return { dx: v[0], dy: v[1], ax: a[0], ay: a[1], bomb, special };
    },
  };
}
