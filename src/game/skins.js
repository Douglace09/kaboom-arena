// Les personnages jouables (partagé entre le navigateur et le serveur).
// Chaque personnage a son apparence et ses propres bombes ; le dessin est dans src/render/characters.js.
export const SKINS = [
  { id: 'boulon', name: 'Boulon', kind: 'Robot', desc: 'Robot costaud, bombes en métal riveté' },
  { id: 'mochi', name: 'Mochi', kind: 'Créature', desc: 'Boule toute douce, bombes-bonbons' },
  { id: 'zap', name: 'Zap', kind: 'Robot', desc: 'Drone volant, bombes cubes néon' },
  { id: 'pepin', name: 'Pépin', kind: 'Créature', desc: 'Petite pousse, bombes-glands' },
  { id: 'croco', name: 'Croco', kind: 'Créature', desc: 'Petit crocodile, bombes-œufs' },
  { id: 'nova', name: 'Nova', kind: 'Astronaute', desc: 'Petite astronaute, bombes-planètes' },
  { id: 'pingu', name: 'Pingu', kind: 'Créature', desc: 'Pingouin, bombes-boules de neige' },
  { id: 'bloub', name: 'Bloub', kind: 'Créature', desc: 'Gelée qui tremblote, bombes-bulles' },
  { id: 'cactus', name: 'Cactus', kind: 'Plante', desc: 'Cactus rigolo, bombes-fleurs' },
  { id: 'glouton', name: 'Glouton', kind: 'Monstre', desc: 'Petit monstre à grande bouche, bonbons acidulés' },
];

export const SKIN_IDS = SKINS.map((s) => s.id);
export const isSkin = (id) => SKIN_IDS.includes(id);
export const randomSkin = (avoid = []) => {
  const free = SKIN_IDS.filter((id) => !avoid.includes(id));
  const list = free.length ? free : SKIN_IDS;
  return list[Math.floor(Math.random() * list.length)];
};
