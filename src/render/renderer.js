// Affichage 3D avec Three.js (formes simples avant le « rendu 2026 » de l'étape 4).
// Ne modifie jamais l'état du jeu : il se contente de le dessiner.
import * as THREE from 'three';
import { CELL, BOMB_TIMER, FIRE_DURATION } from '../game/constants.js';
import { PLAYER_COLORS } from './colors.js';
import { iconCanvas } from './icons.js';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f1a);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const cameraBase = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x2a2035, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
  scene.add(sun, sun.target);

  // Géométries et matériaux partagés (meilleures performances)
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mat = {
    floorA: new THREE.MeshStandardMaterial({ color: 0x1f2438 }),
    floorB: new THREE.MeshStandardMaterial({ color: 0x252b44 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x4a5580, roughness: 0.6 }),
    suddenWall: new THREE.MeshStandardMaterial({ color: 0x7a3d5c, roughness: 0.6 }),
    block: new THREE.MeshStandardMaterial({ color: 0xd08a45, roughness: 0.8 }),
    burning: new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff4a00, emissiveIntensity: 1.2 }),
    bomb: new THREE.MeshStandardMaterial({ color: 0x15151f, roughness: 0.35, metalness: 0.3 }),
    iceBomb: new THREE.MeshStandardMaterial({ color: 0x9fe8ff, roughness: 0.2, emissive: 0x3aa8ff, emissiveIntensity: 0.4 }),
    fuse: new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2020, emissiveIntensity: 2 }),
    detonatorFuse: new THREE.MeshStandardMaterial({ color: 0x9b5cff, emissive: 0x8a4dff, emissiveIntensity: 2.5 }),
    fire: new THREE.MeshStandardMaterial({ color: 0xffb030, emissive: 0xff6a00, emissiveIntensity: 2.2 }),
    iceFire: new THREE.MeshStandardMaterial({ color: 0xbff0ff, emissive: 0x4ab8ff, emissiveIntensity: 1.8 }),
    visor: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }),
    shield: new THREE.MeshStandardMaterial({ color: 0x7dff6b, emissive: 0x3fdf4a, emissiveIntensity: 1, transparent: true, opacity: 0.55 }),
    iceCube: new THREE.MeshStandardMaterial({ color: 0xbfefff, transparent: true, opacity: 0.45, roughness: 0.1 }),
    itemSide: new THREE.MeshStandardMaterial({ color: 0x2b3150 }),
  };
  const bombGeo = new THREE.SphereGeometry(0.36, 20, 16);
  const fuseGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const bodyGeo = new THREE.CapsuleGeometry(0.28, 0.32, 4, 12);
  const visorGeo = new THREE.BoxGeometry(0.34, 0.1, 0.12);
  const ringGeo = new THREE.TorusGeometry(0.42, 0.04, 8, 32);
  const itemGeo = new THREE.BoxGeometry(0.66, 0.1, 0.66);

  // Matériaux des bonus : le dessus porte l'icône
  const itemMats = {};
  function itemMaterial(type) {
    if (!itemMats[type]) {
      const tex = new THREE.CanvasTexture(iconCanvas(type));
      tex.colorSpace = THREE.SRGBColorSpace;
      const top = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 });
      itemMats[type] = [mat.itemSide, mat.itemSide, top, mat.itemSide, mat.itemSide, mat.itemSide];
    }
    return itemMats[type];
  }

  let board = null; // groupe contenant toute l'arène de la manche en cours
  let cols = 15;
  let rows = 13;
  let blocks = new Map(); // index de case -> mesh
  let walls = new Set(); // cases murées (pour repérer les murs de la mort subite)
  let falling = []; // murs de mort subite en train de tomber
  let players = [];
  const bombs = new Map(); // id de bombe -> mesh
  const fires = new Map(); // "x,y" -> mesh
  const items = new Map(); // "x,y" -> mesh
  let shake = 0;
  let lastT = 0;

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

    // Sol en damier
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tile = new THREE.Mesh(box, (x + y) % 2 ? mat.floorA : mat.floorB);
        tile.scale.set(1, 0.1, 1);
        tile.position.set(x, -0.05, y);
        tile.receiveShadow = true;
        board.add(tile);
      }
    }

    // Murs et blocs
    state.cells.forEach((c, i) => {
      const x = i % cols;
      const y = Math.floor(i / cols);
      if (c === CELL.WALL) {
        const wall = new THREE.Mesh(box, mat.wall);
        wall.position.set(x, 0.5, y);
        wall.castShadow = wall.receiveShadow = true;
        board.add(wall);
        walls.add(i);
      } else if (c === CELL.BLOCK) {
        const block = new THREE.Mesh(box, mat.block);
        block.scale.setScalar(0.86);
        block.position.set(x, 0.43, y);
        block.castShadow = block.receiveShadow = true;
        board.add(block);
        blocks.set(i, block);
      }
    });

    // Joueurs : capsule colorée, visière (direction), anneau (bouclier), cube (gel)
    players = state.players.map((p) => {
      const g = new THREE.Group();
      const color = new THREE.Color(PLAYER_COLORS[p.color ?? p.id]);
      const bodyMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.4 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.46;
      body.castShadow = true;
      const visor = new THREE.Mesh(visorGeo, mat.visor);
      visor.position.set(0, 0.62, 0.25);
      const ring = new THREE.Mesh(ringGeo, mat.shield);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.15;
      const ice = new THREE.Mesh(box, mat.iceCube);
      ice.scale.set(0.8, 1.05, 0.8);
      ice.position.y = 0.52;
      g.add(body, visor, ring, ice);
      board.add(g);
      return { group: g, body, bodyMat, color, ring, ice, deathT: 0 };
    });

    const cx = (cols - 1) / 2;
    const cz = (rows - 1) / 2;
    sun.position.set(cx - 6, 18, cz - 4);
    sun.target.position.set(cx, 0, cz);
    resize();
  }

  // ---------- Caméra : l'arène entière reste visible quelle que soit la taille d'écran ----------

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const tilt = THREE.MathUtils.degToRad(64); // inclinaison de la vue
    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const needH = rows * Math.sin(tilt) + 3; // marge pour le bandeau du haut
    const needW = cols + 1.5;
    const dist = Math.max(needH / 2 / Math.tan(halfFov), needW / 2 / (Math.tan(halfFov) * camera.aspect));
    const cx = (cols - 1) / 2;
    const cz = (rows - 1) / 2 + 0.3;
    cameraBase.set(cx, Math.sin(tilt) * dist, cz + Math.cos(tilt) * dist);
    camera.position.copy(cameraBase);
    camera.lookAt(cx, 0, cz);
  }
  window.addEventListener('resize', resize);

  // Synchronise une collection d'objets 3D avec une liste de l'état (création / suppression)
  function sync(map, list, keyOf, create, update) {
    const seen = new Set();
    for (const it of list) {
      const key = keyOf(it);
      seen.add(key);
      let mesh = map.get(key);
      if (!mesh) {
        mesh = create(it);
        board.add(mesh);
        map.set(key, mesh);
      }
      update(mesh, it);
    }
    for (const [key, mesh] of map) {
      if (!seen.has(key)) {
        board.remove(mesh);
        map.delete(key);
      }
    }
  }

  // ---------- Image par image ----------

  function render(state, t) {
    const dt = Math.min(t - lastT, 0.1);
    lastT = t;

    // Blocs : disparaissent en rétrécissant quand ils brûlent
    for (const [i, mesh] of blocks) {
      const c = state.cells[i];
      if (c === CELL.BURNING) {
        mesh.material = mat.burning;
        mesh.scale.multiplyScalar(Math.exp(-dt * 5));
      } else if (c !== CELL.BLOCK) {
        board.remove(mesh);
        blocks.delete(i);
      }
    }

    // Murs de la mort subite : tombent du ciel
    state.cells.forEach((c, i) => {
      if (c === CELL.WALL && !walls.has(i)) {
        walls.add(i);
        const wall = new THREE.Mesh(box, mat.suddenWall);
        wall.position.set(i % cols, 6, Math.floor(i / cols));
        wall.castShadow = true;
        board.add(wall);
        falling.push(wall);
      }
    });
    falling = falling.filter((wall) => {
      wall.position.y = Math.max(0.5, wall.position.y - dt * 30);
      if (wall.position.y === 0.5) shake = Math.min(shake + 0.03, 0.3);
      return wall.position.y > 0.5;
    });

    // Joueurs
    state.players.forEach((p, i) => {
      const v = players[i];
      v.group.position.set(p.x, 0, p.y);
      v.group.rotation.y = Math.atan2(p.faceX, p.faceY);
      v.ring.visible = p.alive && p.shield;
      v.ice.visible = p.alive && p.frozen > 0;
      if (p.alive) {
        const hop = p.moving ? Math.abs(Math.sin(t * 14)) * 0.08 : 0;
        v.body.position.y = 0.46 + hop;
        v.body.scale.set(1, 1, p.dashTimer > 0 ? 1.5 : 1);
        // Malus : le joueur clignote en violet ; invincible : il clignote
        v.bodyMat.emissive.set(p.skull && Math.sin(t * 12) > 0 ? 0x9b5cff : v.color);
        v.group.visible = !(p.invuln > 0 && Math.sin(t * 40) > 0);
        v.ring.rotation.z = t * 2;
      } else {
        v.deathT += dt;
        const s = Math.max(0, 1 - v.deathT * 2);
        v.group.scale.setScalar(s);
        v.group.rotation.y += v.deathT * 20;
        v.group.visible = s > 0;
      }
    });

    // Bombes : pulsent de plus en plus vite ; glissent quand elles sont poussées
    sync(
      bombs,
      state.bombs,
      (b) => b.id,
      (b) => {
        const g = new THREE.Group();
        const ball = new THREE.Mesh(bombGeo, b.ice ? mat.iceBomb : mat.bomb);
        ball.castShadow = true;
        const fuse = new THREE.Mesh(fuseGeo, mat.fuse);
        fuse.position.y = 0.38;
        g.add(ball, fuse);
        g.userData.fuse = fuse;
        return g;
      },
      (g, b) => {
        const k = b.slide ? b.slide.progress : 0;
        g.position.set(b.x + (b.slide ? b.slide.dx * k : 0), 0.36, b.y + (b.slide ? b.slide.dy * k : 0));
        // mèche violette : son propriétaire peut la faire sauter à tout moment (détonateur)
        const owner = state.players[b.owner];
        g.userData.fuse.material = owner && owner.special === 'detonator' ? mat.detonatorFuse : mat.fuse;
        const urgency = 1 - b.timer / BOMB_TIMER;
        g.scale.setScalar(1 + Math.sin(t * (6 + urgency * 18)) * (0.05 + urgency * 0.08));
      },
    );

    // Flammes (orange) et flammes glacées (bleues)
    sync(
      fires,
      state.fires,
      (f) => f.x + ',' + f.y,
      (f) => {
        const m = new THREE.Mesh(box, f.ice ? mat.iceFire : mat.fire);
        m.position.set(f.x, 0.25, f.y);
        return m;
      },
      (m, f) => {
        m.material = f.ice ? mat.iceFire : mat.fire;
        const k = f.timer / FIRE_DURATION;
        m.scale.set(0.5 + 0.45 * k, 0.15 + 0.4 * k, 0.5 + 0.45 * k);
      },
    );

    // Bonus au sol : flottent doucement
    sync(
      items,
      state.items,
      (it) => it.x + ',' + it.y + it.type,
      (it) => {
        const m = new THREE.Mesh(itemGeo, itemMaterial(it.type));
        m.castShadow = true;
        m.scale.setScalar(0.01);
        return m;
      },
      (m, it) => {
        m.scale.setScalar(Math.min(1, m.scale.x + dt * 5)); // apparition
        m.position.set(it.x, 0.22 + Math.sin(t * 3 + it.x + it.y) * 0.06, it.y);
      },
    );

    // Petit tremblement d'écran à chaque explosion
    for (const e of state.events) if (e.type === 'explosion') shake = Math.min(shake + 0.12, 0.3);
    shake = Math.max(0, shake - dt * 1.2);
    camera.position.set(
      cameraBase.x + (Math.random() - 0.5) * shake,
      cameraBase.y + (Math.random() - 0.5) * shake,
      cameraBase.z + (Math.random() - 0.5) * shake,
    );

    renderer.render(scene, camera);
  }

  return { reset, render };
}
