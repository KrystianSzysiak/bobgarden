/* =========================================================
   BobGarden — lokalny serwer z panelem admina
   Uruchom: npm start  →  strona: http://localhost:3000
                          panel:  http://localhost:3000/admin

   Serwer działa TYLKO na Twoim komputerze. Na GitHub Pages
   trafia wyłącznie folder public/ (sama strona, bez panelu).
   ========================================================= */
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // tylko ten komputer — inni w sieci nie wejdą do panelu

const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');
const CONTENT_FILE = path.join(PUBLIC_DIR, 'data', 'content.json');
const IMG_DIR = path.join(PUBLIC_DIR, 'img');
const UPLOAD_DIR = path.join(IMG_DIR, 'gallery');
const BACKUP_DIR = path.join(__dirname, 'backups'); // kopie zapasowe (nie trafiają na stronę)

const app = express();
app.use(express.json({ limit: '25mb' })); // zdjęcia przychodzą jako tekst base64

// ---------- Pliki strony i panelu ----------
app.use(express.static(PUBLIC_DIR, { etag: false, maxAge: 0 }));
app.use('/admin', express.static(ADMIN_DIR));

// ---------- API: odczyt treści ----------
app.get('/api/content', (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8')));
  } catch (err) {
    res.status(500).json({ error: 'Nie można odczytać pliku content.json: ' + err.message });
  }
});

// ---------- API: zapis treści ----------
app.post('/api/content', (req, res) => {
  const data = req.body;
  const problem = validateContent(data);
  if (problem) return res.status(400).json({ error: problem });

  try {
    // 1. Kopia zapasowa poprzedniej wersji (zostaje 30 ostatnich)
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    if (fs.existsSync(CONTENT_FILE)) {
      fs.copyFileSync(CONTENT_FILE, path.join(BACKUP_DIR, `content-${timestamp()}.json`));
      pruneBackups();
    }

    // 2. Bezpieczny zapis: najpierw plik tymczasowy, potem podmiana
    const tmp = CONTENT_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, CONTENT_FILE);

    // 3. Zdjęcia usunięte z galerii przenosimy do backups/ (nie kasujemy na zawsze)
    const moved = archiveUnusedImages(data);

    res.json({ ok: true, archivedImages: moved });
  } catch (err) {
    res.status(500).json({ error: 'Zapis nie powiódł się: ' + err.message });
  }
});

// ---------- API: wgranie zdjęcia ----------
app.post('/api/upload', (req, res) => {
  const { name, dataUrl } = req.body || {};
  const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return res.status(400).json({ error: 'Dozwolone są tylko zdjęcia JPG, PNG lub WEBP.' });

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const base = slugify(path.parse(String(name || 'zdjecie')).name) || 'zdjecie';
  const fileName = `${base}-${Date.now().toString(36)}.${ext}`;

  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), Buffer.from(match[2], 'base64'));
    // Ścieżka względna — działa i lokalnie, i na GitHub Pages
    res.json({ ok: true, src: `img/gallery/${fileName}` });
  } catch (err) {
    res.status(500).json({ error: 'Nie udało się zapisać zdjęcia: ' + err.message });
  }
});

// ---------- Pomocnicze ----------
function validateContent(d) {
  if (!d || typeof d !== 'object') return 'Brak danych.';
  const required = ['settings', 'hero', 'services', 'gallery', 'about', 'process', 'pricing', 'contact'];
  const missing = required.filter((k) => !d[k]);
  if (missing.length) return 'Brakuje sekcji: ' + missing.join(', ');
  if (!Array.isArray(d.services.categories)) return 'Usługi muszą być listą.';
  if (!Array.isArray(d.gallery.items)) return 'Galeria musi być listą.';
  const badSrc = d.gallery.items.find((i) => !isSafeImagePath(i.src));
  if (badSrc) return 'Nieprawidłowa ścieżka zdjęcia: ' + badSrc.src;
  if (!isSafeImagePath(d.hero.image)) return 'Nieprawidłowe zdjęcie w sekcji hero.';
  return null;
}

// Zdjęcie musi leżeć w public/img/ — żadnych ścieżek w stylu ../../
function isSafeImagePath(p) {
  return typeof p === 'string' && /^img\/[a-z0-9/_.-]+$/i.test(p) && !p.includes('..');
}

function archiveUnusedImages(data) {
  if (!fs.existsSync(UPLOAD_DIR)) return [];
  const used = new Set([data.hero.image, ...data.gallery.items.map((i) => i.src)]);
  const archiveDir = path.join(BACKUP_DIR, 'usuniete-zdjecia');
  const moved = [];
  for (const file of fs.readdirSync(UPLOAD_DIR)) {
    const rel = `img/gallery/${file}`;
    if (!used.has(rel) && /\.(jpe?g|png|webp)$/i.test(file)) {
      fs.mkdirSync(archiveDir, { recursive: true });
      fs.renameSync(path.join(UPLOAD_DIR, file), path.join(archiveDir, file));
      moved.push(file);
    }
  }
  return moved;
}

function pruneBackups() {
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => /^content-.*\.json$/.test(f)).sort();
  files.slice(0, Math.max(0, files.length - 30)).forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)));
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function slugify(str) {
  const map = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
  return String(str).toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => map[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  🌿 BobGarden działa!');
  console.log(`  Strona:  http://localhost:${PORT}`);
  console.log(`  Panel:   http://localhost:${PORT}/admin`);
  console.log('  Zatrzymanie serwera: Ctrl + C');
  console.log('');
});
