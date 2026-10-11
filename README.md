# TouchGrass

**Less scrolling. More living.** TouchGrass turns the time, budget and energy you actually have into a realistic plan for going
outside, with a backup in case the day does not cooperate. The plan is written by an **open-weight AI model running on your own
computer** (through Ollama), and when that model is unavailable the app says so clearly and uses a labelled fallback instead.

> Status: integrated and tested with automated tests and a live-backend contract test. It has **not** been run with a real Ollama
> model, against the real OpenStreetMap services, or in a web browser by the person who integrated it. See
> [What is verified](#what-is-verified-and-what-is-not).

## The problem

Most people who want to spend more time outside are not stopped by the walk. They are stopped by the decisions around it: what to
do, how long it takes, whether it costs anything, what to do if it rains, and whether it suits their energy, their company, or an
accessibility need. If you have 10 minutes and no budget, generic "top 10 hikes" content does not help. TouchGrass starts from the
constraints and makes the decisions for you.

## Features

| | |
| --- | --- |
| **AI planner** | Time, budget, interests, energy, company and accessibility go in. A checklist, steps, cost estimate, safety reminders and a backup plan come out. Every plan says whether it came from the AI or from the fallback. |
| **Labelled fallback** | If Ollama is not running, the model is missing, it is too slow, or it returns unusable output, you still get a plan from the built-in catalogue, labelled "Built-in fallback plan, not AI", with the reason. |
| **Places near you** | Parks, gardens, nature reserves, woodland, viewpoints and water from OpenStreetMap. Location is requested only when you press a button; typing a place or coordinates works just as well. List and optional map, filters, directions that open in an external map service. |
| **Activity ideas** | A browsable, filterable catalogue of outdoor activities. |
| **Quests** | 25 hand-written quests in six categories, matched to practical limits ("only 10 to 20 minutes", "almost no budget", "low energy", "cannot travel far", "poor weather"). Start one, finish it, add a note. Each has an indoor fallback. |
| **Progress** | Only what you actually did: quests completed, minutes you entered, streaks from real dates, milestones, notes. No leaderboards, no guilt. |

<!-- Add your screenshots here after capturing them (see screenshots/README.md):
![Landing page](screenshots/01-landing.png)
![AI plan](screenshots/02-planner-ai.png)
![Fallback plan](screenshots/03-planner-fallback.png)
![Places](screenshots/04-places.png)
-->

No screenshots are bundled because no browser was available when this was integrated. `screenshots/README.md` lists what to capture.

## Architecture and data flow

```
React frontend  --->  FastAPI backend  --->  Ollama (local open-weight model)       AI plans
 (browser)                  |         --->  OpenStreetMap Overpass + Nominatim       places (internet)
                            |         --->  SQLite file (quests, progress, plan summaries)
```

1. You fill in the planner. The frontend sends your preferences to `POST /api/plan`.
2. The backend builds a prompt from your preferences (coordinates are never included) and calls Ollama's local HTTP API.
3. The reply is parsed and validated. If it is good, you get an AI plan. If anything goes wrong you get the labelled fallback.
4. Quests, progress and notes are saved in SQLite under a random anonymous id kept in your browser.
5. Place searches go from the backend to OpenStreetMap's public services using coordinates rounded to about 110 m.

More detail: [`docs/architecture.md`](docs/architecture.md), [`docs/api.md`](docs/api.md), [`docs/feature-matrix.md`](docs/feature-matrix.md).

## Technology

React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Leaflet (lazy-loaded) | Python 3.11+, FastAPI, Pydantic, HTTPX,
SQLite | Ollama with an open-weight model (default `gemma3:4b`) | OpenStreetMap data via Overpass and Nominatim | Vitest, Pytest.

## Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Python | 3.11 or newer (built and tested with 3.12) | `py --version` |
| Node.js | 20 LTS or newer (tested with 22) | `node --version` |
| Ollama | any recent version | `ollama --version` |
| Disk and memory | about 3.3 GB for the default model, roughly 4 GB free RAM or VRAM | |
| Internet | needed to download the model once, and for places, place search and map tiles | |

## Setup on Windows PowerShell

Open **PowerShell**. Replace the path with wherever you unzipped the project.

### 1. Install Ollama and download the model

```powershell
winget install Ollama.Ollama
```

No winget? Download the installer from https://ollama.com/download. **Close PowerShell and open a new window** afterwards so
`ollama` is on your PATH.

```powershell
ollama --version
ollama pull gemma3:4b
ollama list
Invoke-RestMethod http://localhost:11434/api/tags
```

The last command should list `gemma3:4b`. If it fails, start the server in a separate window and leave it open: `ollama serve`.

### 2. Backend (first PowerShell window)

```powershell
cd C:\path\to\touchgrass\backend
py -3.11 -m venv .venv            # if "py" is missing: python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell says scripts are disabled, run this once and activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

```powershell
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
Copy-Item .env.example .env
notepad .env                      # set OSM_CONTACT to your email or website, then save
pytest                            # optional but recommended: no Ollama or internet needed
uvicorn app.main:create_app --factory --reload --port 8000
```

Leave it running. Check it in another window:

```powershell
Invoke-RestMethod http://localhost:8000/api/health | ConvertTo-Json -Depth 5
```

`ai.status` should be `ready`. Interactive API docs: http://localhost:8000/docs

### 3. Frontend (second PowerShell window)

```powershell
cd C:\path\to\touchgrass\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open http://localhost:5173.

### 4. Try the whole journey

1. **Plan:** open *Planner*, choose time, budget, energy, interests, company and accessibility, press *Build my plan*. The first plan
   can take a minute while the model loads. The badge shows whether the AI or the fallback wrote it.
2. **Fallback:** quit Ollama and build again to see the labelled fallback and the explanation.
3. **Places:** open *Explore*, press *Find places near me* (or type a city), open a place, press *Get directions*.
4. **Quests:** open *Quests*, tick what is getting in the way, start a quest, finish it with a note.
5. **Progress:** open *My progress* and see it recorded.

### Demo mode (no backend)

Set `VITE_USE_MOCK=true` in `frontend\.env` and run `npm run dev`. Every screen is labelled as a demo: plans come from simple
rules in the browser (not AI) and "places" are a fixed sample in London. Nothing is sent anywhere.

### Production build

```powershell
cd frontend
npm run build          # outputs frontend\dist (static files)
npm run preview        # serves the build at http://localhost:4173
```

## Configuration

Backend settings live in `backend\.env` (documented line by line in `backend\.env.example`). Frontend settings live in
`frontend\.env`. **There are no API keys or secrets anywhere.** Anything starting with `VITE_` is public by design.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Where Ollama listens |
| `OLLAMA_MODEL` | `gemma3:4b` | Which model to use (must be pulled first) |
| `OLLAMA_TIMEOUT_SECONDS` | `120` | How long to wait before falling back |
| `AI_ENABLED` | `true` | `false` = never call the model, always use the labelled fallback |
| `PLACES_PROVIDER` | `overpass` | `none` = no external map requests at all (place discovery returns an honest 501) |
| `OSM_CONTACT` | empty | Your email or URL, sent to OpenStreetMap services in the User-Agent as their policies require |
| `OVERPASS_URLS`, `NOMINATIM_URL` | public servers | Point at your own instances for real traffic |
| `CORS_ORIGINS` | local Vite ports | Frontend origins allowed to call the API |
| `DATABASE_PATH` | `data/touchgrass.db` | SQLite file |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Where the frontend finds the backend |
| `VITE_USE_MOCK` | `false` | `true` = backend-free demo |

## Testing

See [`docs/testing.md`](docs/testing.md) for commands, what each suite proves, and a manual checklist.

```powershell
cd backend;  pytest                       # 272 tests
cd ..\frontend; npx tsc --noEmit; npm test; npm run build
```

### What is verified, and what is not

**Verified (ran and passed):** backend `pytest` (272 tests); frontend type check, 142 unit and smoke tests and the production build;
the frontend's API client against the real backend process (7 tests); the real `uvicorn` server started and exercised with
`curl` including CORS and failure paths.

**Not verified, and needs you:** a real Ollama model (plan quality and speed), the real OpenStreetMap services, any web browser
(visual design, animations, the map, the location prompt, keyboard and screen-reader use, mobile layout), offline behaviour, and
the PowerShell commands on Windows (the same steps were run on Linux). Automated tests use stand-ins for Ollama and OpenStreetMap
that speak the same protocols, so they prove our code, not the services.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Planner says "Could not reach the TouchGrass server" | The backend is not running, or `VITE_API_BASE_URL` is wrong. Start it and press the refresh icon in the status box |
| Status says "The AI service (Ollama) is not running" | Open the Ollama app or run `ollama serve`. Plans still work, labelled as fallback |
| Status says "model has not been downloaded" | `ollama pull gemma3:4b` (or the model in `OLLAMA_MODEL`) |
| Every plan is a fallback with `ai_timeout` | Raise `OLLAMA_TIMEOUT_SECONDS`, or use `gemma3:1b` on a slower computer |
| Fallback with `ai_invalid_response` | Raise `OLLAMA_NUM_PREDICT`, or try a larger model |
| Places show "Map data is unavailable" or "Search limit reached" | The public OpenStreetMap service is busy or you are offline. Wait a minute and retry, or use your own `OVERPASS_URLS` |
| Places return 501 | `PLACES_PROVIDER=none` in `backend\.env` |
| Browser console shows a CORS error | Add the frontend's address to `CORS_ORIGINS` and restart the backend |
| `Activate.ps1 cannot be loaded` | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |
| Map tiles are blank | You are offline, or the tile server is blocking you. See `VITE_MAP_TILE_URL` |
| Port already in use | Change `--port 8000` and update `VITE_API_BASE_URL` and `CORS_ORIGINS` |

macOS or Linux: `python3 -m venv .venv && source .venv/bin/activate`, `cp .env.example .env`, everything else is the same.

## Privacy

- **No accounts.** The browser stores a random anonymous id (`touchgrass.profile` in local storage) sent as `X-Profile-Id` so one
  browser's progress stays separate from another's. It has no personal information. Clearing site data creates a new one.
- **Location is optional and never silent.** The browser location prompt appears only after you press "Find places near me".
  Denying it changes nothing else. Typing a place or coordinates works without it.
- **Coordinates are reduced before leaving your browser** (about 110 m) and again on the server. They are used for that one search and
  an in-memory 10-minute cache, **never stored in the database and never sent to the AI model**. The planner's optional location is
  rounded to about 1 km, only its text label reaches the model, and the coordinates are not stored.
- **Server logs redact** `lat`, `lon` and `q` from request URLs. If you put a reverse proxy in front, configure it the same way.
- **What is stored:** quest completions, minutes you entered, notes you wrote, logged sessions, and a summary of each plan (title,
  length, budget, energy, interests). Notes, locations and accessibility needs are not stored with plans.
- **What leaves your machine:** place searches (rounded coordinates) and typed place names go to OpenStreetMap's Overpass and
  Nominatim. Map tiles are requested by your browser from the tile server. Directions only open when you click and say what is shared.
  The AI runs on your own computer through Ollama: your notes and area name are not sent to any hosted AI service.
- **Delete everything:** stop the backend and delete `backend\data\touchgrass.db*`, then clear the site's local storage.

## Open-weight model and licensing

The app is built on an **open-weight** model served locally by Ollama. It does not use any closed hosted AI API.

| Item | Licence / terms | Notes |
| --- | --- | --- |
| **TouchGrass code** | MIT (`LICENSE`, put your name in the copyright line) | Dependencies use their own permissive licences (React, FastAPI, Tailwind, Framer Motion: MIT, Leaflet: BSD-2-Clause) |
| **Default model `gemma3:4b`** | Google's [Gemma Terms of Use](https://ai.google.dev/gemma/terms) | Open weights, but **not an OSI-approved open-source licence** and it carries use restrictions. Read the terms before commercial or redistributed use |
| **Ollama** | MIT | https://github.com/ollama/ollama |
| **Map data** | ODbL, © OpenStreetMap contributors | Attribution is shown in the app. https://www.openstreetmap.org/copyright |
| **Overpass, Nominatim, tile servers** | Public services with usage policies | Light use only. Set `OSM_CONTACT`. Use your own instances or a tile provider for real traffic |

You can use any model Ollama serves by changing `OLLAMA_MODEL`. If you need a permissively licensed model, candidates I believe are
under MIT or Apache 2.0 are `phi4-mini`, `mistral` and `qwen2.5:7b`, but **I could not check their current licences from the build
environment and have not tested plan quality with them. Confirm each licence on its Ollama model page first.**

## Current limitations and future ideas

Limitations: single anonymous profile per browser (no accounts, no sync, anyone who knows an id can read that profile); no offline
use; OpenStreetMap data is community-maintained, can be incomplete, and carries no ratings, safety or live conditions; plan quality
depends on the model you choose and has not been evaluated; rate limiting and cache are per process; no linter; no screenshots.

Ideas: accounts with a "delete my data" button, weather-aware suggestions from an open data source, multilingual plans, a larger
quest and activity catalogue with community contributions, offline-first quests, evaluating several open models against the same
plan checklist.

## Attribution

[Ollama](https://ollama.com), [Gemma](https://ai.google.dev/gemma) by Google, [OpenStreetMap](https://www.openstreetmap.org)
contributors and the Overpass API and Nominatim services, [Leaflet](https://leafletjs.com), React, FastAPI, Pydantic, Tailwind CSS,
Framer Motion, Lucide icons.

## Why open innovation matters for this product

Going outside is a personal, local and often private decision: your free time, your money, your energy, your health needs. Open
innovation lets the product respect that. Open-weight models can run on your own computer, so the details of your day do not need to
be sent to someone else's server. Open map data means place discovery does not depend on one company's pricing or terms. Open
code and clear licences mean anyone can check what is stored, change the quests for their own city or language, or run the whole
thing for a school, a community group or a clinic. The trade-offs are real too: local models are slower and less polished than
hosted ones, and community data is uneven. TouchGrass is designed around that honesty: it says what came from the AI, what is
curated, what is live data and what is a fallback.

## Project layout

```
touchgrass/
  frontend/    React app (src/components, pages, services, hooks, types, data, utils, styles)
  backend/     FastAPI app (app/ = planner, catalogue, AI; part3/ = places, quests, progress; tests/)
  docs/        architecture.md  api.md  feature-matrix.md  testing.md  dev-submission.md
  scripts/     sync_catalog.py (keeps the demo-mode quest copy in step with the backend)
  screenshots/ instructions for capturing screenshots
```
