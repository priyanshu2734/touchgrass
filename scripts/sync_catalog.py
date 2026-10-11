#!/usr/bin/env python3
"""Copy the quest catalogue (single source of truth) into the frontend demo bundle.

    python scripts/sync_catalog.py          # copy
    python scripts/sync_catalog.py --check  # exit 1 if they differ

The backend test `test_frontend_catalogue_copy_is_in_sync` runs the same comparison.
"""
import shutil
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / "backend" / "part3" / "data" / "quests.json"
target = root / "frontend" / "src" / "data" / "quests.curated.json"

if "--check" in sys.argv:
    same = target.exists() and target.read_bytes() == source.read_bytes()
    print("in sync" if same else "OUT OF SYNC: run scripts/sync_catalog.py")
    sys.exit(0 if same else 1)

shutil.copyfile(source, target)
print(f"copied {source.relative_to(root)} -> {target.relative_to(root)}")
