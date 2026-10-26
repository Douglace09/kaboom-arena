// Ambiance de chaque carte : couleurs, lumière, sol, caisses, décor et éléments spéciaux
// (tapis roulants, portails, lave). Uniquement de l'affichage.
import * as THREE from 'three';

// Palette volontairement douce : couleurs peu saturées, peu de lueurs, pour ne pas fatiguer les yeux
export const THEMES = {
  classique: {
    background: 0x0e1222,
    tileA: '#1d2238', tileB: '#21273f', line: 'rgba(255,255,255,0.05)', glow: null, floorGlow: 0,
    border: 0x3a4262, pillar: 0x4c5580, cap: 0x7f8cff, capGlow: 0.35, strip: 0xaab6ff, stripGlow: 0.8,
    crate: 'wood', crateGlow: 0, groundBase: '#0c0f1c', groundLine: 'rgba(120,140,255,0.06)',
    hemi: [0xc8d4ff, 0x2a2438, 1.35], sun: [0xfff1dd, 2.3], rim: [0x7f8cff, 0.5],
    floorRough: 0.65, floorMetal: 0.1, ambient: null,
  },
  neon: {
    background: 0x0d0b1c,
    tileA: '#1b1834', tileB: '#1e1b3a', line: 'rgba(200,120,255,0.07)', glow: 'rgba(255,120,220,0.5)', floorGlow: 0.25,
    border: 0x2a2846, pillar: 0x3a3860, cap: 0x8a6fa8, capGlow: 0.15, strip: 0x5fc8e0, stripGlow: 0.9,
    crate: 'neon', crateGlow: 0.45, groundBase: '#0d0b1c', groundLine: 'rgba(200,120,255,0.06)',
    hemi: [0xcfc4ff, 0x2a1d40, 1.3], sun: [0xf0e8ff, 2.1], rim: [0xc86bd6, 0.6],
    floorRough: 0.6, floorMetal: 0.15, ambient: 'motes', belt: 0x5fc8e0,
  },
  jungle: {
    background: 0x0b1510,
    tileA: '#26392a', tileB: '#2a3e2d', line: 'rgba(0,0,0,0.12)', glow: null, floorGlow: 0,
    border: 0x4e3b2a, pillar: 0x3c5236, cap: 0x5c7a50, capGlow: 0, strip: 0x9ccf8a, stripGlow: 0.6,
    crate: 'wood', crateGlow: 0, groundBase: '#0c1810', groundLine: 'rgba(160,220,160,0.05)',
    hemi: [0xe4f2dc, 0x1f2a1a, 1.35], sun: [0xfff2d8, 2.3], rim: [0x9ccfb0, 0.4],
    floorRough: 0.85, floorMetal: 0, ambient: 'fireflies',
  },
  banquise: {
    background: 0x101c2a,
    tileA: '#5f7f96', tileB: '#66879e', line: 'rgba(255,255,255,0.12)', glow: null, floorGlow: 0,
    border: 0x4d6c87, pillar: 0x86a8bf, cap: 0xb9d4e4, capGlow: 0, strip: 0xa9d6ee, stripGlow: 0.6,
    crate: 'frost', crateGlow: 0, groundBase: '#0f1b28', groundLine: 'rgba(180,220,255,0.06)',
    hemi: [0xe6f0f8, 0x34485c, 1.1], sun: [0xfff8f0, 1.9], rim: [0x9fc8e6, 0.4],
    floorRough: 0.7, floorMetal: 0.05, ambient: 'snow',
  },
  volcan: {
    background: 0x150c0a,
    tileA: '#2b211f', tileB: '#2f2522', line: 'rgba(0,0,0,0.2)', glow: 'cracks', floorGlow: 0.35,
    border: 0x3d2c27, pillar: 0x4d3830, cap: 0x8a4a34, capGlow: 0.15, strip: 0xd0703a, stripGlow: 0.7,
    crate: 'rock', crateGlow: 0.35, groundBase: '#140b09', groundLine: 'rgba(220,110,60,0.06)',
    hemi: [0xffe0cc, 0x30140c, 1.25], sun: [0xffd0b0, 2.2], rim: [0xd06040, 0.5],
    floorRough: 0.8, floorMetal: 0.05, ambient: 'embers',
  },
  desert: {
    background: 0x1a140c,
    tileA: '#8c7550', tileB: '#927a54', line: 'rgba(0,0,0,0.07)', glow: null, floorGlow: 0,
    border: 0x7a5a3a, pillar: 0x8f6b45, cap: 0x8f6b45, capGlow: 0, strip: 0xe0b070, stripGlow: 0.5,
    crate: 'wood', crateGlow: 0, groundBase: '#1a140c', groundLine: 'rgba(224,176,112,0.06)',
    hemi: [0xfff0d8, 0x4a3420, 1.2], sun: [0xfff0d0, 2.2], rim: [0xffc070, 0.4],
    floorRough: 0.9, floorMetal: 0, ambient: 'dust',
  },
  usine: {
    background: 0x101318,
    tileA: '#3a3f48', tileB: '#3f454e', line: 'rgba(0,0,0,0.25)', glow: null, floorGlow: 0,
    border: 0x2a2e36, pillar: 0x4a505c, cap: 0xffb020, capGlow: 0.3, strip: 0xffb020, stripGlow: 0.6,
    crate: 'wood', crateGlow: 0, groundBase: '#0f1216', groundLine: 'rgba(255,176,32,0.05)',
    hemi: [0xdde4f0, 0x22262e, 1.3], sun: [0xffffff, 2.2], rim: [0xffb020, 0.3],
    floorRough: 0.55, floorMetal: 0.4, ambient: null,
  },
  espace: {
    background: 0x05060f,
    tileA: '#1a1d33', tileB: '#1d2038', line: 'rgba(120,160,255,0.08)', glow: null, floorGlow: 0,
    border: 0x2a2f4a, pillar: 0x3a3f5e, cap: 0x8fa8ff, capGlow: 0.15, strip: 0x8fa8ff, stripGlow: 0.6,
    crate: 'neon', crateGlow: 0.3, groundBase: '#05060f', groundLine: 'rgba(0,0,0,0)', stars: true,
    hemi: [0xc8d0ff, 0x10122a, 1.25], sun: [0xf0f0ff, 2.1], rim: [0x8f6bff, 0.5],
    floorRough: 0.5, floorMetal: 0.3, ambient: 'stars',
  },
  plage: {
    background: 0x0e1a24,
    tileA: '#a48c68', tileB: '#aa926c', line: 'rgba(0,0,0,0.06)', glow: null, floorGlow: 0,
    border: 0x6a6f78, pillar: 0x7d838c, cap: 0x7d838c, capGlow: 0, strip: 0x8fd0ff, stripGlow: 0.5,
    crate: 'wood', crateGlow: 0, groundBase: '#0d2a3a', groundLine: 'rgba(140,210,255,0.08)',
    hemi: [0xfff4e0, 0x2a4a5a, 1.25], sun: [0xfff0dc, 2.2], rim: [0x6fc0ff, 0.4],
    floorRough: 0.9, floorMetal: 0, ambient: null,
  },
  ville: {
    background: 0x05060c,
    tileA: '#24262e', tileB: '#262830', line: 'rgba(255,220,120,0.05)', glow: null, floorGlow: 0,
    border: 0x1c1e26, pillar: 0x2c3040, cap: 0xffd27a, capGlow: 0.5, strip: 0xffd27a, stripGlow: 0.5,
    crate: 'wood', crateGlow: 0, groundBase: '#05060c', groundLine: 'rgba(120,130,200,0.04)',
    hemi: [0x8090c0, 0x10121a, 0.9], sun: [0xaab8ff, 1.3], rim: [0x6070ff, 0.4],
    floorRough: 0.7, floorMetal: 0.1, ambient: null, night: true,
  },
};

