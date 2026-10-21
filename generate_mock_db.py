#!/usr/bin/env python3
"""Regenerate mock_db.json with internally consistent sample data.

    python3 generate_mock_db.py            # writes ./mock_db.json (overwrites!)

Consistency rules enforced here (and checked in tests/test_simulator.py):
  * daily_velocity is the 30-day mean of sales_history
  * every search term has acos = spend / sales
  * each campaign's 30-day ad spend/sales equal the sum of its search terms
  * portfolio acos_history is derived from campaign ad history
  * order amounts are units x unit_cost; reasons are computed from the data
"""
import json
import random
import sys
import uuid
from datetime import timedelta
from pathlib import Path

from simulator import (
    HISTORY_DAYS, WEEKDAY_FACTORS, MockSimulator, recompute_acos_history,
    trailing_acos, utc_today, now_iso,
)
from scoring import compute_opt_score

SEED = 20261016
OUT = Path(__file__).resolve().parent / "mock_db.json"
rng = random.Random(SEED)
today = utc_today()
now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
MARKETPLACE_ID = "ATVPDKIKX0DER"
PLATFORMS = ("Amazon US", "Amazon UK", "Walmart")


def listing_image(sku, index):
    return f"/mock/images/{sku}/{index}.jpg"


CORE_PRODUCTS = [
    dict(asin="B0C8Q4M2K7", name="ArcFold Aluminum Laptop Stand", sku="AF-LS-02", category="Office",
         price=34.99, market_price=34.50, unit_cost=15.40, min_floor=27.50, max_price=39.99,
         stock=619, velocity=18, trend=0.0, lead_days=34, supplier="Shenzhen Northstar Manufacturing",
         campaign=dict(id="CMP-AF", name="ArcFold Stand · Exact + Phrase", bid=0.55, cpc=0.48, ramp=(1.10, 0.90)),
         title="ArcFold Aluminum Laptop Stand for Desk, Adjustable Portable Computer Riser for Home Office",
         bullets=[
             "Raise your screen to a comfortable viewing height with a sturdy adjustable laptop riser.",
             "Fold-flat aluminum frame stores easily and travels between home, office, and classroom.",
             "Non-slip contact points keep laptops stable on desks and shared work surfaces.",
             "Adjustable height settings support sitting and standing desk setups.",
             "Cable management cutout keeps cords tidy behind the stand.",
         ],
         description="A sturdy adjustable aluminum laptop stand that folds flat for storage and travel, sized for home office desks.",
         backend_keywords=["laptop stand", "adjustable", "riser", "foldable laptop riser"],
         images=[listing_image("AF-LS-02", i) for i in range(1, 9)], suppressed=False),
    dict(asin="B0B7P9R3W1", name="QuietClick Wireless Mouse", sku="QC-M-11", category="Electronics",
         price=22.49, market_price=22.99, unit_cost=11.50, min_floor=17.25, max_price=26.99,
         stock=378, velocity=14, trend=0.5, lead_days=28, supplier="Ningbo Kestrel Electronics",
         campaign=dict(id="CMP-QC", name="QuietClick Mouse · Auto", bid=0.50, cpc=0.52, ramp=(0.80, 1.25)),
         title="QuietClick Wireless Mouse for Laptop and Desktop with Quiet Click Buttons",
         bullets=[
             "Quiet-click buttons support focused work in shared offices and study spaces.",
             "Ergonomic contour provides a comfortable everyday grip for laptop and desktop use.",
             "Wireless optical tracking connects to compatible computers for dependable navigation.",
             "Compact travel size with a USB receiver stored inside the mouse.",
         ],
         description="A quiet wireless optical mouse with an ergonomic shape for all-day laptop and desktop use.",
         backend_keywords=["wireless mouse", "quiet click", "ergonomic mouse", "silent wireless mouse"],
         images=[listing_image("QC-M-11", i) for i in range(1, 8)], suppressed=False),
    dict(asin="B0D2L6T8N4", name="TerraGrip Silicone Bottle Sleeve", sku="TG-BS-04", category="Home & Kitchen",
         price=13.99, market_price=13.49, unit_cost=4.75, min_floor=9.25, max_price=16.99,
         stock=141, velocity=12, trend=0.15, lead_days=21, supplier="Evergreen Household Goods",
         campaign=dict(id="CMP-TG", name="TerraGrip Sleeve · Broad", bid=0.32, cpc=0.30, ramp=(1.0, 1.0)),
         title="Reusable Silicone Water Bottle Sleeve, Protective Non-Slip Cover with Easy-Clean Grip",
         bullets=[
             "Flexible silicone helps protect compatible bottles from everyday scuffs.",
             "Textured non-slip grip makes bottles easier to hold during commutes and workouts.",
             "Rinse-clean reusable cover slips on and off for straightforward care.",
             "Fits most standard 24 oz to 40 oz water bottles and tumblers.",
         ],
         description="A protective silicone bottle sleeve with a non-slip grip, easy to slip on and wash between uses.",
         backend_keywords=["silicone bottle sleeve", "water bottle cover", "bottle protective sleeve"],
         images=[listing_image("TG-BS-04", i) for i in range(1, 7)], suppressed=True),
    dict(asin="B0A9H5X3J6", name="Luma USB-C Desk Light", sku="LM-DL-08", category="Lighting",
         price=24.99, market_price=24.49, unit_cost=12.80, min_floor=21.00, max_price=29.99,
         stock=768, velocity=22, trend=-0.10, lead_days=41, supplier="Shenzhen Northstar Manufacturing",
         campaign=dict(id="CMP-LM", name="Luma Desk Light · Exact", bid=0.48, cpc=0.47, ramp=(1.05, 0.95)),
         title="USB-C LED Desk Lamp for Home Office, Adjustable Compact Task Light for Work and Study",
         bullets=[
             "Direct task lighting toward your work surface with an adjustable desk lamp.",
             "Compact footprint fits home-office desks, bedside tables, and study spaces.",
             "USB-C powered design works with a compatible power source.",
             "Touch dimmer with three brightness levels for any task.",
         ],
         description="A compact USB-C powered LED desk lamp with adjustable positioning and dimmable brightness for workspaces.",
         backend_keywords=["usb c desk lamp", "desk light", "led desk lamp", "dimmable reading light"],
         images=[listing_image("LM-DL-08", i) for i in range(1, 8)], suppressed=False),
    dict(asin="B0C3F7Y1V9", name="SnapDock Cable Organizer Set", sku="SD-CO-06", category="Office",
         price=9.99, market_price=9.79, unit_cost=3.85, min_floor=8.50, max_price=11.99,
         stock=243, velocity=20, trend=0.0, lead_days=19, supplier="Evergreen Household Goods",
         campaign=dict(id="CMP-SD", name="SnapDock Organizer · Auto", bid=0.22, cpc=0.17, ramp=(1.0, 1.0)),
         title="Desk Cable Organizer Set, Cord Management Clips for Home Office Charging and Computer Cables",
         bullets=[
             "Keep frequently used charging and computer cords organized along a desk edge.",
             "Compact cable clips help reduce loose cords across home-office work surfaces.",
             "A multi-piece organizer set supports flexible placement around desks and workstations.",
             "Adhesive and screw mounting options for different desk surfaces.",
         ],
         description="A reusable desk cable organizer set with cord management clips for home office charging cables and computer cords.",
         backend_keywords=["desk cable organizer", "cord management clips", "cable ties", "wire management box"],
         images=[listing_image("SD-CO-06", i) for i in range(1, 6)], suppressed=False),
]

