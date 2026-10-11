# Feature matrix

Legend: **Automated** = covered by tests that ran and passed. **Live harness** = the frontend's own API client was run against the
real backend process with stand-ins for Ollama and OpenStreetMap (`backend/tests/e2e_server.py`). **Manual** = needs a person with the
real service or a browser; not verified here. Details and commands are in `testing.md`.

| # | Feature | Implementation | Verified | Still needs manual verification |
| --- | --- | --- | --- | --- |
| 1 | Landing page | `pages/LandingPage.tsx`, Framer Motion hero | Renders without console errors (Automated, jsdom) | Visual quality, animation, responsiveness in a real browser |
| 2 | Planner form and validation | `pages/PlannerPage.tsx` | Route render (Automated). Request format against the real backend (Live harness) | Usability on a phone |
| 3 | AI plan from an open-weight model | Backend `OllamaProvider` -> Ollama `/api/chat` | Real HTTP call over a real socket to an Ollama-protocol stand-in, response validation, labelling, privacy of the prompt (Automated + Live harness) | **A real Ollama and a real model**: output quality, speed, memory use |
| 4 | Labelled fallback when AI is unavailable | `PlannerService` + `PlanResult` badge and notice | Ollama down, model missing, bad JSON, HTTP 500, AI disabled, over-budget plan (Automated). Real uvicorn with Ollama absent (live check) | Seeing the badge in a browser |
| 5 | AI status shown before submitting | `components/AiStatus.tsx` reads `/api/health` | Missing-model case rendered (Automated) | Ready/unreachable look in a browser |
| 6 | Browse and filter activities | `ActivityIdeas.tsx`, `/api/activities` | Contract (Live harness), route render (Automated) | Filter behaviour by hand |
| 7 | Nearby places (live OpenStreetMap) | `part3/overpass.py`, `PlacesDiscovery.tsx` | Query building, response validation, error mapping, caching, rounding, rate limit (Automated, simulated Overpass). Real uvicorn with no internet returns clean 503s (live check) | **A real Overpass query**, the browser location prompt, the Leaflet map and tiles |
| 8 | Manual location | `LocationControls.tsx`, `/api/geocode`, typed coordinates | Parsing and error paths (Automated) | A real Nominatim lookup |
| 9 | Directions | `utils/directions.ts`, `PlaceDetailsModal.tsx` | URL construction for OpenStreetMap, Google, Apple (Automated) | Opening them in a browser |
| 10 | Quests: browse, start, complete, repeat | `part3/quest_service.py`, quest pages | Full flow through the real backend (Live harness, Automated) | Modal focus and keyboard behaviour in a browser |
| 11 | Barrier-aware matching, indoor fallback | `utils/questMatching.ts`, `FitFinder` | Rules including "nothing fits" (Automated) | Wording and usability |
| 12 | Progress from real records | `/api/progress`, `ProgressPage.tsx` | Zero state, streaks from real dates, persistence across restart, profile isolation (Automated + Live harness) | Appearance |
| 13 | Notes, logged time, edit and remove entries | `/api/outdoor-sessions`, `/api/progress/entries/{id}` | Automated + Live harness | |
| 14 | Data created by the old Part 2 backend | `part3/legacy.py` | Import, idempotency, old table untouched (Automated) | Only relevant if you have an old database file |
| 15 | Errors and empty states | Skeletons, retry buttons, empty states on every list | Backend down shows a retry button (Automated). Empty and error paths per feature (Automated) | |
| 16 | Privacy | Coordinate rounding, redacted access logs, no coordinates to the model, no stored coordinates | Automated tests for each | Review of your own deployment's proxy logs |
| 17 | CORS | `app/main.py` | Preflight for GET/POST/PATCH/DELETE, rejected origins (Automated + real uvicorn) | |
| 18 | Accessibility basics | Labelled forms, focus-trapping dialogs, `aria-live` status, reduced-motion respected | Structure only (jsdom) | **Screen reader and keyboard pass, colour contrast audit** |

## Not implemented

- Accounts, sign-in, syncing between devices, a "delete all my data" button (delete the SQLite file instead, see the README).
- Offline use. Nothing here has been tested without internet access, and place search, place-name lookup and map tiles need it.
- Opening hours, ratings, safety status, routes or live conditions. Only unverified OpenStreetMap tags are shown.
- Rate limiting and the places cache are per process, not shared between workers.
- Linting (no linter is configured). `tsc` strict type checking is used instead.
- Screenshots (no browser was available, see `screenshots/README.md`).
