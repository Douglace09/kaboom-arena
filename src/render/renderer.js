// Affichage 3D « rendu 2026 » avec Three.js : arène néon, personnages, bombes, effets.
// Ne modifie jamais l'état du jeu : il se contente de le dessiner.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CELL, BOMB_TIMER, FIRE_DURATION, SLOWMO } from '../game/constants.js';
import { PLAYER_COLORS, ITEM_COLORS } from './colors.js';
import { iconCanvas } from './icons.js';
import { createCharacter, createBomb, setFuse } from './characters.js';
import { createEffects } from './effects.js';

const THEME = {
  background: 0x090b16,
  tileA: '#171c33',
  tileB: '#1b213c',
  line: 'rgba(90, 210, 255, 0.22)',
  border: 0x283055,
  pillar: 0x37406e,
  neon: 0x35e0ff,
  cap: 0x5b47d6,
};

const colorOf = (p) => PLAYER_COLORS[p.color ?? p.id];
const SKULL_HALO = new THREE.Color(0xb36bff).multiplyScalar(1.8);

// ---------- Textures dessinées au pinceau ----------

function floorTexture(cols, rows) {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cols * s;
  cv.height = rows * s;
  const g = cv.getContext('2d');
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y) % 2 ? THEME.tileA : THEME.tileB;
      g.fillRect(x * s, y * s, s, s);
    }
  }
  g.strokeStyle = THEME.line;
  g.lineWidth = 2;
  for (let x = 0; x <= cols; x++) {
    g.beginPath();
    g.moveTo(x * s, 0);
    g.lineTo(x * s, rows * s);
    g.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    g.beginPath();
    g.moveTo(0, y * s);
    g.lineTo(cols * s, y * s);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function crateTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#d98b42';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(120, 60, 20, 0.35)';
  for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 3); // planches
  g.strokeStyle = '#8c4f22';
  g.lineWidth = 14;
  g.strokeRect(7, 7, 114, 114); // cadre
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(14, 114);
  g.lineTo(114, 14); // traverse
  g.stroke();
  g.fillStyle = '#5a3216';
  for (const [x, y] of [[12, 12], [116, 12], [12, 116], [116, 116]]) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill(); // clous
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function gridTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#0b0e1c';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(80, 120, 255, 0.16)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 30);
  return tex;
}

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(THEME.background);
  scene.fog = new THREE.Fog(THEME.background, 22, 46);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const cameraBase = new THREE.Vector3();
  const lookBase = new THREE.Vector3();

  // Lumières : ciel froid, soleil chaud avec ombres, contre-jour violet
  scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x2a1d40, 1.25));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x8a6bff, 1.1);
  scene.add(rim, rim.target);

  // Halo lumineux (qualité haute)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.6, 0.5, 1.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const effects = createEffects(scene);

  // Sol extérieur infini (décor)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);

  // Géométries et matériaux partagés
  const wallGeo = new RoundedBoxGeometry(0.98, 1, 0.98, 2, 0.1);
  const crateGeo = new RoundedBoxGeometry(0.84, 0.84, 0.84, 2, 0.07);
  const capGeo = new RoundedBoxGeometry(0.34, 0.03, 0.34, 1, 0.012);
  const flameGeo = new RoundedBoxGeometry(0.92, 0.7, 0.92, 2, 0.3);
  const itemGeo = new RoundedBoxGeometry(0.62, 0.12, 0.62, 2, 0.05);
  const discGeo = new THREE.CircleGeometry(0.42, 32);
  const bubbleGeo = new THREE.SphereGeometry(0.5, 24, 16);
  const cubeGeo = new RoundedBoxGeometry(0.78, 1, 0.78, 2, 0.08);
  const mat = {
    wall: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.35 }),
    sudden: new THREE.MeshStandardMaterial({ color: 0x6e2f58, roughness: 0.45, metalness: 0.3, emissive: 0xff3d8b, emissiveIntensity: 0.25 }),
    cap: new THREE.MeshStandardMaterial({ color: THEME.cap, emissive: THEME.cap, emissiveIntensity: 1.25 }),
    neon: new THREE.MeshBasicMaterial({ color: new THREE.Color(THEME.neon).multiplyScalar(2.2), toneMapped: false }),
    crate: new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.75 }),
    burning: new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff4a00, emissiveIntensity: 2.2 }),
    fire: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a14).multiplyScalar(1.15), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    fireCore: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb347).multiplyScalar(1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    iceFire: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4fb8ff).multiplyScalar(1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    itemSide: new THREE.MeshStandardMaterial({ color: 0x252b48, roughness: 0.4 }),
    bubble: new THREE.MeshStandardMaterial({ color: 0x7dff6b, emissive: 0x3fdf4a, emissiveIntensity: 0.8, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }),
    ice: new THREE.MeshStandardMaterial({ color: 0xbfefff, transparent: true, opacity: 0.5, roughness: 0.05, emissive: 0x3aa8ff, emissiveIntensity: 0.4 }),
  };

  // Matériaux des bonus : le dessus porte l'icône
  const itemMats = {};
  function itemMaterial(type) {
    if (!itemMats[type]) {
      const tex = new THREE.CanvasTexture(iconCanvas(type));
      tex.colorSpace = THREE.SRGBColorSpace;
      const top = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5 });
      const disc = new THREE.MeshBasicMaterial({
        color: new THREE.Color(ITEM_COLORS[type]).multiplyScalar(1.8), transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      });
      itemMats[type] = { faces: [mat.itemSide, mat.itemSide, top, mat.itemSide, mat.itemSide, mat.itemSide], disc };
    }
    return itemMats[type];
  }

  let board = null; // groupe contenant toute l'arène de la manche en cours
  let cols = 15;
  let rows = 13;
  let blocks = new Map(); // index de case -> mesh
  let walls = new Set(); // cases murées (pour repérer les murs de la mort subite)
  let falling = [];
  let players = [];
  const bombs = new Map(); // id de bombe -> objet
  const fires = new Map(); // "x,y" -> mesh
  const items = new Map(); // "x,y,type" -> groupe
  let shake = 0;
  let lastT = 0;
  let animT = 0; // horloge des animations (ralentie pendant le ralenti final)
  let focus = 0; // zoom sur le gagnant en fin de manche
  const focusPoint = new THREE.Vector3();
  let high = true;

  // ---------- Qualité ----------

  function setQuality(isHigh) {
    high = isHigh;
    renderer.setPixelRatio(isHigh ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.25));
    renderer.shadowMap.enabled = isHigh;
    sun.castShadow = isHigh;
    scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
    effects.setQuality(isHigh);
    resize();
  }

  // ---------- Construction de l'arène ----------

  function reset(state) {
    if (board) scene.remove(board);
    board = new THREE.Group();
    scene.add(board);
    cols = state.cols;
    rows = state.rows;
    blocks = new Map();
    walls = new Set();
    falling = [];
    bombs.clear();
    fires.clear();
    items.clear();
    effects.clear();
    focus = 0;

    // Sol de l'arène
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(cols, rows),
      new THREE.MeshStandardMaterial({ map: floorTexture(cols, rows), roughness: 0.55, metalness: 0.2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((cols - 1) / 2, 0, (rows - 1) / 2);
    floor.receiveShadow = true;
    board.add(floor);

    // Murs fixes : un seul objet « instancié » pour tous (rapide)
    const wallCells = [];
    state.cells.forEach((c, i) => c === CELL.WALL && wallCells.push(i));
    const wallMesh = new THREE.InstancedMesh(wallGeo, mat.wall, wallCells.length);
    const pillarCaps = [];
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    wallCells.forEach((i, k) => {
      const x = i % cols;
      const y = Math.floor(i / cols);
      walls.add(i);
      const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      m4.makeTranslation(x, 0.5, y);
      wallMesh.setMatrixAt(k, m4);
      wallMesh.setColorAt(k, col.set(border ? THEME.border : THEME.pillar));
      if (!border) pillarCaps.push([x, y]);
    });
    wallMesh.castShadow = wallMesh.receiveShadow = true;
    board.add(wallMesh);

    // Petites plaques lumineuses sur les piliers
    const caps = new THREE.InstancedMesh(capGeo, mat.cap, pillarCaps.length);
    pillarCaps.forEach(([x, y], k) => caps.setMatrixAt(k, m4.makeTranslation(x, 1.01, y)));
    board.add(caps);

    // Liseré néon au pied des murs extérieurs
    const strip = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), mat.neon);
      m.position.set(x, 0.015, z);
      board.add(m);
    };
    const inner = { x0: 0.5, x1: cols - 1.5, z0: 0.5, z1: rows - 1.5 };
    strip(cols - 2, 0.04, (cols - 1) / 2, inner.z0);
    strip(cols - 2, 0.04, (cols - 1) / 2, inner.z1);
    strip(0.04, rows - 2, inner.x0, (rows - 1) / 2);
    strip(0.04, rows - 2, inner.x1, (rows - 1) / 2);

    // Caisses destructibles
    state.cells.forEach((c, i) => {
      if (c !== CELL.BLOCK) return;
      const block = new THREE.Mesh(crateGeo, mat.crate);
      block.position.set(i % cols, 0.42, Math.floor(i / cols));
      block.rotation.y = (Math.random() - 0.5) * 0.12;
      block.castShadow = block.receiveShadow = true;
      board.add(block);
      blocks.set(i, block);
    });

    // Personnages
    players = state.players.map((p) => {
      const ch = createCharacter(p.skin, colorOf(p));
      ch.rig.scale.setScalar(1.15);
      const bubble = new THREE.Mesh(bubbleGeo, mat.bubble);
      bubble.position.y = 0.42;
      const ice = new THREE.Mesh(cubeGeo, mat.ice);
      ice.position.y = 0.5;
      ch.root.add(bubble, ice);
      board.add(ch.root);
      return { ...ch, bubble, ice, angle: 0, deathT: 0, deathFx: false, haloColor: ch.halo.material.color.clone() };
    });

    const cx = (cols - 1) / 2;
    const cz = (rows - 1) / 2;
    sun.position.set(cx - 6, 18, cz - 3);
    sun.target.position.set(cx, 0, cz);
    rim.position.set(cx + 8, 6, cz - 10);
    rim.target.position.set(cx, 0, cz);
    resize();
  }

  // ---------- Caméra : l'arène entière reste visible quelle que soit la taille d'écran ----------

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    effects.setScale(h * renderer.getPixelRatio(), camera.fov);

    const tilt = THREE.MathUtils.degToRad(62); // inclinaison de la vue
    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const needH = rows * Math.sin(tilt) + 3; // marge pour le bandeau du haut
    const needW = cols + 1.5;
    const dist = Math.max(needH / 2 / Math.tan(halfFov), needW / 2 / (Math.tan(halfFov) * camera.aspect));
    const cx = (cols - 1) / 2;
    const cz = (rows - 1) / 2 + 0.3;
    cameraBase.set(cx, Math.sin(tilt) * dist, cz + Math.cos(tilt) * dist);
    lookBase.set(cx, 0, cz);
    // Le brouillard suit la distance de la caméra (sur un téléphone en hauteur, elle recule beaucoup)
    scene.fog.near = dist * 1.05;
    scene.fog.far = dist * 2.2;
    camera.position.copy(cameraBase);
    camera.lookAt(lookBase);
  }
  window.addEventListener('resize', resize);

  // Synchronise une collection d'objets 3D avec une liste de l'état (création / suppression)
  function sync(map, list, keyOf, create, update, remove) {
    const seen = new Set();
    for (const it of list) {
      const key = keyOf(it);
      seen.add(key);
      let obj = map.get(key);
      if (!obj) {
        obj = create(it);
        board.add(obj.root || obj);
        map.set(key, obj);
      }
      update(obj, it);
    }
    for (const [key, obj] of map) {
      if (!seen.has(key)) {
        if (remove) remove(obj);
        board.remove(obj.root || obj);
        map.delete(key);
      }
    }
  }

  // ---------- Image par image ----------

  function render(state, t) {
    const dt = Math.min(t - lastT, 0.1);
    lastT = t;
    const slow = state.endTimer != null && state.phase !== 'over' ? SLOWMO : 1;
    const gdt = dt * slow;
    animT += gdt;

    // Événements de la partie -> effets
    for (const e of state.events) {
      if (e.type === 'explosion') {
        effects.explosion(e.x, e.y, e.ice);
        shake = Math.min(shake + 0.14, 0.35);
      } else if (e.type === 'death') {
        const p = state.players[e.id];
        if (p) effects.death(p.x, p.y, colorOf(p));
      } else if (e.type === 'pickup') {
        const p = state.players[e.id];
        if (p) effects.pickup(p.x, p.y, ITEM_COLORS[e.item]);
      } else if (e.type === 'wall') {
        effects.dust(e.x, e.y);
      }
    }

    // Caisses : quand elles brûlent, elles s'embrasent, rétrécissent et volent en éclats
    for (const [i, mesh] of blocks) {
      const c = state.cells[i];
      if (c === CELL.BURNING) {
        if (mesh.material !== mat.burning) {
          mesh.material = mat.burning;
          effects.debris(mesh.position.x, mesh.position.z);
        }
        mesh.scale.multiplyScalar(Math.exp(-gdt * 5));
        mesh.position.y += gdt * 0.4;
      } else if (c !== CELL.BLOCK) {
        board.remove(mesh);
        blocks.delete(i);
      }
    }

    // Murs de la mort subite : tombent du ciel
    state.cells.forEach((c, i) => {
      if (c === CELL.WALL && !walls.has(i)) {
        walls.add(i);
        const wall = new THREE.Mesh(wallGeo, mat.sudden);
        wall.position.set(i % cols, 7, Math.floor(i / cols));
        wall.castShadow = wall.receiveShadow = true;
        board.add(wall);
        falling.push(wall);
      }
    });
    falling = falling.filter((wall) => {
      wall.position.y = Math.max(0.5, wall.position.y - dt * 32);
      if (wall.position.y === 0.5) shake = Math.min(shake + 0.03, 0.35);
      return wall.position.y > 0.5;
    });

    // Personnages
    const alive = state.players.filter((p) => p.alive);
    const ending = state.endTimer != null || state.phase === 'over';
    let winner = null;
    state.players.forEach((p, i) => {
      const v = players[i];
      if (!v) return;
      v.root.position.set(p.x, 0, p.y);
      // Rotation douce vers la direction du regard
      const target = Math.atan2(p.faceX, p.faceY);
      let diff = target - v.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      v.angle += diff * Math.min(1, dt * 14);
      v.rig.rotation.y = v.angle;
      const celebrate = p.alive && ending && alive.length === 1;
      if (celebrate) winner = p;
      v.bubble.visible = p.alive && p.shield;
      v.ice.visible = p.alive && p.frozen > 0;
      if (p.alive) {
        v.animate({ t: animT, dt: gdt, moving: p.moving && !(p.frozen > 0), celebrate });
        if (celebrate) v.rig.rotation.y = v.angle + animT * 6;
        v.rig.scale.set(1.15, 1.15, p.dashTimer > 0 ? 1.5 : 1.15);
        if (p.dashTimer > 0) effects.trail(p.x, p.y, colorOf(p));
        v.bubble.rotation.y = animT * 1.5;
        v.bubble.scale.setScalar(1 + Math.sin(animT * 6) * 0.03);
        // Malus : halo violet clignotant ; invincible : le personnage clignote
        v.halo.material.color.copy(p.skull && Math.sin(animT * 14) > 0 ? SKULL_HALO : v.haloColor);
        v.root.visible = !(p.invuln > 0 && Math.sin(t * 40) > 0);
        v.root.scale.setScalar(1);
      } else {
        v.deathT += gdt;
        const s = Math.max(0, 1 - v.deathT * 2.2);
        v.root.scale.set(s * (1 + v.deathT), s, s * (1 + v.deathT));
        v.rig.rotation.y += v.deathT * 25;
        v.root.visible = s > 0;
      }
    });

    // Bombes : apparaissent avec un petit rebond, pulsent de plus en plus vite, glissent quand on les pousse
    sync(
      bombs,
      state.bombs,
      (b) => b.id,
      (b) => {
        const owner = state.players[b.owner];
        const obj = createBomb(owner?.skin, owner ? colorOf(owner) : '#ffffff', b.ice);
        obj.born = animT;
        return obj;
      },
      (obj, b) => {
        const k = b.slide ? b.slide.progress : 0;
        const x = b.x + (b.slide ? b.slide.dx * k : 0);
        const z = b.y + (b.slide ? b.slide.dy * k : 0);
        obj.root.position.set(x, 0.34, z);
        const owner = state.players[b.owner];
        const det = !!owner && owner.special === 'detonator';
        setFuse(obj, det);
        const urgency = 1 - Math.max(0, b.timer) / BOMB_TIMER;
        const age = animT - obj.born;
        const pop = age < 0.25 ? 0.6 + Math.sin((age / 0.25) * Math.PI) * 0.25 + (age / 0.25) * 0.4 : 1;
        const pulse = 1 + Math.sin(animT * (6 + urgency * 20)) * (0.04 + urgency * 0.1);
        obj.body.scale.setScalar(pop * pulse);
        if (b.slide) {
          obj.body.rotation.x += gdt * 10 * b.slide.dy;
          obj.body.rotation.z -= gdt * 10 * b.slide.dx;
        }
        obj.spark.scale.setScalar(0.8 + Math.random() * 0.6);
        effects.fuse(x, 0.34 + obj.tipY, z, det);
      },
    );

    // Flammes : blocs d'énergie lumineux + braises
    sync(
      fires,
      state.fires,
      (f) => f.x + ',' + f.y,
      (f) => {
        const g = new THREE.Group();
        const outer = new THREE.Mesh(flameGeo, f.ice ? mat.iceFire : mat.fire);
        const core = new THREE.Mesh(flameGeo, f.ice ? mat.iceFire : mat.fireCore);
        core.scale.setScalar(0.55);
        g.add(outer, core);
        g.position.set(f.x, 0.35, f.y);
        g.userData = { outer, core };
        return g;
      },
      (g, f) => {
        const k = Math.max(0, f.timer / FIRE_DURATION);
        const flicker = 1 + Math.sin(animT * 40 + f.x * 3 + f.y * 7) * 0.05;
        g.scale.set((0.55 + 0.45 * k) * flicker, 0.25 + 0.75 * k, (0.55 + 0.45 * k) * flicker);
        g.userData.outer.material = f.ice ? mat.iceFire : mat.fire;
        g.userData.core.material = f.ice ? mat.iceFire : mat.fireCore;
        effects.flame(f.x, f.y, f.ice, k);
      },
    );
    mat.fire.opacity = 0.6;
    mat.fireCore.opacity = 0.75;
    mat.iceFire.opacity = 0.6;

    // Bonus au sol : tuile flottante avec un halo coloré dessous
    sync(
      items,
      state.items,
      (it) => it.x + ',' + it.y + it.type,
      (it) => {
        const m = itemMaterial(it.type);
        const g = new THREE.Group();
        const tile = new THREE.Mesh(itemGeo, m.faces);
        tile.castShadow = true;
        const disc = new THREE.Mesh(discGeo, m.disc);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0.03;
        g.add(tile, disc);
        g.position.set(it.x, 0, it.y);
        g.scale.setScalar(0.01);
        g.userData = { tile, disc };
        return g;
      },
      (g, it) => {
        g.scale.setScalar(Math.min(1, g.scale.x + gdt * 5));
        const ph = animT * 3 + it.x + it.y;
        g.userData.tile.position.y = 0.3 + Math.sin(ph) * 0.06;
        g.userData.tile.rotation.y = Math.sin(ph * 0.5) * 0.4;
        g.userData.disc.scale.setScalar(0.85 + Math.sin(ph) * 0.1);
      },
    );

    effects.update(gdt);

    // Caméra : léger tremblement, zoom sur le gagnant en fin de manche
    focus += ((winner ? 1 : 0) - focus) * Math.min(1, dt * 3);
    if (winner) focusPoint.set(winner.x, 0, winner.y);
    shake = Math.max(0, shake - dt * 1.3);
    const zoom = focus * 0.32;
    camera.position.set(
      cameraBase.x + (focusPoint.x - lookBase.x) * zoom + (Math.random() - 0.5) * shake,
      cameraBase.y * (1 - zoom * 0.9) + (Math.random() - 0.5) * shake,
      cameraBase.z + (focusPoint.z - lookBase.z) * zoom - (cameraBase.z - lookBase.z) * zoom * 0.5 + (Math.random() - 0.5) * shake,
    );
    camera.lookAt(lookBase.x + (focusPoint.x - lookBase.x) * focus * 0.6, 0, lookBase.z + (focusPoint.z - lookBase.z) * focus * 0.6);

    if (high) composer.render();
    else renderer.render(scene, camera);
  }

  return { reset, render, setQuality };
}
