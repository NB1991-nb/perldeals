# perldeals.com

Statische Deal-Seite (DE + EN), gebaut mit `node build.mjs` nach `dist/`.

- Deals: `src/data/deals.json` (wird jeden Morgen automatisch aktualisiert)
- Betreiberdaten fürs Impressum: `src/data/site.json`
- Design: `src/assets/style.css`, Skripte: `src/assets/app.js`, `src/assets/theme.js`
- Schriften liegen lokal in `src/assets/fonts` (keine Verbindung zu Google)

Deploy: IONOS Deploy Now, Build-Befehl `node build.mjs`, Ausgabeordner `dist`.
