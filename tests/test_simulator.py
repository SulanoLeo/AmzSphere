import copy
import json
import unittest
from pathlib import Path
from unittest.mock import patch

from datetime import datetime, timedelta, timezone

from simulator import MockSimulator, build_simulator, tick_is_due


ROOT = Path(__file__).resolve().parents[1]


class SimulatorTests(unittest.TestCase):
    def setUp(self):
        self.state = json.loads((ROOT / "mock_db.json").read_text(encoding="utf-8"))
        self.state["activity"] = []
        self.state["targeted_exact_keywords"] = []
        self.state["negative_keywords"] = []
        self.state["purchase_orders"] = []
        self.engine = MockSimulator()

    @patch("simulator.random.choice", return_value=-1)
    @patch("simulator.random.uniform", return_value=0.10)
    def test_reprices_below_competitor_without_crossing_floor(self, _movement, _direction):
        product = self.state["products"][0]
        product["price"] = 26.00
        product["competitor_price"] = 25.00
        product["min_floor"] = 20.00
        self.state["products"] = [product]

        self.engine._reprice(self.state)

        self.assertEqual(product["price"], 24.89)
        self.assertGreaterEqual(product["price"], product["min_floor"])
        self.assertEqual(self.state["activity"][0]["category"], "repricer")

    @patch("simulator.random.choice", return_value=-1)
    @patch("simulator.random.uniform", return_value=0.10)
    def test_does_not_match_competitor_below_floor(self, _movement, _direction):
        product = self.state["products"][0]
        product["price"] = 12.00
        product["competitor_price"] = 9.99
        product["min_floor"] = 10.00
        self.state["products"] = [product]

        self.engine._reprice(self.state)

        self.assertEqual(product["price"], 12.00)
        self.assertEqual(self.state["activity"], [])

    def test_keyword_thresholds_and_actions_are_idempotent(self):
        self.state["search_terms"] = [
            {"term": "qualified exact", "clicks": 20, "spend": 12, "conversions": 6, "acos": 24.9},
            {"term": "conversion boundary", "clicks": 20, "spend": 12, "conversions": 5, "acos": 20},
            {"term": "acos boundary", "clicks": 20, "spend": 12, "conversions": 6, "acos": 25},
            {"term": "negative term", "clicks": 16, "spend": 12, "conversions": 0, "acos": 0},
            {"term": "click boundary", "clicks": 15, "spend": 12, "conversions": 0, "acos": 0},
        ]

        self.engine._harvest_keywords(self.state)
        self.engine._harvest_keywords(self.state)

        self.assertEqual([item["term"] for item in self.state["targeted_exact_keywords"]], ["qualified exact"])
        self.assertEqual([item["term"] for item in self.state["negative_keywords"]], ["negative term"])
        self.assertEqual(len(self.state["activity"]), 2)

    def test_inventory_burn_creates_one_purchase_order(self):
        product = self.state["products"][0]
        product["stock"] = 149
        product["daily_velocity"] = 10
        product["po_draft_id"] = None

        self.engine._watch_inventory(self.state)
        self.engine._watch_inventory(self.state)

        self.assertLess(product["stock"], 149)
        self.assertIsNotNone(product["po_draft_id"])
        matching_orders = [
            order for order in self.state["purchase_orders"]
            if order["product_asin"] == product["asin"]
        ]
        self.assertEqual(len(matching_orders), 1)

    def test_live_provider_is_not_silently_mocked(self):
        self.assertIsInstance(build_simulator("mock"), MockSimulator)
        with self.assertRaisesRegex(RuntimeError, "not configured"):
            build_simulator("live")

    def test_tick_due_check_uses_ten_second_interval(self):
        now = datetime.now(timezone.utc)
        self.assertTrue(tick_is_due({}, now))
        self.assertFalse(tick_is_due({"last_updated": now.isoformat()}, now + timedelta(seconds=9)))
        self.assertTrue(tick_is_due({"last_updated": now.isoformat()}, now + timedelta(seconds=10)))


if __name__ == "__main__":
    unittest.main()