ADJECTIVES = ("Ultra", "Smart", "Prime", "Swift", "Bold", "Clear", "Soft", "Tough", "Mini", "Pro")
NOUNS = ("Desk", "Home", "Office", "Travel", "Daily", "Essential", "Flex", "Grip", "Lite", "Max")
TYPES = ("Stand", "Mouse", "Sleeve", "Lamp", "Organizer", "Mount", "Tray", "Holder", "Dock", "Case")

GENERATED_CATEGORIES = ("Office", "Electronics", "Home & Kitchen", "Lighting", "Tools", "Sports")


def generated_asin(index):
    return f"B0GEN{index:02d}X"


def generated_content(index, asin, sku, name):
    """Vary listing quality so seeded scores span needs_optimization to optimized."""
    tier = index % 4
    keyword = name.split()[-1].casefold()
    if tier == 0:  # rich, well-optimized listings
        title = f"{name}, Premium {ADJECTIVES[index % len(ADJECTIVES)]} {TYPES[index % len(TYPES)]} with {NOUNS[(index + 2) % len(NOUNS)]} Features"
        bullets = [
            f"Premium {name} built for everyday {NOUNS[index % len(NOUNS)].lower()} use with quality materials.",
            f"Easy to carry and store, designed for {ADJECTIVES[(index + 1) % len(ADJECTIVES)].lower()} lifestyles.",
            f"Trusted finish and simple care keep this {name.lower()} looking new.",
            f"Includes everything needed to start using the {name.lower()} right away.",
            f"Backed by responsive support and a straightforward warranty.",
            f"Designed to pair with popular {TYPES[(index + 3) % len(TYPES)].lower()} setups.",
        ]
        description = f"A well-made {name.lower()} for {NOUNS[index % len(NOUNS)].lower()} setups. Premium materials, simple care, and thoughtful details make it a reliable everyday choice."
        keywords = [keyword, name.casefold(), f"{ADJECTIVES[index % len(ADJECTIVES)].lower()} {TYPES[index % len(TYPES)].lower()}", "premium", "home office"]
        images = [listing_image(sku, i) for i in range(1, 10)]
        suppressed = False
    elif tier == 1:  # medium: decent copy, missing images/keywords
        title = f"{name} · {ADJECTIVES[index % len(ADJECTIVES)]} {TYPES[index % len(TYPES)]}"
        bullets = [
            f"A {name.lower()} for daily use.",
            f"Simple design with {NOUNS[index % len(NOUNS)].lower()} in mind.",
        ]
        description = f"A {name.lower()} for everyday tasks."
        keywords = [keyword]
        images = [listing_image(sku, i) for i in range(1, 4)]
        suppressed = False
    elif tier == 2:  # poor: short title, thin copy
        title = f"{ADJECTIVES[index % len(ADJECTIVES)]} {name}"
        bullets = [f"{name} for sale."]
        description = ""
        keywords = []
        images = []
        suppressed = False
    else:  # suppressed listing with otherwise decent copy
        title = f"{name} — {ADJECTIVES[index % len(ADJECTIVES)]} {TYPES[index % len(TYPES)]} for {NOUNS[index % len(NOUNS)]}"
        bullets = [
            f"A practical {name.lower()} for everyday use around the home or office.",
            f"Simple to set up and keep clean with regular care.",
        ]
        description = f"A practical {name.lower()} with simple controls and easy maintenance."
        keywords = [keyword, "home office", "everyday"]
        images = [listing_image(sku, i) for i in range(1, 6)]
        suppressed = True
    return dict(title=title, bullets=bullets, description=description,
                backend_keywords=keywords, images=images, suppressed=suppressed)


