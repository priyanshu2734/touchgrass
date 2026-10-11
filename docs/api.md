# API reference

Base URL: `http://localhost:8000`. Interactive docs: `http://localhost:8000/docs`.
No authentication. Send an optional `X-Profile-Id` header (8 to 64 characters: letters, digits, `-`, `_`). The frontend creates a
random one per browser. Without it, requests share one `anonymous` profile.

## Two response styles, one frontend type system

| Area | Style | Why |
| --- | --- | --- |
| Planner, activities, history, health | snake_case, list endpoints return `{ items, count }` | The original backend contract |
| Places, geocoding, quests, progress, sessions | camelCase, list endpoints return bare arrays | The contract the frontend was built against |

`frontend/src/services/validators.ts` converts and validates everything into one set of TypeScript types. Nothing is rendered
without passing through it.

## Errors

Every error uses one shape, with a plain-language `message` that is safe to show to people:

```json
{ "error": { "code": "not_found", "message": "That quest could not be found." } }
```

Validation errors add `details: [{ "field": "...", "message": "..." }]`. 429 responses carry a `Retry-After` header.

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_profile_id` | Bad `X-Profile-Id` |
| 404 | `not_found` | Unknown quest or entry |
| 422 | `validation_error` | Request failed validation |
| 429 | `rate_limited` | Our per-client limit, or the map service's |
| 501 | `not_configured` | `PLACES_PROVIDER=none` |
| 502 / 503 / 504 | `upstream_error` / `upstream_unavailable` / `upstream_timeout` | OpenStreetMap services failed |
| 500 | `internal_error` | Unexpected. Details stay in the server log |

## Health

`GET /api/health` returns 200 with `status: "ok"` (AI ready) or `"degraded"` (AI not ready, fallback plans still work), and 503 with
`"error"` if the database fails. `ai.status` is `ready`, `model_missing`, `unreachable` or `disabled`, and `ai.setup_hint` says what to
do. It never contains URLs, file paths or secrets.

## Planner (AI)

`POST /api/plan`

```json
{
  "minutes": 30, "budget": "free", "energy": "low", "interests": ["nature", "photography"],
  "company": "solo", "accessibility": ["step-free"],
  "notes": "I like quiet places",
  "location": { "label": "Riverside", "lat": 20.2961, "lon": 85.8245 }
}
```

`available_minutes` and `accessibility_needs` are accepted as the canonical names; `minutes` and `accessibility` are aliases.
`location` is optional. Coordinates are rounded to 2 decimals (about 1 km) and are **never sent to the model and never stored**;
the label and the notes are sent to the model.

Response (abridged):

```json
{
  "generated_by": "ai",            // or "fallback"
  "model": "gemma3:4b",            // null for fallback
  "fallback_reason": null,         // ai_disabled | ai_unreachable | ai_timeout | ai_model_missing | ai_invalid_response | ai_server_error | ai_error
  "message": null,                 // plain-language explanation when it is a fallback
  "plan": { "id": "...", "title": "...", "summary": "...", "why_it_matches": "...", "total_minutes": 45,
            "steps": [ { "order": 1, "title": "...", "description": "...", "duration_minutes": 10 } ],
            "estimated_cost": { "min": 0, "max": 3, "currency": "USD", "assumptions": "..." },
            "checklist": ["..."], "backup_plan": { "title": "...", "description": "...", "duration_minutes": 10, "when_to_use": "..." },
            "accessibility_adaptations": ["..."], "safety_reminders": ["..."], "phone_away_suggestion": "..." }
}
```

How an AI reply is handled: the backend asks Ollama (`/api/chat`, JSON-schema `format`), parses the JSON, validates it, and corrects
what it can (for example a cost above the person's budget is clamped and the correction is disclosed in `estimated_cost.assumptions`).
If the model is missing, down, too slow or returns unusable output, the plan is built from the built-in catalogue and
`generated_by` is `"fallback"`. The API never returns an unlabelled fallback.

`GET /api/history?limit=20` returns summaries only (title, length, budget, energy, interests, source), per profile.

## Activities

`GET /api/activities` with optional `category`, `min_minutes`, `max_minutes`, `budget`, `difficulty`, `q` returns
`{ items: Activity[], count }` from the built-in catalogue.

## Places and geocoding (live OpenStreetMap data)

| Endpoint | Notes |
| --- | --- |
| `GET /api/places?lat&lon&radius` | Optional `categories` (comma list), `limit`, `include_unnamed`. Returns `Place[]`: `id, name, category, lat, lon, distanceMeters`, plus `categoryId, osmUrl, openingHours, wheelchair, website, named` **only when OpenStreetMap has a value**. Radius is clamped to 15 km. |
| `GET /api/places/categories` | `[{ id, label, defaultOn }]` |
| `GET /api/geocode?q=` | Typed place to `[{ label, lat, lon }]` (Nominatim). The frontend only calls it after the person submits the search form. |

Coordinates are rounded to 3 decimals (about 110 m) before the Overpass query and cache key. Results are cached in memory for 10 minutes.
`openingHours` and `wheelchair` are raw OpenStreetMap tags: unverified.

## Quests, progress and logged time (curated, persisted)

| Endpoint | Notes |
| --- | --- |
| `GET /api/quests` | Optional `category`, `difficulty`. 25 curated quests, each with objective, steps, equipment, completion criteria, indoor fallback and the caller's `status` (`available`, `in-progress`, `completed`) |
| `POST /api/quests/{id}/start` / `DELETE` | Mark in progress / put back |
| `POST /api/quests/{id}/complete` | Optional body `{ minutesSpent 1-600, reflection <=500 chars, repeat, localDate }`. Idempotent unless `repeat: true`; a repeat within 30 s is ignored. Returns `{ quest, progress }` |
| `GET /api/progress` | Optional `today=YYYY-MM-DD` (client's local date for streaks). Counts, minutes, streaks, milestones, 30 most recent entries, `plansGenerated` |
| `POST /api/outdoor-sessions` | `{ minutes, note?, localDate? }`: log time outside without a quest |
| `PATCH /api/progress/entries/{id}` | `{ note }`: edit or clear a reflection |
| `DELETE /api/progress/entries/{id}` | Remove a mistaken entry |

Streaks are consecutive local calendar days with at least one entry (a quest or a logged session), computed from the stored
`localDate`. Minutes are only ever what the person entered. A new profile starts at zero with nothing achieved.
