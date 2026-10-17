import json
import random
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from simulator import (
    HISTORY_DAYS, MockSimulator, build_simulator, tick_is_due, trailing_acos, utc_today,
)


ROOT = Path(__file__).resolve().parents[1]


def load_state():
    state = json.loads((ROOT / "mock_db.json").read_text(encoding="utf-8"))
    state["activity"] = []
    state["targeted_exact_keywords"] = []
    state["negative_keywords"] = []
    state["purchase_orders"] = []
    return state


class RepricerTests(unittest.TestCase):
    def setUp(self):
        self.state = load_state()
        self.engine = MockSimulator()
        self.product = self.state["products"][0]
        self.state["products"] = [self.product]

    @patch("simulator.random.choice", return_value=-1)
    @patch("simulator.random.uniform", return_value=1.0)
    def test_lowers_below_competitor_without_crossing_floor(self, _movement, _direction):
        self.product.update(price=26.00, competitor_price=25.00, market_price=25.00, min_floor=20.00)
        self.engine._reprice(self.state)
        self.assertEqual(self.product["competitor_price"], 24.75)
        self.assertEqual(self.product["price"], 24.74)
        self.assertEqual(self.state["activity"][0]["category"], "repricer")

    @patch("simulator.random.choice", return_value=-1)
    @patch("simulator.random.uniform", return_value=1.0)
    def test_holds_when_competitor_is_below_floor(self, _movement, _direction):
        self.product.update(price=12.00, competitor_price=9.99, market_price=9.99, min_floor=10.00)
        self.engine._reprice(self.state)
        self.assertEqual(self.product["price"], 12.00)
        self.assertEqual(self.state["activity"], [])

    @patch("simulator.random.choice", return_value=1)
    @patch("simulator.random.uniform", return_value=1.0)
    def test_raises_price_gradually_when_competitor_is_higher(self, _movement, _direction):
        self.product.update(price=25.00, competitor_price=30.00, market_price=30.00, min_floor=20.00, max_price=40.00)
        self.engine._reprice(self.state)
        self.assertEqual(self.product["price"], 25.75)  # 3% step, not a jump to the competitor
        self.assertEqual(self.state["activity"][0]["title"], "Price raised toward competitor")

    @patch("simulator.random.choice", return_value=1)
    @patch("simulator.random.uniform", return_value=1.0)
    def test_never_exceeds_price_ceiling(self, _movement, _direction):
        self.product.update(price=38.90, competitor_price=50.00, market_price=50.00, min_floor=20.00, max_price=40.00)
        self.engine._reprice(self.state)
        self.assertEqual(self.product["price"], 40.00)

    def test_price_and_competitor_stay_inside_their_bounds(self):
        random.seed(7)
        for product in self.state["products"]:
            product.update(price=30.0, competitor_price=product["market_price"])
        for _ in range(2000):
            self.engine._reprice(self.state)
            p = self.state["products"][0]
            self.assertGreaterEqual(p["competitor_price"], p["market_price"] * 0.8 - 0.01)
            self.assertLessEqual(p["competitor_price"], p["market_price"] * 1.2 + 0.01)
            self.assertGreaterEqual(p["price"], p["min_floor"] - 1e-9 if p["price"] != 30.0 else 0)
            self.assertLessEqual(p["price"], max(30.0, p["max_price"]) + 1e-9)

    def test_price_can_move_both_directions(self):
        random.seed(11)
        moves = []
        for _ in range(3000):
            before = self.product["price"]
            self.engine._reprice(self.state)
            if self.product["price"] != before:
                moves.append(self.product["price"] - before)
        self.assertTrue(any(m > 0 for m in moves) and any(m < 0 for m in moves))


class PpcTests(unittest.TestCase):
    def setUp(self):
        self.state = load_state()
        self.engine = MockSimulator()

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
        self.assertEqual([i["term"] for i in self.state["targeted_exact_keywords"]], ["qualified exact"])
        self.assertEqual([i["term"] for i in self.state["negative_keywords"]], ["negative term"])
        self.assertEqual(len(self.state["activity"]), 2)

    def test_guardrail_lowers_over_threshold_campaign_once_per_day(self):
        qc = next(c for c in self.state["campaigns"] if c["id"] == "CMP-QC")
        qc["last_guardrail_date"] = None
        before = qc["bid_floor"]
        self.assertGreater(trailing_acos(qc, 7), 25)
        self.engine._apply_guardrail(self.state)
        self.engine._apply_guardrail(self.state)
        self.assertEqual(qc["bid_floor"], round(before * 0.88, 2))
        self.assertEqual(len([a for a in self.state["activity"] if a["title"] == "Bid guardrail triggered"]), 1)
        self.assertEqual(qc["bid_changes"][0]["from"], before)

    def test_guardrail_leaves_healthy_campaigns_alone(self):
        af = next(c for c in self.state["campaigns"] if c["id"] == "CMP-AF")
        before = af["bid_floor"]
        self.engine._apply_guardrail(self.state)
        self.assertEqual(af["bid_floor"], before)

    def test_guardrail_respects_minimum_bid(self):
        qc = next(c for c in self.state["campaigns"] if c["id"] == "CMP-QC")
        qc["bid_floor"] = self.state["ppc_guardrail"]["min_bid"]
        self.engine._apply_guardrail(self.state)
        self.assertEqual(qc["bid_floor"], self.state["ppc_guardrail"]["min_bid"])

    def test_drift_keeps_acos_consistent_with_spend_and_sales(self):
        random.seed(3)
        for _ in range(400):
            self.engine._drift_search_terms(self.state)
        for term in self.state["search_terms"]:
            if term["sales"]:
                self.assertAlmostEqual(term["acos"], term["spend"] / term["sales"] * 100, delta=0.06)


