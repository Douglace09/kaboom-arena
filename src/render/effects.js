// Effets visuels : particules (étincelles, fumée, débris), ondes de choc, flashs lumineux
import * as THREE from 'three';

// Petite texture ronde et douce pour les particules
function softDot() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

const VERT = `
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
uniform float scale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vColor = pcolor;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform sampler2D map;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 tex = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor, vAlpha * tex.a);
  if (gl_FragColor.a < 0.01) discard;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Un lot de particules (une seule géométrie = un seul dessin, rapide)
function createPool(capacity, blending, map) {
  const pos = new Float32Array(capacity * 3);
  const col = new Float32Array(capacity * 3);
  const size = new Float32Array(capacity);
  const alpha = new Float32Array(capacity);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geom.setAttribute('pcolor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geom.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geom.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, scale: { value: 600 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending,
  });
  const points = new THREE.Points(geom, material);
  points.frustumCulled = false;

  // Données de chaque particule (en dehors de la carte graphique)
  const p = Array.from({ length: capacity }, () => ({
    life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0, s1: 0, r: 1, gr: 1, b: 1, a0: 1,
  }));
  let cursor = 0;

  return {
    points,
    material,
    spawn(x, y, z, o) {
      const i = cursor;
      cursor = (cursor + 1) % capacity;
      const q = p[i];
      q.life = q.max = o.life;
      q.vx = o.vx; q.vy = o.vy; q.vz = o.vz;
      q.g = o.gravity ?? 0;
      q.drag = o.drag ?? 0;
      q.s0 = o.size;
      q.s1 = o.sizeEnd ?? o.size;
      q.r = o.color.r; q.gr = o.color.g; q.b = o.color.b;
      q.a0 = o.alpha ?? 1;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    },
    update(dt) {
      for (let i = 0; i < capacity; i++) {
        const q = p[i];
        if (q.life <= 0) {
          alpha[i] = 0;
          continue;
        }
        q.life -= dt;
        const k = Math.max(0, q.life / q.max); // 1 -> 0
        const damp = Math.exp(-q.drag * dt);
        q.vx *= damp; q.vz *= damp; q.vy = q.vy * damp - q.g * dt;
        pos[i * 3] += q.vx * dt;
        pos[i * 3 + 1] = Math.max(0.02, pos[i * 3 + 1] + q.vy * dt);
        pos[i * 3 + 2] += q.vz * dt;
        size[i] = q.s1 + (q.s0 - q.s1) * k;
        alpha[i] = q.a0 * Math.min(1, k * 2.5);
        col[i * 3] = q.r; col[i * 3 + 1] = q.gr; col[i * 3 + 2] = q.b;
      }
      for (const name of ['position', 'pcolor', 'size', 'alpha']) geom.attributes[name].needsUpdate = true;
    },
    clear() {
      for (const q of p) q.life = 0;
    },
  };
}

export function createEffects(scene) {
  const dot = softDot();
  const glow = createPool(2400, THREE.AdditiveBlending, dot);
  const smoke = createPool(900, THREE.NormalBlending, dot);
  scene.add(smoke.points, glow.points);

  // Ondes de choc (anneaux au sol)
  const ringGeo = new THREE.RingGeometry(0.7, 1, 48);
  const rings = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.userData = { life: 0, max: 0.5, size: 1 };
    scene.add(m);
    return m;
  });
  let ringCursor = 0;

  // Flashs lumineux (quelques lumières réutilisées)
  const lights = Array.from({ length: 3 }, () => {
    const l = new THREE.PointLight(0xffa040, 0, 7, 2);
    l.userData = { life: 0, max: 0.35, peak: 0 };
    scene.add(l);
    return l;
  });
  let lightCursor = 0;

  let density = 1; // réduit en qualité basse
  let lightsOn = true;
  const tmp = new THREE.Color();
  const rand = (a, b) => a + Math.random() * (b - a);
  const n = (count) => Math.max(1, Math.round(count * density));

  function burst(x, y, z, { count, color, speed = 3, up = 2, life = 0.6, size = 0.25, sizeEnd = 0, gravity = 6, drag = 1.5, pool = glow, alpha = 1, spread = 1, hdr = 1 }) {
    for (let i = 0; i < n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * rand(0.3, 1);
      tmp.set(Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color).multiplyScalar(hdr);
      pool.spawn(x + rand(-0.15, 0.15) * spread, y, z + rand(-0.15, 0.15) * spread, {
        life: life * rand(0.6, 1.2), vx: Math.cos(a) * s, vy: up * rand(0.4, 1.2), vz: Math.sin(a) * s,
        gravity, drag, size: size * rand(0.7, 1.3), sizeEnd, color: tmp, alpha,
      });
    }
  }

  return {
    setQuality(high) {
      density = high ? 1 : 0.4;
      lightsOn = high;
      for (const l of lights) l.visible = high;
    },
    setScale(pixelHeight, fov) {
      const s = pixelHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
      glow.material.uniforms.scale.value = s;
      smoke.material.uniforms.scale.value = s;
    },
    clear() {
      glow.clear();
      smoke.clear();
      for (const r of rings) r.visible = false;
      for (const l of lights) l.intensity = 0;
    },

    // Explosion d'une bombe (au centre)
    explosion(x, z, ice) {
      const hot = ice ? [0xbff0ff, 0x6fc8ff, 0xffffff] : [0xffd27a, 0xff8a30, 0xff5020];
      burst(x, 0.4, z, { count: 34, color: hot, speed: 5, up: 4, life: 0.55, size: 0.32, hdr: 1.8 });
      burst(x, 0.3, z, { count: 14, color: ice ? 0xdff6ff : 0x3a3440, speed: 1.6, up: 1.5, life: 1.1, size: 0.5, sizeEnd: 1.2, gravity: -0.6, drag: 2, pool: smoke, alpha: ice ? 0.5 : 0.55 });
      this.ring(x, z, ice ? 0x7fd8ff : 0xffa040, 2.6);
      if (lightsOn) {
        const l = lights[lightCursor];
        lightCursor = (lightCursor + 1) % lights.length;
        l.color.set(ice ? 0x7fd8ff : 0xff9040);
        l.position.set(x, 1.2, z);
        l.userData.life = l.userData.max;
        l.userData.peak = 9;
      }
    },
    // Flamme qui brûle sur une case : quelques braises qui montent
    flame(x, z, ice, k) {
      if (Math.random() > 0.35 * density * k) return;
      tmp.set(ice ? 0x9fe4ff : Math.random() < 0.5 ? 0xffb040 : 0xff6a20).multiplyScalar(1.6);
      glow.spawn(x + rand(-0.3, 0.3), 0.2, z + rand(-0.3, 0.3), {
        life: rand(0.25, 0.5), vx: rand(-0.3, 0.3), vy: rand(1.2, 2.6), vz: rand(-0.3, 0.3), gravity: 0, drag: 1, size: rand(0.15, 0.3), sizeEnd: 0, color: tmp,
      });
    },
    // Bloc détruit : éclats de bois
    debris(x, z) {
      burst(x, 0.5, z, { count: 14, color: [0xd08a45, 0x9a5a28, 0xffc070], speed: 3, up: 3.5, life: 0.7, size: 0.16, sizeEnd: 0.1, gravity: 9, drag: 0.8, pool: smoke, alpha: 1 });
    },
    // Joueur éliminé : éclat à sa couleur
    death(x, z, color) {
      burst(x, 0.5, z, { count: 40, color: [color, 0xffffff], speed: 4.5, up: 4, life: 0.8, size: 0.3, hdr: 2.5 });
      this.ring(x, z, color, 1.6);
    },
    // Bonus ramassé : étincelles qui montent
    pickup(x, z, color) {
      burst(x, 0.3, z, { count: 16, color: [color, 0xffffff], speed: 1.4, up: 3, life: 0.6, size: 0.2, gravity: 1, hdr: 2 });
    },
    // Poussière quand un mur tombe
    dust(x, z) {
      burst(x, 0.1, z, { count: 8, color: 0x8b8fa8, speed: 2, up: 0.6, life: 0.8, size: 0.4, sizeEnd: 0.9, gravity: 0, drag: 3, pool: smoke, alpha: 0.4 });
    },
    // Étincelle de mèche
    fuse(x, y, z, purple) {
      if (Math.random() > 0.25 * density) return;
      tmp.set(purple ? 0xb080ff : 0xffb040).multiplyScalar(3);
      glow.spawn(x, y, z, { life: 0.25, vx: rand(-0.6, 0.6), vy: rand(0.5, 1.5), vz: rand(-0.6, 0.6), gravity: 4, drag: 0, size: 0.1, sizeEnd: 0, color: tmp });
    },
    // Traînée du dash
    trail(x, z, color) {
      tmp.set(color).multiplyScalar(2);
      glow.spawn(x + rand(-0.1, 0.1), rand(0.2, 0.6), z + rand(-0.1, 0.1), { life: 0.3, vx: 0, vy: 0.2, vz: 0, gravity: 0, size: 0.35, sizeEnd: 0, color: tmp });
    },
    // Lave qui jaillit : gerbe de magma et braises
    lava(x, z) {
      burst(x, 0.3, z, { count: 18, color: [0xffa040, 0xff5a14, 0xffd070], speed: 1.8, up: 5, life: 0.8, size: 0.28, gravity: 9, hdr: 1.8 });
      burst(x, 0.3, z, { count: 8, color: 0x3a2420, speed: 1.2, up: 1.2, life: 1.2, size: 0.45, sizeEnd: 1, gravity: -0.5, drag: 2, pool: smoke, alpha: 0.5 });
    },
    // Particules d'ambiance propres à chaque carte
    ambient(kind, cols, rows, dt) {
      if (!kind) return;
      const rate = { motes: 3, fireflies: 2.5, snow: 12, embers: 4, dust: 5, stars: 3 }[kind] * density;
      let count = rate * dt;
      while (count > 0) {
        if (count < 1 && Math.random() > count) break;
        count -= 1;
        const x = rand(-1, cols);
        const z = rand(-1, rows);
        if (kind === 'dust') {
          tmp.set(0xd8b886);
          smoke.spawn(x, rand(0.1, 0.8), z, { life: rand(2, 3.5), vx: rand(0.8, 1.6), vy: 0, vz: rand(-0.2, 0.2), gravity: 0, drag: 0, size: rand(0.08, 0.16), color: tmp, alpha: 0.5 });
        } else if (kind === 'stars') {
          tmp.set(0xc8d4ff).multiplyScalar(1.4);
          glow.spawn(x, rand(1.5, 3), z, { life: rand(1.5, 3), vx: 0, vy: 0, vz: 0, gravity: 0, drag: 0, size: rand(0.05, 0.1), sizeEnd: 0, color: tmp });
        } else if (kind === 'snow') {
          tmp.set(0xffffff);
          smoke.spawn(x, rand(4, 7), z, { life: 7, vx: rand(-0.2, 0.2), vy: -0.9, vz: rand(-0.1, 0.1), gravity: 0, drag: 0, size: rand(0.06, 0.12), color: tmp, alpha: 0.85 });
        } else if (kind === 'embers') {
          tmp.set(Math.random() < 0.5 ? 0xff7a30 : 0xffb050).multiplyScalar(1.8);
          glow.spawn(x, 0.1, z, { life: rand(2, 4), vx: rand(-0.2, 0.2), vy: rand(0.5, 1.2), vz: rand(-0.2, 0.2), gravity: 0, drag: 0, size: rand(0.06, 0.12), sizeEnd: 0, color: tmp });
        } else if (kind === 'fireflies') {
          tmp.set(0xc8ff6a).multiplyScalar(2);
          glow.spawn(x, rand(0.4, 1.6), z, { life: rand(2.5, 4), vx: rand(-0.3, 0.3), vy: rand(-0.1, 0.1), vz: rand(-0.3, 0.3), gravity: 0, drag: 0, size: rand(0.08, 0.14), sizeEnd: 0.02, color: tmp });
        } else {
          tmp.set(Math.random() < 0.5 ? 0x35e0ff : 0xff3dd2).multiplyScalar(1.6);
          glow.spawn(x, rand(0, 0.5), z, { life: rand(3, 5), vx: 0, vy: rand(0.2, 0.5), vz: 0, gravity: 0, drag: 0, size: rand(0.05, 0.1), sizeEnd: 0, color: tmp });
        }
      }
    },
    // Espace : particules aspirées par un trou noir
    vortex(x, z) {
      if (Math.random() > 0.3 * density) return;
      const a = Math.random() * Math.PI * 2;
      tmp.set(Math.random() < 0.5 ? 0x9a6bff : 0xffa060).multiplyScalar(1.4);
      glow.spawn(x + Math.cos(a) * 0.9, 0.15, z + Math.sin(a) * 0.9, { life: 0.6, vx: -Math.cos(a) * 1.4 - Math.sin(a) * 0.8, vy: 0, vz: -Math.sin(a) * 1.4 + Math.cos(a) * 0.8, gravity: 0, drag: 0, size: 0.1, sizeEnd: 0, color: tmp });
    },
    // Plage : éclaboussures
    splash(x, z) {
      burst(x, 0.2, z, { count: 14, color: [0xbfe6ff, 0x6fc8ff, 0xffffff], speed: 1.8, up: 3, life: 0.6, size: 0.18, gravity: 8, hdr: 1.2 });
    },
    ring(x, z, color, size) {
      const r = rings[ringCursor];
      ringCursor = (ringCursor + 1) % rings.length;
      r.material.color.set(color).multiplyScalar(2.5);
      r.position.set(x, 0.04, z);
      r.userData.life = r.userData.max;
      r.userData.size = size;
      r.visible = true;
    },

    update(dt) {
      glow.update(dt);
      smoke.update(dt);
      for (const r of rings) {
        if (!r.visible) continue;
        const u = r.userData;
        u.life -= dt;
        const k = 1 - Math.max(0, u.life / u.max);
        r.scale.setScalar(0.2 + k * u.size);
        r.material.opacity = (1 - k) * 0.9;
        if (u.life <= 0) r.visible = false;
      }
      for (const l of lights) {
        const u = l.userData;
        if (u.life <= 0) {
          l.intensity = 0;
          continue;
        }
        u.life -= dt;
        l.intensity = u.peak * Math.max(0, u.life / u.max);
      }
    },
  };
}
