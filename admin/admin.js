/* =========================================================
   BobGarden — panel admina
   Wczytuje treść z /api/content, pozwala ją edytować
   i zapisuje z powrotem do public/data/content.json.
   ========================================================= */
(function () {
  'use strict';

  var data = null;      // aktualnie edytowana treść
  var dirty = false;    // czy są niezapisane zmiany
  var saving = false;

  var MAX_IMG = 1920;   // zdjęcia są zmniejszane do tej szerokości/wysokości
  var JPG_QUALITY = 0.85;

  // ---------- Pomocnicze ----------
  function $(sel, root) { return (root || document).querySelector(sel); }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function toast(msg, isError) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isError);
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, isError ? 5000 : 2800);
  }

  function setStatus(text, mode) {
    var s = $('#status');
    s.className = 'status' + (mode ? ' ' + mode : '');
    $('#statusText').textContent = text;
  }

  function markDirty() {
    if (!dirty) {
      dirty = true;
      setStatus('Masz niezapisane zmiany', 'dirty');
      $('#saveBtn').disabled = false;
    }
  }

  // Upewnia się, że pole dwujęzyczne jest obiektem {pl, en}
  function ensureBi(obj, key) {
    if (!obj[key] || typeof obj[key] !== 'object') obj[key] = { pl: obj[key] || '', en: '' };
    return obj[key];
  }

  function move(arr, from, to) {
    if (to < 0 || to >= arr.length) return;
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    markDirty();
  }

  // ---------- Pola formularza ----------

  // Zwykłe pole tekstowe powiązane z obj[key]
  function textField(label, obj, key, opts) {
    opts = opts || {};
    var input = el(opts.multiline ? 'textarea' : 'input', { type: opts.type || 'text', placeholder: opts.placeholder || '' });
    input.value = obj[key] || '';
    input.addEventListener('input', function () {
      obj[key] = input.value.trim();
      markDirty();
      if (opts.onInput) opts.onInput(input.value);
    });
    return el('div', { 'class': 'field' }, [
      el('label', { text: label }), input,
      opts.hint ? el('div', { 'class': 'hint', html: opts.hint }) : null
    ]);
  }

  // Pole dwujęzyczne: PL i EN obok siebie
  function biField(label, obj, key, opts) {
    opts = opts || {};
    var val = ensureBi(obj, key);
    function box(lang) {
      var input = el(opts.multiline ? 'textarea' : 'input', { type: 'text', rows: opts.rows || 3 });
      input.value = val[lang] || '';
      var wrap = el('div', { 'class': 'lang', 'data-lang': lang.toUpperCase() }, [input]);
      var refresh = function () { wrap.classList.toggle('empty', !input.value.trim()); };
      refresh();
      input.addEventListener('input', function () {
        val[lang] = input.value.trim();
        refresh();
        markDirty();
        if (opts.onInput) opts.onInput();
      });
      return wrap;
    }
    return el('div', { 'class': 'field' }, [
      label ? el('div', { 'class': 'label', text: label }) : null,
      el('div', { 'class': 'bi' }, [box('pl'), box('en')]),
      opts.hint ? el('div', { 'class': 'hint', html: opts.hint }) : null
    ]);
  }

  // Przyciski ↑ ↓ ✕ dla elementu listy
  function listTools(arr, i, rerender, what) {
    return el('div', { 'class': 'item-tools' }, [
      el('button', { 'class': 'icon-btn', type: 'button', title: 'Przesuń wyżej', text: '↑',
        onclick: function () { move(arr, i, i - 1); rerender(); } }),
      el('button', { 'class': 'icon-btn', type: 'button', title: 'Przesuń niżej', text: '↓',
        onclick: function () { move(arr, i, i + 1); rerender(); } }),
      el('button', { 'class': 'icon-btn danger', type: 'button', title: 'Usuń', text: '✕',
        onclick: function () {
          if (!confirm('Usunąć ' + what + '?')) return;
          arr.splice(i, 1); markDirty(); rerender();
        } })
    ]);
  }

  function panel(id, title, desc, children) {
    return el('section', { 'class': 'panel', id: id }, [
      el('h2', { text: title }),
      desc ? el('p', { 'class': 'desc', html: desc }) : null
    ].concat(children));
  }

  // ---------- Sekcje panelu ----------

  function settingsPanel() {
    var s = data.settings;
    ensureBi(s, 'area');
    return panel('s-settings', 'Kontakt i ustawienia', 'Dane widoczne w sekcji kontakt i w stopce.', [
      el('div', { 'class': 'grid-2' }, [
        textField('Nazwa firmy', s, 'companyName'),
        textField('Telefon', s, 'phone', { type: 'tel', placeholder: '+48 600 000 000' })
      ]),
      el('div', { 'class': 'grid-2' }, [
        textField('E-mail (tu przychodzą też zapytania)', s, 'email', { type: 'email' }),
        el('div')
      ]),
      el('div', { 'class': 'grid-2' }, [
        textField('Instagram — link', s, 'instagramUrl', { type: 'url', placeholder: 'https://instagram.com/…', hint: 'Zostaw puste, aby ukryć.' }),
        textField('Instagram — wyświetlana nazwa', s, 'instagramLabel')
      ]),
      el('div', { 'class': 'grid-2' }, [
        textField('Facebook — link', s, 'facebookUrl', { type: 'url', placeholder: 'https://facebook.com/…', hint: 'Zostaw puste, aby ukryć.' }),
        textField('Facebook — wyświetlana nazwa', s, 'facebookLabel')
      ]),
      biField('Obszar działania', s, 'area'),
      el('h3', { 'class': 'sub-h', text: 'Formularz i rezerwacje' }),
      textField('Klucz Web3Forms (formularz wysyłany na e-mail)', s, 'web3formsKey', {
        placeholder: 'np. 1a2b3c4d-…',
        hint: 'Darmowy klucz odbierzesz na <a href="https://web3forms.com" target="_blank" rel="noopener">web3forms.com</a> — wpisz tam adres e-mail, na który mają przychodzić zapytania. ' +
              'Bez klucza formularz otworzy u klienta program pocztowy z gotową wiadomością.'
      }),
      textField('Link do rezerwacji online (opcjonalnie)', s, 'bookingUrl', {
        type: 'url', placeholder: 'https://cal.com/bobgarden/ogledziny',
        hint: 'Np. z <a href="https://cal.com" target="_blank" rel="noopener">Cal.com</a> lub Calendly. Gdy pole jest wypełnione, w sekcji kontakt pojawi się przycisk „Umów oględziny online”.'
      })
    ]);
  }

  function heroPanel() {
    var h = data.hero;
    return panel('s-hero', 'Baner główny', 'Pierwsze, co widzi klient: hasło i przyciski. Obok unosi się ogród 3D, a w banerze nie ma zdjęcia, więc nic się nie rozmywa.', [
      biField('Mały napis nad tytułem', h, 'eyebrow'),
      biField('Tytuł — pierwsza linia', h, 'titleLine1'),
      biField('Tytuł — druga linia (wyróżniona kolorem)', h, 'titleLine2'),
      biField('Opis pod tytułem', h, 'text', { multiline: true })
    ]);
  }

  function servicesPanel() {
    var list = el('div');
    function render() {
      list.innerHTML = '';
      data.services.categories.forEach(function (cat, i) {
        if (!cat.items || Array.isArray(cat.items)) cat.items = { pl: cat.items || [], en: [] };
        var preview = el('div', { 'class': 'icon-preview' });
        var paintIcon = function () {
          preview.innerHTML = '<svg viewBox="0 0 24 24">' + (window.BG_ICONS[cat.icon] || window.BG_ICONS.leaf).svg + '</svg>';
        };
        paintIcon();

        var select = el('select', { style: 'width:auto' });
        Object.keys(window.BG_ICONS).forEach(function (k) {
          var o = el('option', { value: k, text: window.BG_ICONS[k].label });
          if (k === cat.icon) o.selected = true;
          select.appendChild(o);
        });
        select.addEventListener('change', function () { cat.icon = select.value; paintIcon(); markDirty(); });

        var titleSpan = el('span', { 'class': 'title', text: (cat.title && cat.title.pl) || 'Nowa kategoria' });

        function linesField(lang) {
          var ta = el('textarea', { rows: 5 });
          ta.value = (cat.items[lang] || []).join('\n');
          var wrap = el('div', { 'class': 'lang', 'data-lang': lang.toUpperCase() }, [ta]);
          ta.addEventListener('input', function () {
            cat.items[lang] = ta.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
            markDirty();
          });
          return wrap;
        }

        list.appendChild(el('div', { 'class': 'item' }, [
          el('div', { 'class': 'item-head' }, [preview, titleSpan, select, listTools(data.services.categories, i, render, 'tę kategorię usług')]),
          biField('Nazwa kategorii', cat, 'title', { onInput: function () { titleSpan.textContent = cat.title.pl || 'Nowa kategoria'; } }),
          el('div', { 'class': 'field' }, [
            el('div', { 'class': 'label', text: 'Usługi — każda w osobnej linii' }),
            el('div', { 'class': 'bi' }, [linesField('pl'), linesField('en')]),
            el('div', { 'class': 'hint', text: 'Linie w PL i EN powinny iść w tej samej kolejności.' })
          ])
        ]));
      });
    }
    render();
    return panel('s-services', 'Usługi', 'Kategorie usług wyświetlane jako karty.', [
      biField('Opis pod nagłówkiem „Usługi”', data.services, 'intro', { multiline: true }),
      el('h3', { 'class': 'sub-h', text: 'Kategorie' }),
      list,
      el('button', { 'class': 'btn btn-dashed', type: 'button', text: '+ Dodaj kategorię usług', onclick: function () {
        data.services.categories.push({ icon: 'leaf', title: { pl: 'Nowa kategoria', en: 'New category' }, items: { pl: [], en: [] } });
        markDirty(); render();
        list.lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } })
    ]);
  }

  // Teksty przy animowanych scenach (przekrój ziemi, trawnik, pory roku)
  function scenePanel(key, id, title, desc) {
    return function () {
      var g = data[key];
      if (!g) return el('div');
      var list = el('div');
      g.steps.forEach(function (st, i) {
        list.appendChild(el('div', { 'class': 'item' }, [
          el('div', { 'class': 'item-head' }, [el('span', { 'class': 'title', text: 'Etap ' + (i + 1) })]),
          biField('Nazwa etapu', st, 'title'),
          biField('Opis', st, 'text', { multiline: true })
        ]));
      });
      return panel(id, title, desc, [biField('Tytuł', g, 'title'), list]);
    };
  }
  var growthPanel = scenePanel('growth', 's-growth', 'Animacja: od gleby do kwiatów', 'Podpisy przy przekroju ziemi. Animacja ma zawsze 4 etapy: grunt, nawadnianie, siew i wzrost.');
  var lawnPanel = scenePanel('lawnScene', 's-lawn', 'Animacja: trawnik z rolki', 'Podpisy przy animacji trawnika: wałowanie, układanie darni, koszenie, oświetlenie.');
  var seasonsPanel = scenePanel('seasons', 's-seasons', 'Animacja: cztery pory roku', 'Podpisy przy animacji pór roku: wiosna, lato, jesień, zima.');

  function galleryPanel() {
    var grid = el('div', { 'class': 'gal-grid' });
    var progress = el('div', { 'class': 'progress' });
    var fileInput = el('input', { type: 'file', accept: 'image/*', multiple: '', hidden: '' });
    var dragFrom = null;

    function render() {
      grid.innerHTML = '';
      var items = data.gallery.items;
      items.forEach(function (item, i) {
        ensureBi(item, 'caption');
        var card = el('div', { 'class': 'gal-card', draggable: 'true' }, [
          el('div', { 'class': 'gal-thumb', title: 'Przeciągnij, aby zmienić kolejność' }, [
            el('img', { src: '/' + item.src, alt: '', loading: 'lazy' }),
            el('span', { 'class': 'pos', text: '#' + (i + 1) })
          ]),
          el('div', { 'class': 'gal-body' }, [
            biField('', item, 'caption', {}),
            el('div', { 'class': 'gal-tools' }, [
              el('div', { 'class': 'item-tools' }, [
                el('button', { 'class': 'icon-btn', type: 'button', title: 'Wcześniej', text: '←', onclick: function () { move(items, i, i - 1); render(); } }),
                el('button', { 'class': 'icon-btn', type: 'button', title: 'Później', text: '→', onclick: function () { move(items, i, i + 1); render(); } })
              ]),
              el('button', { 'class': 'icon-btn danger', type: 'button', title: 'Usuń zdjęcie', text: '✕', onclick: function () {
                if (!confirm('Usunąć to zdjęcie z galerii?')) return;
                items.splice(i, 1); markDirty(); render();
              } })
            ])
          ])
        ]);
        // Przeciąganie kart, aby zmienić kolejność
        card.addEventListener('dragstart', function (e) { dragFrom = i; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
        card.addEventListener('dragend', function () { card.classList.remove('dragging'); dragFrom = null; });
        card.addEventListener('dragover', function (e) { if (dragFrom !== null) { e.preventDefault(); card.classList.add('drop-target'); } });
        card.addEventListener('dragleave', function () { card.classList.remove('drop-target'); });
        card.addEventListener('drop', function (e) {
          e.preventDefault(); card.classList.remove('drop-target');
          if (dragFrom !== null && dragFrom !== i) { move(items, dragFrom, i); render(); }
        });
        grid.appendChild(card);
      });
    }

    function addFiles(files) {
      var list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
      if (!list.length) return;
      var done = 0;
      progress.textContent = 'Wgrywanie 0 / ' + list.length + '…';
      // Wgrywamy po kolei, żeby nie przeciążyć przeglądarki
      list.reduce(function (chain, file) {
        return chain.then(function () {
          return uploadImage(file).then(function (src) {
            var name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
            data.gallery.items.push({ src: src, caption: { pl: name, en: '' } });
            done++;
            progress.textContent = 'Wgrywanie ' + done + ' / ' + list.length + '…';
          });
        });
      }, Promise.resolve()).then(function () {
        progress.textContent = '';
        markDirty(); render();
        toast('Dodano zdjęcia: ' + done + '. Uzupełnij podpisy i zapisz.');
      }).catch(function (e) {
        progress.textContent = '';
        markDirty(); render();
        toast(e.message, true);
      });
    }

    var drop = el('div', { 'class': 'dropzone', role: 'button', tabindex: '0' }, [
      el('strong', { text: 'Dodaj zdjęcia' }),
      'Przeciągnij pliki tutaj albo kliknij, aby wybrać. Duże zdjęcia zostaną automatycznie zmniejszone.'
    ]);
    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    drop.addEventListener('dragover', function (e) { if (e.dataTransfer.types.indexOf('Files') > -1) { e.preventDefault(); drop.classList.add('over'); } });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });

    render();
    return panel('s-gallery', 'Galeria realizacji', 'Kolejność zmienisz przeciągając zdjęcia albo strzałkami. Podpis pojawia się po najechaniu na zdjęcie i w powiększeniu.', [
      biField('Opis pod nagłówkiem „Realizacje”', data.gallery, 'intro', { multiline: true }),
      drop, fileInput, progress, grid
    ]);
  }

  function aboutPanel() {
    var a = data.about;
    if (!Array.isArray(a.stats)) a.stats = [];
    var statsBox = el('div');
    function renderStats() {
      statsBox.innerHTML = '';
      a.stats.forEach(function (st, i) {
        statsBox.appendChild(el('div', { 'class': 'item' }, [
          el('div', { 'class': 'item-head' }, [el('span', { 'class': 'title', text: 'Liczba ' + (i + 1) }), listTools(a.stats, i, renderStats, 'tę liczbę')]),
          el('div', { 'class': 'grid-2', style: 'grid-template-columns: 140px 1fr' }, [
            textField('Liczba', st, 'number', { placeholder: 'np. 15 lub 200+' }),
            biField('Opis', st, 'label')
          ])
        ]));
      });
    }
    renderStats();
    return panel('s-about', 'O nas', null, [
      biField('Tytuł', a, 'title'),
      biField('Akapit 1', a, 'paragraph1', { multiline: true, rows: 4 }),
      biField('Akapit 2', a, 'paragraph2', { multiline: true, rows: 3 }),
      biField('Opinia klienta', a, 'quote', { multiline: true }),
      biField('Podpis pod opinią', a, 'quoteAuthor'),
      el('h3', { 'class': 'sub-h', text: 'Liczby (animowane na stronie)' }),
      statsBox,
      el('button', { 'class': 'btn btn-dashed', type: 'button', text: '+ Dodaj liczbę', onclick: function () {
        a.stats.push({ number: '0', label: { pl: '', en: '' } }); markDirty(); renderStats();
      } })
    ]);
  }

  function processPanel() {
    var p = data.process;
    var list = el('div');
    function render() {
      list.innerHTML = '';
      p.steps.forEach(function (step, i) {
        list.appendChild(el('div', { 'class': 'item' }, [
          el('div', { 'class': 'item-head' }, [el('span', { 'class': 'title', text: 'Krok ' + (i + 1) }), listTools(p.steps, i, render, 'ten krok')]),
          biField('Nazwa kroku', step, 'title'),
          biField('Opis', step, 'text', { multiline: true })
        ]));
      });
    }
    render();
    return panel('s-process', 'Jak pracujemy', 'Kroki współpracy wyświetlane na ciemnym tle.', [
      biField('Tytuł sekcji', p, 'title'),
      list,
      el('button', { 'class': 'btn btn-dashed', type: 'button', text: '+ Dodaj krok', onclick: function () {
        p.steps.push({ title: { pl: '', en: '' }, text: { pl: '', en: '' } }); markDirty(); render();
      } })
    ]);
  }

  function textsPanel() {
    return panel('s-texts', 'Cennik i kontakt', null, [
      biField('Tekst w sekcji „Cennik”', data.pricing, 'text', { multiline: true, rows: 4 }),
      biField('Tytuł sekcji kontakt', data.contact, 'title'),
      biField('Tekst w sekcji kontakt', data.contact, 'text', { multiline: true })
    ]);
  }

  // ---------- Wgrywanie zdjęć (ze zmniejszaniem w przeglądarce) ----------
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_IMG / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // przezroczyste PNG dostaną białe tło
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', JPG_QUALITY));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Nie można odczytać pliku: ' + file.name)); };
      img.src = url;
    });
  }

  function uploadImage(file) {
    return resizeImage(file).then(function (dataUrl) {
      return fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, dataUrl: dataUrl })
      });
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) throw new Error(json.error || 'Błąd wgrywania');
        return json.src;
      });
    });
  }

  // ---------- Zapis ----------
  function save() {
    if (saving || !dirty) return;
    saving = true;
    $('#saveBtn').disabled = true;
    setStatus('Zapisywanie…', 'dirty');
    fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().then(function (json) {
          if (!res.ok) throw new Error(json.error || 'Błąd zapisu');
          return json;
        });
      })
      .then(function (json) {
        dirty = false;
        var time = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        setStatus('Zapisano o ' + time);
        var extra = json.archivedImages && json.archivedImages.length
          ? ' Usunięte zdjęcia przeniesiono do folderu backups/.' : '';
        toast('Zapisano! Odśwież podgląd strony, aby zobaczyć zmiany.' + extra);
      })
      .catch(function (e) {
        setStatus('Błąd zapisu', 'error');
        $('#saveBtn').disabled = false;
        toast(e.message, true);
      })
      .finally(function () { saving = false; });
  }

  // ---------- Podświetlanie aktywnej sekcji w menu ----------
  function bindScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('#sideNav a'));
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    document.querySelectorAll('.panel').forEach(function (p) { obs.observe(p); });
  }

  // ---------- Start ----------
  function build() {
    var editor = $('#editor');
    editor.innerHTML = '';
    [settingsPanel, heroPanel, servicesPanel, growthPanel, lawnPanel, galleryPanel, aboutPanel, seasonsPanel, processPanel, textsPanel].forEach(function (fn) {
      editor.appendChild(fn());
    });
    bindScrollSpy();
  }

  $('#saveBtn').addEventListener('click', save);
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  fetch('/api/content', { cache: 'no-store' })
    .then(function (res) { if (!res.ok) throw new Error(); return res.json(); })
    .then(function (json) {
      data = json;
      build();
      setStatus('Wszystko zapisane');
    })
    .catch(function () {
      setStatus('Brak połączenia z serwerem', 'error');
      $('#editor').innerHTML = '';
      $('#editor').appendChild(el('div', { 'class': 'fatal', html:
        '<b>Panel nie może wczytać danych.</b><br>Panel działa tylko z serwerem z tego projektu. ' +
        'Zamknij inne serwery (np. <code>python -m http.server</code>) i kliknij dwukrotnie plik <b>start.bat</b> w folderze projektu ' +
        '(albo wpisz w terminalu <code>npm start</code>). Panel otworzy się pod adresem <b>http://localhost:3000/admin</b>.' }));
    });
})();
