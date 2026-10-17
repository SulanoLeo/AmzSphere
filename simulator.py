import random
import uuid
from datetime import date, datetime, timedelta, timezone


TICK_SECONDS = 10
ACTIVITY_LIMIT = 120
HISTORY_DAYS = 30
WEEKDAY_FACTORS = (1.00, 1.00, 0.97, 1.00, 1.05, 1.12, 0.86)  # Mon..Sun
COMPETITOR_REVERSION = 0.08      # pull toward the market price per tick
COMPETITOR_BAND = 0.20           # competitor stays within +/-20% of market
MIN_PRICE_CHANGE = 0.03          # absolute floor for a repricing move
MIN_PRICE_CHANGE_PCT = 0.025     # ...and at least 2.5% of price, to avoid log chatter
REPRICE_EVERY_TICKS = 6          # repricer runs about once a minute


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


def utc_today():
    return datetime.now(timezone.utc).date()


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


def recompute_acos_history(state):
    """Portfolio ACoS per day = total ad spend / total ad sales across campaigns."""
    campaigns = state.get("campaigns") or []
    if not campaigns:
        return
    days = min(len(campaign["ad_history"]) for campaign in campaigns)
    history = []
    for offset in range(days, 0, -1):
        spend = sum(campaign["ad_history"][-offset]["spend"] for campaign in campaigns)
        sales = sum(campaign["ad_history"][-offset]["sales"] for campaign in campaigns)
        history.append(round(spend / sales * 100, 1) if sales else 0.0)
    state["acos_history"] = history


def trailing_acos(campaign, window_days):
    window = campaign["ad_history"][-window_days:]
    spend = sum(day["spend"] for day in window)
    sales = sum(day["sales"] for day in window)
    return spend / sales * 100 if sales else None


