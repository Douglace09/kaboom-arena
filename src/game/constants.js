// Réglages de la logique du jeu (aucun lien avec l'affichage)


export const TICK = 1 / 60; // la logique avance par pas fixes de 1/60 s

export const BOMB_TIMER = 2.5; // secondes avant l'explosion
export const FIRE_DURATION = 0.5; // durée de vie d'une flamme (s)
export const BASE_RANGE = 2; // portée d'explosion de départ (cases)
export const BASE_BOMBS = 1; // bombes posables en même temps au départ
export const BASE_SPEED = 3.5; // vitesse de départ (cases par seconde)
export const BLOCK_DENSITY = 0.7; // part des cases libres remplies de blocs
export const END_DELAY = 1.5; // délai avant d'annoncer le vainqueur (permet l'égalité)
export const SLOWMO = 0.35; // ralenti pendant ce délai, après la dernière élimination

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

// Cartes
export const BELT_SPEED = 2.2; // vitesse des tapis roulants (cases/s)
export const ICE_ACCEL = 7; // banquise : accélération (cases/s²)
export const ICE_FRICTION = 2.4; // banquise : ralentissement quand on lâche la touche
export const ICE_BRAKE = 10; // banquise : freinage quand on appuie dans l'autre sens
export const ICE_START = 1.4; // banquise : vitesse de départ
export const LAVA_FIRST = 12; // volcan : première éruption après 12 s
export const LAVA_EVERY = 7; // puis toutes les 7 s
export const LAVA_WARN = 1.6; // la case rougeoie 1,6 s avant de jaillir
export const LAVA_BURN = 0.9; // durée des flammes de lave
export const LAVA_COUNT = 4; // nombre de cases par éruption (augmente avec le temps)

export const SAND_SLOW = 0.55; // désert : vitesse dans les sables mouvants
export const WATER_SLOW = 0.5; // plage : vitesse dans une rangée inondée
export const WAVE_FIRST = 10; // plage : première vague après 10 s
export const WAVE_EVERY = 8; // puis toutes les 8 s
export const WAVE_WARN = 2; // la rangée scintille 2 s avant d'être inondée
export const WAVE_FLOOD = 3; // durée de l'inondation
export const DOOR_PERIOD = 5; // usine : les portes changent toutes les 5 s
export const HOLE_PULL = 2; // espace : portée d'aspiration des trous noirs (cases)
export const HOLE_SPEED = 3; // vitesse d'une bombe aspirée

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

