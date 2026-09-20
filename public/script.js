/* =========================================================
   BobGarden — logika strony
   1. Wczytuje treści z data/content.json (edytowane w panelu)
   2. Obsługuje język PL/EN
   3. Animacje 3D przy przewijaniu, galerię, lightbox, formularz
   ========================================================= */
(function () {
  'use strict';

  // ---------- Stałe teksty interfejsu (nie zmieniają się w panelu) ----------
  var UI = {
    pl: {
      'skip': 'Przejdź do treści',
      'nav.services': 'Usługi', 'nav.work': 'Realizacje', 'nav.about': 'O nas', 'nav.process': 'Jak pracujemy',
      'nav.pricing': 'Cennik', 'nav.contact': 'Kontakt', 'nav.cta': 'Wycena',
      'hero.ctaQuote': 'Poproś o wycenę', 'hero.ctaWork': 'Zobacz realizacje', 'hero.scroll': 'Przewiń',
      'scene.growth': 'Jak to robimy', 'scene.lawn': 'Trawniki', 'scene.seasons': 'Opieka całoroczna',
      'services.eyebrow': 'Co robimy', 'services.title': 'Usługi',
      'gallery.eyebrow': 'Portfolio', 'gallery.title': 'Realizacje', 'gallery.open': 'Powiększ zdjęcie',
      'about.eyebrow': 'O nas', 'process.eyebrow': 'Jak pracujemy',
      'pricing.eyebrow': 'Ile to kosztuje', 'pricing.title': 'Cennik', 'pricing.cta': 'Poproś o bezpłatną wycenę',
      'contact.eyebrow': 'Kontakt',
      'booking.text': 'Wolisz sam wybrać termin? Zarezerwuj oględziny online.', 'booking.cta': 'Umów oględziny online',
      'form.title': 'Poproś o bezpłatną wycenę', 'form.sub': 'Odpiszemy z terminem oględzin i orientacyjnym kosztem.',
      'form.name': 'Imię i nazwisko', 'form.phone': 'Telefon', 'form.email': 'E-mail', 'form.optional': '(opcjonalnie)',
      'form.city': 'Miejscowość', 'form.service': 'Czego dotyczy zapytanie', 'form.other': 'Inne',
      'form.date': 'Preferowany termin oględzin', 'form.time': 'Pora dnia',
      'form.timeAny': 'Dowolna', 'form.timeMorning': 'Rano (8–11)', 'form.timeMidday': 'Południe (11–14)', 'form.timeAfternoon': 'Popołudnie (14–18)',
      'form.message': 'Wiadomość', 'form.messagePh': 'Opisz krótko, czego potrzebujesz — np. powierzchnię trawnika albo zakres prac.',
      'form.consent': 'Wyrażam zgodę na kontakt w sprawie mojego zapytania.',
      'form.submit': 'Wyślij zapytanie', 'form.sending': 'Wysyłanie…',
      'form.ok': 'Dziękujemy! Zapytanie zostało wysłane — odezwiemy się wkrótce.',
      'form.err': 'Nie udało się wysłać. Zadzwoń do nas lub spróbuj ponownie za chwilę.',
      'form.missing': 'Uzupełnij zaznaczone pola.',
      'form.mailto': 'Otwieramy Twój program pocztowy z gotową wiadomością…',
      'form.subject': 'Zapytanie o wycenę ze strony',
      'footer.top': 'Do góry ↑',
      'meta.title': 'usługi ogrodnicze',
      'lb.prev': 'Poprzednie', 'lb.next': 'Następne', 'lb.close': 'Zamknij'
    },
    en: {
      'skip': 'Skip to content',
      'nav.services': 'Services', 'nav.work': 'Our work', 'nav.about': 'About', 'nav.process': 'How we work',
      'nav.pricing': 'Pricing', 'nav.contact': 'Contact', 'nav.cta': 'Get a quote',
      'hero.ctaQuote': 'Get a free quote', 'hero.ctaWork': 'See our work', 'hero.scroll': 'Scroll',
      'scene.growth': 'How we do it', 'scene.lawn': 'Lawns', 'scene.seasons': 'Year-round care',
      'services.eyebrow': 'What we do', 'services.title': 'Services',
      'gallery.eyebrow': 'Portfolio', 'gallery.title': 'Our work', 'gallery.open': 'Enlarge photo',
      'about.eyebrow': 'About us', 'process.eyebrow': 'How we work',
      'pricing.eyebrow': 'What it costs', 'pricing.title': 'Pricing', 'pricing.cta': 'Get a free quote',
      'contact.eyebrow': 'Contact',
      'booking.text': 'Prefer to pick a date yourself? Book a site visit online.', 'booking.cta': 'Book a site visit online',
      'form.title': 'Get a free quote', 'form.sub': "We'll reply with a site-visit date and an estimated cost.",
      'form.name': 'Full name', 'form.phone': 'Phone', 'form.email': 'Email', 'form.optional': '(optional)',
      'form.city': 'Town / city', 'form.service': 'What is it about', 'form.other': 'Other',
      'form.date': 'Preferred site-visit date', 'form.time': 'Time of day',
      'form.timeAny': 'Any time', 'form.timeMorning': 'Morning (8–11)', 'form.timeMidday': 'Midday (11–14)', 'form.timeAfternoon': 'Afternoon (14–18)',
      'form.message': 'Message', 'form.messagePh': 'Briefly describe what you need — e.g. lawn size or scope of work.',
      'form.consent': 'I agree to be contacted about my enquiry.',
      'form.submit': 'Send enquiry', 'form.sending': 'Sending…',
      'form.ok': "Thank you! Your enquiry has been sent — we'll be in touch soon.",
      'form.err': "Sending failed. Please call us or try again in a moment.",
      'form.missing': 'Please fill in the highlighted fields.',
      'form.mailto': 'Opening your email app with a ready-made message…',
      'form.subject': 'Quote request from the website',
      'footer.top': 'Back to top ↑',
      'meta.title': 'garden services',
      'lb.prev': 'Previous', 'lb.next': 'Next', 'lb.close': 'Close'
    }
  };

  var content = null;
  var lang = 'pl';
  // Efekty 3D sterowane przewijaniem działają także przy włączonym w systemie „ogranicz ruch".
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- Pomocnicze ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Zwraca tekst w bieżącym języku; jeśli brak EN, pokazuje PL
  function tr(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return value[lang] || value.pl || '';
  }
  function ui(key) { return UI[lang][key] || UI.pl[key] || key; }

  // Odczyt ścieżki w stylu "hero.titleLine1" z obiektu treści
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }

  // Tworzy element DOM (tekst zawsze przez textContent — bezpiecznie)
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k]; // tylko dla naszych ikon SVG
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function svgIcon(inner) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
  }

  var CONTACT_ICONS = {
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
    facebook: '<path d="M15 8h-1.5A1.5 1.5 0 0 0 12 9.5V12h3l-.5 3H12v6H9v-6H7v-3h2V9.2A4.2 4.2 0 0 1 13.2 5H15z"/>',
    pin: '<path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/>'
  };

  // ---------- Język ----------
  function detectLang() {
    var fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl === 'pl' || fromUrl === 'en') return fromUrl;
    try {
      var saved = localStorage.getItem('bg_lang');
      if (saved === 'pl' || saved === 'en') return saved;
    } catch (e) { /* prywatny tryb przeglądarki — ignorujemy */ }
    return (navigator.language || 'pl').toLowerCase().indexOf('pl') === 0 ? 'pl' : 'en';
  }

  function setLang(newLang) {
    lang = newLang;
    document.documentElement.lang = lang;
    try { localStorage.setItem('bg_lang', lang); } catch (e) {}
    var url = new URL(location.href);
    if (lang === 'pl') url.searchParams.delete('lang'); else url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
    $all('.lang-switch button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    renderAll();
  }

  // ---------- Renderowanie treści ----------
  function renderAll() {
    var s = content.settings;
    document.title = s.companyName + ' — ' + ui('meta.title');

    // Stałe teksty interfejsu
    $all('[data-i18n]').forEach(function (n) { n.textContent = ui(n.dataset.i18n); });
    $all('[data-i18n-placeholder]').forEach(function (n) { n.placeholder = ui(n.dataset.i18nPlaceholder); });
    // Teksty z content.json
    $all('[data-c]').forEach(function (n) { n.textContent = tr(getPath(content, n.dataset.c)); });
    $all('[data-c-ui]').forEach(function (n) { n.textContent = ui(n.dataset.cUi); });
    $all('[data-split]').forEach(splitWords);
    $all('[data-setting="companyName"]').forEach(function (n) { n.textContent = s.companyName; });
    $all('[data-setting-area]').forEach(function (n) { n.textContent = tr(s.area); });

    $('#lbPrev').setAttribute('aria-label', ui('lb.prev'));
    $('#lbNext').setAttribute('aria-label', ui('lb.next'));
    $('#lbClose').setAttribute('aria-label', ui('lb.close'));

    renderScenes();
    renderMarquee();
    renderServices();
    renderGallery();
    renderAbout();
    renderProcess();
    renderContact();
    renderFormOptions();
    observeReveals();
    // Tytuł w banerze animuje się od razu po wczytaniu
    requestAnimationFrame(function () { $('#heroTitle').classList.add('is-in'); });
  }

  // Dzieli nagłówek na słowa, żeby każde mogło „obrócić się" osobno
  function splitWords(node) {
    var words = node.textContent.trim().split(/\s+/).filter(Boolean);
    node.textContent = '';
    node.setAttribute('aria-label', words.join(' '));
    words.forEach(function (w, i) {
      var inner = el('span', { 'class': 'wi', style: '--i:' + i, text: w });
      node.appendChild(el('span', { 'class': 'w', 'aria-hidden': 'true' }, [inner]));
      if (i < words.length - 1) node.appendChild(document.createTextNode(' '));
    });
  }

  // ---------- Menu: chowa się przy przewijaniu w dół i w scenach pełnoekranowych ----------
  var lastScrollY = 0;
  function updateHeader(y, vh) {
    var header = $('#siteHeader');
    if ($('#navToggle').getAttribute('aria-expanded') === 'true') { header.classList.remove('nav-hidden'); return; }
    var immersive = $all('[data-scene]').some(function (sec) {
      var r = sec.getBoundingClientRect();
      return r.top <= 2 && r.bottom >= vh - 2;
    });
    var goingDown = y > lastScrollY + 2, goingUp = y < lastScrollY - 2;
    if (immersive || (goingDown && y > vh * 0.6)) header.classList.add('nav-hidden');
    else if (goingUp || y < vh * 0.6) header.classList.remove('nav-hidden');
    lastScrollY = y;
  }

  // ---------- Animowane sceny 2D (plik scenes.js) ----------
  // Każda sekcja z atrybutem data-scene ma swoją animację sterowaną przewijaniem.
  var scenes = [];
  function renderScenes() {
    $all('[data-scene]').forEach(function (sec) {
      var key = sec.dataset.scene, def = window.BG_SCENES && window.BG_SCENES[key];
      if (!def) return;
      var ckey = sec.dataset.content;
      if (!content[ckey]) content[ckey] = def.defaults;
      var data = content[ckey];
      $('.scene-title', sec).textContent = tr(data.title);
      var list = $('.scene-steps', sec);
      list.innerHTML = '';
      data.steps.slice(0, def.steps.length).forEach(function (st, i) {
        list.appendChild(el('li', { 'data-n': '0' + (i + 1) }, [el('strong', { text: tr(st.title) }), el('p', { text: tr(st.text) })]));
      });
      var sc = scenes.filter(function (x) { return x.sec === sec; })[0];
      if (!sc) {
        sc = { sec: sec, def: def, visible: false, t: 0, last: 0 };
        sc.svg = $('.scene-svg', sec);
        sc.state = def.build(sc.svg);
        scenes.push(sc);
        new IntersectionObserver(function (e) {
          var was = sc.visible;
          sc.visible = e[0].isIntersecting;
          if (sc.visible && !was) requestAnimationFrame(function (now) { sceneLoop(sc, now); });
        }).observe(sec);
      }
      updateScene(sc);
    });
  }

  function updateScene(sc) {
    var vh = window.innerHeight, r = sc.sec.getBoundingClientRect();
    var p = clamp01(-r.top / (r.height - vh));
    // kadr sceny: na telefonie (wąski ekran) bliżej najważniejszej części
    var vb = (window.innerWidth / vh < 0.85 && sc.def.mobileViewBox) || sc.def.viewBox || '0 0 1200 700';
    if (sc.svg.getAttribute('viewBox') !== vb) sc.svg.setAttribute('viewBox', vb);
    sc.def.update(sc.state, p, sc.t, lang);
    var active = 0;
    sc.def.steps.forEach(function (a, i) { if (p >= a) active = i; });
    Array.prototype.forEach.call($('.scene-steps', sc.sec).children, function (li, i) {
      li.classList.toggle('active', i === active);
      li.classList.toggle('done', i < active);
    });
    $('.scene-progress i', sc.sec).style.setProperty('--tp', p.toFixed(3));
  }

  // pętla działa tylko, gdy scena jest na ekranie (woda płynie, kwiaty się kołyszą, pada śnieg)
  function sceneLoop(sc, now) {
    if (!sc.last) sc.last = now;
    sc.t += Math.min(0.05, (now - sc.last) / 1000);
    sc.last = now;
    updateScene(sc);
    if (sc.visible) requestAnimationFrame(function (n) { sceneLoop(sc, n); }); else sc.last = 0;
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }


  function renderMarquee() {
    var names = [];
    content.services.categories.forEach(function (c) {
      (c.items[lang] && c.items[lang].length ? c.items[lang] : c.items.pl || []).forEach(function (i) { names.push(i); });
    });
    var track = $('#marqueeTrack');
    track.innerHTML = '';
    // Dwie kopie listy — dzięki temu pasek przewija się bez przerwy
    [0, 1].forEach(function () {
      names.forEach(function (n) { track.appendChild(el('span', { text: n })); });
    });
  }

  function renderServices() {
    var grid = $('#serviceGrid');
    grid.innerHTML = '';
    content.services.categories.forEach(function (cat, i) {
      var icon = (window.BG_ICONS[cat.icon] || window.BG_ICONS.leaf).svg;
      var items = (cat.items[lang] && cat.items[lang].length) ? cat.items[lang] : (cat.items.pl || []);
      var card = el('article', { 'class': 'service-card tilt' }, [
        el('span', { 'class': 'num', text: String(i + 1).padStart(2, '0') }),
        el('div', { 'class': 'service-icon', html: svgIcon(icon) }),
        el('h3', { text: tr(cat.title) }),
        el('ul', null, items.map(function (t) { return el('li', { text: t }); }))
      ]);
      grid.appendChild(el('div', { 'class': 'service-cell', 'data-reveal': '', style: '--delay:' + (i * 0.08) + 's' }, [card]));
    });
    bindTilt();
  }

  function renderGallery() {
    var grid = $('#galleryGrid');
    grid.innerHTML = '';
    content.gallery.items.forEach(function (item, i) {
      var caption = tr(item.caption);
      var btn = el('button', { 'class': 'g-inner', type: 'button', style: '--side:' + (i % 2 ? 1 : -1), 'aria-label': ui('gallery.open') + ': ' + caption }, [
        el('img', { src: item.src, alt: caption, loading: 'lazy', decoding: 'async' }),
        el('span', { 'class': 'zoom', html: svgIcon('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/>') }),
        el('figcaption', { text: caption })
      ]);
      btn.addEventListener('click', function () { openLightbox(i); });
      grid.appendChild(el('figure', { 'class': 'g-item' }, [btn]));
    });
    trackGalleryItems();
  }

  function renderAbout() {
    var items = content.gallery.items;
    var img1 = $('#aboutImg1'), img2 = $('#aboutImg2');
    // Dwa zdjęcia z galerii do efektu „stosu" w sekcji O nas
    if (items[0]) { img1.src = items[0].src; img1.alt = tr(items[0].caption); }
    if (items[3] || items[1]) { var b = items[3] || items[1]; img2.src = b.src; img2.alt = tr(b.caption); }

    var stats = $('#stats');
    stats.innerHTML = '';
    (content.about.stats || []).forEach(function (st, i) {
      stats.appendChild(el('div', { 'data-reveal': '', style: '--delay:' + (i * 0.1) + 's' }, [
        el('span', { 'class': 'stat-num', 'data-count': st.number, text: st.number }),
        el('span', { 'class': 'stat-label', text: tr(st.label) })
      ]));
    });
  }

  function renderProcess() {
    var list = $('#processList');
    list.innerHTML = '';
    content.process.steps.forEach(function (step, i) {
      list.appendChild(el('li', { 'data-reveal': '' }, [
        el('span', { 'class': 'step-num', text: String(i + 1).padStart(2, '0') }),
        el('div', null, [el('h3', { text: tr(step.title) }), el('p', { text: tr(step.text) })])
      ]));
    });
  }

  function contactRow(iconKey, text, href, external) {
    var inner = [el('span', { 'class': 'ic', html: svgIcon(CONTACT_ICONS[iconKey]) }), el('span', { text: text })];
    var node = href
      ? el('a', external ? { href: href, target: '_blank', rel: 'noopener' } : { href: href }, inner)
      : el('span', { 'class': 'row' }, inner);
    return el('li', null, [node]);
  }

  function renderContact() {
    var s = content.settings;
    var list = $('#contactList');
    list.innerHTML = '';
    if (s.phone) list.appendChild(contactRow('phone', s.phone, 'tel:' + s.phone.replace(/[^\d+]/g, '')));
    if (s.email) list.appendChild(contactRow('mail', s.email, 'mailto:' + s.email));
    if (s.instagramUrl) list.appendChild(contactRow('instagram', s.instagramLabel || 'Instagram', s.instagramUrl, true));
    if (s.facebookUrl) list.appendChild(contactRow('facebook', s.facebookLabel || 'Facebook', s.facebookUrl, true));
    if (tr(s.area)) list.appendChild(contactRow('pin', tr(s.area)));

    // Przycisk rezerwacji online pojawia się tylko, gdy w panelu wpisano link
    var box = $('#bookingBox');
    if (s.bookingUrl) { box.hidden = false; $('#bookingBtn').href = s.bookingUrl; }
    else box.hidden = true;
  }

  function renderFormOptions() {
    var select = $('#fService');
    var current = select.value;
    select.innerHTML = '';
    content.services.categories.forEach(function (c) {
      select.appendChild(el('option', { value: tr(c.title), text: tr(c.title) }));
    });
    select.appendChild(el('option', { value: ui('form.other'), text: ui('form.other') }));
    if (current) select.value = current;
    if (!select.value) select.selectedIndex = 0;

    // Nie można wybrać daty z przeszłości
    var d = new Date();
    var today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    $('#fDate').min = today;
  }

  // ---------- Animacje: pojawianie się przy przewijaniu ----------
  var revealObserver = null;
  function observeReveals() {
    var targets = $all('[data-reveal]:not(.is-in)');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('is-in'); });
      $all('[data-count]').forEach(function (n) { n.textContent = n.dataset.count; });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          var counter = e.target.querySelector('[data-count]');
          if (counter) countUp(counter);
          revealObserver.unobserve(e.target);
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    }
    targets.forEach(function (t) { revealObserver.observe(t); });
  }

  // Liczby w statystykach „odliczają" od zera
  function countUp(node) {
    var target = parseInt(node.dataset.count, 10);
    if (isNaN(target)) return;
    var suffix = node.dataset.count.replace(/^\d+/, '');
    var start = performance.now(), dur = 1400;
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      node.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------- Animacje: efekt 3D kart usług pod kursorem ----------
  function bindTilt() {
    if (!finePointer) return;
    $all('.tilt').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((x - 0.5) * 22).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - y) * 18).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  // ---------- Animacje: efekty zależne od pozycji przewijania ----------
  var galleryVisible = new Set();
  var galleryObserver = null;
  function trackGalleryItems() {
    galleryVisible.clear();
    if (galleryObserver) galleryObserver.disconnect();
    galleryObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) galleryVisible.add(e.target); else galleryVisible.delete(e.target);
      });
      requestTick();
    }, { rootMargin: '10% 0px' });
    $all('.g-inner').forEach(function (n) { galleryObserver.observe(n); });
  }

  var ticking = false;
  function requestTick() {
    if (!ticking) { ticking = true; requestAnimationFrame(onFrame); }
  }

  function onFrame() {
    ticking = false;
    var vh = window.innerHeight;
    var y = window.scrollY;

    $('#siteHeader').classList.toggle('scrolled', y > 40);
    updateHeader(y, vh);

    // Hero: tekst „odjeżdża" w głąb i przechyla się przy przewijaniu
    var hero = $('.hero');
    var hp = Math.min(1, Math.max(0, y / hero.offsetHeight));
    $('#heroInner').style.transform = 'perspective(900px) translate3d(0,' + (hp * -80).toFixed(1) + 'px,' + (hp * -300).toFixed(1) + 'px) rotateX(' + (hp * 22).toFixed(2) + 'deg)';
    $('#heroInner').style.opacity = String(Math.max(0, 1 - hp * 1.3));


    // Galeria: zdjęcia pochylają się w 3D zależnie od odległości od środka ekranu
    galleryVisible.forEach(function (node) {
      var r = node.getBoundingClientRect();
      var t = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2);
      t = Math.max(-1, Math.min(1, t));
      node.style.setProperty('--t', t.toFixed(3));
      node.style.setProperty('--ta', Math.abs(t).toFixed(3));
    });

    // O nas: dwie karty ze zdjęciami obracają się, gdy sekcja przesuwa się przez ekran
    var about = $('#aboutVisual');
    var ar = about.getBoundingClientRect();
    if (ar.bottom > 0 && ar.top < vh) {
      var ap = Math.max(0, Math.min(1, (vh - ar.top) / (vh + ar.height) * 1.6));
      about.style.setProperty('--p', ap.toFixed(3));
    }

    // Proces: linia „rośnie" razem z przewijaniem
    var pw = $('#processWrap').getBoundingClientRect();
    if (pw.bottom > 0 && pw.top < vh) {
      var lp = Math.max(0, Math.min(1, (vh * 0.65 - pw.top) / pw.height));
      $('#processLine').style.setProperty('--lp', lp.toFixed(3));
    }
  }

  // ---------- Menu mobilne ----------
  function bindMenu() {
    var toggle = $('#navToggle'), menu = $('#mobileMenu');
    function close() { toggle.setAttribute('aria-expanded', 'false'); menu.hidden = true; }
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      if (open) $('#siteHeader').classList.add('scrolled');
      else requestTick();
    });
    $all('a', menu).forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  // ---------- Lightbox ----------
  var lbIndex = 0, lastFocus = null;
  function showLb(i) {
    var items = content.gallery.items;
    lbIndex = (i + items.length) % items.length;
    var img = $('#lbImg');
    img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    img.src = items[lbIndex].src;
    img.alt = tr(items[lbIndex].caption);
    $('#lbCap').textContent = tr(items[lbIndex].caption);
    $('#lbCount').textContent = (lbIndex + 1) + ' / ' + items.length;
  }
  function openLightbox(i) {
    lastFocus = document.activeElement;
    $('#lightbox').hidden = false;
    document.body.style.overflow = 'hidden';
    showLb(i);
    $('#lbClose').focus();
  }
  function closeLightbox() {
    $('#lightbox').hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  function bindLightbox() {
    var lb = $('#lightbox');
    $('#lbClose').addEventListener('click', closeLightbox);
    $('#lbPrev').addEventListener('click', function () { showLb(lbIndex - 1); });
    $('#lbNext').addEventListener('click', function () { showLb(lbIndex + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
      if (e.key === 'ArrowRight') showLb(lbIndex + 1);
      if (e.key === 'Tab') { // fokus zostaje wewnątrz okna
        var f = $all('button', lb), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // Przesuwanie palcem na telefonie
    var startX = null;
    lb.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) showLb(lbIndex + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  // ---------- Formularz ----------
  function bindForm() {
    var form = $('#quoteForm'), status = $('#formStatus'), btn = $('#formSubmit');

    form.addEventListener('input', function (e) {
      e.target.classList.remove('invalid');
      if (e.target.id === 'fConsent') e.target.closest('.consent').classList.remove('invalid');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = ''; status.className = 'form-status';

      // Prosta walidacja wymaganych pól
      var ok = true;
      ['#fName', '#fPhone'].forEach(function (sel) {
        var f = $(sel);
        if (!f.value.trim()) { f.classList.add('invalid'); ok = false; }
      });
      var email = $('#fEmail');
      if (email.value && !email.checkValidity()) { email.classList.add('invalid'); ok = false; }
      if (!$('#fConsent').checked) { $('#fConsent').closest('.consent').classList.add('invalid'); ok = false; }
      if (!ok) { status.textContent = ui('form.missing'); status.classList.add('err'); return; }

      if (form.botcheck.checked) return; // bot — nic nie wysyłamy

      var timeSel = $('#fTime');
      var data = {
        name: $('#fName').value.trim(),
        phone: $('#fPhone').value.trim(),
        email: email.value.trim(),
        city: $('#fCity').value.trim(),
        service: $('#fService').value,
        date: $('#fDate').value,
        time: timeSel.options[timeSel.selectedIndex].text,
        message: $('#fMsg').value.trim()
      };
      var s = content.settings;
      var subject = ui('form.subject') + ' — ' + data.name;
      var summary = [
        'Imię i nazwisko: ' + data.name,
        'Telefon: ' + data.phone,
        'E-mail: ' + (data.email || '—'),
        'Miejscowość: ' + (data.city || '—'),
        'Usługa: ' + data.service,
        'Preferowany termin: ' + (data.date || '—') + ', ' + data.time,
        'Język strony: ' + lang.toUpperCase(),
        '',
        data.message
      ].join('\n');

      // Brak klucza Web3Forms → otwieramy program pocztowy z gotową wiadomością
      if (!s.web3formsKey) {
        status.textContent = ui('form.mailto'); status.classList.add('ok');
        location.href = 'mailto:' + s.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(summary);
        return;
      }

      btn.disabled = true; btn.textContent = ui('form.sending');
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: s.web3formsKey,
          subject: subject,
          from_name: s.companyName + ' — strona www',
          replyto: data.email || undefined,
          'Imię i nazwisko': data.name,
          'Telefon': data.phone,
          'E-mail': data.email || '—',
          'Miejscowość': data.city || '—',
          'Usługa': data.service,
          'Preferowany termin': (data.date || '—') + ', ' + data.time,
          'Wiadomość': data.message || '—',
          'Język strony': lang.toUpperCase()
        })
      })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          if (!json.success) throw new Error(json.message);
          status.textContent = ui('form.ok'); status.classList.add('ok');
          form.reset();
          renderFormOptions();
        })
        .catch(function () {
          status.textContent = ui('form.err'); status.classList.add('err');
        })
        .finally(function () {
          btn.disabled = false; btn.textContent = ui('form.submit');
        });
    });
  }

  // ---------- Start ----------
  function init() {
    $('#year').textContent = new Date().getFullYear();
    lang = detectLang();

    $all('.lang-switch button').forEach(function (b) {
      b.addEventListener('click', function () { if (b.dataset.lang !== lang) setLang(b.dataset.lang); });
    });
    bindMenu();
    bindLightbox();
    bindForm();


    // cache: 'no-cache' — po publikacji zmian przeglądarka pobierze świeże dane
    fetch('data/content.json', { cache: 'no-cache' })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (json) {
        content = json;
        setLang(lang);
        window.addEventListener('scroll', requestTick, { passive: true });
        window.addEventListener('resize', requestTick);
        requestTick();
      })
      .catch(function (err) {
        console.error('Nie udało się wczytać data/content.json', err);
        document.body.insertAdjacentHTML('afterbegin',
          '<p class="noscript">Nie udało się wczytać treści strony. Jeśli otwierasz plik bezpośrednio z dysku, uruchom <b>npm start</b> i wejdź na http://localhost:3000</p>');
      });
  }

  init();
})();
