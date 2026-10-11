# TouchGrass backend

FastAPI backend. Setup, configuration and Windows PowerShell commands are in the **root [`README.md`](../README.md)**. This file is a
short map of the code.

```
app/
  main.py            create_app(): wires CORS, errors, routes, and mounts part3
  api/               routes (health, plan, activities), error handling, profile header
  core/              settings (config.py), container, part3.py (how Part 3 is mounted), logging
  services/          planner, AI service, Ollama client, prompts, plan normalizer, catalogue, fallback planner
  repositories/      SQLite access (profiles, plan history)
  schemas/ models/   Pydantic schemas and domain types
  data/              built-in activity catalogue
part3/               places (Overpass), geocoding (Nominatim), curated quests, progress, privacy log filter, legacy import
  data/quests.json   the curated quest catalogue (single source of truth, copied to the frontend by scripts/sync_catalog.py)
tests/               Part 2 tests, part3/ tests, test_integration_api.py, test_ollama_end_to_end.py, e2e_server.py
```

Run: `uvicorn app.main:create_app --factory --reload --port 8000` (docs at `/docs`). Test: `pytest` (no Ollama or internet needed).
API reference: [`../docs/api.md`](../docs/api.md). How the two halves were merged: [`../docs/architecture.md`](../docs/architecture.md).

Swapping providers: places implement `part3.overpass.PlacesProvider`, geocoding implements `part3.geocode.Geocoder`, AI implements
`app.services.ai_provider.AIProvider`. Pass any of them to `create_app(...)`.