def generated_products():
    products = []
    for index in range(5, 30):
        category = GENERATED_CATEGORIES[index % len(GENERATED_CATEGORIES)]
        asin = generated_asin(index)
        sku = f"GEN-{category.split(' ')[0].upper()}-{index:02d}"
        name = f"{ADJECTIVES[index % len(ADJECTIVES)]} {NOUNS[index % len(NOUNS)]} {TYPES[index % len(TYPES)]}"
        base_price = round(rng.uniform(8.0, 55.0), 2)
        price = round(base_price, 2)
        market_price = round(price * rng.uniform(0.92, 1.08), 2)
        unit_cost = round(price * rng.uniform(0.35, 0.6), 2)
        min_floor = round(max(unit_cost * 1.4, price * 0.75), 2)
        max_price = round(price * 1.3, 2)
        velocity = round(rng.uniform(2.0, 40.0), 1)
        stock = round(rng.uniform(12.0, 900.0), 1)
        trend = round(rng.uniform(-0.25, 0.35), 2)
        lead_days = int(rng.choice([14, 18, 21, 25, 28, 34, 41, 52]))
        supplier = rng.choice([
            "Shenzhen Northstar Manufacturing", "Ningbo Kestrel Electronics",
            "Evergreen Household Goods", "Pacific Coast Brands", "Blue Ridge Supply Co.",
        ])
        content = generated_content(index, asin, sku, name)
        products.append(dict(
            asin=asin, name=name, sku=sku, category=category,
            price=price, market_price=market_price, unit_cost=unit_cost,
            min_floor=min_floor, max_price=max_price,
            stock=stock, daily_velocity=velocity, trend=trend,
            lead_days=lead_days, supplier=supplier,
            title=content["title"], bullets=content["bullets"],
            description=content["description"],
            backend_keywords=content["backend_keywords"],
            images=content["images"], suppressed=content["suppressed"],
        ))
    return products


