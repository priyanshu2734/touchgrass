# Testing

## Results from the integration run

| Check | Result |
| --- | --- |
| Backend `pytest` (Python 3.12, fresh virtual environment) | **272 passed** |
| Frontend `npx tsc --noEmit` | passed, no errors |
| Frontend `npm run build` | passed (Leaflet is split into a lazy chunk) |
| Frontend `npx vitest run` (no backend) | **142 passed**, 7 skipped (the live-backend tests) |
| Frontend `vitest` with the live-backend tests | **149 passed** |
| Real `uvicorn app.main:create_app --factory` started and called with `curl` | health, plan fallback, quests, progress, places/geocode failure paths, CORS preflight and log redaction all behaved as documented |

Not run: a real Ollama server or model, real OpenStreetMap services (no internet in the build environment), any web browser, any
linter, the PowerShell commands on Windows (the equivalent steps were run on Linux).

## Commands (Windows PowerShell)

Backend (from `backend`, virtual environment active):

```powershell
pytest                       # everything, no Ollama and no internet needed
pytest tests/part3           # place discovery, quests, progress package only
pytest tests/test_ollama_end_to_end.py   # real HTTP path to an Ollama-protocol stand-in
```

Frontend (from `frontend`):

```powershell
npx tsc --noEmit
npm test                     # unit and smoke tests, no backend needed
npm run build
```

Contract test: the frontend's API client against the real backend, in two PowerShell windows:

```powershell
# window 1, in backend (virtual environment active): real app, stand-ins for Ollama and OpenStreetMap
python -m tests.e2e_server 8765

# window 2, in frontend
$env:VITE_E2E_URL = "http://127.0.0.1:8765"
npx vitest run src/e2e.contract.test.ts
Remove-Item Env:VITE_E2E_URL
```

## What the tests prove, and what they do not

- **Mocks are never real services.** Tests use stand-ins so they are deterministic and offline. The Ollama stand-in speaks Ollama's
  documented HTTP protocol, so it proves our client, parsing, validation, labelling and fallback logic. It says nothing about how
  good a real model's plans are.
- **Smoke tests render every route in jsdom** and fail on any `console.error`. jsdom is not a browser: layout, animation, the Leaflet
  map and geolocation prompts are not exercised.
- **The catalogue copy** used by demo mode must match `backend/part3/data/quests.json`: run `python scripts/sync_catalog.py` after
  editing quests (a test fails if they differ).

## Manual checklist (needs Ollama, internet and a browser)

1. `ollama pull gemma3:4b`, start backend and frontend. Open `/plan`: the status box says "AI ready: gemma3:4b".
2. Build a plan. Expect a wait of up to a minute the first time. The badge reads "AI-generated with gemma3:4b".
3. Quit Ollama (system-tray icon, or stop the `ollama serve` window) and build again. Expect the amber notice and "Built-in fallback plan, not AI".
4. `/explore`: nothing is requested on load. Press "Find places near me", allow the prompt, check places, the Map view and tiles.
   Deny the prompt on a second try and confirm the search box still works.
5. Open a place, then "Get directions": it opens in a new tab.
6. `/quests`: select "Only 10 to 20 minutes" and "Almost no budget", start a quest, finish it with a note, check `/progress`.
7. Restart the backend and confirm progress is still there.
8. Disconnect from the internet: confirm places and place search show a clear error with a retry, while quests, progress and
   fallback plans still work. (This has not been tested; note the result before claiming any offline behaviour.)
9. Keyboard only: tab through the planner, open and close a dialog with Escape, confirm focus returns to the button.
10. Narrow the window to phone width and check the navigation menu and dialogs.
