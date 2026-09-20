/* =========================================================
   BobGarden — animowane sceny 2D sterowane przewijaniem
   Każda scena rysuje się w SVG 1200×700. Przewijanie sekcji
   daje postęp p od 0 (początek) do 1 (koniec), a czas t
   napędza drobne ruchy (woda, kołysanie, śnieg).

   Sceny:
   • growth   — przekrój ziemi: grunt → rury → siew → kwiaty
   • lawn     — trawnik z rolki: wałowanie → rolki → koszenie → światła
   • seasons  — ogród przez cztery pory roku

   Każda scena ma: steps (od kiedy zaczyna się etap),
   defaults (teksty, gdy brak ich w content.json),
   build(svg) i update(p, t, lang).
   ========================================================= */
(function () {
  'use strict';

  // ---------- Pomocnicze ----------
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function seeded(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function range(p, a, b) { return clamp01((p - a) / (b - a)); }   // postęp p w przedziale a…b (0…1)
  function lerp(a, b, k) { return a + (b - a) * k; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeIn(x) { return x * x * x; }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeBack(x) { var c = 1.7; return x <= 0 ? 0 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function drawLine(path) { var L = path.getTotalLength(); path.style.strokeDasharray = L; path.style.strokeDashoffset = L; return L; }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(c1, c2, k) {
    var a = hex(c1), b = hex(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], k)) + ',' + Math.round(lerp(a[1], b[1], k)) + ',' + Math.round(lerp(a[2], b[2], k)) + ')';
  }
  // kolor / liczba zależna od postępu: stops = [[p, wartość], …]
  function colorAt(p, stops) {
    if (p <= stops[0][0]) return mix(stops[0][1], stops[0][1], 0);
    for (var i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (p - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    }
    return mix(stops[stops.length - 1][1], stops[stops.length - 1][1], 0);
  }
  function valAt(p, stops) {
    if (p <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) return lerp(stops[i - 1][1], stops[i][1], (p - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    }
    return stops[stops.length - 1][1];
  }
  function T(g, x, y, extra) { g.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')' + (extra || '')); }
  function op(el, v) { el.setAttribute('opacity', Math.max(0, Math.min(1, v)).toFixed(3)); }
  function bi(pl, en) { return { pl: pl, en: en }; }
  function step(tpl, ten, xpl, xen) { return { title: bi(tpl, ten), text: bi(xpl, xen) }; }

  // Wspólne: zraszacz wysuwany z ziemi
  function sprinkler(root, x, groundY) {
    var g = svg('g', { opacity: 0 }, root);
    svg('rect', { x: x - 8, y: 0, width: 16, height: 46, rx: 4, fill: '#2b3a44' }, g);
    svg('rect', { x: x - 11, y: -4, width: 22, height: 9, rx: 3, fill: '#3d8b3d' }, g);
    var spray = svg('g', { opacity: 0 }, g);
    [-1, 1].forEach(function (side) {
      [60, 95, 130].forEach(function (len, k) {
        svg('path', { d: 'M' + x + ',-2 Q' + (x + side * len * 0.6) + ',' + (-60 - k * 12) + ' ' + (x + side * len) + ',' + (18 + k * 4),
          stroke: '#7cc4ff', 'stroke-width': 2.5, 'stroke-dasharray': '3 11', 'stroke-linecap': 'round', fill: 'none' }, spray);
      });
    });
    return {
      set: function (rise, sprayK, t) {
        T(g, 0, groundY - 10 - rise * 50);
        op(g, rise > 0.01 ? 1 : 0);
        op(spray, sprayK);
        Array.prototype.forEach.call(spray.children, function (sp) { sp.style.strokeDashoffset = (-t * 40).toFixed(1); });
      }
    };
  }

  // Wspólne: kwiat z płatków (grupa .pop — skaluje się od środka)
  function flowerHead(root, x, y, color, petals, size) {
    var head = svg('g', { 'class': 'pop' }, root);
    for (var i = 0; i < petals; i++) {
      svg('ellipse', { cx: x, cy: y - size, rx: size * 0.55, ry: size, fill: color, transform: 'rotate(' + (i * 360 / petals) + ' ' + x + ' ' + y + ')' }, head);
    }
    svg('circle', { cx: x, cy: y, r: size * 0.55, fill: color === '#f2c14e' ? '#8a5a1a' : '#f2c14e' }, head);
    return head;
  }

  var SCENES = {};

  // =========================================================
  // 1. PRZEKRÓJ ZIEMI — od gołej ziemi do kwitnącego ogrodu
  // =========================================================
  SCENES.growth = {
    steps: [0, 0.15, 0.45, 0.62],
    defaults: {
      title: bi('Od gołej ziemi do kwitnącego ogrodu', 'From bare soil to a garden in bloom'),
      steps: [
        step('Przygotowanie gruntu', 'Ground preparation', 'Usuwamy stary trawnik i chwasty, poprawiamy glebę i drenaż.', 'We remove old turf and weeds, improve the soil and drainage.'),
        step('System nawadniania', 'Irrigation system', 'Pod ziemią układamy rury i linie kroplujące, a zraszacze wysuwają się tylko na czas podlewania.', 'Pipes and drip lines go underground; pop-up sprinklers rise only while watering.'),
        step('Siew i nasadzenia', 'Sowing and planting', 'Rozkładamy żyzną ziemię, wysiewamy trawę i sadzimy rośliny dobrane do Twojej działki.', 'We spread rich topsoil, sow grass and plant species chosen for your plot.'),
        step('Ogród rośnie', 'Your garden grows', 'Korzenie piją wodę z systemu, trawa gęstnieje, a rabaty kwitną — sezon po sezonie.', 'Roots drink from the system, the lawn thickens and the beds bloom — season after season.')
      ]
    },
    build: function (root) {
      var GROUND = 380, R = seeded(42);
      var G = { weeds: [], particles: [], blades: [], plants: [], drops: [], sprinklers: [] };
      var defs = svg('defs', null, root);
      var wet = svg('radialGradient', { id: 'wetGrad' }, defs);
      svg('stop', { offset: '0%', 'stop-color': '#2f1e10', 'stop-opacity': '0.55' }, wet);
      svg('stop', { offset: '100%', 'stop-color': '#2f1e10', 'stop-opacity': '0' }, wet);
      svg('rect', { width: 1200, height: 700, fill: 'url(#growthSky)' }, root);
      var sky = svg('linearGradient', { id: 'growthSky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svg('stop', { offset: '0%', 'stop-color': '#dfeadb' }, sky);
      svg('stop', { offset: '60%', 'stop-color': '#f6f2e8' }, sky);

      G.sun = svg('g', { opacity: 0 }, root);
      G.sunRays = svg('g', null, G.sun);
      for (var r = 0; r < 12; r++) svg('rect', { x: -3, y: -95, width: 6, height: 26, rx: 3, fill: '#f2c14e', transform: 'rotate(' + (r * 30) + ')' }, G.sunRays);
      svg('circle', { r: 52, fill: '#f6cf62' }, G.sun);

      function wavy(y, amp, seed) {
        var d = 'M0,' + y, rr = seeded(seed);
        for (var x = 0; x <= 1200; x += 100) d += ' Q' + (x + 50) + ',' + (y + (rr() - 0.5) * amp * 2) + ' ' + (x + 100) + ',' + y;
        return d + ' L1200,700 L0,700 Z';
      }
      // warstwy od góry: żyzna ziemia, podglebie, żwir (każda kolejna przykrywa dolną część poprzedniej)
      svg('path', { d: wavy(GROUND, 4, 9), fill: '#6a4426' }, root);
      svg('path', { d: wavy(452, 12, 5), fill: '#8a6843' }, root);
      var stones2 = svg('g', null, root);
      for (var j = 0; j < 22; j++) svg('ellipse', { cx: R() * 1200, cy: 470 + R() * 70, rx: 3 + R() * 6, ry: 2 + R() * 4, fill: '#a78a63' }, stones2);
      svg('path', { d: wavy(560, 14, 3), fill: '#a8957a' }, root);
      var stones = svg('g', null, root);
      for (var i = 0; i < 70; i++) svg('ellipse', { cx: R() * 1200, cy: 580 + R() * 110, rx: 6 + R() * 14, ry: 4 + R() * 8, fill: ['#c9bda8', '#b7a98f', '#d8cfbd', '#9d8f78'][i % 4] }, stones);
      G.labels = svg('g', { 'font-family': 'Manrope, sans-serif', 'font-size': 15, 'font-weight': 700, fill: 'rgba(255,255,255,0.8)', 'letter-spacing': '2', stroke: 'rgba(60,35,15,0.35)', 'stroke-width': 0.6 }, root);

      G.wetSpots = svg('g', { opacity: 0 }, root);
      for (var w = 225; w < 1200; w += 150) svg('ellipse', { cx: w, cy: 425, rx: 70, ry: 36, fill: 'url(#wetGrad)' }, G.wetSpots);
      G.trench = svg('rect', { x: 0, y: GROUND, width: 0, height: 52, fill: '#3e2716' }, root);
      G.pipe = svg('path', { d: 'M-10,410 L1210,410', stroke: '#23303a', 'stroke-width': 14, 'stroke-linecap': 'round', fill: 'none' }, root);
      G.water = svg('path', { d: 'M-10,410 L1210,410', stroke: '#5fb4ff', 'stroke-width': 5, 'stroke-dasharray': '22 16', fill: 'none', opacity: 0 }, root);
      G.emitters = svg('g', { opacity: 0 }, root);
      for (var e = 225; e < 1200; e += 150) {
        svg('circle', { cx: e, cy: 410, r: 7, fill: '#1b252d', stroke: '#5fb4ff', 'stroke-width': 2 }, G.emitters);
        for (var dd = 0; dd < 3; dd++) G.drops.push({ el: svg('circle', { cx: e + (dd - 1) * 10, cy: 420, r: 3, fill: '#5fb4ff', opacity: 0 }, root), phase: dd / 3 + R() * 0.2 });
      }
      [560, 860, 1120].forEach(function (sx) { G.sprinklers.push(sprinkler(root, sx, GROUND + 20)); });

      for (var k = 0; k < 12; k++) {
        var wx = 60 + k * 98 + R() * 40, weed = svg('g', null, root);
        for (var b = 0; b < 5; b++) {
          var h = 20 + R() * 26, dx = (R() - 0.5) * 22;
          svg('path', { d: 'M' + wx + ',' + GROUND + ' q' + dx * 0.4 + ',' + (-h * 0.5) + ' ' + dx + ',' + (-h), stroke: ['#8a8a3a', '#6f7a3a', '#a38f4a'][b % 3], 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, weed);
        }
        G.weeds.push({ el: weed, rot: (R() - 0.5) * 60, dx: (R() - 0.5) * 80 });
      }
      G.oldTurf = svg('rect', { x: 0, y: GROUND - 6, width: 1200, height: 8, fill: '#7d8a4a' }, root);
      root.insertBefore(G.oldTurf, G.weeds[0].el);
      G.mulch = svg('path', { d: wavy(GROUND - 8, 5, 13).replace(/L1200,700 L0,700 Z$/, 'L1200,' + (GROUND + 10) + ' L0,' + (GROUND + 10) + ' Z'), fill: '#4a2e18', opacity: 0 }, root);
      for (var q = 0; q < 150; q++) {
        var pe = q % 3 === 0
          ? svg('ellipse', { cx: 0, cy: 0, rx: 4, ry: 2.6, fill: '#c89b5a' }, root)
          : svg('circle', { cx: 0, cy: 0, r: 2 + R() * 3.5, fill: ['#4a2e18', '#5c3a1f', '#3b2413'][q % 3] }, root);
        G.particles.push({ el: pe, x: R() * 1200, land: GROUND - 6 + R() * 12, start: 0.47 + R() * 0.1, rot: R() * 180 });
      }

      var palette = ['#9b6fd1', '#e98bb0', '#f2c14e', '#f5efe0', '#8fb4e8', '#e46b5d'];
      [90, 200, 320, 470, 545, 640, 715, 800, 885, 965, 1040, 1110, 1170].forEach(function (x, idx) {
        var Hh = 120 + R() * 110, bend = (R() - 0.5) * 50;
        var p = { roots: [], leaves: [], delay: R() * 0.05 };
        var rootsG = svg('g', null, root);
        for (var rt = 0; rt < 3; rt++) {
          var rl = 50 + R() * 90, ang = (rt - 1) * 35 + (R() - 0.5) * 20;
          var ex = x + Math.sin(ang * Math.PI / 180) * rl, ey = GROUND + Math.cos(ang * Math.PI / 180) * rl;
          p.roots.push(svg('path', { d: 'M' + x + ',' + (GROUND + 2) + ' Q' + (x + (ex - x) * 0.3 + (R() - 0.5) * 20) + ',' + (GROUND + rl * 0.6) + ' ' + ex + ',' + ey,
            stroke: '#e3cfa6', 'stroke-width': 1.8, fill: 'none', 'stroke-linecap': 'round' }, rootsG));
        }
        p.stem = svg('path', { d: 'M' + x + ',' + GROUND + ' Q' + (x + bend) + ',' + (GROUND - Hh * 0.55) + ' ' + (x + bend * 0.6) + ',' + (GROUND - Hh),
          stroke: '#4f8a34', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, root);
        var stemLen = p.stem.getTotalLength();
        [0.35, 0.6].forEach(function (f, li) {
          var pt = p.stem.getPointAtLength(stemLen * f), side = li % 2 ? 1 : -1;
          var leafG = svg('g', { 'class': 'pop' }, root);
          svg('ellipse', { cx: pt.x + side * 16, cy: pt.y, rx: 17, ry: 7, fill: '#5d9e45', transform: 'rotate(' + (side * -30) + ' ' + (pt.x + side * 16) + ' ' + pt.y + ')' }, leafG);
          p.leaves.push(leafG);
        });
        p.head = flowerHead(root, x + bend * 0.6, GROUND - Hh, palette[idx % palette.length], 7, 15);
        p.stemLen = drawLine(p.stem);
        p.roots.forEach(drawLine);
        G.plants.push(p);
      });

      var bladesG = svg('g', null, root);
      for (var gb = 0; gb < 190; gb++) {
        var bx = gb * (1200 / 190) + R() * 4, bh = 16 + R() * 26;
        G.blades.push({ el: svg('path', { d: 'M' + (bx - 3) + ',' + (GROUND + 2) + ' Q' + (bx + (R() - 0.5) * 8) + ',' + (GROUND - bh * 0.6) + ' ' + (bx + (R() - 0.5) * 6) + ',' + (GROUND - bh) + ' L' + (bx + 3) + ',' + (GROUND + 2) + ' Z',
          fill: ['#5c9c3c', '#6fb04a', '#4f8a34'][gb % 3], 'class': 'blade' }, bladesG), start: 0.62 + R() * 0.1 });
      }
      [['ŻYZNA ZIEMIA', 'TOPSOIL', 442], ['PODGLEBIE', 'SUBSOIL', 520], ['ŻWIR / DRENAŻ', 'GRAVEL / DRAINAGE', 640]].forEach(function (l) {
        var tx = svg('text', { x: 1110, y: l[2], 'text-anchor': 'end' }, G.labels);
        tx.dataset.pl = l[0]; tx.dataset.en = l[1];
      });
      return G;
    },
    update: function (G, p, t, lang) {
      // ziemia jest na miejscu od początku — chwasty stoją na starym trawniku
      Array.prototype.forEach.call(G.labels.children, function (tx) { tx.textContent = tx.dataset[lang] || tx.dataset.pl; });
      op(G.labels, range(p, 0.08, 0.13) * (1 - range(p, 0.6, 0.7)));
      G.weeds.forEach(function (w, i) {
        var k = easeIn(range(p, 0.03 + i * 0.006, 0.1 + i * 0.006)); // wyrywane po kolei
        T(w.el, w.dx * k, -k * 180, ' rotate(' + (w.rot * k).toFixed(1) + ')');
        op(w.el, 1 - k);
      });
      op(G.oldTurf, 1 - range(p, 0.06, 0.13));
      G.trench.setAttribute('width', (1200 * range(p, 0.15, 0.22)).toFixed(0));
      op(G.trench, 1 - range(p, 0.42, 0.47));
      G.pipe.style.strokeDasharray = 1220;
      G.pipe.style.strokeDashoffset = (1220 * (1 - range(p, 0.2, 0.32))).toFixed(0);
      var waterOn = range(p, 0.31, 0.35);
      op(G.water, waterOn);
      G.water.style.strokeDashoffset = (-t * 60).toFixed(1);
      op(G.emitters, range(p, 0.3, 0.33));
      op(G.wetSpots, range(p, 0.35, 0.5));
      G.drops.forEach(function (d) {
        var cyc = (t * 0.9 + d.phase) % 1;
        d.el.setAttribute('cy', (418 + cyc * 40).toFixed(1));
        op(d.el, waterOn * (1 - cyc) * 0.9);
      });
      var rise = range(p, 0.34, 0.39) * (1 - range(p, 0.5, 0.55));
      G.sprinklers.forEach(function (s) { s.set(rise, range(p, 0.38, 0.4) * (1 - range(p, 0.48, 0.5)), t); });
      G.particles.forEach(function (pt) {
        var k = range(p, pt.start, pt.start + 0.04);
        T(pt.el, pt.x, -30 + (pt.land + 30) * (k * k), ' rotate(' + (pt.rot * k).toFixed(0) + ')');
        op(pt.el, (k > 0 ? 1 : 0) * (1 - range(p, 0.7, 0.76) * 0.7));
      });
      op(G.mulch, range(p, 0.55, 0.62));
      G.blades.forEach(function (b) { b.el.style.transform = 'scaleY(' + easeOut(range(p, b.start, b.start + 0.12)).toFixed(3) + ')'; });
      G.plants.forEach(function (pl) {
        var rootsK = range(p, 0.63 + pl.delay, 0.82);
        pl.roots.forEach(function (r) {
          r.style.strokeDashoffset = (parseFloat(r.style.strokeDasharray) * (1 - rootsK)).toFixed(1);
          r.style.opacity = rootsK > 0.01 ? 1 : 0; // zaokrąglony koniec linii rysowałby kropkę
        });
        var stemK = easeOut(range(p, 0.66 + pl.delay, 0.8 + pl.delay));
        pl.stem.style.strokeDashoffset = (pl.stemLen * (1 - stemK)).toFixed(1);
        pl.stem.style.opacity = stemK > 0.01 ? 1 : 0;
        var leafK = easeBack(range(p, 0.72 + pl.delay, 0.8 + pl.delay));
        pl.leaves.forEach(function (lf) { lf.style.transform = 'scale(' + Math.max(0, leafK).toFixed(3) + ')'; });
        var bloom = easeBack(range(p, 0.8 + pl.delay, 0.88 + pl.delay));
        pl.head.style.transform = 'scale(' + Math.max(0, bloom).toFixed(3) + ') rotate(' + ((1 - bloom) * -120 + Math.sin(t * 1.6 + pl.delay * 80) * 4 * bloom).toFixed(1) + 'deg)';
      });
      var sunK = easeOut(range(p, 0.86, 0.96));
      op(G.sun, sunK);
      T(G.sun, 1080, 200 - sunK * 100);
      G.sunRays.setAttribute('transform', 'rotate(' + (t * 12).toFixed(1) + ')');
    }
  };

  // =========================================================
  // 2. TRAWNIK Z ROLKI — od nierównej ziemi do wieczornych świateł
  // =========================================================
  SCENES.lawn = {
    steps: [0, 0.22, 0.56, 0.8],
    viewBox: '0 110 1200 590', // trochę bliżej niż domyślnie — dom i trawnik są większe
    mobileViewBox: '400 110 600 590', // na telefonie kadr wokół domu
    defaults: {
      title: bi('Trawnik z rolki w jeden dzień', 'A turf lawn in a single day'),
      steps: [
        step('Wyrównanie i wałowanie', 'Levelling and rolling', 'Wyrównujemy teren, usuwamy kamienie i zagęszczamy podłoże walcem — bez tego trawnik byłby pofałdowany.', 'We level the ground, clear stones and firm the base with a roller — otherwise the lawn would be bumpy.'),
        step('Układanie trawy z rolki', 'Laying the turf', 'Rozwijamy pasy gotowej darni na styk. Po kilku godzinach ogród jest zielony.', 'We unroll strips of ready-grown turf edge to edge. A few hours later the garden is green.'),
        step('Podlewanie i pierwsze koszenie', 'Watering and first mow', 'Obfite podlewanie pomaga korzeniom się przyjąć, a pierwsze koszenie zostawia piękne pasy.', 'Generous watering helps the roots take hold, and the first mow leaves those classic stripes.'),
        step('Oświetlenie ogrodu', 'Garden lighting', 'Po zmroku ogród pracuje dalej: lampy przy ścieżkach i podświetlone drzewa robią efekt.', 'After dark the garden keeps working: path lights and up-lit trees set the mood.')
      ]
    },
    build: function (root) {
      var GROUND = 470, R = seeded(7);
      var L = { debris: [], strips: [], lamps: [], clippings: [], sprinklers: [] };
      var defs = svg('defs', null, root);
      var sky = svg('linearGradient', { id: 'lawnSky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      L.sky1 = svg('stop', { offset: '0%', 'stop-color': '#bfe0f0' }, sky);
      L.sky2 = svg('stop', { offset: '100%', 'stop-color': '#f1f4e6' }, sky);
      var glow = svg('radialGradient', { id: 'lampGlow' }, defs);
      svg('stop', { offset: '0%', 'stop-color': '#ffe3a3', 'stop-opacity': '0.95' }, glow);
      svg('stop', { offset: '100%', 'stop-color': '#ffe3a3', 'stop-opacity': '0' }, glow);
      var beam = svg('linearGradient', { id: 'upBeam', x1: 0, y1: 1, x2: 0, y2: 0 }, defs);
      svg('stop', { offset: '0%', 'stop-color': '#ffe3a3', 'stop-opacity': '0.7' }, beam);
      svg('stop', { offset: '100%', 'stop-color': '#ffe3a3', 'stop-opacity': '0' }, beam);
      // wzór źdźbeł trawy (brzeg darni)
      // wzór trawy: źdźbła wyrastają z pełnego pasa zieleni (bez prześwitów u dołu)
      var pat = svg('pattern', { id: 'grassEdge', x: 0, y: GROUND - 34, width: 12, height: 20, patternUnits: 'userSpaceOnUse' }, defs);
      svg('path', { d: 'M-1,20 L2,6 L5,20 Z M3,20 L7,0 L10,20 Z M8,20 L11,8 L13,20 Z', fill: '#5fa33e' }, pat);
      svg('rect', { x: 0, y: 14, width: 12, height: 6, fill: '#4f8f36' }, pat);
      var patS = svg('pattern', { id: 'grassShort', x: 0, y: GROUND - 26, width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, defs);
      svg('path', { d: 'M-1,10 L2,4 L4,10 Z M3,10 L6,2 L9,10 Z M7,10 L9,5 L11,10 Z', fill: '#66ab45' }, patS);
      svg('rect', { x: 0, y: 7, width: 10, height: 3, fill: '#5a9f3e' }, patS);

      svg('rect', { width: 1200, height: 700, fill: 'url(#lawnSky)' }, root);
      L.stars = svg('g', { opacity: 0 }, root);
      for (var s = 0; s < 45; s++) svg('circle', { cx: R() * 1200, cy: R() * 300, r: 0.8 + R() * 1.4, fill: '#fff' }, L.stars);
      L.moon = svg('g', { opacity: 0 }, root);
      svg('circle', { cx: 980, cy: 185, r: 70, fill: 'url(#lampGlow)', opacity: 0.4 }, L.moon);
      svg('circle', { cx: 980, cy: 185, r: 28, fill: '#f7f0d8' }, L.moon);
      L.sun = svg('circle', { cx: 980, cy: 200, r: 40, fill: '#f6cf62' }, root);

      // ogrodzenie panelowe (jak na zdjęciach realizacji)
      var fence = svg('g', null, root);
      for (var fx = 0; fx <= 1200; fx += 34) {
        if (fx > 585 && fx < 880) continue;
        svg('rect', { x: fx, y: 392, width: 4, height: 78, fill: '#2c3a33' }, fence);
      }
      svg('rect', { x: 0, y: 402, width: 590, height: 5, fill: '#2c3a33' }, fence);
      svg('rect', { x: 0, y: 450, width: 590, height: 5, fill: '#2c3a33' }, fence);
      svg('rect', { x: 876, y: 402, width: 324, height: 5, fill: '#2c3a33' }, fence);
      svg('rect', { x: 876, y: 450, width: 324, height: 5, fill: '#2c3a33' }, fence);

      // nowoczesny biały dom
      var house = svg('g', null, root);
      svg('rect', { x: 600, y: 300, width: 270, height: 170, fill: '#f4f3ef' }, house);
      svg('rect', { x: 590, y: 290, width: 290, height: 14, fill: '#2d3136' }, house);
      L.win1 = svg('rect', { x: 625, y: 338, width: 90, height: 112, fill: '#9fb7c6', stroke: '#2d3136', 'stroke-width': 5 }, house);
      L.win2 = svg('rect', { x: 745, y: 345, width: 96, height: 60, fill: '#9fb7c6', stroke: '#2d3136', 'stroke-width': 5 }, house);
      svg('rect', { x: 595, y: 462, width: 280, height: 8, fill: '#3a3f44' }, house);

      // drzewko na trawniku
      L.tree = svg('g', null, root);
      svg('rect', { x: 1004, y: 330, width: 12, height: 140, fill: '#6b4a2f' }, L.tree);
      [[1010, 300, 70, 60, '#4f9a3f'], [972, 322, 46, 40, '#5fae4a'], [1048, 318, 48, 42, '#468c38']].forEach(function (c) {
        svg('ellipse', { cx: c[0], cy: c[1], rx: c[2], ry: c[3], fill: c[4] }, L.tree);
      });

      // ziemia: wierzch nierówny, dopóki nie przejedzie walec
      L.bumps = [];
      for (var bx = 0; bx <= 1200; bx += 30) L.bumps.push((R() - 0.5) * 22 + (R() < 0.2 ? -14 : 0));
      L.soil = svg('path', { fill: '#6a4426' }, root);
      svg('rect', { x: 0, y: 560, width: 1200, height: 140, fill: '#8a6843' }, root);
      var st = svg('g', null, root);
      for (var i = 0; i < 40; i++) svg('ellipse', { cx: R() * 1200, cy: 575 + R() * 110, rx: 5 + R() * 10, ry: 3 + R() * 6, fill: ['#c9bda8', '#b7a98f', '#a78a63'][i % 3] }, st);
      for (var d = 0; d < 16; d++) {
        var dx = 40 + d * 72 + R() * 30;
        L.debris.push({ x: dx, el: svg('ellipse', { cx: dx, cy: GROUND - 6 - R() * 6, rx: 6 + R() * 8, ry: 4 + R() * 4, fill: ['#8d8378', '#5a3b22', '#a39684'][d % 3] }, root) });
      }

      // darń: 4 pasy po 300 px, każdy rozwija się z rolki
      L.turfLayer = svg('g', null, root);
      for (var k = 0; k < 4; k++) {
        var x0 = k * 300;
        var g = svg('g', null, L.turfLayer);
        var side = svg('rect', { x: x0, y: GROUND - 16, width: 0, height: 16, fill: '#4f8f36' }, g);
        var edge = svg('rect', { x: x0, y: GROUND - 34, width: 0, height: 20, fill: 'url(#grassEdge)' }, g);
        svg('rect', { x: x0, y: GROUND - 4, width: 300, height: 4, fill: '#5a3b22', opacity: 0 }, g);
        var roll = svg('g', { opacity: 0 }, root);
        var outer = svg('circle', { cx: 0, cy: 0, r: 30, fill: '#3f7a2e', stroke: '#5fa33e', 'stroke-width': 4 }, roll);
        var spiral = svg('g', null, roll);
        svg('circle', { cx: 0, cy: 0, r: 18, fill: 'none', stroke: '#5a3b22', 'stroke-width': 3 }, spiral);
        svg('circle', { cx: 0, cy: 0, r: 8, fill: 'none', stroke: '#5a3b22', 'stroke-width': 3 }, spiral);
        svg('line', { x1: 0, y1: 0, x2: 16, y2: 0, stroke: '#5a3b22', 'stroke-width': 2 }, spiral);
        L.strips.push({ x0: x0, side: side, edge: edge, roll: roll, outer: outer, spiral: spiral, start: 0.24 + k * 0.075 });
      }
      L.seams = svg('g', { opacity: 0 }, root);
      [300, 600, 900].forEach(function (x) { svg('line', { x1: x, y1: GROUND - 30, x2: x, y2: GROUND, stroke: 'rgba(40,25,10,0.5)', 'stroke-width': 2 }, L.seams); });

      // skoszony trawnik w pasy (odsłaniany za kosiarką)
      var clipM = svg('clipPath', { id: 'mowedClip' }, defs);
      L.mowClip = svg('rect', { x: 0, y: 0, width: 0, height: 700 }, clipM);
      var clipT = svg('clipPath', { id: 'tallClip' }, defs);
      L.tallClip = svg('rect', { x: -10, y: 0, width: 1300, height: 700 }, clipT);
      L.turfLayer.setAttribute('clip-path', 'url(#tallClip)');
      L.mowed = svg('g', { 'clip-path': 'url(#mowedClip)' }, root);
      for (var m = 0; m < 20; m++) svg('rect', { x: m * 60, y: GROUND - 16, width: 60, height: 16, fill: m % 2 ? '#4f8f36' : '#66ab45' }, L.mowed);
      svg('rect', { x: 0, y: GROUND - 26, width: 1200, height: 10, fill: 'url(#grassShort)' }, L.mowed);
      L.wet = svg('rect', { x: 0, y: GROUND - 30, width: 1200, height: 30, fill: '#1c4f86', opacity: 0 }, root);

      [210, 470, 930].forEach(function (x) { L.sprinklers.push(sprinkler(root, x, GROUND)); });

      // kosiarka
      L.mower = svg('g', { opacity: 0 }, root);
      svg('line', { x1: -30, y1: -30, x2: -85, y2: -110, stroke: '#2b3a44', 'stroke-width': 5, 'stroke-linecap': 'round' }, L.mower);
      svg('line', { x1: -95, y1: -112, x2: -75, y2: -108, stroke: '#2b3a44', 'stroke-width': 7, 'stroke-linecap': 'round' }, L.mower);
      svg('rect', { x: -44, y: -30, width: 88, height: 24, rx: 8, fill: '#3d8b3d' }, L.mower);
      svg('rect', { x: -20, y: -48, width: 40, height: 22, rx: 6, fill: '#2b3a44' }, L.mower);
      svg('rect', { x: -48, y: -14, width: 20, height: 8, rx: 3, fill: '#e2c08d' }, L.mower);
      L.wheels = [-28, 28].map(function (wx) {
        var w = svg('g', null, L.mower);
        svg('circle', { cx: 0, cy: 0, r: 11, fill: '#1d1f21' }, w);
        svg('line', { x1: -6, y1: 0, x2: 6, y2: 0, stroke: '#9aa3a8', 'stroke-width': 2 }, w);
        return { el: w, x: wx };
      });
      for (var c = 0; c < 18; c++) L.clippings.push({ el: svg('rect', { width: 3, height: 7, rx: 1.5, fill: '#6fb04a', opacity: 0 }, root), ph: R(), dx: R() });

      // walec do wyrównania gruntu
      L.roller = svg('g', { opacity: 0 }, root);
      svg('line', { x1: 0, y1: 0, x2: -80, y2: -95, stroke: '#4b5358', 'stroke-width': 5, 'stroke-linecap': 'round' }, L.roller);
      svg('line', { x1: -92, y1: -97, x2: -70, y2: -93, stroke: '#4b5358', 'stroke-width': 7, 'stroke-linecap': 'round' }, L.roller);
      svg('circle', { cx: 0, cy: 0, r: 32, fill: '#9aa3a8', stroke: '#5f676c', 'stroke-width': 4 }, L.roller);
      L.rollerSpoke = svg('line', { x1: -24, y1: 0, x2: 24, y2: 0, stroke: '#5f676c', 'stroke-width': 3 }, L.roller);
      svg('circle', { cx: 0, cy: 0, r: 5, fill: '#4b5358' }, L.roller);

      // lampy ogrodowe (słupki)
      [120, 330, 520, 930, 1140].forEach(function (x) {
        var g = svg('g', { 'class': 'blade' }, root);
        svg('rect', { x: x - 5, y: GROUND - 58, width: 10, height: 44, rx: 2, fill: '#2b3136' }, g);
        svg('rect', { x: x - 8, y: GROUND - 62, width: 16, height: 6, rx: 2, fill: '#2b3136' }, g);
        var bulb = svg('rect', { x: x - 4, y: GROUND - 55, width: 8, height: 8, fill: '#ffe3a3', opacity: 0 }, g);
        L.lamps.push({ post: g, bulb: bulb, x: x });
      });

      // noc: przyciemnienie i światła na wierzchu
      L.night = svg('rect', { width: 1200, height: 700, fill: '#0b1830', opacity: 0 }, root);
      root.appendChild(L.stars); // gwiazdy i księżyc nad przyciemnieniem — świecą w nocy
      root.appendChild(L.moon);
      L.lights = svg('g', { opacity: 0 }, root);
      svg('rect', { x: 627, y: 340, width: 86, height: 108, fill: '#ffd98a', opacity: 0.9 }, L.lights);
      svg('rect', { x: 747, y: 347, width: 92, height: 56, fill: '#ffd98a', opacity: 0.8 }, L.lights);
      svg('polygon', { points: '1004,468 950,255 1070,255 1016,468', fill: 'url(#upBeam)', opacity: 0.55 }, L.lights);
      L.glows = L.lamps.map(function (lp) {
        var g = svg('g', null, L.lights);
        svg('circle', { cx: lp.x, cy: GROUND - 50, r: 55, fill: 'url(#lampGlow)' }, g);
        svg('ellipse', { cx: lp.x, cy: GROUND - 18, rx: 70, ry: 12, fill: 'url(#lampGlow)', opacity: 0.8 }, g);
        svg('rect', { x: lp.x - 4, y: GROUND - 55, width: 8, height: 8, fill: '#fff4d6' }, g);
        return g;
      });
      return L;
    },
    update: function (L, p, t) {
      var GROUND = 470;
      // 1. walec wyrównuje ziemię
      var rollerX = lerp(-90, 1300, range(p, 0.02, 0.2));
      op(L.roller, range(p, 0, 0.02) * (1 - range(p, 0.2, 0.22)));
      T(L.roller, rollerX, GROUND - 32);
      L.rollerSpoke.setAttribute('transform', 'rotate(' + (rollerX * 1.8).toFixed(0) + ')');
      var d = 'M0,700 L0,' + GROUND;
      L.bumps.forEach(function (b, i) {
        var x = i * 30;
        d += ' L' + x + ',' + (GROUND + (x > rollerX - 20 ? b : 0)).toFixed(1);
      });
      L.soil.setAttribute('d', d + ' L1200,700 Z');
      L.debris.forEach(function (db) { op(db.el, db.x > rollerX - 30 ? 1 : 0); });

      // 2. pasy darni rozwijają się z rolek
      L.strips.forEach(function (s) {
        var k = easeInOut(range(p, s.start, s.start + 0.085));
        var w = 300 * k + (k > 0 ? 2 : 0); // 2 px zakładki — pasy łączą się bez szpar
        s.side.setAttribute('width', w.toFixed(1));
        s.edge.setAttribute('width', w.toFixed(1));
        var r = 8 + 26 * (1 - k);
        op(s.roll, k > 0 && k < 0.99 ? 1 : 0); // rolka widoczna tylko podczas rozwijania
        T(s.roll, s.x0 + 300 * k + r * 0.3, GROUND - r);
        s.outer.setAttribute('r', r.toFixed(1));
        s.spiral.setAttribute('transform', 'scale(' + (r / 34).toFixed(3) + ') rotate(' + (k * 900).toFixed(0) + ')');
      });
      op(L.seams, range(p, 0.5, 0.55) * (1 - range(p, 0.64, 0.7)));

      // 3. podlewanie i koszenie w pasy
      var rise = range(p, 0.56, 0.59) * (1 - range(p, 0.66, 0.69));
      L.sprinklers.forEach(function (s) { s.set(rise, range(p, 0.58, 0.6) * (1 - range(p, 0.65, 0.67)), t); });
      op(L.wet, 0.22 * range(p, 0.58, 0.62) * (1 - range(p, 0.68, 0.8)));
      var mk = range(p, 0.66, 0.8);
      var mowerX = lerp(-150, 1350, mk);
      op(L.mower, range(p, 0.64, 0.66) * (1 - range(p, 0.8, 0.82)));
      T(L.mower, mowerX, GROUND - 22 + Math.sin(t * 30) * 0.8);
      L.wheels.forEach(function (w) { w.el.setAttribute('transform', 'translate(' + w.x + ',-4) rotate(' + (mowerX * 3).toFixed(0) + ')'); });
      var cut = mk <= 0 ? -20 : Math.max(0, mowerX - 40);
      L.mowClip.setAttribute('width', cut.toFixed(1));
      L.tallClip.setAttribute('x', cut.toFixed(1));
      L.clippings.forEach(function (c) {
        var cyc = (t * 1.4 + c.ph) % 1, on = mk > 0 && mk < 1;
        c.el.setAttribute('x', (mowerX - 50 - cyc * 60 - c.dx * 20).toFixed(1));
        c.el.setAttribute('y', (GROUND - 30 - Math.sin(cyc * Math.PI) * 40).toFixed(1));
        op(c.el, on ? 1 - cyc : 0);
      });

      // 4. zmierzch i światła
      var n1 = range(p, 0.8, 0.87), n2 = range(p, 0.87, 0.97);
      L.sky1.setAttribute('stop-color', n2 > 0 ? mix('#f0a36e', '#0f1c33', n2) : mix('#bfe0f0', '#f0a36e', n1));
      L.sky2.setAttribute('stop-color', n2 > 0 ? mix('#f9d9b5', '#2b3d5c', n2) : mix('#f1f4e6', '#f9d9b5', n1));
      L.sun.setAttribute('cy', (200 + n1 * 170 + n2 * 150).toFixed(1));
      op(L.sun, 1 - n2);
      op(L.stars, n2);
      op(L.moon, n2);
      op(L.night, n1 * 0.12 + n2 * 0.4);
      L.lamps.forEach(function (lp, i) {
        lp.post.style.transform = 'scaleY(' + easeBack(range(p, 0.78 + i * 0.008, 0.82 + i * 0.008)).toFixed(3) + ')';
      });
      op(L.lights, range(p, 0.9, 0.96) * (0.94 + Math.sin(t * 7) * 0.03));
      L.tree.setAttribute('transform', 'rotate(' + (Math.sin(t * 1.1) * 0.6).toFixed(2) + ' 1010 470)');
    }
  };

  // =========================================================
  // 3. CZTERY PORY ROKU — opieka przez cały rok
  // =========================================================
  SCENES.seasons = {
    steps: [0, 0.25, 0.5, 0.75],
    viewBox: '0 80 1200 620',
    mobileViewBox: '400 80 600 620', // na telefonie kadr wokół drzewa
    defaults: {
      title: bi('Ogród zadbany przez cały rok', 'A well-kept garden all year round'),
      steps: [
        step('Wiosna', 'Spring', 'Przygotowanie ogrodu do sezonu: nawożenie, wertykulacja, pierwsze nasadzenia i przycinanie.', 'Getting the garden ready: feeding, scarifying, first plantings and pruning.'),
        step('Lato', 'Summer', 'Regularne koszenie, podlewanie i pielęgnacja rabat, żeby wszystko kwitło bez przerwy.', 'Regular mowing, watering and bed care so everything keeps blooming.'),
        step('Jesień', 'Autumn', 'Grabienie liści, przycinanie krzewów i ostatnie nawożenie przed zimą.', 'Raking leaves, trimming shrubs and a final feed before winter.'),
        step('Zima', 'Winter', 'Zabezpieczamy wrażliwe rośliny agrowłókniną i ściółką — wiosną budzą się zdrowe.', 'We protect delicate plants with fleece and mulch so they wake up healthy in spring.')
      ]
    },
    build: function (root) {
      var GROUND = 470, R = seeded(99);
      var S = { leaves: [], blossoms: [], tulips: [], daisies: [], thujas: [], flakes: [], words: [] };
      var defs = svg('defs', null, root);
      var sky = svg('linearGradient', { id: 'seasonSky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      S.sky1 = svg('stop', { offset: '0%', 'stop-color': '#cfe8f2' }, sky);
      S.sky2 = svg('stop', { offset: '100%', 'stop-color': '#eef6e4' }, sky);
      var glow = svg('radialGradient', { id: 'seasonGlow' }, defs);
      svg('stop', { offset: '0%', 'stop-color': '#ffe3a3', 'stop-opacity': '0.9' }, glow);
      svg('stop', { offset: '100%', 'stop-color': '#ffe3a3', 'stop-opacity': '0' }, glow);
      var burlap = svg('pattern', { id: 'burlap', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, defs);
      svg('rect', { width: 8, height: 8, fill: '#c9a877' }, burlap);
      svg('path', { d: 'M0,4 H8 M4,0 V8', stroke: '#b08f5f', 'stroke-width': 1.2 }, burlap);

      svg('rect', { width: 1200, height: 700, fill: 'url(#seasonSky)' }, root);
      // duży napis pory roku w tle
      var words = svg('g', { 'font-family': 'Fraunces, Georgia, serif', 'font-size': 150, 'text-anchor': 'middle', fill: '#ffffff' }, root);
      [['WIOSNA', 'SPRING'], ['LATO', 'SUMMER'], ['JESIEŃ', 'AUTUMN'], ['ZIMA', 'WINTER']].forEach(function (w) {
        var tx = svg('text', { x: 760, y: 170, opacity: 0 }, words);
        tx.dataset.pl = w[0]; tx.dataset.en = w[1];
        S.words.push(tx);
      });
      S.sun = svg('g', null, root);
      svg('circle', { cx: 0, cy: 0, r: 110, fill: 'url(#seasonGlow)', opacity: 0.6 }, S.sun);
      S.sunDisc = svg('circle', { cx: 0, cy: 0, r: 42, fill: '#f6cf62' }, S.sun);

      // żywopłot z tui po prawej
      for (var x = 930; x <= 1220; x += 36) {
        var h = 150 + R() * 40;
        var g = svg('g', null, root);
        var body = svg('path', { d: 'M' + (x - 26) + ',' + GROUND + ' Q' + (x - 30) + ',' + (GROUND - h * 0.6) + ' ' + x + ',' + (GROUND - h) + ' Q' + (x + 30) + ',' + (GROUND - h * 0.6) + ' ' + (x + 26) + ',' + GROUND + ' Z', fill: '#2f6b34' }, g);
        var cap = svg('path', { d: 'M' + (x - 13) + ',' + (GROUND - h * 0.72) + ' Q' + x + ',' + (GROUND - h * 1.03) + ' ' + (x + 13) + ',' + (GROUND - h * 0.72) + ' Q' + x + ',' + (GROUND - h * 0.66) + ' ' + (x - 13) + ',' + (GROUND - h * 0.72) + ' Z', fill: '#fff', opacity: 0 }, g);
        S.thujas.push({ body: body, cap: cap, tone: R() });
      }

      // drzewo: pień i gałęzie (widoczne zimą), korona z liści
      var TX = 740, TY = 250;
      S.tree = svg('g', null, root);
      svg('path', { d: 'M' + (TX - 16) + ',' + GROUND + ' Q' + (TX - 8) + ',360 ' + (TX - 6) + ',' + (TY + 40) + ' L' + (TX + 6) + ',' + (TY + 40) + ' Q' + (TX + 10) + ',360 ' + (TX + 18) + ',' + GROUND + ' Z', fill: '#6b4a2f' }, S.tree);
      var branchD = [
        'M' + TX + ',330 Q' + (TX - 60) + ',290 ' + (TX - 140) + ',250',
        'M' + TX + ',320 Q' + (TX + 70) + ',280 ' + (TX + 150) + ',240',
        'M' + TX + ',300 Q' + (TX - 30) + ',240 ' + (TX - 80) + ',170',
        'M' + TX + ',295 Q' + (TX + 30) + ',230 ' + (TX + 90) + ',160',
        'M' + TX + ',290 Q' + (TX + 4) + ',210 ' + (TX - 6) + ',130',
        'M' + (TX - 90) + ',270 Q' + (TX - 130) + ',220 ' + (TX - 160) + ',200',
        'M' + (TX + 100) + ',262 Q' + (TX + 140) + ',210 ' + (TX + 170) + ',196'
      ];
      branchD.forEach(function (bd, i) { svg('path', { d: bd, stroke: '#6b4a2f', 'stroke-width': i < 5 ? 9 : 5, fill: 'none', 'stroke-linecap': 'round' }, S.tree); });
      S.branchSnow = svg('g', { opacity: 0 }, root);
      branchD.forEach(function (bd, i) { svg('path', { d: bd, stroke: '#ffffff', 'stroke-width': i < 5 ? 4 : 3, fill: 'none', 'stroke-linecap': 'round', transform: 'translate(0,-5)' }, S.branchSnow); });

      var autumn = ['#e8a33c', '#d9642b', '#f2c14e', '#c4452f', '#e07b33'];
      for (var i = 0; i < 90; i++) {
        var a = R() * Math.PI * 2, rr = Math.sqrt(R());
        var lx = TX + Math.cos(a) * rr * 175, ly = TY - 20 + Math.sin(a) * rr * 115;
        var leaf = svg('ellipse', { cx: 0, cy: 0, rx: 13 + R() * 9, ry: 9 + R() * 6, fill: '#5aa845' }, root);
        S.leaves.push({ el: leaf, x: lx, y: ly, bud: R(), fall: 0.58 + R() * 0.12, ph: R() * 6, drift: (R() - 0.5) * 120,
          land: GROUND - 3 - R() * 6, rot: R() * 180, autumn: autumn[i % autumn.length], green: i % 3 ? '#4f9a3f' : '#5fae4a', rake: R() });
      }
      for (var b = 0; b < 26; b++) {
        var ba = R() * Math.PI * 2, br = Math.sqrt(R());
        S.blossoms.push({ el: svg('circle', { cx: TX + Math.cos(ba) * br * 165, cy: TY - 20 + Math.sin(ba) * br * 105, r: 5 + R() * 3, fill: b % 2 ? '#f6b8cc' : '#fbd3e0', 'class': 'pop' }, root), d: R() });
      }

      // trawnik i ziemia w przekroju
      S.lawn = svg('rect', { x: 0, y: GROUND, width: 1200, height: 26, fill: '#6fb04a' }, root);
      svg('rect', { x: 0, y: GROUND + 26, width: 1200, height: 210, fill: '#6a4426' }, root);
      var st = svg('g', null, root);
      for (var s = 0; s < 36; s++) svg('ellipse', { cx: R() * 1200, cy: 530 + R() * 150, rx: 5 + R() * 10, ry: 3 + R() * 6, fill: ['#8a6843', '#a78a63', '#5a3b22'][s % 3] }, st);

      // rabata z tulipanami i stokrotkami
      S.bed = svg('path', { d: 'M440,' + GROUND + ' Q520,' + (GROUND - 16) + ' 650,' + GROUND + ' Z', fill: '#4a2e18' }, root);
      var tulipCols = ['#e0453a', '#f2c14e', '#f08cae', '#e0453a', '#faf3e6', '#f6a13a', '#f08cae', '#e0453a'];
      for (var tI = 0; tI < 8; tI++) {
        var tx0 = 462 + tI * 23, th = 55 + R() * 25;
        var tg = svg('g', null, root);
        var stem = svg('path', { d: 'M' + tx0 + ',' + GROUND + ' L' + tx0 + ',' + (GROUND - th), stroke: '#4f8a34', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, tg);
        var tLeaf = svg('ellipse', { cx: tx0 + 7, cy: GROUND - 18, rx: 4, ry: 14, fill: '#5d9e45', transform: 'rotate(20 ' + (tx0 + 7) + ' ' + (GROUND - 18) + ')', 'class': 'pop' }, tg);
        var cup = svg('path', { d: 'M' + (tx0 - 9) + ',' + (GROUND - th - 14) + ' Q' + (tx0 - 9) + ',' + (GROUND - th + 4) + ' ' + tx0 + ',' + (GROUND - th + 3) + ' Q' + (tx0 + 9) + ',' + (GROUND - th + 4) + ' ' + (tx0 + 9) + ',' + (GROUND - th - 14) + ' L' + (tx0 + 4) + ',' + (GROUND - th - 8) + ' L' + tx0 + ',' + (GROUND - th - 16) + ' L' + (tx0 - 4) + ',' + (GROUND - th - 8) + ' Z', fill: tulipCols[tI], 'class': 'pop' }, tg);
        S.tulips.push({ g: tg, stem: stem, leaf: tLeaf, cup: cup, color: tulipCols[tI], x: tx0, top: GROUND - th, len: drawLine(stem), d: R() });
      }
      for (var dI = 0; dI < 5; dI++) {
        var dx0 = 474 + dI * 38 + R() * 8, dh = 30 + R() * 15;
        var dg = svg('g', null, root);
        svg('path', { d: 'M' + dx0 + ',' + GROUND + ' L' + dx0 + ',' + (GROUND - dh), stroke: '#4f8a34', 'stroke-width': 2.5, fill: 'none' }, dg);
        var dh2 = flowerHead(dg, dx0, GROUND - dh, dI % 2 ? '#faf6ee' : '#c9b3e6', 8, 8);
        S.daisies.push({ g: dg, head: dh2, x: dx0, d: R() });
      }

      // krzewy (zimą okryte jutą)
      S.shrubs = [[400, 34], [880, 40]].map(function (sh) {
        var g = svg('g', null, root);
        var bush = svg('ellipse', { cx: sh[0], cy: GROUND - sh[1] * 0.8, rx: sh[1], ry: sh[1] * 0.85, fill: '#4f8a34' }, g);
        var cover = svg('g', { opacity: 0 }, root);
        var w = sh[1] + 10;
        svg('path', { d: 'M' + (sh[0] - w) + ',' + GROUND + ' Q' + (sh[0] - w - 4) + ',' + (GROUND - sh[1] * 1.3) + ' ' + sh[0] + ',' + (GROUND - sh[1] * 2.1) + ' Q' + (sh[0] + w + 4) + ',' + (GROUND - sh[1] * 1.3) + ' ' + (sh[0] + w) + ',' + GROUND + ' Z', fill: 'url(#burlap)', stroke: '#9c7b4e', 'stroke-width': 2 }, cover);
        svg('path', { d: 'M' + (sh[0] - 14) + ',' + (GROUND - sh[1] * 1.75) + ' Q' + sh[0] + ',' + (GROUND - sh[1] * 1.62) + ' ' + (sh[0] + 14) + ',' + (GROUND - sh[1] * 1.75), stroke: '#7a5a2e', 'stroke-width': 3, fill: 'none' }, cover);
        svg('path', { d: 'M' + (sh[0] - 6) + ',' + (GROUND - sh[1] * 2.05) + ' l-8,-12 M' + (sh[0] + 6) + ',' + (GROUND - sh[1] * 2.05) + ' l8,-12', stroke: '#7a5a2e', 'stroke-width': 3, 'stroke-linecap': 'round' }, cover);
        return { bush: bush, cover: cover };
      });

      S.pile = svg('ellipse', { cx: 575, cy: GROUND - 2, rx: 0, ry: 0, fill: '#d9742f' }, root);
      S.sprinkler = sprinkler(root, 640, GROUND + 10);
      S.mulch = svg('path', { d: 'M436,' + GROUND + ' Q520,' + (GROUND - 26) + ' 654,' + GROUND + ' Z', fill: '#b08f5f', opacity: 0 }, root);

      // lampa i śnieg
      S.lamp = svg('g', null, root);
      svg('rect', { x: 1076, y: GROUND - 90, width: 8, height: 90, fill: '#2b3136' }, S.lamp);
      svg('rect', { x: 1066, y: GROUND - 100, width: 28, height: 12, rx: 3, fill: '#2b3136' }, S.lamp);
      S.lampGlow = svg('circle', { cx: 1080, cy: GROUND - 84, r: 70, fill: 'url(#seasonGlow)', opacity: 0 }, root);
      S.snow = svg('path', { d: 'M0,' + (GROUND + 4) + ' Q300,' + (GROUND - 14) + ' 600,' + (GROUND - 4) + ' T1200,' + (GROUND - 6) + ' L1200,' + (GROUND + 8) + ' L0,' + (GROUND + 8) + ' Z', fill: '#f7fbff', 'class': 'blade' }, root);
      for (var f = 0; f < 80; f++) S.flakes.push({ el: svg('circle', { r: 1.5 + R() * 2.5, fill: '#fff', opacity: 0 }, root), x: R() * 1200, sp: 40 + R() * 60, ph: R() * 700, sw: R() * 6 });
      S.autumnFall = [];
      for (var af = 0; af < 14; af++) S.autumnFall.push({ el: svg('ellipse', { rx: 7, ry: 4.5, fill: autumn[af % 5], opacity: 0 }, root), x: 500 + R() * 600, sp: 50 + R() * 40, ph: R() * 500 });
      return S;
    },
    update: function (S, p, t, lang) {
      var GROUND = 470;
      // niebo i słońce zależne od pory roku
      S.sky1.setAttribute('stop-color', colorAt(p, [[0, '#cfe8f2'], [0.2, '#cfe8f2'], [0.3, '#8fc9ef'], [0.45, '#9fd0ea'], [0.5, '#e9dcae'], [0.55, '#f0c28a'], [0.7, '#f0c28a'], [0.8, '#aebdcc']]));
      S.sky2.setAttribute('stop-color', colorAt(p, [[0, '#eef6e4'], [0.2, '#eef6e4'], [0.3, '#e6f4ff'], [0.45, '#e6f4ff'], [0.55, '#fbe7c6'], [0.7, '#fbe7c6'], [0.8, '#eef2f6']]));
      var sx = valAt(p, [[0, 1050], [0.3, 990], [0.55, 1060], [0.8, 1070]]);
      var sy = valAt(p, [[0, 150], [0.3, 95], [0.55, 220], [0.8, 250]]);
      T(S.sun, sx, sy);
      S.sunDisc.setAttribute('fill', colorAt(p, [[0, '#f6d77a'], [0.3, '#f6cf62'], [0.55, '#f0a045'], [0.8, '#f4efe0']]));
      op(S.sun, valAt(p, [[0, 0.9], [0.3, 1], [0.6, 0.9], [0.8, 0.45]]));
      S.words.forEach(function (w, i) {
        w.textContent = w.dataset[lang] || w.dataset.pl;
        var c = 0.125 + i * 0.25;
        op(w, 0.35 * clamp01(1 - Math.abs(p - c) / 0.11));
      });
      S.lawn.setAttribute('fill', colorAt(p, [[0, '#86c460'], [0.25, '#5aa13c'], [0.5, '#6f9a3e'], [0.62, '#8a9a4a'], [0.78, '#7d8a5a']]));

      // liście: pąki wiosną, zielone latem, kolorowe jesienią, potem spadają
      S.leaves.forEach(function (l) {
        var grow = easeBack(range(p, 0.02 + l.bud * 0.1, 0.1 + l.bud * 0.1));
        var col = colorAt(p, [[0, '#c7e89a'], [0.2, '#9ed46a'], [0.3, l.green], [0.5, l.green], [0.56, l.autumn]]);
        var fk = range(p, l.fall, l.fall + 0.07);
        var x = l.x + Math.sin(fk * 7 + l.ph) * 22 * fk + l.drift * fk;
        var y = l.y + (l.land - l.y) * easeIn(fk);
        var rk = range(p, 0.71 + l.rake * 0.02, 0.74 + l.rake * 0.02); // grabienie do kupki
        x = lerp(x, 575 + (l.rake - 0.5) * 40, rk);
        l.el.setAttribute('fill', col);
        l.el.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + (l.rot + fk * 300 + Math.sin(t * 1.3 + l.ph) * 6 * (1 - fk)).toFixed(0) + ') scale(' + Math.max(0.001, grow * (fk > 0 ? 0.8 : 1)).toFixed(3) + ')');
        op(l.el, 1 - rk);
      });
      S.blossoms.forEach(function (b) {
        var k = easeBack(range(p, 0.04 + b.d * 0.05, 0.1 + b.d * 0.05)) * (1 - range(p, 0.19 + b.d * 0.05, 0.24 + b.d * 0.05));
        b.el.style.transform = 'scale(' + Math.max(0, k).toFixed(3) + ')';
      });
      var pileK = easeOut(range(p, 0.71, 0.75)) * (1 - range(p, 0.77, 0.8));
      S.pile.setAttribute('rx', (pileK * 46).toFixed(1));
      S.pile.setAttribute('ry', (pileK * 18).toFixed(1));

      // rabata: tulipany wiosną, stokrotki latem, jesienią więdną, zimą ściółka
      var wilt = range(p, 0.52, 0.62), hide = range(p, 0.74, 0.79);
      S.tulips.forEach(function (tl) {
        var sk = easeOut(range(p, 0.04 + tl.d * 0.04, 0.13 + tl.d * 0.04));
        tl.stem.style.strokeDashoffset = (tl.len * (1 - sk)).toFixed(1);
        tl.stem.style.opacity = sk > 0.01 ? 1 : 0;
        tl.leaf.style.transform = 'scale(' + easeBack(range(p, 0.06 + tl.d * 0.04, 0.12 + tl.d * 0.04)).toFixed(3) + ')';
        var bloom = easeBack(range(p, 0.12 + tl.d * 0.04, 0.18 + tl.d * 0.04));
        tl.cup.style.transform = 'scale(' + Math.max(0, bloom * (1 - wilt * 0.3)).toFixed(3) + ')';
        tl.cup.setAttribute('fill', mix(tl.color, '#8a6a4a', wilt));
        tl.g.setAttribute('transform', 'rotate(' + (wilt * (tl.d > 0.5 ? 25 : -25)).toFixed(1) + ' ' + tl.x + ' ' + GROUND + ')');
        op(tl.g, 1 - hide);
      });
      S.daisies.forEach(function (d) {
        var k = easeBack(range(p, 0.27 + d.d * 0.05, 0.35 + d.d * 0.05));
        d.head.style.transform = 'scale(' + Math.max(0, k * (1 - wilt * 0.4)).toFixed(3) + ') rotate(' + (Math.sin(t * 1.5 + d.d * 9) * 5).toFixed(1) + 'deg)';
        d.g.setAttribute('transform', 'rotate(' + (wilt * 30 * (d.d > 0.5 ? 1 : -1)).toFixed(1) + ' ' + d.x + ' ' + GROUND + ')');
        op(d.g, range(p, 0.24, 0.27) * (1 - hide));
      });
      op(S.mulch, range(p, 0.76, 0.8));
      S.shrubs.forEach(function (sh) {
        sh.bush.setAttribute('fill', colorAt(p, [[0, '#7cc05a'], [0.25, '#4f8a34'], [0.5, '#4f8a34'], [0.6, '#b5502d']]));
        var ck = easeOut(range(p, 0.78, 0.85));
        T(sh.cover, 0, -(1 - ck) * 260);
        op(sh.cover, ck > 0.01 ? 1 : 0);
      });
      var rise = range(p, 0.3, 0.33) * (1 - range(p, 0.45, 0.48));
      S.sprinkler.set(rise, range(p, 0.33, 0.35) * (1 - range(p, 0.43, 0.45)), t);

      // zima: śnieg na ziemi, tujach i gałęziach, pada śnieg, świeci lampa
      var w = range(p, 0.8, 0.9);
      S.snow.style.transform = 'scaleY(' + w.toFixed(3) + ')';
      op(S.branchSnow, w);
      S.thujas.forEach(function (th) {
        th.body.setAttribute('fill', mix('#2f6b34', '#2a5a31', w + th.tone * 0.1));
        op(th.cap, w);
      });
      var falling = range(p, 0.76, 0.8);
      S.flakes.forEach(function (f) {
        var y = (f.ph + t * f.sp) % 700;
        f.el.setAttribute('cx', (f.x + Math.sin(t + f.ph) * f.sw * 3).toFixed(1));
        f.el.setAttribute('cy', y.toFixed(1));
        op(f.el, falling * 0.9);
      });
      var autumnAir = range(p, 0.55, 0.6) * (1 - range(p, 0.7, 0.73));
      S.autumnFall.forEach(function (a) {
        var y = (a.ph + t * a.sp) % 500;
        a.el.setAttribute('transform', 'translate(' + (a.x + Math.sin(t * 1.5 + a.ph) * 30).toFixed(1) + ',' + y.toFixed(1) + ') rotate(' + (t * 90 + a.ph).toFixed(0) + ')');
        op(a.el, autumnAir);
      });
      op(S.lampGlow, range(p, 0.84, 0.9) * (0.9 + Math.sin(t * 6) * 0.05));
      S.tree.setAttribute('transform', 'rotate(' + (Math.sin(t * 0.9) * 0.4).toFixed(2) + ' 740 470)');
    }
  };

  window.BG_SCENES = SCENES;
})();
