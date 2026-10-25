// Réglages de la logique du jeu (aucun lien avec l'affichage)

export const COLS = 15; // largeur de l'arène en cases
export const ROWS = 13; // hauteur de l'arène en cases

export const TICK = 1 / 60; // la logique avance par pas fixes de 1/60 s

export const BOMB_TIMER = 2.5; // secondes avant l'explosion
export const FIRE_DURATION = 0.5; // durée de vie d'une flamme (s)
export const BASE_RANGE = 2; // portée d'explosion de départ (cases)
export const BASE_BOMBS = 1; // bombes posables en même temps au départ
export const BASE_SPEED = 3.5; // vitesse de départ (cases par seconde)
export const BLOCK_DENSITY = 0.7; // part des cases libres remplies de blocs
export const END_DELAY = 1.0; // délai avant d'annoncer le vainqueur (permet l'égalité)

// Bonus
export const ITEM_CHANCE = 0.4; // chance qu'un bloc détruit laisse un bonus
export const MAX_BOMBS = 8;
export const MAX_RANGE = 8;
export const MAX_SPEED = 6;
export const SPEED_STEP = 0.5; // gain du bonus Vitesse (cases/s)
export const SLOW_SPEED = 2; // vitesse avec le malus « lenteur »
export const KICK_SPEED = 9; // vitesse d'une bombe poussée (cases/s)
export const FREEZE_TIME = 2; // durée du gel (bombe glacée)
export const ICE_BOMBS = 3; // nombre de bombes glacées par bonus
export const SHIELD_INVULN = 0.7; // invincibilité après avoir perdu le bouclier
export const DASH_TIME = 0.15; // durée du sprint
export const DASH_FACTOR = 3.2; // multiplicateur de vitesse pendant le sprint
export const DASH_COOLDOWN = 1.5; // attente entre deux sprints
export const SKULL_TIME = 10; // durée du malus

// Mort subite
export const SUDDEN_DEATH_AT = 120; // secondes avant le début du rétrécissement
export const SUDDEN_DEATH_STEP = 0.3; // une case se ferme toutes les 0,3 s

// Contenu d'une case
export const CELL = { EMPTY: 0, WALL: 1, BLOCK: 2, BURNING: 3 };

// Bonus et leur fréquence (plus le nombre est grand, plus le bonus est courant)
export const ITEM_WEIGHTS = [
  ['bomb', 20],
  ['flame', 20],
  ['speed', 12],
  ['shield', 7],
  ['kick', 8],
  ['detonator', 6],
  ['ice', 6],
  ['dash', 6],
  ['skull', 8],
];

// Effets possibles du malus (crâne)
export const SKULL_EFFECTS = ['inverse', 'slow', 'autobomb', 'nobomb'];

// Coins de départ : J1 en haut à gauche, J2 en bas à droite, puis J3, J4
export const SPAWNS = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: ROWS - 2 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
];
