import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TABLE_NAME = "amzsphere_state"
STATE_ID = "primary"


class ConcurrentStateUpdate(Exception):
    pass


class JsonStateStore:
    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.RLock()

    def read(self):
        with self.lock, self.path.open(encoding="utf-8") as state_file:
            return json.load(state_file), None

    def write(self, state, _version):
        with self.lock:
            temporary_path = self.path.with_suffix(".json.tmp")
            temporary_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
            temporary_path.replace(self.path)


class SupabaseStateStore:
    def __init__(self, client, seed_path):
        self.client = client
        self.seed_path = Path(seed_path)

    def _fetch_row(self):
        response = (
            self.client.table(TABLE_NAME)
            .select("state,version")
            .eq("id", STATE_ID)
            .maybe_single()
            .execute()
        )
        return response.data

    def read(self):
        row = self._fetch_row()
        if row is None:
            seed_state = json.loads(self.seed_path.read_text(encoding="utf-8"))
            self.client.table(TABLE_NAME).upsert(
                {"id": STATE_ID, "state": seed_state, "version": 0},
                on_conflict="id",
                ignore_duplicates=True,
            ).execute()
            row = self._fetch_row()
        if row is None:
            raise RuntimeError("Supabase state row could not be initialized.")
        return row["state"], int(row["version"])

    def write(self, state, version):
        response = (
            self.client.table(TABLE_NAME)
            .update(
                {
                    "state": state,
                    "version": version + 1,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", STATE_ID)
            .eq("version", version)
            .select("version")
            .execute()
        )
        if not response.data:
            raise ConcurrentStateUpdate("Supabase state changed during this request.")


_STORE = None
_STORE_LOCK = threading.Lock()


def get_state_store():
    global _STORE
    if _STORE is not None:
        return _STORE

    with _STORE_LOCK:
        if _STORE is not None:
            return _STORE

        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        supabase_key = (
            os.environ.get("SUPABASE_SECRET_KEY", "").strip()
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        )
        if supabase_url or supabase_key:
            if not supabase_url or not supabase_key:
                raise RuntimeError("Set both SUPABASE_URL and a Supabase server key.")
            from supabase import create_client

            _STORE = SupabaseStateStore(
                create_client(supabase_url, supabase_key),
                ROOT / "mock_db.json",
            )
        elif os.environ.get("VERCEL"):
            raise RuntimeError("Configure SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.")
        else:
            _STORE = JsonStateStore(os.environ.get("MOCK_DB_PATH", ROOT / "mock_db.json"))

    return _STORE