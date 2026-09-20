# BobGarden — instrukcja obsługi strony

Ten plik jest dla właściciela strony. Opis projektu dla odwiedzających GitHuba znajdziesz w [README.md](README.md).

Treści i zdjęcia edytujesz w panelu, który działa **tylko na Twoim komputerze**.

---

## Struktura plików

```
bobgarden/
├── package.json            ← informacje o projekcie i komenda „npm start”
├── start.bat               ← dwuklik = uruchom serwer i otwórz panel (Windows)
├── server.js               ← lokalny serwer: pokazuje stronę i obsługuje zapis z panelu
├── admin/                  ← panel edycji (NIE trafia do internetu)
│   ├── index.html
│   ├── admin.css
│   └── admin.js
├── public/                 ← GOTOWA STRONA — tylko ten folder jest publikowany
│   ├── index.html          ← układ strony
│   ├── style.css           ← wygląd (kolory na górze pliku)
│   ├── script.js           ← język PL/EN, galeria, formularz, uruchamianie scen
│   ├── scenes.js           ← animowane sceny 2D: przekrój ziemi, trawnik z rolki, pory roku
│   ├── garden3d.js         ← kwiatowy ogród 3D w banerze (Three.js)
│   ├── vendor/three-lite.js← biblioteka Three.js (okrojona, nie edytuj)
│   ├── icons.js            ← ikony usług
│   ├── data/content.json   ← WSZYSTKIE TREŚCI (to edytuje panel)
│   └── img/                ← zdjęcia (hero.jpg + gallery/)
├── .github/workflows/pages.yml  ← automatyczna publikacja na GitHub Pages
└── backups/                ← kopie zapasowe tworzone przy każdym zapisie (lokalnie)
```

**Jak to działa razem:**
- **Strona (frontend)** to zwykłe pliki HTML/CSS/JS. Po otwarciu `script.js` wczytuje `data/content.json` i na jego podstawie buduje treść w wybranym języku.
- **Serwer (backend)** jest potrzebny tylko do edycji. `server.js` (Express) wyświetla stronę pod `localhost:3000`, panel pod `localhost:3000/admin` i zapisuje zmiany do `public/data/content.json` oraz zdjęcia do `public/img/gallery/`.
- **W internecie** działa sam folder `public/` na GitHub Pages, bez serwera, za darmo.

---

## 1. Pierwsze uruchomienie (jednorazowo)

1. Zainstaluj **Node.js** (wersja LTS) ze strony https://nodejs.org
2. Otwórz folder projektu w terminalu
   (Windows: wejdź do folderu w Eksploratorze, kliknij pasek adresu, wpisz `cmd` i naciśnij Enter).
3. Wpisz:
   ```
   npm install
   ```

## 2. Edycja treści

**Najprościej (Windows):** kliknij dwukrotnie plik **`start.bat`**. Przy pierwszym uruchomieniu zainstaluje, co trzeba, uruchomi serwer i otworzy panel w przeglądarce. Nie zamykaj czarnego okna, dopóki pracujesz w panelu.

Albo ręcznie w terminalu:
```
npm start
```

> ⚠️ Panel **nie działa** z innymi serwerami (np. `python -m http.server`, Live Server w VS Code) — one tylko wyświetlają pliki, nie umieją zapisywać zmian. Do panelu zawsze używaj `start.bat` lub `npm start`.
- Strona: http://localhost:3000
- Panel: http://localhost:3000/admin

W panelu zmieniasz teksty (PL i EN), dane kontaktowe, usługi i galerię. Kliknij **Zapisz zmiany** (albo naciśnij Ctrl+S) i odśwież podgląd.
Serwer zatrzymasz, naciskając `Ctrl + C` w terminalu.

> Zostaw puste pole EN, a strona pokaże w tym miejscu tekst polski.
> Każdy zapis tworzy kopię poprzedniej wersji w folderze `backups/`. Usunięte z galerii zdjęcia też tam trafiają.

## 3. Publikacja na GitHub Pages (jednorazowa konfiguracja)

