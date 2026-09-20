# BobGarden

Strona wizytówka firmy ogrodniczej — usługi, galeria realizacji, formularz wyceny.
Zbudowana bez frameworków: czysty HTML, CSS i JavaScript, z animacjami sterowanymi przewijaniem i modelem 3D w banerze.

**🌿 Demo na żywo: https://krystianszysiak.github.io/bobgarden/**

*A landing page for a gardening company, built with vanilla HTML/CSS/JS. Bilingual (PL/EN), scroll-driven SVG animations, a Three.js garden island, and a local admin panel for editing all content.*

---

## Co jest w środku

| | |
|---|---|
| **Dwa języki** | Cała treść w PL i EN, przełącznik w nagłówku. Język zapamiętywany w `localStorage`, wykrywany z `?lang=` i ustawień przeglądarki. Brak tłumaczenia = fallback na polski. |
| **Ogród 3D** | Niskopoligonowa wyspa z kwiatami w banerze — Three.js, cienie, proceduralnie generowane rośliny, delikatna reakcja na ruch myszy. |
| **Trzy sceny animowane przewijaniem** | Ręcznie rysowane sceny SVG, w których postęp przewijania steruje każdym elementem: przekrój gleby z nawodnieniem i kiełkującymi kwiatami, układanie trawnika z rolki (walec → rolki → zraszacze → kosiarka → zmierzch) oraz drzewo przechodzące przez cztery pory roku. |
| **Galeria** | Siatka realizacji z lightboxem, lazy loading, obsługa klawiatury. |
| **Formularz wyceny** | Wysyłka e-mail przez [Web3Forms](https://web3forms.com) (bez backendu), z polem preferowanego terminu oględzin i opcjonalnym linkiem do rezerwacji (Cal.com / Calendly). Bez klucza API formularz otwiera program pocztowy z gotową wiadomością. |
| **Panel edycji** | Lokalna aplikacja Express: teksty (PL/EN), dane kontaktowe, usługi, cennik i galeria ze zmianą kolejności i wgrywaniem zdjęć. Zapisuje do `public/data/content.json`, robi kopie zapasowe, skaluje zdjęcia przed zapisem. |

Strona jest responsywna, działa bez JavaScriptowych zależności i bez śledzenia. Strony wynikowej nie trzeba budować — to gotowe pliki statyczne.

## Technologie

- **Frontend:** HTML, CSS (custom properties, `clamp()`, grid), JavaScript ES5/ES6 — zero zależności runtime
- **3D:** [Three.js](https://threejs.org) 0.186, spakowany do lekkiego bundla przez esbuild
- **Animacje:** SVG generowane w JS, `IntersectionObserver` + `requestAnimationFrame`, sekcje sticky
- **Panel:** Node.js + [Express](https://expressjs.com) 4 (jedyna zależność), zapis atomowy do JSON
- **Hosting:** GitHub Pages + GitHub Actions (publikowany jest tylko folder `public/`)

## Struktura

```
public/              ← gotowa strona (to trafia na GitHub Pages)
  index.html
  style.css          ← zmienne kolorów w :root na górze pliku
  script.js          ← język, galeria, formularz, silnik scen
  scenes.js          ← definicje trzech scen 2D
  garden3d.js        ← ogród 3D (Three.js)
  data/content.json  ← wszystkie treści strony
  img/               ← zdjęcia galerii
admin/               ← panel edycji (nie jest publikowany)
server.js            ← lokalny serwer Express dla panelu
.github/workflows/   ← publikacja na GitHub Pages
```

## Uruchomienie lokalne

```bash
npm install
npm start
```

- Strona: http://localhost:3000
- Panel edycji: http://localhost:3000/admin

Na Windowsie wystarczy dwuklik na `start.bat`.

Panel wymaga tego serwera — `python -m http.server` czy Live Server tylko wyświetlają pliki i nie zapiszą zmian. Samo `public/` można natomiast serwować dowolnie, byle nie otwierać `index.html` bezpośrednio z dysku (przeglądarka zablokuje wczytanie `content.json`).

Pełna instrukcja dla właściciela strony — edycja treści, publikacja, podpięcie formularza i własnej domeny — jest w [INSTRUKCJA.md](INSTRUKCJA.md).

## Licencja

Kod można wykorzystywać dowolnie. Zdjęcia w `public/img/` należą do firmy BobGarden i nie są objęte tą zgodą.