PRODUCTS = CORE_PRODUCTS + generated_products()


def gauss_units(velocity, trend, day_index, day):
    ramp = 1 + trend * (day_index / (HISTORY_DAYS - 1) - 0.5)
    noise = max(0.5, rng.gauss(1, 0.10))
    return max(0, round(velocity * WEEKDAY_FACTORS[day.weekday()] * ramp * noise))


def build():
    days = [today - timedelta(days=HISTORY_DAYS - 1 - i) for i in range(HISTORY_DAYS)]
    sales_history = {p["sku"]: [gauss_units(p.get("daily_velocity", p.get("velocity", 10)), p.get("trend", 0.0), i, d) for i, d in enumerate(days)] for p in PRODUCTS}

    products = []
    for p in PRODUCTS:
        hist = sales_history[p["sku"]]
        product = {
            "id": str(uuid.uuid4()),
            "asin": p["asin"], "sku": p["sku"], "marketplace_id": MARKETPLACE_ID, "source": "amazon_sync",
            "name": p["name"], "title": p.get("title") or p["name"],
            "category": p["category"], "price": p["price"],
            "bullets": p.get("bullets") or [],
            "description": p.get("description") or "",
            "backend_keywords": p.get("backend_keywords") or [],
            "images": p.get("images") or [],
            "sellable_units": float(p["stock"]), "stock": float(p["stock"]),
            "days_of_supply": round(float(p["stock"]) / max(p.get("daily_velocity", p.get("velocity", 10)), 0.1), 1),
            "daily_velocity": round(sum(hist) / len(hist), 1),
            "competitor_price": p["market_price"], "market_price": p["market_price"],
            "min_floor": p["min_floor"], "max_price": p["max_price"],
            "unit_cost": p["unit_cost"],
            "lead_time_days": p["lead_days"], "supplier": p["supplier"], "po_draft_id": None,
            "suppressed": bool(p.get("suppressed")),
            "last_synced_at": now_iso(), "sync_status": "synced",
            "last_optimized_at": None,
        }
        score, issues, status = compute_opt_score(product)
        product.update(opt_score=score, opt_issues=issues, opt_status=status)
        products.append(product)

    search_terms = []
    for idx, term, clicks, cpc, conversions in TERMS:
        p = PRODUCTS[idx]
        spend = round(clicks * cpc, 2)
        sales = round(conversions * p["price"], 2)
        search_terms.append({
            "term": term, "asin": p["asin"], "campaign_id": p["campaign"]["id"],
            "impressions": clicks * rng.randint(25, 45), "clicks": clicks, "spend": spend,
            "conversions": conversions, "sales": sales, "order_value": p["price"],
            "acos": round(spend / sales * 100, 1) if sales else 0.0,
        })

    campaigns = []
    for p in PRODUCTS:
        campaign_spec = p.get("campaign")
        if campaign_spec is None:
            continue
        c = campaign_spec
        mine = [t for t in search_terms if t["campaign_id"] == c["id"]]
        total_spend, total_sales = sum(t["spend"] for t in mine), sum(t["sales"] for t in mine)
        hist = sales_history[p["sku"]]
        revenue = [u * p["price"] for u in hist]
        sales_d = [total_sales * r / sum(revenue) for r in revenue] if revenue else []
        raw = [s * (c["ramp"][0] + (c["ramp"][1] - c["ramp"][0]) * i / (HISTORY_DAYS - 1)) * max(0.6, rng.gauss(1, 0.06))
               for i, s in enumerate(sales_d)]
        scale = total_spend / sum(raw) if raw else 0.0
        ad_history = []
        for s, r in zip(sales_d, raw):
            spend = round(r * scale, 2)
            ad_history.append({"spend": spend, "sales": round(s, 2),
                               "clicks": round(spend / c["cpc"]), "orders": round(s / p["price"])})
        week_spend = sum(d["spend"] for d in ad_history[-7:])
        week_sales = sum(d["sales"] for d in ad_history[-7:])
        campaign = {
            "id": c["id"], "name": c["name"], "asin": p["asin"], "sku": p["sku"],
            "bid_floor": c["bid"], "avg_cpc": c["cpc"],
            "base_acos": round(week_spend / week_sales * 100, 2) if week_sales else 0.0,
            "ad_share": round(total_sales / sum(revenue), 4) if revenue else 0.0,
            "acos_modifier": 1.0,
            "ad_history": ad_history,
        }
        assert abs(sum(d["spend"] for d in ad_history) - total_spend) < 0.5, c["id"]
        assert abs(sum(d["sales"] for d in ad_history) - total_sales) < 0.5, c["id"]
        campaigns.append(campaign)

    iso = lambda days_ago, hours=0: (now - timedelta(days=days_ago, hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    by_idx = lambda i: products[i]
    orders = []
    for n, (idx, units, ago, status, kind, note) in enumerate(ORDERS):
        prod, spec = by_idx(idx), PRODUCTS[idx]
        cover = prod["stock"] / prod["daily_velocity"]
        hist = sales_history[prod["sku"]]
        wow = (sum(hist[-7:]) / max(1, sum(hist[-14:-7])) - 1) * 100
        if kind.startswith("custom:"):
            reason = kind[7:]
        elif kind == "velocity" and wow > 0:
            reason = f"Velocity increase · {wow:.0f}% week over week"
        elif kind == "lead":
            reason = f"Supplier lead time · {spec['lead_days']} days"
        elif kind == "q4":
            reason = f"Q4 replenishment · {cover:.0f} days of cover"
        elif kind == "reorder":
            reason = "Reorder point reached"
        else:
            reason = f"Low stock · {cover:.0f} days of cover"
        order = {
            "id": f"WF-{2060 - n}", "product_name": prod["name"], "category": prod["category"],
            "supplier": prod["supplier"], "units": units, "amount": round(units * prod["unit_cost"], 2),
            "submitted_by": STAFF[n % len(STAFF)], "submitted_at": iso(ago, n % 5), "status": status, "reason": reason,
        }
        if status != "pending":
            order.update(reviewed_by="User", reviewed_at=iso(ago - 1 if ago > 1 else 0), review_note=note)
        orders.append(order)

    state = {
        "last_updated": now_iso(),
        "history_end": today.isoformat(),
        "manager": {"name": "User", "role": "Procurement manager", "initials": "U"},
        "products": products,
        "global_products": [dict(p) for p in products],
        "marketplace_listings": [],
        "order_shipments": [],
        "sales_history": sales_history,
        "campaigns": campaigns,
        "ppc_guardrail": {"acos_threshold": 25.0, "window_days": 7, "bid_reduction_pct": 12, "min_bid": 0.20},
        "search_terms": search_terms,
        "targeted_exact_keywords": [], "negative_keywords": [],
        "orders": orders, "purchase_orders": [],
        "reviews": [{"rating": r, "product": PRODUCTS[i]["name"], "date": (today - timedelta(days=ago)).isoformat(),
                     "theme": theme, "text": text} for ago, i, r, theme, text in sorted(REVIEWS)],
        "review_themes": THEMES,
        "catalog_profiles": CATALOG_PROFILES | {p["asin"]: dict(rank=None, gaps=[], currentTitle=p["name"], currentBullets=[], optimizedTitle=p["name"], optimizedBullets=[]) for p in PRODUCTS[5:]},
        "acos_history": [], "activity": [], "execution_queue": [],
        "seller_store": [],
        "product_revisions": [],
        "amazon_catalog": [],
        "sync_state": {"status": "not_synced"},
    }

    for p in products:
        for platform in PLATFORMS:
            status = "Suppressed" if p.get("suppressed") else "Live & In Sync"
            state["marketplace_listings"].append({
                "id": str(uuid.uuid4()),
                "global_product_id": p["asin"],
                "sku": p["sku"],
                "platform": platform,
                "status": status,
                "title": p.get("title") or p["name"],
                "description": p.get("description") or f"{p['name']} premium listing",
            })
        # Mock Amazon catalog: the source of truth the mock sync upserts from.
        state["amazon_catalog"].append({
            "asin": p["asin"], "sku": p["sku"], "marketplace_id": MARKETPLACE_ID,
            "title": p.get("title") or p["name"], "bullets": p.get("bullets") or [],
            "description": p.get("description") or "",
            "backend_keywords": p.get("backend_keywords") or [],
            "images": p.get("images") or [],
            "price": p["price"], "stock": float(p["stock"]),
        })

    state["order_shipments"] = [
        {"tracking_number": "1Z999AA10123456784", "carrier": "UPS", "status": "In Transit", "order_id": "ORD-001"},
        {"tracking_number": "7894561230", "carrier": "FedEx", "status": "Label Created", "order_id": "ORD-002"},
        {"tracking_number": "1234567890", "carrier": "DHL", "status": "Out for Delivery", "order_id": "ORD-003"},
        {"tracking_number": "TBA123456789000", "carrier": "Amazon Logistics", "status": "Delivered", "order_id": "ORD-004"},
        {"tracking_number": "1Z999AA10987654321", "carrier": "UPS", "status": "In Transit", "order_id": "ORD-005"},
    ]

    for p in products:
        state["seller_store"].append({
            "id": str(uuid.uuid4()),
            "asin": p["asin"],
            "name": p["name"],
            "sku": p["sku"],
            "category": p["category"],
            "price": p["price"],
            "stock": p["stock"],
            "visible": True,
            "added_at": now_iso(),
        })
    recompute_acos_history(state)
    sim = MockSimulator()
    sim._harvest_keywords(state)
    sim._draft_purchase_orders(state)
    return state


TERMS = [
    (0, "foldable laptop riser", 246, 0.48, 21), (0, "portable computer stand aluminum", 137, 0.50, 9),
    (0, "ergonomic laptop holder for desk", 82, 0.80, 6), (0, "cheap plastic laptop stand", 38, 0.65, 0),
    (0, "laptop stand with cooling fan", 17, 1.14, 0), (0, "adjustable laptop stand for travel", 104, 0.49, 8),
    (0, "wooden monitor shelf", 11, 0.75, 1),
    (1, "silent wireless mouse", 190, 0.50, 18), (1, "ergonomic mouse for laptop", 96, 0.55, 8),
    (1, "gaming mouse rgb", 20, 0.50, 0), (1, "wireless mouse bluetooth", 12, 0.50, 1),
    (2, "silicone water bottle sleeve", 160, 0.26, 18), (2, "bottle protective cover", 74, 0.30, 9),
    (2, "stanley cup boot", 20, 0.30, 0), (2, "insulated bottle sleeve 40oz", 91, 0.33, 10),
    (3, "usb c desk lamp", 210, 0.45, 22), (3, "led desk lamp for office", 120, 0.52, 11),
    (3, "dimmable reading light", 18, 0.50, 0), (3, "clip on desk light", 14, 0.50, 0),
    (4, "desk cable organizer", 150, 0.16, 12), (4, "cord clips adhesive", 88, 0.19, 7),
    (4, "wire management box", 42, 0.15, 0), (4, "cable ties reusable", 17, 0.18, 2),
]

THEMES = {
    "hinge_defect": ("cracked or broken hinge hardware", "The recurring complaint points to a weak plastic hinge assembly.", "Replace the hinge connector with reinforced hardware and add a torque warning to the insert."),
    "arrives_damaged": ("items arriving damaged", "Units reach customers with damage despite an intact outer carton.", "Add a molded protective insert and test the pack-out with a drop test."),
    "scroll_wheel": ("scroll wheel failures", "The scroll wheel stops responding after weeks of normal use.", "Ask the supplier for a defect analysis on the encoder and tighten incoming QC."),
    "connectivity": ("Bluetooth dropouts", "The mouse disconnects and needs to be re-paired.", "Review the Bluetooth firmware and mention the USB receiver as the stable option."),
    "fit_too_tight": ("a sleeve that is too tight for the bottle", "The listing implies a looser fit than customers experience.", "State the supported bottle diameters in the title and bullets, or add a larger size."),
    "brightness": ("a light that is too dim for work", "Customers expected more output for desk work.", "State lumen output clearly and offer a higher-output variant."),
    "adhesive_weak": ("adhesive that does not hold", "Clips detach within days on painted or textured surfaces.", "Switch to a stronger adhesive and note which surfaces it supports."),
    "great_value": ("good value for the price", "", ""), "quiet_clicks": ("quiet clicks", "", ""),
    "usb_power": ("simple USB-C power", "", ""), "portability": ("portability", "", ""),
    "comfort": ("comfort", "", ""), "grip": ("a grippy texture", "", ""),
}
THEMES = {k: dict(label=v[0], summary=v[1], fix=v[2]) for k, v in THEMES.items()}

REVIEWS = [
    (2, 0, 1, "hinge_defect", "The hinge snapped the second week. I only adjusted it a few times and now it will not hold my laptop up."),
    (3, 0, 1, "arrives_damaged", "Arrived with the hinge cracked. The box looked fine outside, but the stand was loose in the package."),
    (4, 0, 1, "hinge_defect", "Plastic connector broke while I was tightening the stand. The instructions say not to overtighten but it barely felt snug."),
    (9, 0, 2, "hinge_defect", "Works fine flat but the angle adjustment keeps slipping and the hinge feels flimsy."),
    (6, 0, 5, "great_value", "Sturdy for the price and it folds flat into my bag. Raised my screen to eye level right away."),
    (12, 0, 4, "portability", "Light and packs small. Wish the rubber pads were a bit grippier."),
    (15, 0, 5, "great_value", "Best desk upgrade I made this year. No wobble when typing."),
    (5, 1, 1, "scroll_wheel", "The scroll wheel stopped working after a month. It still clicks, but the wheel no longer moves the page."),
    (8, 1, 2, "connectivity", "Drops its Bluetooth connection every hour or so and needs to be re-paired."),
    (3, 1, 5, "quiet_clicks", "Finally a quiet mouse. My coworkers have stopped asking what that clicking is."),
    (10, 1, 4, "quiet_clicks", "Clicks are nearly silent and the battery is lasting well. Scroll wheel feels a bit loose though."),
    (18, 1, 5, "great_value", "Great mouse for the money. Setup took ten seconds with the USB receiver."),
    (20, 1, 3, "comfort", "Fine for small hands but a bit narrow for me. Gets uncomfortable after a long day."),
    (7, 2, 1, "fit_too_tight", "Much tighter than the listing implied. I cannot get the sleeve over my bottle without stretching it hard."),
    (11, 2, 2, "fit_too_tight", "Does not fit my 40 oz bottle even though the listing says it fits most. Had to return it."),
    (4, 2, 4, "grip", "Nice grippy texture and no more scratches on my bottle. Runs a little snug."),
    (14, 2, 5, "great_value", "Keeps my bottle from sliding around the cup holder and washes easily."),
    (22, 2, 5, "great_value", "Bought three for the family. Colors are exactly as shown."),
    (6, 3, 2, "brightness", "Too dim for real work. Fine as a bedside light but not for a desk."),
    (2, 3, 5, "usb_power", "Love that it runs off my laptop's USB-C port. Clean and compact."),
    (13, 3, 4, "usb_power", "Neck holds position well. Light is a bit cool-white for my taste."),
    (17, 3, 3, "brightness", "Okay light but the touch dimmer is finicky."),
    (25, 3, 5, "great_value", "Perfect for my small desk and the brightness range is plenty."),
    (3, 4, 1, "adhesive_weak", "The adhesive let go within a week and the clips ended up on the floor."),
    (9, 4, 2, "adhesive_weak", "Stuck fine on my wood desk but would not hold on the painted side panel."),
    (5, 4, 5, "great_value", "Cheap and does exactly what it says. My desk finally looks tidy."),
    (16, 4, 4, "great_value", "Good variety of sizes in the set. A couple of clips are a bit loose."),
    (21, 4, 5, "great_value", "Held up after two months on a standing desk with no peeling."),
]

CATALOG_PROFILES = {
    "B0C8Q4M2K7": dict(rank=18, gaps=["foldable laptop riser", "portable computer stand aluminum", "adjustable laptop stand for travel"],
        currentTitle="ArcFold Aluminum Laptop Stand for Desk", currentBullets=["Aluminum support for laptops", "Adjustable stand for desk use", "Foldable design for storage"],
        optimizedTitle="Foldable Aluminum Laptop Stand for Desk, Adjustable Portable Computer Riser for Home Office and Travel",
        optimizedBullets=["Raise your screen to a comfortable viewing height with a sturdy adjustable laptop riser.", "Fold-flat aluminum frame stores easily and travels between home, office, and classroom.", "Non-slip contact points help keep laptops stable on desks and shared work surfaces."]),
    "B0B7P9R3W1": dict(rank=42, gaps=["silent wireless mouse", "ergonomic mouse for laptop"],
        currentTitle="QuietClick Wireless Mouse", currentBullets=["Wireless optical mouse", "Comfortable shape", "Works with most computers"],
        optimizedTitle="QuietClick Wireless Mouse for Laptop and Desktop, Ergonomic Optical Mouse with Quiet Buttons",
        optimizedBullets=["Quiet-click buttons support focused work in shared offices and study spaces.", "Ergonomic contour provides a comfortable everyday grip for laptop and desktop use.", "Wireless optical tracking connects to compatible computers for dependable navigation."]),
    "B0D2L6T8N4": dict(rank=31, gaps=["reusable silicone bottle sleeve", "water bottle protective cover"],
        currentTitle="TerraGrip Silicone Bottle Sleeve", currentBullets=["Soft silicone bottle cover", "Protective grip", "Easy to clean"],
        optimizedTitle="Reusable Silicone Water Bottle Sleeve, Protective Non-Slip Cover with Flexible Easy-Clean Grip",
        optimizedBullets=["Flexible silicone helps protect compatible bottles from everyday scuffs.", "Textured non-slip grip makes bottles easier to hold during commutes and workouts.", "Rinse-clean reusable cover slips on and off for straightforward care."]),
    "B0A9H5X3J6": dict(rank=56, gaps=["adjustable usb c desk lamp", "dimmable home office light"],
        currentTitle="Luma USB-C Desk Light", currentBullets=["USB-C desk lamp", "Compact lighting", "For workspaces"],
        optimizedTitle="USB-C LED Desk Lamp for Home Office, Adjustable Compact Task Light for Work and Study",
        optimizedBullets=["Direct task lighting toward your work surface with an adjustable desk lamp.", "Compact footprint fits home-office desks, bedside tables, and study spaces.", "USB-C powered design works with a compatible power source."]),
    "B0C3F7Y1V9": dict(rank=27, gaps=["under desk cable organizer", "cord management clips for desk"],
        currentTitle="SnapDock Cable Organizer Set", currentBullets=["Cable clips for desks", "Organize charging cords", "Reusable set"],
        optimizedTitle="Desk Cable Organizer Set, Cord Management Clips for Home Office Charging and Computer Cables",
        optimizedBullets=["Keep frequently used charging and computer cords organized along a desk edge.", "Compact cable clips help reduce loose cords across home-office work surfaces.", "A multi-piece organizer set supports flexible placement around desks and workstations."]),
}

STAFF = ["Jordan Lee", "Avery Patel", "Morgan Diaz"]
ORDERS = [
    (0, 600, 1, "pending", "q4", None), (1, 400, 1, "pending", "velocity", None),
    (3, 320, 1, "pending", "lead", None), (2, 500, 2, "pending", "cover", None),
    (4, 800, 2, "pending", "cover", None),
    (4, 700, 3, "approved", "reorder", "Within cover budget"),
    (3, 600, 5, "denied", "custom:Exceeds 60-day cover budget", "Resubmit at 320 units"),
    (1, 300, 9, "approved", "velocity", "Approved at requested quantity"),
    (0, 1200, 11, "denied", "custom:Quantity above $20k budget cap", "Split across two POs"),
    (0, 500, 12, "approved", "q4", "Approved"),
    (2, 400, 16, "approved", "cover", "Approved"),
    (4, 2000, 20, "denied", "custom:Quantity above supplier MOQ ceiling", "Reduce to one pallet"),
]


if __name__ == "__main__":
    state = build()
    OUT.write_text(json.dumps(state, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    for p in state["products"]:
        print(f"  {p['sku']:11} {p['opt_status']:20} score {p['opt_score']:>3} stock {p['stock']:>6.0f} vel {p['daily_velocity']:>5} cover {p['days_of_supply']:>5.1f}d  ${p['price']}")
    suppressed = [p for p in state["products"] if p.get("suppressed")]
    print("  products:", len(state["products"]), "| suppressed:", len(suppressed),
          "| needs_optimization:", sum(p["opt_status"] == "needs_optimization" for p in state["products"]),
          "| optimized:", sum(p["opt_status"] == "optimized" for p in state["products"]))
