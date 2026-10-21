import copy
import json
import os
import signal
import subprocess
import tempfile
import time
import unittest
from urllib.parse import urlencode
from pathlib import Path

import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

BASE_URL = "http://127.0.0.1:18971"


def request(method, path, body=None, params=None):
    query = f"?{urlencode(params)}" if params else ""
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{BASE_URL}{path}{query}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


class MockServerProcess:
    def __enter__(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self.tmpdir.name) / "mock_db.json"
        db_path.write_bytes((ROOT / "mock_db.json").read_bytes())
        env = copy.copy(os.environ)
        env["MOCK_DB_PATH"] = str(db_path)
        env["PORT"] = "18971"
        env["HOST"] = "127.0.0.1"
        self.proc = subprocess.Popen(
            ["python3", str(ROOT / "local_server.py")], env=env, cwd=str(ROOT),
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for _ in range(50):
            try:
                request("GET", "/api/health")
                break
            except Exception:
                time.sleep(0.2)
        else:
            self.proc.kill()
            raise AssertionError("mock server did not start")
        return self

    def __exit__(self, exc_type, exc, tb):
        self.proc.terminate()
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self.tmpdir.cleanup()


class ProductsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = MockServerProcess().__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.server.__exit__(None, None, None)

    def test_sync_is_runnable_and_idempotent(self):
        status, payload = request("POST", "/api/sync")
        self.assertEqual(status, 202)
        self.assertEqual(payload["status"], "completed")
        self.assertEqual(payload["products_synced"], 30)

        status, state = request("GET", "/api/state")
        self.assertEqual(status, 200)
        before_count = len(state["products"])
        catalog_asins = {entry["asin"] for entry in state.get("amazon_catalog", [])}
        self.assertEqual(len(catalog_asins), 30)

        status, payload = request("POST", "/api/sync")
        self.assertEqual(status, 202)
        self.assertEqual(payload["products_synced"], 30)

        status, state = request("GET", "/api/state")
        self.assertEqual(status, 200)
        # Idempotent upsert: no duplicate products are created
        self.assertEqual(len(state["products"]), before_count)
        product_asins = {product["asin"] for product in state["products"]}
        self.assertTrue(catalog_asins.issubset(product_asins))
        for product in state["products"]:
            if product["asin"] in catalog_asins:
                self.assertEqual(product["sync_status"], "synced")
                self.assertIsNotNone(product["last_synced_at"])

        status, summary = request("GET", "/api/overview/summary")
        self.assertEqual(status, 200)
        self.assertEqual(summary["catalog_items"], before_count)
        self.assertIn("needs_optimization", summary)
        self.assertIn("reorder_flags", summary)
        self.assertIn("pending_approvals", summary)
        self.assertEqual(len(summary["top_10"]), 10)
        impacts = [item["impact"] for item in summary["top_10"]]
        self.assertEqual(impacts, sorted(impacts, reverse=True))

    def _needs_optimization_product(self):
        status, payload = request("GET", "/api/products?opt_status=needs_optimization&page_size=200")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(payload["products"]), 1)
        return payload["products"][0]

    def test_optimize_then_approve_publishes_and_recomputes(self):
        before = self._needs_optimization_product()
        product_id = before["id"]
        asin = before["asin"]

        suggested = {
            "title": "E2E Approved Title · Premium Everyday Essential",
            "bullets": ["Bullet one", "Bullet two", "Bullet three", "Bullet four", "Bullet five"],
            "backend_keywords": ["e2e", "approved"],
            "description": "E2E approved description.",
        }
        status, result = request("POST", f"/api/products/{product_id}/optimize", {"suggested": suggested})
        self.assertEqual(status, 200)
        self.assertEqual(result["revision"]["status"], "pending_approval")
        self.assertEqual(result["product"]["opt_status"], "draft_ready")
        revision_id = result["revision"]["id"]

        # The draft is visible in the approvals list
        status, state = request("GET", "/api/state")
        revisions = [r for r in state["product_revisions"] if r["id"] == revision_id]
        self.assertEqual(len(revisions), 1)
        self.assertEqual(revisions[0]["status"], "pending_approval")

        status, result = request("POST", f"/api/approvals/{revision_id}/approve", {})
        self.assertEqual(status, 200)
        self.assertEqual(result["revision"]["status"], "approved")
        self.assertEqual(result["product"]["opt_status"], "published")

        status, product = request("GET", f"/api/products/{product_id}")
        self.assertEqual(status, 200)
        product = product["product"]
        self.assertEqual(product["opt_status"], "published")
        self.assertEqual(product["title"], suggested["title"])
        self.assertEqual(product["bullets"], suggested["bullets"])
        self.assertEqual(product["backend_keywords"], suggested["backend_keywords"])
        self.assertEqual(product["description"], suggested["description"])
        self.assertIsNotNone(product["last_optimized_at"])

        # Mock Amazon accepted the change: marketplace listing updated
        status, state = request("GET", "/api/state")
        listing = next((l for l in state["marketplace_listings"] if l["global_product_id"] == asin and l["platform"] == "Amazon US"), None)
        self.assertIsNotNone(listing)
        self.assertEqual(listing["title"], suggested["title"])
        self.assertEqual(listing["status"], "Live & In Sync")

        # Activity log records the approval
        activity_titles = [event["title"] for event in state["activity"]]
        self.assertTrue(any("approved" in title for title in activity_titles))

    def test_optimize_then_reject(self):
        product = self._needs_optimization_product()
        status, result = request("POST", f"/api/products/{product['id']}/optimize", {
            "suggested": {"title": "Rejected draft title", "bullets": ["b1"], "backend_keywords": [], "description": "d"},
        })
        self.assertEqual(status, 200)
        revision_id = result["revision"]["id"]

        status, result = request("POST", f"/api/approvals/{revision_id}/reject", {})
        self.assertEqual(status, 200)
        self.assertEqual(result["revision"]["status"], "rejected")
        self.assertEqual(result["product"]["opt_status"], "needs_optimization")

    def test_manual_add_patch_and_filters(self):
        status, product = request("POST", "/api/products", {
            "name": "E2E Manual Lamp",
            "sku": "E2E-LAMP-02",
            "asin": "B0E2ELAMP2",
            "title": "E2E Manual Lamp for Testing",
            "category": "Lighting",
            "price": 24.99,
            "stock": 300,
            "daily_velocity": 10,
        })
        self.assertEqual(status, 200)
        self.assertEqual(product["product"]["source"], "manual")
        product_id = product["product"]["id"]

        status, patched = request("PATCH", f"/api/products/{product_id}", {"price": 29.99, "stock": 350})
        self.assertEqual(status, 200)
        self.assertEqual(patched["product"]["price"], 29.99)
        self.assertEqual(patched["product"]["stock"], 350)
        self.assertEqual(patched["product"]["sellable_units"], 350)

        status, payload = request("GET", "/api/products", params={"search": "E2E Manual Lamp", "page_size": 200})
        self.assertEqual(status, 200)
        self.assertTrue(any(p["sku"] == "E2E-LAMP-02" for p in payload["products"]))

        status, payload = request("GET", "/api/products?low_stock=true&page_size=200")
        self.assertEqual(status, 200)
        for p in payload["products"]:
            self.assertLess(p["days_of_supply"], 15)

    def test_unknown_api_route_returns_json_not_html(self):
        status, payload = request("GET", "/api/products/does-not-exist")
        self.assertEqual(status, 404)
        self.assertIn("detail", payload)

    def test_approve_already_reviewed_revision_conflicts(self):
        product = self._needs_optimization_product()
        status, result = request("POST", f"/api/products/{product['id']}/optimize", {
            "suggested": {"title": "x", "bullets": [], "backend_keywords": [], "description": ""},
        })
        revision_id = result["revision"]["id"]
        request("POST", f"/api/approvals/{revision_id}/approve", {})
        status, _ = request("POST", f"/api/approvals/{revision_id}/approve", {})
        self.assertEqual(status, 409)


if __name__ == "__main__":
    unittest.main()
