# Talent Arena Agenda App

Angular web application to explore the Talent Arena agenda from JSON data.

## What this app does

- Loads sessions from `public/talentarena.json`
- Shows sessions grouped as:
	- All sessions
	- By day
	- By stage
	- By category
- Supports combined filters (day + stage + category at the same time)
- Allows marking/unmarking sessions as favorites
- Stores favorites in browser local storage
- Lets users show only favorites and manage filter/favorite selections

## Tech stack

- Angular 20
- TypeScript
- CSS (custom modern UI styling)

## Run locally

From this folder (`talentarena-app`):

```bash
npm install
npm start
```

Open `http://localhost:4200/`.

## Build

```bash
npm run build
```

Production output is generated in:

`dist/talentarena-app/`

## Data source

- Input data file: `public/talentarena.json`
- Original source used in workspace: `../json/talentarena.json`

## Deploy to GitHub Pages (optional)

Example for repo name `talentarena2026`:

```bash
ng build --configuration production --base-href "/talentarena2026/"
npx angular-cli-ghpages --dir=dist/talentarena-app/browser
```

Then enable GitHub Pages from the `gh-pages` branch in repository settings.