class MockSimulator:
    def tick(self, state):
        state["tick_count"] = state.get("tick_count", 0) + 1
        self._roll_history(state)
        if state["tick_count"] % REPRICE_EVERY_TICKS == 0:
            self._reprice(state)
        self._drift_search_terms(state)
        self._harvest_keywords(state)
        self._apply_guardrail(state)
        self._watch_inventory(state)
        state["last_updated"] = now_iso()

    # ------------------------------------------------------------------ pricing
    def _reprice(self, state):
        for product in state["products"]:
            market = product.get("market_price", product["competitor_price"])
            step_pct = random.uniform(0.10, 1.50) * random.choice((-1, 1))
            drift = market * step_pct / 100
            pull = COMPETITOR_REVERSION * (market - product["competitor_price"])
            low, high = market * (1 - COMPETITOR_BAND), market * (1 + COMPETITOR_BAND)
            competitor = max(0.50, min(high, max(low, product["competitor_price"] + drift + pull)))
            competitor = round(competitor, 2)
            product["competitor_price"] = competitor

            price = product["price"]
            floor = product["min_floor"]
            ceiling = product.get("max_price", float("inf"))
            if competitor < floor:
                continue  # never chase a competitor below our floor
            if competitor < price:
                new_price = round(max(floor, competitor - 0.01), 2)
                if price - new_price >= max(MIN_PRICE_CHANGE, price * MIN_PRICE_CHANGE_PCT):
                    product["price"] = new_price
                    detail = f"{product['asin']} moved from ${price:.2f} to ${new_price:.2f}, "
                    detail += (f"held at its ${floor:.2f} floor." if new_price == floor
                               else "one cent below its competitor.")
                    record_activity(state, "repricer", "Buy Box price matched", detail)
            elif competitor - 0.01 > price:
                step = round(max(0.05, price * 0.03), 2)
                new_price = round(min(ceiling, competitor - 0.01, price + step), 2)
                if new_price - price >= max(MIN_PRICE_CHANGE, price * MIN_PRICE_CHANGE_PCT):
                    product["price"] = new_price
                    detail = f"{product['asin']} moved from ${price:.2f} to ${new_price:.2f} as its competitor rose to ${competitor:.2f}"
                    detail += " (capped at its price ceiling)." if new_price == ceiling else "."
                    record_activity(state, "repricer", "Price raised toward competitor", detail)

    # ---------------------------------------------------------------------- PPC
    def _drift_search_terms(self, state):
        for term in state["search_terms"]:
            if random.random() > 0.04:
                continue
            cpc = term["spend"] / term["clicks"] if term["clicks"] else 0.40
            added = random.randint(1, 4)
            term["clicks"] += added
            term["spend"] = round(term["spend"] + added * cpc, 2)
            term["impressions"] = term.get("impressions", 0) + added * random.randint(18, 30)
            rate = term["conversions"] / term["clicks"]
            if term.get("order_value") and random.random() < max(rate, 0.05):
                term["conversions"] += 1
                term["sales"] = round(term.get("sales", 0) + term["order_value"], 2)
            if "sales" in term:
                term["acos"] = round(term["spend"] / term["sales"] * 100, 1) if term["sales"] else 0.0

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

    def _apply_guardrail(self, state):
        """Trailing-window ACoS above threshold lowers that campaign's bid, once per UTC day."""
        config = state.get("ppc_guardrail")
        if not config:
            return
        today = utc_today().isoformat()
        for campaign in state.get("campaigns", []):
            acos = trailing_acos(campaign, config["window_days"])
            campaign["trailing_acos"] = round(acos, 1) if acos is not None else None
            if acos is None or acos <= config["acos_threshold"]:
                continue
            if campaign.get("last_guardrail_date") == today:
                continue
            old_bid = campaign["bid_floor"]
            new_bid = max(config["min_bid"], round(old_bid * (1 - config["bid_reduction_pct"] / 100), 2))
            if new_bid >= old_bid:
                continue
            campaign["bid_floor"] = new_bid
            campaign["last_guardrail_date"] = today
            campaign["acos_modifier"] = max(0.6, campaign.get("acos_modifier", 1.0) * 0.94)
            campaign.setdefault("bid_changes", []).insert(0, {
                "date": today, "from": old_bid, "to": new_bid, "trailing_acos": round(acos, 1),
            })
            del campaign["bid_changes"][10:]
            record_activity(
                state,
                "ppc",
                "Bid guardrail triggered",
                f"{campaign['name']} trailing {config['window_days']}-day ACoS was {acos:.1f}% "
                f"(limit {config['acos_threshold']:.0f}%). Bid lowered from ${old_bid:.2f} to ${new_bid:.2f}.",
            )

    # ------------------------------------------------------------ sales history
    def _roll_history(self, state):
        """Append one realistic day of units and ad results per UTC day elapsed."""
        end_raw = state.get("history_end")
        if not end_raw or "sales_history" not in state:
            return
        today = utc_today()
        steps = min((today - date.fromisoformat(end_raw)).days, HISTORY_DAYS)
        if steps <= 0:
            return
        for offset in range(steps - 1, -1, -1):
            self._append_day(state, today - timedelta(days=offset))
        state["history_end"] = today.isoformat()
        recompute_acos_history(state)

    def _append_day(self, state, day):
        latest_units = {}
        for product in state["products"]:
            history = state["sales_history"].get(product["sku"])
            if history is None:
                continue
            recent = history[-14:]
            base = sum(recent) / len(recent) if recent else product["daily_velocity"]
            units = max(0, round(base * WEEKDAY_FACTORS[day.weekday()] * random.gauss(1, 0.10)))
            history.append(units)
            del history[:-HISTORY_DAYS]
            latest_units[product["sku"]] = units
            product["daily_velocity"] = round(sum(history) / len(history), 1)
        prices = {product["sku"]: product["price"] for product in state["products"]}
        for campaign in state.get("campaigns", []):
            units = latest_units.get(campaign["sku"])
            if units is None:
                continue
            sales = round(units * prices[campaign["sku"]] * campaign["ad_share"], 2)
            acos = campaign["base_acos"] * campaign.get("acos_modifier", 1.0) * max(0.5, random.gauss(1, 0.08))
            spend = round(sales * acos / 100, 2)
            campaign["ad_history"].append({
                "spend": spend,
                "sales": sales,
                "clicks": round(spend / campaign["avg_cpc"]),
                "orders": round(sales / prices[campaign["sku"]]),
            })
            del campaign["ad_history"][:-HISTORY_DAYS]

    # ---------------------------------------------------------------- inventory
    def _watch_inventory(self, state):
        self._burn_stock(state)
        self._draft_purchase_orders(state)

    def _burn_stock(self, state):
        for product in state["products"]:
            sold_since_last_tick = product["daily_velocity"] * TICK_SECONDS / 86_400
            product["stock"] = round(max(0, product["stock"] - sold_since_last_tick), 3)
        # Keep global_products synchronized with products
        for p, gp in zip(state.get("products", []), state.get("global_products", [])):
            gp["stock"] = p["stock"]

    def _draft_purchase_orders(self, state):
        for product in state["products"]:
            if product["daily_velocity"] <= 0:
                continue
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