export const themeOf = (mapId) => THEMES[mapId] || THEMES.classique;

const canvas = (w, h) => {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')];
};
const texture = (cv, srgb = true) => {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

// Sol de l'arène : damier + lignes ; « glow » = lignes ou fissures qui brillent
export function floorTextures(theme, cols, rows) {
  const s = 64;
  const [cv, g] = canvas(cols * s, rows * s);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y) % 2 ? theme.tileA : theme.tileB;
      g.fillRect(x * s, y * s, s, s);
    }
  }
  const grid = (ctx, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * s, 0);
      ctx.lineTo(x * s, rows * s);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * s);
      ctx.lineTo(cols * s, y * s);
      ctx.stroke();
    }
  };
  grid(g, theme.line, 2);
  let emissive = null;
  if (theme.glow) {
    const [ecv, e] = canvas(cols * s, rows * s);
    e.fillStyle = '#000';
    e.fillRect(0, 0, ecv.width, ecv.height);
    if (theme.glow === 'cracks') {
      // Fissures de lave qui serpentent dans la roche
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const ctx of [g, e]) ctx.lineCap = 'round';
      for (let k = 0; k < 11; k++) {
        let x = rnd() * cv.width;
        let y = rnd() * cv.height;
        const pts = [[x, y]];
        for (let j = 0; j < 6; j++) {
          x += (rnd() - 0.5) * 90;
          y += (rnd() - 0.5) * 90;
          pts.push([x, y]);
        }
        for (const [ctx, color, w] of [[g, '#a8482a', 2], [e, '#c8603a', 2]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.beginPath();
          pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.stroke();
        }
      }
    } else {
      grid(e, theme.glow, 2);
    }
    emissive = texture(ecv);
  }
  return { map: texture(cv), emissive };
}

