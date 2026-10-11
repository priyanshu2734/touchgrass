"""Starts the REAL TouchGrass app with stand-ins for the two things that need the internet or a GPU:

  * Ollama  -> a local socket server that speaks Ollama's protocol (the real OllamaProvider connects to it)
  * OpenStreetMap -> a fake places provider and geocoder (no external requests)

Used to run the frontend's own API client against the real backend:

    python -m tests.e2e_server 8765
"""
import json
import sys
import tempfile
from pathlib import Path

import uvicorn

from app.core.config import Settings
from app.main import create_app
from tests.helpers import FakeGeocoder, FakePlaces, raw_place
from tests.test_ollama_end_to_end import FakeOllama

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ollama = FakeOllama().__enter__()
settings = Settings(
    database_path=str(Path(tempfile.mkdtemp()) / "e2e.db"),
    ollama_base_url=ollama.url,
    ollama_model="gemma3:4b",
    cors_origins=("http://localhost:5173",),
)
places = FakePlaces([
    raw_place("Lakeside Park", 20.3, 85.8, opening_hours="Mo-Su 06:00-20:00"),
    raw_place("Botanical Garden", 20.31, 85.81, category_id="garden", wheelchair="yes", website="https://example.org"),
])
app = create_app(settings, places_provider=places, geocoder=FakeGeocoder())
print(json.dumps({"ready": True, "port": port, "ollama": ollama.url}), flush=True)
uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
