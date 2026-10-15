import random
import uuid
from datetime import datetime, timedelta, timezone


TICK_SECONDS = 10
ACTIVITY_LIMIT = 120


def build_simulator(mode):
    if mode == "mock":
        return MockSimulator()
    if mode == "live":
        raise RuntimeError(
            "The live SP-API adapter is not configured in this MVP. Set AMZ_DATA_MODE=mock."
        )
    raise ValueError("AMZ_DATA_MODE must be either 'mock' or 'live'.")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def tick_is_due(state, now=None):
    last_updated = state.get("last_updated")
    if not last_updated:
        return True
    try:
        last_tick = datetime.fromisoformat(last_updated.replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError):
        return True
    current_time = now or datetime.now(timezone.utc)
    return current_time - last_tick >= timedelta(seconds=TICK_SECONDS)


def record_activity(state, category, title, detail):
    state.setdefault("activity", []).insert(
        0,
        {
            "id": str(uuid.uuid4()),
            "timestamp": now_iso(),
            "category": category,
            "title": title,
            "detail": detail,
        },
    )
    del state["activity"][ACTIVITY_LIMIT:]


class MockSimulator:
    def tick(self, state):
        self._reprice(state)
        self._harvest_keywords(state)
        self._watch_inventory(state)
        state["last_updated"] = now_iso()

    def _reprice(self, state):
        for product in state["products"]:
            movement = random.uniform(0.10, 1.50) * random.choice((-1, 1))
            competitor_price = max(0.50, product["competitor_price"] + movement)
            product["competitor_price"] = round(competitor_price, 2)

            if competitor_price < product["price"] and competitor_price > product["min_floor"]:
                new_price = round(max(product["min_floor"], competitor_price - 0.01), 2)
                if new_price < product["price"]:
                    old_price = product["price"]
                    product["price"] = new_price
                    record_activity(
                        state,
                        "repricer",
                        "Buy Box price matched",
                        f"{product['asin']} moved from ${old_price:.2f} to ${new_price:.2f}, one cent below its competitor.",
                    )

    def _harvest_keywords(self, state):
        exact_terms = {item["term"].casefold() for item in state["targeted_exact_keywords"]}
        negative_terms = {item["term"].casefold() for item in state["negative_keywords"]}

        for term in state["search_terms"]:
            key = term["term"].casefold()
            if term["conversions"] > 5 and term["acos"] < 25 and key not in exact_terms:
                state["targeted_exact_keywords"].append(
                    {"term": term["term"], "added_at": now_iso(), "source": "Auto harvest"}
                )
                exact_terms.add(key)
                record_activity(
                    state,
                    "ppc",
                    "Exact keyword harvested",
                    f"{term['term']} qualified with {term['conversions']} conversions at {term['acos']:.1f}% ACoS.",
                )
            elif term["clicks"] > 15 and term["conversions"] == 0 and key not in negative_terms:
                state["negative_keywords"].append(
                    {"term": term["term"], "added_at": now_iso(), "source": "Zero-conversion guard"}
                )
                negative_terms.add(key)
                record_activity(
                    state,
                    "ppc",
                    "Negative keyword added",
                    f"{term['term']} reached {term['clicks']} clicks without a conversion.",
                )

    def _watch_inventory(self, state):
        for product in state["products"]:
            sold_since_last_tick = product["daily_velocity"] * TICK_SECONDS / 86_400
            product["stock"] = round(max(0, product["stock"] - sold_since_last_tick), 3)
            days_of_supply = product["stock"] / product["daily_velocity"]

            if days_of_supply < 15 and not product.get("po_draft_id"):
                po_id = f"PO-{uuid.uuid4().hex[:6].upper()}"
                product["po_draft_id"] = po_id
                purchase_order = {
                    "id": po_id,
                    "product_asin": product["asin"],
                    "product_name": product["name"],
                    "supplier": product["supplier"],
                    "units": max(100, round(product["daily_velocity"] * 30)),
                    "status": "draft",
                    "created_at": now_iso(),
                }
                state.setdefault("purchase_orders", []).insert(0, purchase_order)
                record_activity(
                    state,
                    "inventory",
                    "Critical stock alert · PO drafted",
                    f"{product['name']} has {days_of_supply:.1f} days of supply. Draft {po_id} created for {purchase_order['units']} units.",
                )