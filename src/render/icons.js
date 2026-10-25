// Icônes des bonus, dessinées au pinceau (canvas) : utilisées sur les bonus
// en 3D et dans l'interface. Formes simples, aucune image externe.
import { ITEM_COLORS } from './colors.js';

const cache = new Map();

export function iconCanvas(type, size = 128) {
  const key = type + size;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(size / 128, size / 128);

  // Fond arrondi
  g.fillStyle = ITEM_COLORS[type];
  roundRect(g, 4, 4, 120, 120, 26);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 5;
  g.stroke();

  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  DRAW[type](g);
  cache.set(key, c);
  return c;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function plus(g, x, y) {
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(x - 13, y); g.lineTo(x + 13, y);
  g.moveTo(x, y - 13); g.lineTo(x, y + 13);
  g.stroke();
}

function bombShape(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(x + r * 0.6, y - r * 0.7);
  g.quadraticCurveTo(x + r, y - r * 1.4, x + r * 1.4, y - r * 1.1);
  g.stroke();
}

function flameShape(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - 34 * s);
  g.bezierCurveTo(x + 30 * s, y - 6 * s, x + 26 * s, y + 30 * s, x, y + 30 * s);
  g.bezierCurveTo(x - 26 * s, y + 30 * s, x - 30 * s, y - 6 * s, x, y - 34 * s);
  g.fill();
}

const DRAW = {
  bomb(g) {
    bombShape(g, 52, 72, 26);
    plus(g, 96, 34);
  },
  flame(g) {
    flameShape(g, 54, 68, 1.1);
    plus(g, 96, 34);
  },
  speed(g) {
    g.beginPath();
    g.moveTo(36, 36); g.lineTo(62, 64); g.lineTo(36, 92);
    g.moveTo(66, 36); g.lineTo(92, 64); g.lineTo(66, 92);
    g.stroke();
  },
  shield(g) {
    g.beginPath();
    g.moveTo(64, 26);
    g.lineTo(98, 38);
    g.quadraticCurveTo(98, 86, 64, 104);
    g.quadraticCurveTo(30, 86, 30, 38);
    g.closePath();
    g.fill();
  },
  kick(g) {
    // une chaussure qui pousse une bombe
    g.beginPath();
    g.moveTo(22, 40); g.lineTo(44, 40); g.lineTo(46, 70); g.lineTo(66, 76);
    g.lineTo(66, 92); g.lineTo(22, 92); g.closePath();
    g.fill();
    bombShape(g, 92, 74, 17);
  },
  detonator(g) {
    // boîtier à poignée en T
    g.fillRect(34, 66, 60, 36);
    g.beginPath();
    g.moveTo(64, 66); g.lineTo(64, 38);
    g.moveTo(44, 34); g.lineTo(84, 34);
    g.stroke();
  },
  ice(g) {
    g.lineWidth = 8;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 38, 64 + Math.sin(a) * 38);
      g.lineTo(64 - Math.cos(a) * 38, 64 - Math.sin(a) * 38);
      g.stroke();
    }
  },
  dash(g) {
    g.beginPath();
    g.moveTo(74, 20); g.lineTo(38, 70); g.lineTo(62, 70);
    g.lineTo(52, 108); g.lineTo(92, 54); g.lineTo(66, 54); g.closePath();
    g.fill();
  },
  skull(g) {
    g.fillStyle = '#e9ddff';
    g.beginPath();
    g.arc(64, 58, 32, 0, Math.PI * 2);
    g.fill();
    g.fillRect(46, 80, 36, 22);
    g.fillStyle = '#2a2433';
    g.beginPath();
    g.arc(51, 58, 9, 0, Math.PI * 2);
    g.moveTo(86, 58);
    g.arc(77, 58, 9, 0, Math.PI * 2);
    g.fill();
    g.fillRect(55, 88, 5, 14);
    g.fillRect(68, 88, 5, 14);
  },
};
