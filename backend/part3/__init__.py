"""TouchGrass Part 3: real place discovery, geocoding, curated quests and progress.

Mounted into the main FastAPI app by `app/core/part3.py`:

    mount_part3(app, settings, container=...)
    mount_part3(app, settings, include_places=False)   # quests and progress only
"""
from .privacy import install_access_log_redaction
from .routes import get_owner, mount_part3, places_router, quests_router

__all__ = ["mount_part3", "places_router", "quests_router", "get_owner", "install_access_log_redaction"]