class HistoryAndInventoryTests(unittest.TestCase):
    def setUp(self):
        self.state = load_state()
        self.engine = MockSimulator()

    def test_roll_history_appends_missing_days_and_recomputes_everything(self):
        stale = (utc_today() - timedelta(days=3)).isoformat()
        self.state["history_end"] = stale
        self.engine._roll_history(self.state)
        self.assertEqual(self.state["history_end"], utc_today().isoformat())
        for product in self.state["products"]:
            history = self.state["sales_history"][product["sku"]]
            self.assertEqual(len(history), HISTORY_DAYS)
            self.assertAlmostEqual(product["daily_velocity"], sum(history) / len(history), delta=0.06)
        for campaign in self.state["campaigns"]:
            self.assertEqual(len(campaign["ad_history"]), HISTORY_DAYS)
        self.assertEqual(len(self.state["acos_history"]), HISTORY_DAYS)

    def test_roll_history_is_a_noop_on_the_same_day(self):
        self.state["history_end"] = utc_today().isoformat()
        snapshot = json.dumps(self.state["sales_history"], sort_keys=True)
        self.engine._roll_history(self.state)
        self.assertEqual(json.dumps(self.state["sales_history"], sort_keys=True), snapshot)

    def test_inventory_burn_creates_one_purchase_order(self):
        product = self.state["products"][0]
        product.update(stock=149, daily_velocity=10, po_draft_id=None)
        self.engine._watch_inventory(self.state)
        self.engine._watch_inventory(self.state)
        self.assertLess(product["stock"], 149)
        self.assertIsNotNone(product["po_draft_id"])
        matching = [o for o in self.state["purchase_orders"] if o["product_asin"] == product["asin"]]
        self.assertEqual(len(matching), 1)

    def test_full_tick_runs_and_keeps_state_valid(self):
        random.seed(5)
        for _ in range(50):
            self.engine.tick(self.state)
        self.assertIn("last_updated", self.state)
        self.assertTrue(all(p["stock"] >= 0 for p in self.state["products"]))


class SeedDataConsistencyTests(unittest.TestCase):
    """Invariants that must hold for the committed mock_db.json, even after simulation."""

    def setUp(self):
        self.state = json.loads((ROOT / "mock_db.json").read_text(encoding="utf-8"))

    def test_velocity_matches_sales_history(self):
        for product in self.state["products"]:
            history = self.state["sales_history"][product["sku"]]
            self.assertEqual(len(history), HISTORY_DAYS)
            self.assertAlmostEqual(product["daily_velocity"], sum(history) / len(history), delta=0.06)

    def test_search_term_acos_equals_spend_over_sales(self):
        for term in self.state["search_terms"]:
            if term["sales"]:
                self.assertAlmostEqual(term["acos"], term["spend"] / term["sales"] * 100, delta=0.06)
            else:
                self.assertEqual(term["acos"], 0)

    def test_portfolio_acos_is_derived_from_campaigns(self):
        self.assertEqual(len(self.state["acos_history"]), HISTORY_DAYS)
        spend = sum(c["ad_history"][-1]["spend"] for c in self.state["campaigns"])
        sales = sum(c["ad_history"][-1]["sales"] for c in self.state["campaigns"])
        self.assertAlmostEqual(self.state["acos_history"][-1], spend / sales * 100, delta=0.06)

    def test_orders_amount_is_units_times_unit_cost_and_decided_orders_have_reviewers(self):
        costs = {p["name"]: p["unit_cost"] for p in self.state["products"]}
        for order in self.state["orders"]:
            self.assertAlmostEqual(order["amount"], order["units"] * costs[order["product_name"]], places=2)
            if order["status"] != "pending":
                self.assertTrue(order["reviewed_by"] and order["reviewed_at"])
        self.assertEqual(len({o["id"] for o in self.state["orders"]}), len(self.state["orders"]))

    def test_every_product_has_profile_floor_below_price_ceiling_and_margin(self):
        for product in self.state["products"]:
            self.assertIn(product["asin"], self.state["catalog_profiles"])
            self.assertLessEqual(product["min_floor"], product["price"])
            self.assertLessEqual(product["price"], product["max_price"])
            self.assertGreater(product["min_floor"], product["unit_cost"] * 1.3)

    def test_reviews_reference_known_products_and_themes(self):
        names = {p["name"] for p in self.state["products"]}
        for review in self.state["reviews"]:
            self.assertIn(review["product"], names)
            self.assertIn(review["theme"], self.state["review_themes"])
            self.assertIn(review["rating"], (1, 2, 3, 4, 5))

    def test_purchase_order_drafts_match_product_references(self):
        drafts = {po["id"] for po in self.state["purchase_orders"]}
        for product in self.state["products"]:
            if product.get("po_draft_id"):
                self.assertIn(product["po_draft_id"], drafts)


class SimulatorSetupTests(unittest.TestCase):
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
