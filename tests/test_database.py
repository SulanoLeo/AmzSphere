import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import database
from database import ConcurrentStateUpdate, JsonStateStore, SupabaseStateStore


class FakeQuery:
    def __init__(self, table):
        self.table = table
        self.operation = "select"
        self.filters = {}
        self.payload = None

    def select(self, _columns):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def maybe_single(self):
        return self

    def upsert(self, payload, **_options):
        self.operation = "upsert"
        self.payload = payload
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def execute(self):
        if self.operation == "upsert":
            self.table.row = self.table.row or self.payload
            return SimpleNamespace(data=None)
        if self.operation == "update":
            if self.table.row["version"] != self.filters.get("version"):
                return SimpleNamespace(data=[])
            self.table.row.update(self.payload)
            return SimpleNamespace(data=[{"version": self.table.row["version"]}])
        row = self.table.row
        if row is None:
            return SimpleNamespace(data=None)
        if row["id"] != self.filters.get("id"):
            return SimpleNamespace(data=None)
        return SimpleNamespace(data={"state": row["state"], "version": row["version"]})


class FakeClient:
    def __init__(self):
        self.state_table = SimpleNamespace(row=None)

    def table(self, _name):
        return FakeQuery(self.state_table)


class DatabaseStoreTests(unittest.TestCase):
    def test_json_store_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            path.write_text('{"count": 1}', encoding="utf-8")
            store = JsonStateStore(path)

            state, version = store.read()
            state["count"] += 1
            store.write(state, version)

            self.assertEqual(store.read(), ({"count": 2}, None))

    def test_supabase_store_seeds_once_and_checks_revision(self):
        with tempfile.TemporaryDirectory() as directory:
            seed_path = Path(directory) / "seed.json"
            seed_path.write_text('{"count": 1}', encoding="utf-8")
            client = FakeClient()
            store = SupabaseStateStore(client, seed_path)

            state, version = store.read()
            self.assertEqual((state, version), ({"count": 1}, 0))
            state["count"] = 2
            store.write(state, version)
            self.assertEqual(store.read(), ({"count": 2}, 1))
            with self.assertRaises(ConcurrentStateUpdate):
                store.write({"count": 3}, 0)

    def test_vercel_falls_back_to_json_store_without_supabase(self):
        original_store = database._STORE
        try:
            database._STORE = None
            with patch.dict(os.environ, {"VERCEL": "1"}, clear=True):
                store = database.get_state_store()
            self.assertIsInstance(store, database.JsonStateStore)
        finally:
            database._STORE = original_store


if __name__ == "__main__":
    unittest.main()