1. Załóż konto na https://github.com i utwórz nowe repozytorium, np. `bobgarden` (publiczne).
2. Wyślij pliki do repozytorium. Najprościej przez **GitHub Desktop** (https://desktop.github.com):
   *File → Add local repository* → wybierz folder projektu → *Publish repository*.
   Albo w terminalu:
   ```
   git init
   git add .
   git commit -m "Pierwsza wersja strony"
   git branch -M main
   git remote add origin https://github.com/TWOJA-NAZWA/bobgarden.git
   git push -u origin main
   ```
3. Na GitHubie wejdź w repozytorium → **Settings → Pages** → w polu **Source** wybierz **GitHub Actions**.
4. Po 1–2 minutach strona będzie dostępna pod adresem `https://TWOJA-NAZWA.github.io/bobgarden/`
   (postęp widać w zakładce **Actions**).

### Aktualizacja strony po zmianach w panelu
- **GitHub Desktop:** wpisz krótki opis zmian → *Commit to main* → *Push origin*.
- **Terminal:** `git add .` → `git commit -m "Nowe zdjęcia"` → `git push`
- **Ręcznie przez przeglądarkę:** w repozytorium otwórz `public/data/content.json` → *Add file → Upload files* i wgraj nowy plik (a nowe zdjęcia do `public/img/gallery/`).

Strona zaktualizuje się po około minucie.

---

## 4. Formularz wyceny (e-mail)

1. Wejdź na https://web3forms.com, wpisz **bobgarden@wp.pl** i odbierz darmowy klucz (Access Key) z maila.
2. Wklej klucz w panelu: **Kontakt i ustawienia → Klucz Web3Forms** i zapisz.
3. Opublikuj zmiany. Od teraz zapytania z formularza przychodzą na maila.

Bez klucza formularz też działa, ale otwiera u klienta program pocztowy z gotową wiadomością.

## 5. Rezerwacje online (opcjonalnie)

Załóż darmowe konto na https://cal.com (lub Calendly), utwórz typ spotkania, np. „Oględziny działki”, i podłącz swój kalendarz.
Wklej link w panelu w polu **Link do rezerwacji online**. W sekcji kontakt pojawi się przycisk „Umów oględziny online”.
Wyczyść pole, a przycisk zniknie.

## 6. Własna domena (opcjonalnie, ok. 50–100 zł rocznie)

Kup domenę, np. `bobgarden.pl`, a potem na GitHubie w **Settings → Pages → Custom domain** wpisz ją i ustaw rekordy DNS według instrukcji GitHuba.

---

## Częste pytania

**Strona otwarta prosto z pliku (dwuklik na index.html) jest pusta.**
Przeglądarka blokuje wczytywanie `content.json` z dysku. Uruchom `npm start` i wejdź na http://localhost:3000.

**Chcę zmienić kolory.**
Otwórz `public/style.css`. Kolory są na samej górze w sekcji `:root`.

**Chcę przesunąć ogród 3D w banerze.**
Otwórz `public/garden3d.js`. Na górze jest obiekt `PLACE`: pozycja (`nx`, `ny` od -1 do 1), wielkość (`s`) i ustawienia na telefon (`m`). Ogród jest częścią banera i przewija się razem ze stroną.

**Animowane sceny (gleba, trawnik, pory roku).**
Teksty etapów zmienisz w panelu (zakładki „Animacja: …”). Same rysunki i ruch są w `public/scenes.js` — każda scena ma tam `steps` (od którego momentu przewijania zaczyna się dany etap) oraz `build` i `update`. Kolejność scen na stronie zmienisz, przestawiając sekcje `<section class="scene">` w `public/index.html`.

**Nie widzę ogrodu 3D.**
Ogród 3D wymaga WebGL, który działa w każdej nowoczesnej przeglądarce. Jeśli w przeglądarce wyłączono „akcelerację sprzętową”, strona działa normalnie, tylko bez modelu.

**Opcja „ogranicz ruch” w systemie.**
Zatrzymuje tylko animacje, które zapętlają się same (pasek z usługami, tło). Ogród 3D i efekty sterowane przewijaniem działają dalej.

**Port 3000 jest zajęty.**
Uruchom na innym porcie: Windows (cmd) `set PORT=3001&& npm start`, macOS/Linux `PORT=3001 npm start`.
