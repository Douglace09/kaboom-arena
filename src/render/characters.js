// Les 4 personnages et leurs bombes, construits en 3D directement dans le code
// (formes simples arrondies). Chaque personnage garde sa forme ; la couleur du
// joueur colore ses détails lumineux et ses bombes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ---------- Outils ----------

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, ...o });
const glow = (color, intensity = 2.5) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3 });

function mesh(geometry, material, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = shadow;
  return m;
}

const sphere = (r, w = 20, h = 14) => geo(`s${r}${w}`, () => new THREE.SphereGeometry(r, w, h));
const rbox = (x, y, z, r) => geo(`rb${x}${y}${z}${r}`, () => new RoundedBoxGeometry(x, y, z, 3, r));
const cyl = (rt, rb, h, seg = 12) => geo(`c${rt}${rb}${h}${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const torus = (r, t, seg = 32) => geo(`t${r}${t}${seg}`, () => new THREE.TorusGeometry(r, t, 10, seg));
const cone = (r, h, seg = 12) => geo(`co${r}${h}${seg}`, () => new THREE.ConeGeometry(r, h, seg));

// Yeux de créature : pupille noire + reflet blanc
function cuteEye(x, y, z, r = 0.055) {
  const g = new THREE.Group();
  g.add(mesh(sphere(r, 14, 10), std(0x15121c, { roughness: 0.2 }), { sz: 0.6, shadow: false }));
  g.add(mesh(sphere(r * 0.38, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), { x: r * 0.3, y: r * 0.35, z: r * 0.4, shadow: false }));
  g.position.set(x, y, z);
  return g;
}

// ---------- Personnages ----------

const BUILDERS = {
  // Robot costaud : écran-visage avec yeux LED, écrou sur la tête
  boulon(c) {
    const metal = std(0xa7b0c4, { metalness: 0.55, roughness: 0.35 });
    const dark = std(0x0b0f1a, { roughness: 0.25, metalness: 0.2 });
    const accent = glow(c, 2);
    const rig = new THREE.Group();
    const legL = mesh(rbox(0.12, 0.16, 0.14, 0.04), dark, { x: -0.11, y: 0.08 });
    const legR = mesh(rbox(0.12, 0.16, 0.14, 0.04), dark, { x: 0.11, y: 0.08 });
    const body = new THREE.Group();
    body.add(mesh(rbox(0.46, 0.34, 0.38, 0.08), metal, { y: 0.32 }));
    body.add(mesh(rbox(0.2, 0.1, 0.02, 0.01), accent, { y: 0.33, z: 0.195, shadow: false }));
    const armL = mesh(sphere(0.07), dark, { x: -0.29, y: 0.33 });
    const armR = mesh(sphere(0.07), dark, { x: 0.29, y: 0.33 });
    const head = new THREE.Group();
    head.position.y = 0.66;
    head.add(mesh(rbox(0.44, 0.32, 0.36, 0.09), metal));
    head.add(mesh(rbox(0.34, 0.2, 0.02, 0.02), dark, { z: 0.18, shadow: false }));
    const eyeL = mesh(rbox(0.07, 0.09, 0.02, 0.02), accent, { x: -0.08, z: 0.193, shadow: false });
    const eyeR = mesh(rbox(0.07, 0.09, 0.02, 0.02), accent, { x: 0.08, z: 0.193, shadow: false });
    head.add(eyeL, eyeR);
    head.add(mesh(cyl(0.07, 0.07, 0.06, 6), dark, { y: 0.19 }));
    head.add(mesh(cyl(0.045, 0.045, 0.05, 10), dark, { x: -0.24, rz: Math.PI / 2 }));
    head.add(mesh(cyl(0.045, 0.045, 0.05, 10), dark, { x: 0.24, rz: Math.PI / 2 }));
    body.add(armL, armR, head);
    rig.add(legL, legR, body);
    let blink = 0;
    return {
      rig,
      animate({ t, dt, moving, celebrate }) {
        const walk = moving ? Math.sin(t * 16) : 0;
        legL.rotation.x = walk * 0.6;
        legR.rotation.x = -walk * 0.6;
        armL.position.z = walk * 0.06;
        armR.position.z = -walk * 0.06;
        body.position.y = moving ? Math.abs(Math.sin(t * 16)) * 0.04 : Math.sin(t * 2) * 0.01;
        if (celebrate) {
          armL.position.y = armR.position.y = 0.45 + Math.abs(Math.sin(t * 10)) * 0.1;
        } else {
          armL.position.y = armR.position.y = 0.33;
        }
        blink -= dt;
        if (blink < -0.12) blink = 2 + Math.random() * 3;
        eyeL.scale.y = eyeR.scale.y = blink < 0 ? 0.15 : 1;
      },
    };
  },

  // Boule toute douce avec oreilles et joues colorées : elle rebondit en s'écrasant
  mochi(c) {
    const skin = std(0xfff1f4, { roughness: 0.65 });
    const accent = std(c, { emissive: c, emissiveIntensity: 0.6, roughness: 0.5 });
    const rig = new THREE.Group();
    const body = new THREE.Group();
    body.add(mesh(sphere(0.34, 28, 20), skin, { y: 0.31, sy: 0.88 }));
    body.add(mesh(cone(0.09, 0.18), accent, { x: -0.17, y: 0.6, rz: 0.4 }));
    body.add(mesh(cone(0.09, 0.18), accent, { x: 0.17, y: 0.6, rz: -0.4 }));
    body.add(cuteEye(-0.11, 0.36, 0.3), cuteEye(0.11, 0.36, 0.3));
    body.add(mesh(sphere(0.05, 12, 8), accent, { x: -0.2, y: 0.26, z: 0.25, sz: 0.4, shadow: false }));
    body.add(mesh(sphere(0.05, 12, 8), accent, { x: 0.2, y: 0.26, z: 0.25, sz: 0.4, shadow: false }));
    body.add(mesh(torus(0.03, 0.01, 12), std(0x3a2030), { y: 0.27, z: 0.32, rz: Math.PI, shadow: false }));
    const feetMat = std(0xf3d6de);
    const footL = mesh(sphere(0.07, 12, 8), feetMat, { x: -0.13, y: 0.04, z: 0.05, sy: 0.6 });
    const footR = mesh(sphere(0.07, 12, 8), feetMat, { x: 0.13, y: 0.04, z: 0.05, sy: 0.6 });
    rig.add(body, footL, footR);
    return {
      rig,
      animate({ t, moving, celebrate }) {
        const f = celebrate ? 9 : 12;
        const b = moving || celebrate ? Math.abs(Math.sin(t * f)) : (Math.sin(t * 2.5) + 1) * 0.15;
        body.position.y = b * (celebrate ? 0.25 : 0.08);
        const squash = 1 - (moving ? (1 - b) * 0.12 : b * 0.05);
        body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
        footL.position.z = moving ? Math.sin(t * f) * 0.06 + 0.05 : 0.05;
        footR.position.z = moving ? -Math.sin(t * f) * 0.06 + 0.05 : 0.05;
      },
    };
  },

  // Drone volant : un gros œil lumineux et un anneau qui tourne autour
  zap(c) {
    const shell = std(0x3a4160, { metalness: 0.6, roughness: 0.3 });
    const accent = glow(c, 1.6);
    const rig = new THREE.Group();
    const body = new THREE.Group();
    body.add(mesh(sphere(0.27, 28, 20), shell));
    body.add(mesh(torus(0.272, 0.03), accent, { rx: Math.PI / 2, shadow: false }));
    body.add(mesh(cyl(0.12, 0.12, 0.05, 24), std(0x0b0f1a, { roughness: 0.15 }), { z: 0.25, rx: Math.PI / 2, shadow: false }));
    const eye = mesh(cyl(0.085, 0.085, 0.02, 24), accent, { z: 0.28, rx: Math.PI / 2, shadow: false });
    const pupil = mesh(cyl(0.035, 0.035, 0.02, 16), std(0x05060a), { z: 0.292, rx: Math.PI / 2, shadow: false });
    body.add(eye, pupil);
    const orbit = mesh(torus(0.4, 0.014, 48), glow(c, 0.9), { shadow: false });
    const thruster = mesh(cone(0.08, 0.14, 12), glow(c, 1.8), { y: -0.3, rx: Math.PI, shadow: false });
    body.add(orbit, thruster);
    body.position.y = 0.52;
    rig.add(body);
    return {
      rig,
      animate({ t, moving, celebrate }) {
        body.position.y = 0.52 + Math.sin(t * 3) * 0.04 + (celebrate ? Math.abs(Math.sin(t * 8)) * 0.2 : 0);
        body.rotation.x = moving ? 0.25 : 0;
        body.rotation.z = Math.sin(t * 2) * 0.05;
        orbit.rotation.set(1.2 + Math.sin(t) * 0.2, t * (celebrate ? 8 : 2), 0.3);
        thruster.scale.y = 0.8 + Math.random() * 0.4 + (moving ? 0.4 : 0);
        pupil.position.x = Math.sin(t * 0.7) * 0.02;
      },
    };
  },

  // Petite pousse : corps de graine, deux feuilles sur la tête, écharpe colorée
  pepin(c) {
    const seed = std(0xc98a4b, { roughness: 0.7 });
    const leaf = std(0x6fd85c, { roughness: 0.55 });
    const accent = std(c, { emissive: c, emissiveIntensity: 0.7 });
    const rig = new THREE.Group();
    const body = new THREE.Group();
    body.add(mesh(sphere(0.3, 26, 18), seed, { y: 0.34, sy: 1.12 }));
    body.add(mesh(sphere(0.2, 20, 14), std(0xe9c08f, { roughness: 0.7 }), { y: 0.36, z: 0.14, sz: 0.6, shadow: false }));
    body.add(cuteEye(-0.08, 0.42, 0.27, 0.05), cuteEye(0.08, 0.42, 0.27, 0.05));
    body.add(mesh(torus(0.27, 0.045, 32), accent, { y: 0.17, rx: Math.PI / 2, sx: 1.02 }));
    const sprout = new THREE.Group();
    sprout.position.y = 0.66;
    sprout.add(mesh(cyl(0.018, 0.022, 0.12, 8), leaf, { y: 0.04 }));
    const leafL = mesh(sphere(0.09, 14, 10), leaf, { x: -0.08, y: 0.11, sx: 1.4, sy: 0.35, rz: 0.35 });
    const leafR = mesh(sphere(0.09, 14, 10), leaf, { x: 0.08, y: 0.11, sx: 1.4, sy: 0.35, rz: -0.35 });
    sprout.add(leafL, leafR);
    body.add(sprout);
    const feet = std(0x7a4b26);
    const footL = mesh(sphere(0.065, 12, 8), feet, { x: -0.11, y: 0.04, sy: 0.6 });
    const footR = mesh(sphere(0.065, 12, 8), feet, { x: 0.11, y: 0.04, sy: 0.6 });
    rig.add(body, footL, footR);
    return {
      rig,
      animate({ t, moving, celebrate }) {
        const w = moving ? Math.sin(t * 15) : 0;
        footL.position.z = w * 0.07;
        footR.position.z = -w * 0.07;
        body.rotation.z = w * 0.08;
        body.position.y = moving ? Math.abs(w) * 0.04 : 0;
        sprout.rotation.z = Math.sin(t * 3) * 0.12 + w * 0.15;
        if (celebrate) {
          body.position.y = Math.abs(Math.sin(t * 9)) * 0.22;
          sprout.rotation.y = t * 10;
        } else {
          sprout.rotation.y = 0;
        }
      },
    };
  },

  // Petit crocodile : long museau, yeux sur le dessus, crête colorée, queue qui balance
  croco(c) {
    const green = std(0x5cbf5a, { roughness: 0.6 });
    const belly = std(0xd9f0b0, { roughness: 0.7 });
    const accent = std(c, { emissive: c, emissiveIntensity: 0.6 });
    const rig = new THREE.Group();
    const body = new THREE.Group();
    body.add(mesh(sphere(0.3, 24, 16), green, { y: 0.3, sx: 0.95, sy: 0.85, sz: 1.15 }));
    body.add(mesh(sphere(0.22, 18, 12), belly, { y: 0.26, z: 0.12, sx: 1, sy: 0.8, sz: 0.7, shadow: false }));
    body.add(mesh(rbox(0.3, 0.14, 0.26, 0.06), green, { y: 0.4, z: 0.33 }));
    for (const x of [-0.07, 0.07]) body.add(mesh(sphere(0.012, 6, 4), std(0x1a2a14), { x, y: 0.47, z: 0.45, shadow: false }));
    for (const x of [-0.1, 0.1]) {
      body.add(mesh(sphere(0.075, 14, 10), green, { x, y: 0.53, z: 0.12 }));
      body.add(cuteEye(x, 0.56, 0.18, 0.045));
    }
    for (let k = 0; k < 3; k++) body.add(mesh(cone(0.045, 0.1, 6), accent, { y: 0.55 - k * 0.02, z: -0.05 - k * 0.12, rx: -0.3 }));
    const tail = mesh(cone(0.11, 0.36, 10), green, { y: 0.2, z: -0.42, rx: -Math.PI / 2 - 0.3 });
    body.add(tail);
    const feet = [[-0.17, 0.1], [0.17, 0.1], [-0.17, -0.15], [0.17, -0.15]].map(([x, z]) => mesh(sphere(0.06, 10, 8), green, { x, y: 0.04, z, sy: 0.6 }));
    rig.add(body, ...feet);
    return {
      rig,
      animate({ t, moving, celebrate }) {
        const w = moving ? Math.sin(t * 15) : 0;
        feet.forEach((f, i) => (f.position.y = 0.04 + Math.max(0, (i % 2 ? w : -w)) * 0.05));
        tail.rotation.z = Math.sin(t * (moving ? 12 : 3)) * 0.4;
        body.position.y = celebrate ? Math.abs(Math.sin(t * 9)) * 0.2 : moving ? Math.abs(w) * 0.03 : 0;
        body.rotation.z = celebrate ? Math.sin(t * 9) * 0.2 : 0;
      },
    };
  },

  // Petit astronaute : combinaison orange, visière dorée, sac à réacteurs
  nova(c) {
    const suit = std(0xff9a3c, { roughness: 0.55 });
    const white = std(0xf2f2f2, { roughness: 0.5 });
    const visor = std(0xd9a640, { metalness: 0.9, roughness: 0.15 });
    const accent = glow(c, 1.6);
    const rig = new THREE.Group();
    const legL = mesh(rbox(0.12, 0.16, 0.13, 0.04), suit, { x: -0.1, y: 0.08 });
    const legR = mesh(rbox(0.12, 0.16, 0.13, 0.04), suit, { x: 0.1, y: 0.08 });
    const body = new THREE.Group();
    body.add(mesh(rbox(0.38, 0.3, 0.3, 0.1), suit, { y: 0.3 }));
    body.add(mesh(rbox(0.16, 0.06, 0.02, 0.01), accent, { y: 0.32, z: 0.155, shadow: false }));
    body.add(mesh(rbox(0.26, 0.26, 0.12, 0.05), white, { y: 0.34, z: -0.2 }));
    for (const x of [-0.07, 0.07]) body.add(mesh(cyl(0.035, 0.045, 0.08, 10), accent, { x, y: 0.18, z: -0.22, shadow: false }));
    const head = new THREE.Group();
    head.position.y = 0.62;
    head.add(mesh(sphere(0.21, 26, 18), white));
    head.add(mesh(geo('visor', () => new THREE.SphereGeometry(0.19, 24, 14, -Math.PI / 2.4, Math.PI / 1.2, Math.PI / 3.2, Math.PI / 2.6)), visor, { z: 0.035, shadow: false }));
    head.add(mesh(torus(0.15, 0.02, 24), accent, { y: -0.17, rx: Math.PI / 2, shadow: false }));
    body.add(head);
    rig.add(legL, legR, body);
    return {
      rig,
      animate({ t, moving, celebrate }) {
        const w = moving ? Math.sin(t * 15) : 0;
        legL.rotation.x = w * 0.6;
        legR.rotation.x = -w * 0.6;
        body.position.y = celebrate ? Math.abs(Math.sin(t * 7)) * 0.3 : moving ? Math.abs(w) * 0.04 : Math.sin(t * 2) * 0.01;
        head.rotation.y = celebrate ? Math.sin(t * 8) * 0.5 : 0;
      },
    };
  },

  // Pingouin : ventre blanc, bec et pattes orange, écharpe colorée
  pingu(c) {
    const black = std(0x23283a, { roughness: 0.5 });
    const white = std(0xf7f7f7, { roughness: 0.6 });
    const orange = std(0xffa22e, { roughness: 0.5 });
    const accent = std(c, { emissive: c, emissiveIntensity: 0.6 });
    const rig = new THREE.Group();
    const body = new THREE.Group();
    body.add(mesh(sphere(0.29, 24, 18), black, { y: 0.36, sy: 1.25 }));
    body.add(mesh(sphere(0.23, 20, 14), white, { y: 0.32, z: 0.1, sy: 1.15, sz: 0.75, shadow: false }));
    body.add(cuteEye(-0.08, 0.55, 0.22, 0.045), cuteEye(0.08, 0.55, 0.22, 0.045));
    body.add(mesh(cone(0.05, 0.12, 8), orange, { y: 0.48, z: 0.29, rx: Math.PI / 2 }));
    body.add(mesh(torus(0.22, 0.045, 28), accent, { y: 0.44, rx: Math.PI / 2 }));
    const flipL = mesh(sphere(0.08, 12, 8), black, { x: -0.28, y: 0.36, sx: 0.4, sy: 1.4 });
    const flipR = mesh(sphere(0.08, 12, 8), black, { x: 0.28, y: 0.36, sx: 0.4, sy: 1.4 });
    body.add(flipL, flipR);
    const footL = mesh(sphere(0.07, 10, 8), orange, { x: -0.1, y: 0.03, z: 0.08, sy: 0.4 });
    const footR = mesh(sphere(0.07, 10, 8), orange, { x: 0.1, y: 0.03, z: 0.08, sy: 0.4 });
    rig.add(body, footL, footR);
    return {
      rig,
      animate({ t, moving, celebrate }) {
        const w = moving ? Math.sin(t * 16) : 0;
        body.rotation.z = w * 0.15; // se dandine
        footL.position.z = 0.08 + w * 0.05;
        footR.position.z = 0.08 - w * 0.05;
        const flap = celebrate ? Math.sin(t * 20) * 0.8 : moving ? 0.2 : 0;
        flipL.rotation.z = 0.2 + flap;
        flipR.rotation.z = -0.2 - flap;
        body.position.y = celebrate ? Math.abs(Math.sin(t * 9)) * 0.15 : 0;
      },
    };
  },

  // Bloub : créature en gelée translucide qui tremblote, des bulles à l'intérieur
  bloub(c) {
    const jelly = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, transparent: true, opacity: 0.78, roughness: 0.15 });
    const rig = new THREE.Group();
    const body = new THREE.Group();
    body.add(mesh(sphere(0.33, 28, 20), jelly, { y: 0.3, sy: 0.9 }));
    for (const [x, y, z, r] of [[-0.1, 0.22, 0.05, 0.05], [0.12, 0.35, -0.05, 0.04], [0.02, 0.15, -0.12, 0.035]]) {
      body.add(mesh(sphere(r, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }), { x, y, z, shadow: false }));
    }
    body.add(cuteEye(-0.1, 0.38, 0.28, 0.055), cuteEye(0.1, 0.38, 0.28, 0.055));
    body.add(mesh(torus(0.035, 0.012, 12), std(0x2a1430), { y: 0.27, z: 0.3, rz: Math.PI, shadow: false }));
    rig.add(body);
    return {
      rig,
      animate({ t, moving, celebrate }) {
        const f = celebrate ? 14 : moving ? 12 : 4;
        const a = celebrate ? 0.18 : moving ? 0.12 : 0.05;
        const k = Math.sin(t * f);
        body.scale.set(1 + k * a, 1 - k * a, 1 + k * a);
        body.position.y = celebrate ? Math.abs(Math.sin(t * 7)) * 0.2 : 0;
      },
    };
  },

  // Cactus rigolo : bras levés, fleur colorée sur la tête, petit pot
  cactus(c) {
    const green = std(0x3fa65a, { roughness: 0.65 });
    const pot = std(0xc2683d, { roughness: 0.8 });
    const accent = std(c, { emissive: c, emissiveIntensity: 0.6 });
    const rig = new THREE.Group();
    rig.add(mesh(cyl(0.2, 0.15, 0.18, 16), pot, { y: 0.09 }));
    const body = new THREE.Group();
    body.add(mesh(geo('cactusBody', () => new THREE.CapsuleGeometry(0.17, 0.3, 6, 16)), green, { y: 0.48 }));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      body.add(mesh(sphere(0.012, 4, 3), std(0xffffff), { x: Math.cos(a) * 0.17, y: 0.48 + ((k % 3) - 1) * 0.12, z: Math.sin(a) * 0.17, shadow: false }));
    }
    const armL = new THREE.Group();
    armL.position.set(-0.17, 0.45, 0);
    armL.add(mesh(cyl(0.06, 0.06, 0.14, 10), green, { x: -0.07, rz: Math.PI / 2 }), mesh(cyl(0.06, 0.06, 0.16, 10), green, { x: -0.13, y: 0.08 }));
    const armR = armL.clone();
    armR.position.x = 0.17;
    armR.scale.x = -1;
    body.add(armL, armR);
    body.add(cuteEye(-0.07, 0.56, 0.16, 0.045), cuteEye(0.07, 0.56, 0.16, 0.045));
    const flower = new THREE.Group();
    flower.position.y = 0.82;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      flower.add(mesh(sphere(0.055, 10, 8), accent, { x: Math.cos(a) * 0.07, z: Math.sin(a) * 0.07, sy: 0.4, shadow: false }));
    }
    flower.add(mesh(sphere(0.04, 10, 8), std(0xffe066), { y: 0.02, shadow: false }));
    body.add(flower);
    rig.add(body);
    return {
      rig,
      animate({ t, moving, celebrate }) {
        body.rotation.z = moving ? Math.sin(t * 14) * 0.1 : Math.sin(t * 2) * 0.03;
        armL.rotation.z = celebrate ? Math.sin(t * 12) * 0.5 : 0;
        armR.rotation.z = celebrate ? -Math.sin(t * 12) * 0.5 : 0;
        flower.rotation.y = t * (celebrate ? 8 : 1);
        rig.position.y = celebrate ? Math.abs(Math.sin(t * 8)) * 0.15 : moving ? Math.abs(Math.sin(t * 14)) * 0.03 : 0;
      },
    };
  },

  // Glouton : petit monstre tout rond à grande bouche, cornes colorées
  glouton(c) {
    const fur = std(0x8f6ad8, { roughness: 0.8 });
    const accent = std(c, { emissive: c, emissiveIntensity: 0.6 });
    const rig = new THREE.Group();
    const body = new THREE.Group();
    body.add(mesh(sphere(0.33, 26, 18), fur, { y: 0.33 }));
    const mouth = mesh(geo('mouth', () => new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), std(0x2a0f24), { y: 0.3, z: 0.2, sz: 0.5, shadow: false });
    body.add(mouth);
    for (let k = 0; k < 4; k++) body.add(mesh(cone(0.025, 0.06, 5), std(0xffffff), { x: -0.09 + k * 0.06, y: 0.27, z: 0.29, rx: Math.PI, shadow: false }));
    body.add(cuteEye(0, 0.5, 0.27, 0.075));
    body.add(mesh(cone(0.05, 0.14, 8), accent, { x: -0.16, y: 0.62, rz: 0.4 }), mesh(cone(0.05, 0.14, 8), accent, { x: 0.16, y: 0.62, rz: -0.4 }));
    const feet = [-0.13, 0.13].map((x) => mesh(sphere(0.07, 10, 8), fur, { x, y: 0.04, z: 0.06, sy: 0.6 }));
    rig.add(body, ...feet);
    return {
      rig,
      animate({ t, moving, celebrate }) {
        const w = moving ? Math.sin(t * 14) : 0;
        feet[0].position.z = 0.06 + w * 0.06;
        feet[1].position.z = 0.06 - w * 0.06;
        mouth.scale.y = 1 + (celebrate ? Math.abs(Math.sin(t * 12)) * 0.6 : Math.abs(Math.sin(t * 3)) * 0.15);
        body.position.y = celebrate ? Math.abs(Math.sin(t * 9)) * 0.22 : moving ? Math.abs(w) * 0.04 : 0;
      },
    };
  },
};

// Crée un personnage : { root, setColor..., update(info) }
export function createCharacter(skinId, colorHex) {
  const color = new THREE.Color(colorHex);
  const built = (BUILDERS[skinId] || BUILDERS.boulon)(color);
  const root = new THREE.Group();
  // Halo au sol à la couleur du joueur : on repère tout de suite qui est qui
  const halo = new THREE.Mesh(
    geo('halo', () => new THREE.RingGeometry(0.3, 0.42, 40)),
    new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6), transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.02;
  root.add(halo, built.rig);
  return { root, rig: built.rig, halo, animate: built.animate, color };
}

// ---------- Bombes ----------

// Texture rayée pour les bombes-bonbons
const stripeCache = new Map();
function stripeTexture(colorHex) {
  const key = colorHex;
  if (stripeCache.has(key)) return stripeCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff6f8';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = colorHex;
  for (let i = -64; i < 192; i += 24) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 12, 0);
    g.lineTo(i + 12 + 32, 64);
    g.lineTo(i + 32, 64);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  stripeCache.set(key, tex);
  return tex;
}

// Taches de l'œuf (Croco) et sucre (Glouton)
function spotTexture(colorHex) {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#f5efd8';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = colorHex;
  for (const [x, y, r] of [[14, 12, 7], [52, 30, 9], [90, 14, 6], [110, 44, 8], [30, 50, 6], [72, 54, 5]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let sugarTex = null;
function sugarTexture() {
  if (sugarTex) return sugarTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillStyle = '#d8d8d8';
  for (let k = 0; k < 60; k++) g.fillRect((k * 37) % 64, (k * 23) % 64, 2, 2);
  sugarTex = new THREE.CanvasTexture(cv);
  sugarTex.colorSpace = THREE.SRGBColorSpace;
  return sugarTex;
}

const bombMatCache = new Map();
function bombMats(skin, colorHex) {
  const key = skin + colorHex;
  if (bombMatCache.has(key)) return bombMatCache.get(key);
  const c = new THREE.Color(colorHex);
  const m = {
    boulon: { main: std(0x5d6677, { metalness: 0.8, roughness: 0.3 }), trim: std(0x353b47, { metalness: 0.7, roughness: 0.4 }), accent: glow(c, 2.6) },
    mochi: { main: std(0xffffff, { map: stripeTexture(colorHex), roughness: 0.25 }), trim: std(c, { roughness: 0.4, transparent: true, opacity: 0.9 }), accent: glow(c, 1.5) },
    zap: { main: std(0x1c2236, { metalness: 0.5, roughness: 0.15 }), trim: new THREE.LineBasicMaterial({ color: c.clone().multiplyScalar(1.8), toneMapped: false }), accent: glow(c, 2.2) },
    pepin: { main: std(0xb0703a, { roughness: 0.6 }), trim: std(0x5e3b1e, { roughness: 0.9 }), accent: glow(c, 2) },
    croco: { main: std(0xf5efd8, { map: spotTexture(colorHex), roughness: 0.5 }), trim: std(0xe0d6b8), accent: glow(c, 1.5) },
    nova: { main: std(c, { roughness: 0.45 }), trim: std(0xf2e2b0, { roughness: 0.4, metalness: 0.3 }), accent: glow(c, 1.5) },
    pingu: { main: new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.9, flatShading: true }), trim: std(c), accent: glow(c, 1.4) },
    bloub: { main: new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3, transparent: true, opacity: 0.55, roughness: 0.05 }), trim: std(0xffffff), accent: glow(c, 2) },
    cactus: { main: std(0x3fa65a, { roughness: 0.6 }), trim: std(c, { emissive: c, emissiveIntensity: 0.4 }), accent: glow(c, 1.5) },
    glouton: { main: std(c, { map: sugarTexture(), roughness: 0.85 }), trim: std(0xffffff), accent: glow(c, 1.4) },
  }[skin] || null;
  bombMatCache.set(key, m);
  return m;
}

const fuseMats = {
  normal: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(4), toneMapped: false }),
  detonator: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa070ff).multiplyScalar(4), toneMapped: false }),
};
const iceShell = new THREE.MeshStandardMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.45, roughness: 0.05, emissive: 0x3aa8ff, emissiveIntensity: 0.6 });

// Crée une bombe : { root, body, spark, sparkTip }
export function createBomb(skinId, colorHex, ice) {
  const skin = BUILDERS[skinId] ? skinId : 'boulon';
  const m = bombMats(skin, colorHex);
  const body = new THREE.Group();
  let tipY = 0.42;

  if (skin === 'boulon') {
    body.add(mesh(sphere(0.32, 24, 18), m.main));
    body.add(mesh(torus(0.322, 0.035, 40), m.trim, { rx: Math.PI / 2 }));
    body.add(mesh(torus(0.29, 0.02, 40), m.accent, { y: 0.12, rx: Math.PI / 2, shadow: false }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      body.add(mesh(sphere(0.028, 8, 6), m.trim, { x: Math.cos(a) * 0.33, z: Math.sin(a) * 0.33, shadow: false }));
    }
    body.add(mesh(cyl(0.06, 0.07, 0.08, 10), m.trim, { y: 0.33 }));
  } else if (skin === 'mochi') {
    body.add(mesh(sphere(0.3, 24, 18), m.main));
    body.add(mesh(cone(0.13, 0.2, 10), m.trim, { x: -0.38, rz: -Math.PI / 2 }));
    body.add(mesh(cone(0.13, 0.2, 10), m.trim, { x: 0.38, rz: Math.PI / 2 }));
    body.add(mesh(cyl(0.025, 0.025, 0.1, 6), std(0xeeeeee), { y: 0.33 }));
    tipY = 0.4;
  } else if (skin === 'zap') {
    body.add(mesh(rbox(0.44, 0.44, 0.44, 0.06), m.main));
    const edges = new THREE.LineSegments(geo('zapEdges', () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.47, 0.47, 0.47))), m.trim);
    body.add(edges);
    body.add(mesh(sphere(0.1, 16, 12), m.accent, { shadow: false }));
    body.add(mesh(cyl(0.02, 0.02, 0.14, 6), m.main, { y: 0.29 }));
    tipY = 0.38;
  } else if (skin === 'croco') {
    body.add(mesh(sphere(0.27, 24, 18), m.main, { y: 0.02, sy: 1.25 }));
    tipY = 0.42;
  } else if (skin === 'nova') {
    body.add(mesh(sphere(0.25, 24, 18), m.main));
    body.add(mesh(torus(0.38, 0.035, 40), m.trim, { rx: Math.PI / 2 + 0.4, rz: 0.2 }));
    body.add(mesh(cyl(0.02, 0.02, 0.12, 6), m.trim, { y: 0.29 }));
    tipY = 0.36;
  } else if (skin === 'pingu') {
    body.add(mesh(geo('snowball', () => new THREE.IcosahedronGeometry(0.3, 1)), m.main));
    body.add(mesh(torus(0.3, 0.025, 32), m.trim, { y: 0.06, rx: Math.PI / 2, shadow: false }));
    body.add(mesh(cyl(0.02, 0.02, 0.12, 6), m.trim, { y: 0.32 }));
    tipY = 0.39;
  } else if (skin === 'bloub') {
    body.add(mesh(sphere(0.31, 24, 18), m.main, { shadow: false }));
    body.add(mesh(sphere(0.12, 16, 12), m.accent, { shadow: false }));
    body.add(mesh(sphere(0.06, 8, 6), m.trim, { x: 0.12, y: 0.14, z: 0.18, shadow: false }));
    tipY = 0.36;
  } else if (skin === 'cactus') {
    body.add(mesh(sphere(0.24, 20, 14), m.main));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      body.add(mesh(sphere(0.12, 12, 8), m.trim, { x: Math.cos(a) * 0.2, y: 0.12, z: Math.sin(a) * 0.2, sy: 0.35, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 }));
    }
    body.add(mesh(sphere(0.07, 10, 8), std(0xffe066), { y: 0.2 }));
    tipY = 0.32;
  } else if (skin === 'glouton') {
    body.add(mesh(cyl(0.24, 0.3, 0.32, 20), m.main, { y: -0.08 }));
    body.add(mesh(sphere(0.24, 20, 12), m.main, { y: 0.08, sy: 0.7 }));
    body.add(mesh(cyl(0.02, 0.02, 0.12, 6), m.trim, { y: 0.26 }));
    tipY = 0.33;
  } else {
    body.add(mesh(sphere(0.29, 24, 18), m.main, { y: -0.03, sy: 1.12 }));
    body.add(mesh(geo('acornCap', () => new THREE.SphereGeometry(0.31, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), m.trim, { y: 0.06, sy: 0.75 }));
    body.add(mesh(cyl(0.03, 0.035, 0.12, 8), m.trim, { y: 0.32 }));
    body.add(mesh(torus(0.3, 0.012, 40), m.accent, { y: 0.07, rx: Math.PI / 2, shadow: false }));
    tipY = 0.41;
  }

  if (ice) body.add(mesh(sphere(0.38, 20, 14), iceShell, { shadow: false }));

  const spark = mesh(sphere(0.06, 10, 8), fuseMats.normal, { y: tipY, shadow: false });
  body.add(spark);
  const root = new THREE.Group();
  root.add(body);
  return { root, body, spark, tipY };
}

export function setFuse(bomb, detonator) {
  bomb.spark.material = detonator ? fuseMats.detonator : fuseMats.normal;
}

// ---------- Portraits (menus, salon, podium) ----------

// Rend chaque personnage dans une petite image, une seule fois au démarrage
export function renderPortraits(skins, colorOf, size = 160) {
  const out = {};
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  r.setSize(size, size);
  r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x332840, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  cam.position.set(0.9, 1.05, 2.1);
  cam.lookAt(0, 0.38, 0);
  for (const s of skins) {
    const ch = createCharacter(s.id, colorOf(s.id));
    ch.halo.visible = false;
    ch.root.rotation.y = 0.35;
    ch.animate({ t: 0.6, dt: 0, moving: false, celebrate: false });
    scene.add(ch.root);
    r.render(scene, cam);
    out[s.id] = r.domElement.toDataURL('image/png');
    scene.remove(ch.root);
  }
  r.dispose();
  r.forceContextLoss?.();
  return out;
}
