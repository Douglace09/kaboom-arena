// Les personnages jouables (partagé entre le navigateur et le serveur).
// Chaque personnage a son apparence et ses propres bombes ; le dessin est dans src/render/characters.js.
export const SKINS = [
  { id: 'boulon', name: 'Boulon', kind: 'Robot', desc: 'Robot costaud, bombes en métal riveté' },
  { id: 'mochi', name: 'Mochi', kind: 'Créature', desc: 'Boule toute douce, bombes-bonbons' },
  { id: 'zap', name: 'Zap', kind: 'Robot', desc: 'Drone volant, bombes cubes néon' },
  { id: 'pepin', name: 'Pépin', kind: 'Créature', desc: 'Petite pousse, bombes-glands' },
];

export const SKIN_IDS = SKINS.map((s) => s.id);
export const isSkin = (id) => SKIN_IDS.includes(id);
export const randomSkin = (avoid = []) => {
  const free = SKIN_IDS.filter((id) => !avoid.includes(id));
  const list = free.length ? free : SKIN_IDS;
  return list[Math.floor(Math.random() * list.length)];
};
