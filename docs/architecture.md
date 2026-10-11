# Architecture

```
Browser (React + TypeScript + Vite + Tailwind + Framer Motion)
   |  services/api.ts: one client. Adds X-Profile-Id, validates every response, converts snake_case <-> camelCase
   v
FastAPI backend  (backend/app = Part 2, backend/part3 = Part 3, mounted into one app by app/core/part3.py)
   |-- /api/plan, /api/activities, /api/history, /api/health ----> app/ (planner, catalogue, AI client)
   |        |                                                          |
   |        |                                         Ollama HTTP API  v  (local open-weight model, e.g. gemma3:4b)
   |        +--> on any AI problem: labelled fallback planner (no model)
   |-- /api/quests, /api/progress, /api/outdoor-sessions ---------> part3/ (curated quests, progress)
   |-- /api/places, /api/geocode ---------------------------------> part3/ ----> OpenStreetMap Overpass + Nominatim (live, internet)
   v
SQLite (one file): profiles, plan_history (summary only)  +  tg3_entries, tg3_quest_starts, tg3_meta
```

## Folder map

```
touchgrass/
  frontend/src/   components/ pages/ layouts/ services/ hooks/ types/ data/ utils/ styles/
  backend/app/    api/ core/ schemas/ services/ repositories/ models/ data/        Part 2: planner, catalogue, AI, history
  backend/part3/  overpass.py places_service.py geocode.py quest_service.py ...    Part 3: places, quests, progress
  backend/tests/  Part 2 tests, part3/ tests, integration + Ollama end-to-end tests
  docs/  scripts/  screenshots/
```

## How the two backends were reconciled

Both originally defined `/api/places`, `/api/quests` and `/api/progress` differently.

| Decision | Reason |
| --- | --- |
| Part 3 serves places, geocoding, quests, progress and sessions. Part 2's duplicate routes, schemas, services and tests for these were removed | Part 3's quest catalogue (25) is a strict superset of Part 2's (10, same ids); it adds start, repeat, notes, sessions and accurate streaks |
| Part 2 serves planner, activities, history, health | Part 3 has no equivalent |
| Part 3's owner dependency is replaced with Part 2's `X-Profile-Id` | One anonymous-profile mechanism, per-browser isolation |
| One SQLite file | Part 3 tables are prefixed `tg3_`, no collisions |
| Part 2's `quest_completions` table is imported once into `tg3_entries` (`part3/legacy.py`), then left untouched | Nobody loses progress recorded by the Part 2 backend. Idempotent, tested |
| `PLACES_PROVIDER=none` kept as an off switch (honest 501) | Preserves Part 2's documented behaviour and gives a zero-external-calls mode |
| `plansGenerated` added to progress | Preserves Part 2's `plans_generated` field |
| Part 2's `tz_offset_minutes` progress parameter dropped | Part 3 stores the client's local date with each entry, which is more accurate |
| CORS now allows `PATCH` and `DELETE`; the error handler keeps `Retry-After` | Needed by Part 3 endpoints |
| The standalone Part 3 app and its env variables were removed | One entry point, one `.env` |

## Where provenance is decided

| Label | Decided by | Shown as |
| --- | --- | --- |
| AI-generated | `PlannerService` only when the model reply parsed and validated | "AI-generated with {model}" |
| Fallback | `PlannerService` for any AI failure | "Built-in fallback plan, not AI" plus the reason |
| Demo | Frontend, only when `VITE_USE_MOCK=true` | "Demo plan from simple rules in your browser, not AI" plus a banner |
| Curated | Quests and activities are static data | "Curated" |
| Live external data | Places and geocoding come from OpenStreetMap | "Place data from OpenStreetMap contributors", plus unverified labels |