// Caisses : bois, métal néon, bois givré ou roche volcanique
export function crateTextures(style) {
  const [cv, g] = canvas(128, 128);
  const [ecv, e] = canvas(128, 128);
  e.fillStyle = '#000';
  e.fillRect(0, 0, 128, 128);
  let glows = false;
  const frame = (ctx, color, w = 14) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.strokeRect(7, 7, 114, 114);
  };
  if (style === 'neon') {
    g.fillStyle = '#2a2350';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 2);
    frame(g, '#5fc8e0', 5);
    frame(e, '#5fc8e0', 5);
    glows = true;
  } else if (style === 'rock') {
    g.fillStyle = '#4a3530';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 14; k++) g.fillRect((k * 37) % 120, (k * 53) % 120, 14, 10);
    frame(g, '#2e1f1b', 12);
    for (const [ctx, c] of [[g, '#a8482a'], [e, '#c8603a']]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 30);
      ctx.lineTo(55, 60);
      ctx.lineTo(48, 92);
      ctx.lineTo(90, 108);
      ctx.stroke();
    }
    glows = true;
  } else {
    // Bois (givré sur la banquise)
    g.fillStyle = style === 'frost' ? '#c99a6a' : '#d98b42';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(120, 60, 20, 0.35)';
    for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 3);
    frame(g, '#8c4f22');
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(14, 114);
    g.lineTo(114, 14);
    g.stroke();
    g.fillStyle = '#5a3216';
    for (const [x, y] of [[12, 12], [116, 12], [12, 116], [116, 116]]) {
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
    }
    if (style === 'frost') {
      g.fillStyle = 'rgba(235, 248, 255, 0.85)';
      g.fillRect(0, 0, 128, 22); // neige sur le haut
      g.fillStyle = 'rgba(220, 240, 255, 0.25)';
      g.fillRect(0, 0, 128, 128);
    }
  }
  return { map: texture(cv), emissive: glows ? texture(ecv) : null };
}

// Sol extérieur (décor autour de l'arène)
export function groundTexture(theme) {
  const [cv, g] = canvas(128, 128);
  g.fillStyle = theme.groundBase;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = theme.groundLine;
  g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  if (theme.stars) {
    // Ciel étoilé autour de la station spatiale
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 14; k++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
      g.fillRect(rnd() * 128, rnd() * 128, 1.5, 1.5);
    }
  }
  const t = texture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  return t;
}

// ---------- Tapis roulants (Néon City) ----------

let chevronTex = null;
export function chevronTexture() {
  if (chevronTex) return chevronTex;
  const [cv, g] = canvas(64, 64);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const x0 of [8, 40]) {
    g.beginPath();
    g.moveTo(x0, 16);
    g.lineTo(x0 + 14, 32);
    g.lineTo(x0, 48);
    g.stroke();
  }
  chevronTex = texture(cv);
  chevronTex.wrapS = THREE.RepeatWrapping;
  return chevronTex;
}

