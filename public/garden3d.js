/* =========================================================
   BobGarden — ogród kwiatowy 3D (Three.js)
   Unosząca się „wysepka": trawnik w pasy, okrągła rabata
   z tulipanami i kwitnącą wiśnią, rabata z lawendą, różami
   i hortensjami, oczko wodne z liliami, pergola z różami,
   ścieżka z płyt, lampa i dwa motyle. Z boku widać warstwy
   ziemi z rurą nawadniania. Wszystko zbudowane w kodzie.

   Ogród jest w banerze i przewija się razem ze stroną.
   Pozycję i wielkość ustawiasz w obiekcie PLACE.
   ========================================================= */
import * as THREE from './vendor/three-lite.js';

// Ogród jest częścią banera: przewija się razem ze stroną jak zwykły element
// (nie znika i nie pojawia się w innych sekcjach).
// nx, ny: pozycja w banerze (-1…1), s: wielkość, rx: pochylenie w stronę widza. „m" — telefon.
const PLACE = { nx: 0.5, ny: -0.12, s: 1.0, rx: 0.45, m: { nx: 0.0, ny: 0.5, s: 0.75 } };

const canvas = document.getElementById('scene-canvas');
if (canvas) start();

function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.remove(); // brak WebGL — strona działa dalej bez ogrodu 3D
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const FOV = 35, CAM_Z = 10;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  // Światło: niebo, ciepłe słońce z cieniami i światło od widza (żeby było widać warstwy ziemi)
  scene.add(new THREE.HemisphereLight(0xf4f7ea, 0x3a2a1a, 1.35));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.3);
  sun.position.set(5, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
  sun.shadow.bias = -0.002;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xfff6e8, 1.2);
  fill.position.set(0, 1, 10);
  scene.add(fill);

  const root = new THREE.Group();   // pozycja i wielkość na ekranie
  const tilt = new THREE.Group();   // pochylenie i obrót
  const garden = buildGarden();
  tilt.add(garden.island);
  root.add(tilt);
  scene.add(root);
  sun.target = root;

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let mouse = { x: 0, y: 0 }, mouseS = { x: 0, y: 0 };
  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX / window.innerWidth - 0.5;
      mouse.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const hero = document.querySelector('.hero');
  let vis = 0; // płynne pojawienie się po wczytaniu strony
  const clock = { last: 0, t: 0 };

  function frame(now) {
    if (!clock.last) clock.last = now;
    const dt = Math.max(0, Math.min(0.05, (now - clock.last) / 1000));
    clock.last = now;
    clock.t += dt;
    const t = clock.t;

    vis += (1 - vis) * (1 - Math.exp(-dt * 2.5));
    mouseS.x += (mouse.x - mouseS.x) * 0.03;
    mouseS.y += (mouse.y - mouseS.y) * 0.03;

    // gdzie jest baner? ogród przesuwa się razem z nim
    const r = hero.getBoundingClientRect();
    root.visible = r.bottom > 0;
    if (root.visible) {
      const stop = camera.aspect < 0.85 ? Object.assign({}, PLACE, PLACE.m) : PLACE;
      const e = easeOutCubic(vis);
      const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAM_Z;
      const halfW = halfH * camera.aspect;
      const unit = Math.min(halfW, halfH) / 6;
      const pxToWorld = (2 * halfH) / window.innerHeight;
      root.position.x = stop.nx * halfW;
      root.position.y = stop.ny * halfH + (-r.top) * pxToWorld - (1 - e) * 0.6;
      root.scale.setScalar(stop.s * unit * (0.6 + 0.4 * e));

      // bardzo powolny obrót, lekka reakcja na mysz, delikatne unoszenie
      tilt.rotation.x = stop.rx + mouseS.y * 0.12;
      tilt.rotation.y = -0.5 + t * 0.07 + mouseS.x * 0.25 + (1 - e) * 0.6;
      garden.island.position.y = Math.sin(t * 0.9) * 0.05;
      garden.setOpacity(e);
      garden.update(t, dt);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  canvas.classList.add('ready');
}

// =========================================================
// Budowa ogrodu kwiatowego
// =========================================================
function buildGarden() {
  const island = new THREE.Group();
  const growers = []; // elementy „wyrastające" po wczytaniu
  const swayers = []; // elementy kołyszące się na wietrze
  const materials = []; // wszystkie materiały — do płynnego pojawiania się
  const rand = seeded(11);

  const matCache = {};
  const mat = (color, extra) => {
    const key = color + JSON.stringify(extra || {});
    if (!matCache[key]) {
      matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, flatShading: true, transparent: true }, extra || {}));
      materials.push(matCache[key]);
    }
    return matCache[key];
  };
  const mesh = (geo, m, shadow) => {
    const o = new THREE.Mesh(geo, m);
    if (shadow !== false) { o.castShadow = true; o.receiveShadow = true; }
    return o;
  };
  const grow = (obj, delay) => { growers.push({ obj, delay }); return obj; };

  // wspólne kształty (oszczędza pamięć)
  const GEO = {
    stem: new THREE.CylinderGeometry(0.012, 0.014, 1, 5),
    petal: new THREE.SphereGeometry(0.05, 8, 6),
    ball: new THREE.IcosahedronGeometry(1, 1),
    blob: new THREE.IcosahedronGeometry(1, 0),
    disc: new THREE.CylinderGeometry(1, 1, 1, 12),
    spike: new THREE.ConeGeometry(0.028, 0.18, 6),
    stone: new THREE.DodecahedronGeometry(1)
  };
  const green = mat(0x4f8a34), darkGreen = mat(0x3b7431);

  // ---------- Wyspa: trawnik i warstwy ziemi ----------
  const lawnTop = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.9, transparent: true });
  materials.push(lawnTop);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.2, 56), [mat(0x4f8a34), lawnTop, mat(0x4f8a34)]);
  grass.position.y = -0.1;
  grass.receiveShadow = true;
  island.add(grass);
  let y = -0.2;
  [{ r1: 2.99, r2: 2.94, h: 0.45, c: 0x5a3920 }, { r1: 2.94, r2: 2.75, h: 0.55, c: 0x7d5a37 }, { r1: 2.75, r2: 2.45, h: 0.35, c: 0x9a8468 }]
    .forEach((l) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(l.r1, l.r2, l.h, 56), mat(l.c, { flatShading: false }));
      m.position.y = y - l.h / 2;
      island.add(m);
      y -= l.h;
    });
  const rock = new THREE.Mesh(new THREE.ConeGeometry(2.45, 1.6, 12), mat(0x6c655c));
  rock.rotation.x = Math.PI;
  rock.position.y = y - 0.8;
  island.add(rock);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(3.005, 3.005, 0.07, 56, 1, true), mat(0x2d7fd3, { flatShading: false, roughness: 0.4 }));
  pipe.position.y = -0.5;
  island.add(pipe);
  for (let i = 0; i < 24; i++) {
    const a = rand() * Math.PI * 2, d = rand();
    const st = new THREE.Mesh(GEO.stone, mat(0xb9b0a3));
    st.scale.setScalar(0.05 + rand() * 0.04);
    st.position.set(Math.cos(a) * (2.9 - d * 0.25), -0.75 - d * 0.5, Math.sin(a) * (2.9 - d * 0.25));
    island.add(st);
  }

  // ---------- Pojedyncze rośliny ----------
  function tulip(color) {
    const g = new THREE.Group();
    const h = 0.28 + rand() * 0.1;
    const s = mesh(GEO.stem, green); s.scale.y = h; s.position.y = h / 2; g.add(s);
    const leaf = mesh(GEO.petal, green); leaf.scale.set(0.5, 2.2, 0.25); leaf.position.set(0.03, 0.08, 0); leaf.rotation.z = -0.4; g.add(leaf);
    for (let i = 0; i < 3; i++) {
      const p = mesh(GEO.petal, mat(color, { roughness: 0.55 }));
      const a = i * Math.PI * 2 / 3;
      p.scale.set(0.75, 1.5, 0.75);
      p.position.set(Math.cos(a) * 0.022, h + 0.05, Math.sin(a) * 0.022);
      g.add(p);
    }
    return g;
  }
  function daisy(petalColor) {
    const g = new THREE.Group();
    const h = 0.22 + rand() * 0.12;
    const s = mesh(GEO.stem, green); s.scale.y = h; s.position.y = h / 2; g.add(s);
    const head = new THREE.Group();
    head.position.y = h;
    head.rotation.x = -0.35 + rand() * 0.2;
    for (let i = 0; i < 8; i++) {
      const p = mesh(GEO.petal, mat(petalColor, { roughness: 0.6 }), false);
      const a = i * Math.PI / 4;
      p.scale.set(1.1, 0.25, 0.5);
      p.position.set(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
      p.rotation.y = -a;
      head.add(p);
    }
    const c = mesh(GEO.petal, mat(0xf2b134), false); c.scale.set(0.55, 0.4, 0.55); head.add(c);
    g.add(head);
    return g;
  }
  function lavender() {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const h = 0.3 + rand() * 0.14, a = rand() * Math.PI * 2, r = rand() * 0.07;
      const s = mesh(GEO.stem, mat(0x6f8f5a), false); s.scale.y = h;
      s.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      s.rotation.set((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3);
      g.add(s);
      const sp = mesh(GEO.spike, mat(i % 2 ? 0x8a6fc9 : 0x9d84d6), false);
      sp.position.set(Math.cos(a) * r * 1.3, h + 0.06, Math.sin(a) * r * 1.3);
      g.add(sp);
    }
    const base = mesh(GEO.ball, mat(0x7d9a68)); base.scale.set(0.12, 0.07, 0.12); base.position.y = 0.04; g.add(base);
    return g;
  }
  function flowerBush(leafColor, flowerColors, size, flowerSize, count) {
    const g = new THREE.Group();
    const b = mesh(GEO.ball, mat(leafColor)); b.scale.set(size, size * 0.85, size); b.position.y = size * 0.8; g.add(b);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, up = 0.2 + rand() * 0.8;
      const f = mesh(GEO.ball, mat(flowerColors[i % flowerColors.length], { roughness: 0.6 }));
      f.scale.setScalar(flowerSize * (0.8 + rand() * 0.4));
      const rr = size * Math.sqrt(1 - up * up) * 0.95;
      f.position.set(Math.cos(a) * rr, size * 0.8 + up * size * 0.8, Math.sin(a) * rr);
      g.add(f);
    }
    return g;
  }

  // ---------- Okrągła rabata z kwitnącą wiśnią i tulipanami ----------
  const bedC = new THREE.Vector3(0.75, 0, -0.35);
  const bed = mesh(GEO.disc, mat(0x4a2f1c, { flatShading: false }));
  bed.scale.set(1.05, 0.06, 1.05); bed.position.set(bedC.x, 0.03, bedC.z); bed.castShadow = false;
  island.add(bed);
  for (let i = 0; i < 30; i++) { // obwódka z bukszpanu
    const a = i / 30 * Math.PI * 2;
    const bx = grow(mesh(GEO.ball, darkGreen), 0.2 + i * 0.01);
    bx.scale.set(0.1, 0.085, 0.1);
    bx.position.set(bedC.x + Math.cos(a) * 1.1, 0.08, bedC.z + Math.sin(a) * 1.1);
    island.add(bx);
  }
  // wiśnia japońska w środku
  const cherry = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.75, 6), mat(0x6b4a2f)); trunk.position.y = 0.375; cherry.add(trunk);
  [[0, 0.95, 0, 0.42, 0xf4b6c8], [0.28, 0.85, 0.1, 0.3, 0xf7c9d6], [-0.25, 0.88, -0.1, 0.32, 0xeea3ba], [0.05, 1.18, -0.05, 0.3, 0xf9d5e0], [-0.1, 0.8, 0.28, 0.26, 0xf4b6c8]]
    .forEach((c) => { const bl = mesh(GEO.blob, mat(c[4], { roughness: 0.7 })); bl.scale.setScalar(c[3]); bl.position.set(c[0], c[1], c[2]); bl.rotation.set(rand() * 3, rand() * 3, 0); cherry.add(bl); });
  cherry.position.copy(bedC);
  island.add(grow(cherry, 0.3));
  swayers.push({ obj: cherry, phase: 0, amp: 0.015 });
  // pierścień hortensji i dwa pierścienie tulipanów
  [0, 1, 2, 3].forEach((i) => {
    const a = i * Math.PI / 2 + 0.4;
    const h = flowerBush(0x4b8a3c, i % 2 ? [0x9fb8ea, 0xb7c9f0] : [0xf0b8cf, 0xf6d0de], 0.13, 0.07, 6);
    h.position.set(bedC.x + Math.cos(a) * 0.45, 0.05, bedC.z + Math.sin(a) * 0.45);
    island.add(grow(h, 0.7 + i * 0.08));
  });
  const tulipColors = [0xe0453a, 0xf2c14e, 0xf08cae, 0xfaf3e6, 0xd8403c, 0xf6a13a];
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, r = i % 2 ? 0.8 : 0.68;
    const tl = tulip(tulipColors[i % tulipColors.length]);
    tl.position.set(bedC.x + Math.cos(a) * r, 0.05, bedC.z + Math.sin(a) * r);
    tl.rotation.y = rand() * 3;
    island.add(grow(tl, 0.9 + i * 0.025));
    swayers.push({ obj: tl, phase: i * 0.7, amp: 0.05 });
  }

  // ---------- Rabata wzdłuż tylnej krawędzi: lawenda, róże, stokrotki ----------
  // pas ściółki w kształcie łuku (tylna połowa wyspy)
  const ringGeo = new THREE.RingGeometry(2.3, 2.95, 64, 1, 0.08, Math.PI - 0.16);
  ringGeo.rotateX(-Math.PI / 2);
  const backBed = new THREE.Mesh(ringGeo, mat(0x4a2f1c, { flatShading: false }));
  backBed.position.y = 0.006;
  backBed.receiveShadow = true;
  island.add(backBed);
  let k = 0;
  for (let deg = 185; deg <= 350; deg += 11) {
    const a = THREE.MathUtils.degToRad(deg);
    const type = k % 3;
    let plant;
    if (type === 0) plant = lavender();
    else if (type === 1) plant = flowerBush(0x3f7a36, [0xd83a4b, 0xe8607a, 0xf2a0b0], 0.17, 0.05, 9); // róża
    else plant = daisy([0xfaf6ee, 0xf3a9c7, 0xc9b3e6][k % 3]);
    plant.position.set(Math.cos(a) * 2.62, 0.01, Math.sin(a) * 2.62);
    plant.scale.setScalar(1.3);
    island.add(grow(plant, 0.5 + k * 0.05));
    swayers.push({ obj: plant, phase: k, amp: 0.04 });
    // druga, niższa linia stokrotek
    const d = daisy([0xfaf6ee, 0xf8d26a, 0xf3a9c7][k % 3]);
    d.position.set(Math.cos(a + 0.09) * 2.42, 0.01, Math.sin(a + 0.09) * 2.42);
    d.scale.setScalar(0.85);
    island.add(grow(d, 0.8 + k * 0.05));
    k++;
  }

  // ---------- Oczko wodne z liliami ----------
  const pondC = new THREE.Vector3(-1.25, 0, 0.95);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.04, 40), mat(0x4f9fd0, { flatShading: false, roughness: 0.08, metalness: 0.3 }));
  water.position.set(pondC.x, 0.01, pondC.z);
  island.add(water);
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    const st = mesh(GEO.stone, mat([0xd6d2c8, 0xbfc3c5, 0xe4dfd4][i % 3], { roughness: 0.6 }));
    st.scale.set(0.12, 0.07, 0.1);
    st.position.set(pondC.x + Math.cos(a) * 0.8, 0.04, pondC.z + Math.sin(a) * 0.8);
    st.rotation.y = rand() * 3;
    island.add(grow(st, 0.1 + i * 0.015));
  }
  [[-0.25, 0.1], [0.2, -0.2], [0.05, 0.3]].forEach((p, i) => {
    const pad = mesh(GEO.disc, mat(0x5a9e45), false);
    pad.scale.set(0.13, 0.01, 0.13);
    pad.position.set(pondC.x + p[0], 0.04, pondC.z + p[1]);
    island.add(grow(pad, 1.2 + i * 0.1));
    if (i < 2) {
      const lily = daisy(i ? 0xf6c2d4 : 0xfaf6ee);
      lily.children[0].visible = false; // bez łodygi — kwiat leży na liściu
      lily.children[1].position.y = 0.02;
      lily.position.copy(pad.position).setY(0.05);
      lily.scale.setScalar(0.8);
      island.add(grow(lily, 1.5 + i * 0.1));
    }
  });

  // ---------- Pergola z różami nad ścieżką ----------
  const arch = new THREE.Group();
  const archMat = mat(0xf2efe8, { roughness: 0.5 });
  const curvePts = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * i / 16;
    const px = -Math.cos(a) * 0.42;
    const py = i === 0 || i === 16 ? 0 : 0.7 + Math.sin(a) * 0.38;
    curvePts.push(new THREE.Vector3(px, py, 0));
  }
  curvePts.splice(1, 0, new THREE.Vector3(-0.42, 0.7, 0));
  curvePts.splice(curvePts.length - 1, 0, new THREE.Vector3(0.42, 0.7, 0));
  const archCurve = new THREE.CatmullRomCurve3(curvePts, false, 'catmullrom', 0.05);
  arch.add(mesh(new THREE.TubeGeometry(archCurve, 80, 0.035, 8), archMat));
  for (let i = 0; i < 16; i++) { // pnące róże na łuku
    const pt = archCurve.getPoint(0.08 + i / 16 * 0.84);
    const lf = mesh(GEO.blob, mat(0x3f7a36)); lf.scale.setScalar(0.085 + rand() * 0.04);
    lf.position.set(pt.x + (rand() - 0.5) * 0.05, pt.y, (rand() - 0.5) * 0.08); arch.add(lf);
    if (i % 2 === 0) {
      const rs = mesh(GEO.ball, mat(i % 4 ? 0xe8607a : 0xd83a4b, { roughness: 0.6 }));
      rs.scale.setScalar(0.045); rs.position.set(pt.x, pt.y + 0.03, 0.07); arch.add(rs);
    }
  }
  arch.position.set(1.35, 0, 1.75);
  arch.rotation.y = -0.5;
  arch.scale.setScalar(1.35);
  island.add(grow(arch, 0.6));

  // ---------- Ścieżka z płyt ----------
  [[1.85, 2.45], [1.55, 2.05], [1.2, 1.55], [1.0, 1.1], [0.85, 0.72]].forEach((p, i) => {
    const slab = mesh(new THREE.BoxGeometry(0.42, 0.04, 0.26), mat(0xd3cfc6, { roughness: 0.7 }));
    slab.position.set(p[0], 0.02, p[1]);
    slab.rotation.y = -0.6;
    slab.castShadow = false;
    island.add(grow(slab, 0.1 + i * 0.06));
  });

  // ---------- Lampa przy oczku ----------
  const lamp = new THREE.Group();
  const lampMat = mat(0xb9bcbf, { metalness: 0.6, roughness: 0.3, flatShading: false });
  const post = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 8), lampMat); post.position.y = 0.3; lamp.add(post);
  const cap = mesh(new THREE.CylinderGeometry(0.11, 0.04, 0.05, 12), lampMat); cap.position.y = 0.63; lamp.add(cap);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true });
  materials.push(bulbMat);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), bulbMat); bulb.position.y = 0.58; lamp.add(bulb);
  const glow = new THREE.PointLight(0xffc870, 1.0, 2.2); glow.position.y = 0.55; lamp.add(glow);
  lamp.position.set(-0.3, 0, 1.75);
  island.add(grow(lamp, 1.4));

  // kilka kwiatków na trawniku przy oczku
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2, r = 0.95 + rand() * 0.35;
    const d = daisy([0xfaf6ee, 0xf8d26a, 0xc9b3e6][i % 3]);
    d.position.set(pondC.x + Math.cos(a) * r, 0, pondC.z + Math.sin(a) * r);
    d.scale.setScalar(0.7);
    island.add(grow(d, 1.1 + i * 0.05));
  }

  // ---------- Dwa motyle ----------
  const butterflies = [0xf2c14e, 0xf3a9c7].map((c, i) => {
    const b = new THREE.Group();
    const wm = mat(c, { roughness: 0.5, side: THREE.DoubleSide, flatShading: false });
    const wings = [1, -1].map((side) => {
      const pivot = new THREE.Group();
      const w = new THREE.Mesh(GEO.petal, wm);
      w.scale.set(1.3, 0.12, 1.6);
      w.position.set(0, 0, side * 0.075);
      pivot.add(w);
      b.add(pivot);
      return { pivot, side };
    });
    const body = new THREE.Mesh(GEO.petal, mat(0x2b2118));
    body.scale.set(1.2, 0.25, 0.25);
    b.add(body);
    island.add(b);
    return { g: b, wings, phase: i * Math.PI, radius: 1.3 + i * 0.5, height: 1.1 + i * 0.3, speed: 0.35 + i * 0.1 };
  });

  // start: wszystko rośnie od zera
  growers.forEach((g) => { g.base = g.obj.scale.clone(); g.obj.scale.setScalar(0.0001); });

  let age = 0;
  function update(t, dt) {
    age += dt;
    growers.forEach((g) => {
      if (g.done) return;
      const p = THREE.MathUtils.clamp((age - g.delay) / 0.9, 0, 1);
      const s = Math.max(0.0001, easeOutBack(p));
      g.obj.scale.set(g.base.x * s, g.base.y * s, g.base.z * s);
      if (p >= 1) g.done = true;
    });
    swayers.forEach((w) => {
      w.obj.rotation.z = Math.sin(t * 1.1 + w.phase) * w.amp;
      w.obj.rotation.x = Math.cos(t * 0.9 + w.phase) * w.amp * 0.6;
    });
    butterflies.forEach((b) => {
      const a = t * b.speed + b.phase;
      b.g.position.set(Math.cos(a) * b.radius + 0.3, b.height + Math.sin(t * 1.7 + b.phase) * 0.15, Math.sin(a) * b.radius);
      b.g.rotation.y = -a - Math.PI / 2 * (b.speed > 0 ? 1 : -1);
      const flap = Math.sin(t * 16 + b.phase) * 0.9;
      b.wings.forEach((w) => { w.pivot.rotation.x = w.side * flap; });
      b.g.visible = age > 2;
    });
  }

  // płynne pojawianie się / znikanie całego ogrodu
  let lastOpacity = -1;
  function setOpacity(o) {
    if (Math.abs(o - lastOpacity) < 0.005) return;
    lastOpacity = o;
    const done = o > 0.995;
    materials.forEach((m) => {
      m.opacity = o;
      if (m.transparent === done) { m.transparent = !done; m.needsUpdate = true; } // pełna widoczność = szybsze rysowanie
    });
  }

  return { island, update, setOpacity };
}

// Trawnik koszony w pasy (tekstura rysowana na canvasie)
function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#5c9c3c' : '#6fb04a';
    ctx.fillRect(i * 32, 0, 32, 256);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 1500; i++) ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

// Powtarzalne „losowe" liczby — ogród wygląda zawsze tak samo
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