export function createBelt(dx, dy, color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(0.94, 0.94),
    new THREE.MeshStandardMaterial({ color: 0x0d0b1f, roughness: 0.4, metalness: 0.4 }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.006;
  base.receiveShadow = true;
  const arrows = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.86),
    new THREE.MeshBasicMaterial({ map: chevronTexture(), color: new THREE.Color(color), transparent: true, opacity: 0.7, depthWrite: false }),
  );
  arrows.rotation.x = -Math.PI / 2;
  arrows.position.y = 0.012;
  g.add(base, arrows);
  g.rotation.y = Math.atan2(-dy, dx);
  return g;
}

// ---------- Portails (Jungle) ----------

export function createPortal(color) {
  const c = new THREE.Color(color);
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.045, 10, 40),
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.025, 8, 32, Math.PI * 1.4),
    new THREE.MeshBasicMaterial({ color: c }),
  );
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 0.06;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  g.add(ring, inner, disc);
  g.userData = { inner, disc, color };
  return g;
}

// ---------- Lave (Volcan) ----------

const lavaWarnMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color(0xff5a20), transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const lavaGeo = new THREE.CircleGeometry(0.46, 28);
export function createLavaWarning() {
  const m = new THREE.Mesh(lavaGeo, lavaWarnMat.clone());
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

// ---------- Sables mouvants (Désert) ----------

let sandTex = null;
export function createSand() {
  if (!sandTex) {
    const [cv, g] = canvas(64, 64);
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, '#5a4428');
    grad.addColorStop(0.75, '#7a6038');
    grad.addColorStop(1, 'rgba(122,96,56,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(40,28,14,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.2) {
      const r = 2 + a * 1.4;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.stroke();
    sandTex = texture(cv);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), new THREE.MeshStandardMaterial({ map: sandTex, transparent: true, roughness: 1, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.008;
  m.receiveShadow = true;
  return m;
}

// ---------- Portes (Usine) ----------

let hazardTex = null;
export function createDoor(group) {
  if (!hazardTex) {
    const [cv, g] = canvas(64, 64);
    g.fillStyle = '#e8b020';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#1c1c22';
    for (let k = -64; k < 128; k += 20) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + 10, 0);
      g.lineTo(k + 74, 64);
      g.lineTo(k + 64, 64);
      g.closePath();
      g.fill();
    }
    hazardTex = texture(cv);
  }
  const root = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshStandardMaterial({ color: group === 'A' ? 0x5b4a20 : 0x20405b, roughness: 0.6 }));
  frame.rotation.x = -Math.PI / 2;
  frame.position.y = 0.006;
  const shutter = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    [0, 1, 2, 3, 4, 5].map((k) => new THREE.MeshStandardMaterial({ map: k === 2 ? null : hazardTex, color: k === 2 ? (group === 'A' ? 0xe8b020 : 0x3aa0e8) : 0xffffff, roughness: 0.5, metalness: 0.3 })),
  );
  shutter.castShadow = shutter.receiveShadow = true;
  root.add(frame, shutter);
  root.userData = { shutter, h: 0 };
  return root;
}

// ---------- Trous noirs (Espace) ----------

export function createHole() {
  const g = new THREE.Group();
  const pit = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  pit.rotation.x = -Math.PI / 2;
  pit.position.y = 0.012;
  const disk = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.5, 40),
    new THREE.MeshBasicMaterial({ color: 0x9a6bff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = 0.02;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.03, 8, 40, Math.PI * 1.5),
    new THREE.MeshBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.7 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  g.add(pit, disk, ring);
  g.userData = { ring, disk };
  return g;
}

// ---------- Vagues (Plage) ----------

export function createWave(cols) {
  const g = new THREE.Group();
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(cols - 2, 0.22, 0.98),
    new THREE.MeshStandardMaterial({ color: 0x3a9ad8, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.1, emissive: 0x1a5a88, emissiveIntensity: 0.3 }),
  );
  water.position.y = 0.11;
  water.scale.y = 0.05;
  const warn = new THREE.Mesh(
    new THREE.PlaneGeometry(cols - 2, 0.9),
    new THREE.MeshBasicMaterial({ color: 0x6fc8ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  warn.rotation.x = -Math.PI / 2;
  warn.position.y = 0.015;
  g.add(water, warn);
  g.userData = { water, warn };
  return g;
}
