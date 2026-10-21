import json
import mimetypes
import os
import re
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

from simulator import MockSimulator, now_iso, record_activity, tick_is_due
from scoring import compute_opt_score, impact_rank


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DATABASE_PATH = Path(os.environ.get("MOCK_DB_PATH", ROOT / "mock_db.json"))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
TICK_SECONDS = 10
STATE_LOCK = threading.RLock()
SIMULATOR = MockSimulator()
US_MARKETPLACE_ID = "ATVPDKIKX0DER"
PAGE_SIZE_DEFAULT = 50
OPT_FIELDS = ("title", "bullets", "description", "backend_keywords", "images")


def product_defaults(product):
    product.setdefault("id", uuid.uuid4().hex)
    product.setdefault("marketplace_id", US_MARKETPLACE_ID)
    product.setdefault("source", "amazon_sync")
    product.setdefault("title", product.get("name") or "")
    product.setdefault("bullets", [])
    product.setdefault("description", "")
    product.setdefault("backend_keywords", [])
    product.setdefault("images", [])
    product.setdefault("sellable_units", product.get("stock", 0))
    product.setdefault("days_of_supply", 0)
    product.setdefault("opt_score", 0)
    product.setdefault("opt_issues", [])
    product.setdefault("opt_status", "needs_optimization")
    product.setdefault("last_optimized_at", None)
    product.setdefault("last_synced_at", None)
    product.setdefault("sync_status", "synced")
    return product


def normalize_state(state):
    for product in state.setdefault("products", []):
        product_defaults(product)
    state.setdefault("global_products", [])
    if len(state["global_products"]) != len(state["products"]):
        state["global_products"] = [dict(p) for p in state["products"]]
    state.setdefault("product_revisions", [])
    state.setdefault("amazon_catalog", [])
    state.setdefault("sync_state", {"status": "not_synced"})
    return state


def find_product(state, ref):
    return next((p for p in state.get("products", []) if p.get("id") == ref or p.get("asin") == ref), None)


def revision_for(state, revision_id):
    return next((r for r in state.get("product_revisions", []) if r.get("id") == revision_id), None)


def suppressed_for(state, product):
    if product.get("suppressed"):
        return True
    return any(
        listing.get("global_product_id") == product.get("asin")
        and str(listing.get("status", "")).casefold() == "suppressed"
        for listing in state.get("marketplace_listings", [])
    )


def ensure_listings(state, product):
    asin = product.get("asin")
    existing = [l for l in state.get("marketplace_listings", []) if l.get("global_product_id") == asin]
    if existing:
        return existing
    listings = []
    for platform in ("Amazon US", "Amazon UK", "Walmart"):
        listings.append({
            "id": uuid.uuid4().hex,
            "global_product_id": asin,
            "sku": product.get("sku"),
            "platform": platform,
            "status": "Suppressed" if product.get("suppressed") else "Live & In Sync",
            "title": product.get("title") or product.get("name"),
            "description": product.get("description") or f"{product.get('name')} premium listing",
        })
    state.setdefault("marketplace_listings", []).extend(listings)
    return listings


def recompute_product(state, product):
    score, issues, status = compute_opt_score(product)
    product["opt_score"] = score
    product["opt_issues"] = issues
    if product.get("opt_status") in ("needs_optimization", "optimized", None):
        product["opt_status"] = status
    return product


def build_suggested_copy(state, product):
    name = product.get("name") or product.get("title") or ""
    category = product.get("category") or "General"
    keywords = list(product.get("backend_keywords") or [])
    if not keywords:
        keywords = [name.casefold(), category.casefold()]
    return {
        "title": f"{name} — Premium {category} Essential for Everyday Use",
        "bullets": [
            f"Premium {name} built for everyday use around the home and office.",
            "Simple to set up, easy to clean, and made to last.",
            f"A practical choice for {category.lower()} shoppers looking for reliable quality.",
            "Designed for everyday routines with thoughtful, convenient details.",
            "Backed by straightforward support and a simple warranty.",
        ],
        "description": f"A reliable {name.lower()} for everyday {category.lower()} use. Simple, practical, and built to fit daily routines.",
        "backend_keywords": keywords[:8],
    }


def read_json_body(handler):
    try:
        length = int(handler.headers.get("Content-Length", "0"))
        if not length:
            return {}
        return json.loads(handler.rfile.read(length))
    except (ValueError, json.JSONDecodeError):
        return None


def read_database():
    with DATABASE_PATH.open(encoding="utf-8") as database_file:
        return json.load(database_file)


def write_database(state):
    temporary_path = DATABASE_PATH.with_suffix(".json.tmp")
    temporary_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
    temporary_path.replace(DATABASE_PATH)


def simulator_loop():
    while True:
        try:
            with STATE_LOCK:
                state = read_database()
                SIMULATOR.tick(state)
                write_database(state)
        except Exception as error:
            print(f"Simulator tick failed: {error}", flush=True)
        time.sleep(TICK_SECONDS)


class DashboardHandler(BaseHTTPRequestHandler):
    def send_body(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_body(status, body, "application/json; charset=utf-8")

    def send_api_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def api_not_found(self):
        self.send_api_json(404, {"detail": "Not found"})

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == "/api/health":
            self.send_json(200, {"ok": True, "mode": "mock"})
            return
        if path == "/api/state":
            with STATE_LOCK:
                state = read_database()
            state["generated_at"] = now_iso()
            self.send_json(200, state)
            return
        if path == "/api/seller-store":
            with STATE_LOCK:
                state = read_database()
            self.send_json(200, {"products": state.get("seller_store", [])})
            return

        if path == "/api/products":
            with STATE_LOCK:
                state = normalize_state(read_database())
                query = parse_qs(urlparse(self.path).query)
                products = list(state.get("products", []))

                opt_status = query.get("opt_status", [None])[0]
                if opt_status:
                    products = [p for p in products if p.get("opt_status") == opt_status]

                if query.get("low_stock"):
                    products = [p for p in products if p.get("days_of_supply", 0) < 15]

                if query.get("suppressed"):
                    products = [p for p in products if suppressed_for(state, p)]

                search = (query.get("search", [None])[0] or "").casefold()
                if search:
                    products = [
                        p for p in products
                        if search in f"{p.get('name','')} {p.get('title','')} {p.get('asin','')} {p.get('sku','')} {p.get('category','')}".casefold()
                    ]

                sort = (query.get("sort", [None])[0] or "").strip()
                if sort:
                    reverse = sort.startswith("-")
                    key = sort.lstrip("-")

                    def sort_key(product):
                        value = product.get(key)
                        return (value is None, value if isinstance(value, (int, float)) else str(value or "").casefold())

                    products.sort(key=sort_key, reverse=reverse)

                page = max(1, int(query.get("page", ["1"])[0] or 1))
                page_size = max(1, min(100, int(query.get("page_size", [str(PAGE_SIZE_DEFAULT)])[0] or PAGE_SIZE_DEFAULT)))
                total = len(products)
                total_pages = max(1, -(-total // page_size))
                start = (page - 1) * page_size
                page_products = products[start:start + page_size]
                payload = {
                    "products": page_products,
                    "total": total,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": total_pages,
                }
            self.send_api_json(200, payload)
            return

        match = re.fullmatch(r"/api/products/([^/]+)", path)
        if match:
            with STATE_LOCK:
                state = normalize_state(read_database())
                product = find_product(state, unquote(match.group(1)))
            if product is None:
                self.send_api_json(404, {"detail": "Product not found"})
                return
            self.send_api_json(200, {"product": product})
            return

        if path == "/api/sync/status":
            with STATE_LOCK:
                state = read_database()
            self.send_api_json(200, state.get("sync_state", {"status": "not_synced"}))
            return

        if path == "/api/overview/summary":
            with STATE_LOCK:
                state = normalize_state(read_database())
                products = state.get("products", [])
                sellable_units = sum(p.get("sellable_units", p.get("stock", 0)) for p in products)
                reorder_flags = [p for p in products if p.get("days_of_supply", 0) < 15]
                pending_approvals = [r for r in state.get("product_revisions", []) if r.get("status") == "pending_approval"]
                needs_optimization = [p for p in products if p.get("opt_status") == "needs_optimization"]
                ranked = sorted(products, key=impact_rank, reverse=True)[:10]
                top_10 = [
                    {
                        "id": p.get("id"), "asin": p.get("asin"), "sku": p.get("sku"),
                        "name": p.get("name") or p.get("title"),
                        "opt_score": p.get("opt_score"), "opt_status": p.get("opt_status"),
                        "impact": round(impact_rank(p), 2),
                        "days_of_supply": p.get("days_of_supply"),
                        "sellable_units": p.get("sellable_units", p.get("stock")),
                        "opt_issues": p.get("opt_issues", []),
                    }
                    for p in ranked
                ]
            self.send_api_json(200, {
                "catalog_items": len(products),
                "sellable_units": round(sellable_units, 1),
                "reorder_flags": len(reorder_flags),
                "pending_approvals": len(pending_approvals),
                "needs_optimization": len(needs_optimization),
                "top_10": top_10,
                "sync": state.get("sync_state", {"status": "not_synced"}),
            })
            return

        if path.startswith("/api/"):
            self.api_not_found()
            return

        if path.startswith("/static/"):
            relative_path = path.removeprefix("/static/")
        else:
            relative_path = "index.html"
        file_path = (STATIC_DIR / relative_path).resolve()
        if STATIC_DIR not in file_path.parents or not file_path.is_file():
            self.send_error(404)
            return
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        self.send_body(200, file_path.read_bytes(), f"{content_type}; charset=utf-8")

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/simulator/tick":
            with STATE_LOCK:
                state = read_database()
                if tick_is_due(state):
                    SIMULATOR.tick(state)
                    write_database(state)
                state["generated_at"] = now_iso()
            self.send_json(200, state)
            return

        if path == "/api/agent-actions":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                request = json.loads(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"detail": "Invalid JSON request"})
                return
            if not isinstance(request, dict):
                self.send_json(422, {"detail": "Request body must be an object"})
                return
            action = request.get("action")
            if action not in ("catalog_push", "procurement_po"):
                self.send_json(422, {"detail": "Action must be catalog_push or procurement_po"})
                return

            with STATE_LOCK:
                state = read_database()
                jobs = []
                if action == "catalog_push":
                    asin = request.get("asin")
                    product = next((item for item in state["products"] if item["asin"] == asin), None)
                    if product is None:
                        self.send_json(404, {"detail": "Catalog item not found"})
                        return
                    jobs.append({"type": "catalog_push", "asin": product["asin"], "sku": product["sku"]})
                else:
                    items = request.get("items")
                    products_by_sku = {item["sku"]: item for item in state["products"]}
                    if not isinstance(items, list) or not items or len(items) > 50:
                        self.send_json(422, {"detail": "Provide 1 to 50 procurement items"})
                        return
                    if any(not isinstance(item, dict) for item in items):
                        self.send_json(422, {"detail": "Each procurement item must be an object"})
                        return
                    skus = [item.get("sku") for item in items]
                    if any(not isinstance(sku, str) or not sku or len(sku) > 80 for sku in skus) or len(set(skus)) != len(skus):
                        self.send_json(422, {"detail": "Procurement SKUs must be unique"})
                        return
                    for item in items:
                        units = item.get("units")
                        if item["sku"] not in products_by_sku:
                            self.send_json(404, {"detail": f"SKU {item['sku']} not found"})
                            return
                        if isinstance(units, bool) or not isinstance(units, int) or not 0 < units <= 100000:
                            self.send_json(422, {"detail": "Units must be an integer from 1 to 100000"})
                            return
                        jobs.append({"type": "procurement_po", "sku": item["sku"], "units": units})

                staged = state.setdefault("execution_queue", [])
                created = []
                for job in jobs:
                    entry = {
                        "id": uuid.uuid4().hex,
                        **job,
                        "status": "staged",
                        "mode": "mock",
                        "worker_status": "not_configured",
                        "created_at": now_iso(),
                    }
                    staged.append(entry)
                    created.append(entry)
                del staged[:-100]
                record_activity(
                    state,
                    "procurement" if action == "procurement_po" else "catalog",
                    "Procurement action staged" if action == "procurement_po" else "Catalog update staged",
                    f"{len(created)} action(s) staged in the sandbox; no Amazon or supplier calls were made.",
                )
                write_database(state)
            self.send_json(202, {
                "jobs": created,
                "message": "Sandbox only: no Amazon or supplier calls were made.",
            })
            return

        match = re.fullmatch(r"/api/orders/([^/]+)/decision", path)
        if match:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                decision = json.loads(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"detail": "Invalid JSON request"})
                return
            action = decision.get("action")
            if action not in ("approve", "deny"):
                self.send_json(422, {"detail": "Action must be approve or deny"})
                return

            order_id = unquote(match.group(1))
            with STATE_LOCK:
                state = read_database()
                order = next((item for item in state["orders"] if item["id"] == order_id), None)
                if order is None:
                    self.send_json(404, {"detail": "Order not found"})
                    return
                if order["status"] != "pending":
                    self.send_json(409, {"detail": "This workflow has already been reviewed"})
                    return
                order["status"] = "approved" if action == "approve" else "denied"
                order["reviewed_by"] = state["manager"]["name"]
                order["reviewed_at"] = now_iso()
                record_activity(
                    state,
                    "procurement",
                    f"Purchase workflow {order['status']}",
                    f"{order['id']} for {order['product_name']} was {order['status']} by {order['reviewed_by']}.",
                )
                write_database(state)
                payload = {"order": order, "activity": state["activity"][0]}
            self.send_json(200, payload)
            return

        match = re.fullmatch(r"/api/seller-store/([^/]+)/(toggle-visibility)", path)
        if match:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                request = json.loads(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"detail": "Invalid JSON request"})
                return
            product_id = unquote(match.group(1))
            with STATE_LOCK:
                state = read_database()
                product = next((item for item in state.get("seller_store", []) if item["id"] == product_id), None)
                if product is None:
                    self.send_json(404, {"detail": "Product not found in seller store"})
                    return
                product["visible"] = not product.get("visible", True)
                record_activity(
                    state,
                    "seller-store",
                    "Product visibility updated",
                    f"{product['name']} visibility set to {'visible' if product['visible'] else 'hidden'} in seller store.",
                )
                write_database(state)
            self.send_json(200, {"product": product, "message": "Visibility updated"})
            return

        match = re.fullmatch(r"/api/seller-store/add", path)
        if match:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                request = json.loads(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"detail": "Invalid JSON request"})
                return
            asin = request.get("asin")
            if not asin:
                self.send_json(422, {"detail": "asin is required"})
                return
            with STATE_LOCK:
                state = read_database()
                catalog_product = next((item for item in state["products"] if item["asin"] == asin), None)
                if catalog_product is None:
                    self.send_json(404, {"detail": "Catalog item not found"})
                    return
                if any(item["asin"] == asin for item in state.get("seller_store", [])):
                    self.send_json(409, {"detail": "Product already in seller store"})
                    return
                new_product = {
                    "id": uuid.uuid4().hex,
                    "asin": catalog_product["asin"],
                    "name": catalog_product["name"],
                    "sku": catalog_product["sku"],
                    "category": catalog_product["category"],
                    "price": catalog_product["price"],
                    "stock": catalog_product["stock"],
                    "visible": True,
                    "added_at": now_iso(),
                }
                state.setdefault("seller_store", []).append(new_product)
                record_activity(
                    state,
                    "seller-store",
                    "Product added to seller store",
                    f"{catalog_product['name']} added to seller store.",
                )
                write_database(state)
            self.send_json(200, {"product": new_product, "message": "Product added to seller store"})
            return

        match = re.fullmatch(r"/api/catalog-products", path)
        if match:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                request = json.loads(self.rfile.read(length))
            except (ValueError, json.JSONDecodeError):
                self.send_json(400, {"detail": "Invalid JSON request"})
                return
            name = request.get("name")
            sku = request.get("sku")
            asin = request.get("asin")
            category = request.get("category")
            price = request.get("price")
            stock = request.get("stock")
            daily_velocity = request.get("daily_velocity")
            unit_cost = request.get("unit_cost")
            min_floor = request.get("min_floor")
            max_price = request.get("max_price")
            supplier = request.get("supplier")
            lead_time_days = request.get("lead_time_days")
            if not all([name, sku, asin, category, price is not None, stock is not None]):
                self.send_json(422, {"detail": "name, sku, asin, category, price, and stock are required"})
                return
            with STATE_LOCK:
                state = read_database()
                if any(item["asin"] == asin for item in state["products"]):
                    self.send_json(409, {"detail": "Product with this ASIN already exists"})
                    return
                if any(item["sku"] == sku for item in state["products"]):
                    self.send_json(409, {"detail": "Product with this SKU already exists"})
                    return
                new_product = {
                    "asin": asin,
                    "name": name,
                    "sku": sku,
                    "category": category,
                    "price": float(price),
                    "competitor_price": float(price),
                    "market_price": float(price),
                    "min_floor": float(min_floor) if min_floor is not None else float(price) * 0.8,
                    "max_price": float(max_price) if max_price is not None else float(price) * 1.2,
                    "unit_cost": float(unit_cost) if unit_cost is not None else float(price) * 0.5,
                    "stock": float(stock),
                    "daily_velocity": float(daily_velocity) if daily_velocity is not None else 10.0,
                    "lead_time_days": int(lead_time_days) if lead_time_days is not None else 21,
                    "supplier": supplier or "Unknown Supplier",
                    "po_draft_id": None,
                }
                state["products"].append(new_product)
                state.setdefault("global_products", []).append(dict(new_product))
                state.setdefault("sales_history", {})[sku] = [int(new_product["daily_velocity"])] * 30
                record_activity(
                    state,
                    "catalog",
                    "Product added to catalog",
                    f"{name} ({sku}) added to catalog with {stock} units.",
                )
                write_database(state)
            self.send_json(200, {"product": new_product, "message": "Product added to catalog"})
            return

        if path == "/api/products":
            body = read_json_body(self)
            if body is None:
                self.send_api_json(400, {"detail": "Invalid JSON request"})
                return
            name = body.get("name")
            sku = body.get("sku")
            asin = body.get("asin")
            if not name or not sku or not asin:
                self.send_api_json(422, {"detail": "name, sku, and asin are required"})
                return
            try:
                price = float(body.get("price", 0) or 0)
                stock = float(body.get("stock", 0) or 0)
                velocity = float(body.get("daily_velocity", 10) or 10)
            except (TypeError, ValueError):
                self.send_api_json(422, {"detail": "price, stock, and daily_velocity must be numbers"})
                return
            with STATE_LOCK:
                state = normalize_state(read_database())
                if any(p.get("asin") == asin for p in state.get("products", [])):
                    self.send_api_json(409, {"detail": "Product with this ASIN already exists"})
                    return
                if any(p.get("sku") == sku for p in state.get("products", [])):
                    self.send_api_json(409, {"detail": "Product with this SKU already exists"})
                    return
                product = {
                    "id": uuid.uuid4().hex,
                    "asin": asin,
                    "sku": sku,
                    "marketplace_id": body.get("marketplace_id", US_MARKETPLACE_ID),
                    "source": "manual",
                    "name": name,
                    "title": body.get("title") or name,
                    "category": body.get("category") or "General",
                    "price": price,
                    "bullets": body.get("bullets") or [],
                    "description": body.get("description") or "",
                    "backend_keywords": body.get("backend_keywords") or [],
                    "images": body.get("images") or [],
                    "sellable_units": stock,
                    "stock": stock,
                    "days_of_supply": round(stock / max(velocity, 0.1), 1),
                    "daily_velocity": velocity,
                    "competitor_price": price,
                    "market_price": price,
                    "min_floor": float(body.get("min_floor", round(price * 0.8, 2))),
                    "max_price": float(body.get("max_price", round(price * 1.2, 2))),
                    "unit_cost": float(body.get("unit_cost", round(price * 0.5, 2))),
                    "lead_time_days": int(body.get("lead_time_days", 21)),
                    "supplier": body.get("supplier") or "Unknown Supplier",
                    "po_draft_id": None,
                    "suppressed": bool(body.get("suppressed")),
                    "last_synced_at": None,
                    "sync_status": "not_synced",
                    "last_optimized_at": None,
                }
                recompute_product(state, product)
                state.get("products", []).append(product)
                state.setdefault("global_products", []).append(dict(product))
                state.setdefault("sales_history", {})[sku] = [int(velocity)] * 30
                ensure_listings(state, product)
                record_activity(
                    state,
                    "catalog",
                    "Product added to catalog",
                    f"{name} ({sku}) added to catalog with {stock} units.",
                )
                write_database(state)
            self.send_api_json(200, {"product": product, "message": "Product added to catalog"})
            return

        if path == "/api/products/import":
            body = read_json_body(self)
            if body is None:
                self.send_api_json(400, {"detail": "Invalid JSON request"})
                return
            ref = body.get("asin") or body.get("sku")
            if not ref:
                self.send_api_json(422, {"detail": "asin or sku is required"})
                return
            with STATE_LOCK:
                state = normalize_state(read_database())
                entry = next(
                    (e for e in state.get("amazon_catalog", [])
                     if e.get("asin") == ref or e.get("sku") == ref),
                    None,
                )
                if entry is None:
                    self.send_api_json(404, {"detail": "Product not found in mock Amazon catalog"})
                    return
                now_ = now_iso()
                listing_fields = ("title", "bullets", "description", "backend_keywords", "images", "price", "stock")
                existing = next(
                    (p for p in state.get("products", []) if p.get("asin") == entry.get("asin") and p.get("marketplace_id") == entry.get("marketplace_id", US_MARKETPLACE_ID)),
                    None,
                )
                if existing is not None:
                    for field in listing_fields:
                        if field in entry:
                            existing[field] = entry[field]
                    existing["name"] = entry.get("title") or existing.get("name")
                    existing["sellable_units"] = float(entry.get("stock", existing.get("stock", 0)))
                    existing["stock"] = existing["sellable_units"]
                    existing["days_of_supply"] = round(existing["sellable_units"] / max(existing.get("daily_velocity", 10), 0.1), 1)
                    existing["last_synced_at"] = now_
                    existing["sync_status"] = "synced"
                    recompute_product(state, existing)
                    ensure_listings(state, existing)
                    product = existing
                    message = "Product refreshed from mock Amazon catalog"
                else:
                    stock = float(entry.get("stock", 0) or 0)
                    price = float(entry.get("price", 0) or 0)
                    product = {
                        "id": uuid.uuid4().hex,
                        "asin": entry.get("asin"),
                        "sku": entry.get("sku", entry.get("asin")),
                        "marketplace_id": entry.get("marketplace_id", US_MARKETPLACE_ID),
                        "source": "amazon_sync",
                        "name": entry.get("title") or entry.get("name"),
                        "title": entry.get("title") or entry.get("name"),
                        "category": "General",
                        "price": price,
                        "bullets": entry.get("bullets") or [],
                        "description": entry.get("description") or "",
                        "backend_keywords": entry.get("backend_keywords") or [],
                        "images": entry.get("images") or [],
                        "sellable_units": stock,
                        "stock": stock,
                        "days_of_supply": round(stock / 10.0, 1),
                        "daily_velocity": 10.0,
                        "competitor_price": price,
                        "market_price": price,
                        "min_floor": round(price * 0.8, 2),
                        "max_price": round(price * 1.2, 2),
                        "unit_cost": round(price * 0.5, 2),
                        "lead_time_days": 21,
                        "supplier": "Mock Amazon Supplier",
                        "po_draft_id": None,
                        "suppressed": bool(entry.get("suppressed")),
                        "last_synced_at": now_,
                        "sync_status": "synced",
                        "last_optimized_at": None,
                    }
                    recompute_product(state, product)
                    state.get("products", []).append(product)
                    state.setdefault("global_products", []).append(dict(product))
                    state.setdefault("sales_history", {})[product["sku"]] = [10] * 30
                    ensure_listings(state, product)
                    record_activity(
                        state,
                        "catalog",
                        "Product imported from mock Amazon",
                        f'{entry.get("title") or entry.get("name")} ({entry.get("asin")}) added to catalog.',
                    )
                    message = "Product imported from mock Amazon catalog"
                write_database(state)
            self.send_api_json(200, {"product": product, "message": message})
            return

        if path == "/api/products/optimize-bulk":
            body = read_json_body(self)
            if body is None:
                self.send_api_json(400, {"detail": "Invalid JSON request"})
                return
            requested_ids = body.get("product_ids") or []
            with STATE_LOCK:
                state = normalize_state(read_database())
                targets = []
                if requested_ids:
                    for ref in requested_ids:
                        product = find_product(state, ref)
                        if product is not None:
                            targets.append(product)
                else:
                    targets = [p for p in state.get("products", []) if p.get("opt_status") == "needs_optimization"]
                results = []
                for product in targets:
                    suggested = build_suggested_copy(state, product)
                    field_changes = {}
                    for field in OPT_FIELDS:
                        before = product.get(field)
                        after = suggested.get(field)
                        if after is not None and after != before:
                            field_changes[field] = {"before": before, "after": after}
                    revision = {
                        "id": uuid.uuid4().hex,
                        "product_id": product["id"],
                        "asin": product.get("asin"),
                        "field_changes": field_changes,
                        "status": "pending_approval",
                        "created_by": state["manager"]["name"],
                        "created_at": now_iso(),
                    }
                    state.setdefault("product_revisions", []).append(revision)
                    product["opt_status"] = "draft_ready"
                    product["last_optimized_at"] = revision["created_at"]
                    record_activity(
                        state,
                        "catalog",
                        "Bulk optimization drafts sent to approval",
                        f"{product.get('name') or product.get('title')} · {len(field_changes)} field(s) changed.",
                    )
                    results.append({"product_id": product["id"], "asin": product.get("asin"), "revision_id": revision["id"]})
                write_database(state)
            self.send_api_json(200, {"results": results, "count": len(results)})
            return

        match = re.fullmatch(r"/api/products/([^/]+)/optimize", path)
        if match:
            body = read_json_body(self)
            if body is None:
                self.send_api_json(400, {"detail": "Invalid JSON request"})
                return
            with STATE_LOCK:
                state = normalize_state(read_database())
                product = find_product(state, unquote(match.group(1)))
                if product is None:
                    self.send_api_json(404, {"detail": "Product not found"})
                    return
                suggested = body.get("suggested") or {k: body.get(k) for k in OPT_FIELDS if k in body}
                if not suggested:
                    suggested = build_suggested_copy(state, product)
                save_draft = bool(body.get("save_draft"))
                field_changes = {}
                for field in OPT_FIELDS:
                    before = product.get(field)
                    after = suggested.get(field)
                    if after is not None and after != before:
                        field_changes[field] = {"before": before, "after": after}
                revision = {
                    "id": uuid.uuid4().hex,
                    "product_id": product["id"],
                    "asin": product.get("asin"),
                    "field_changes": field_changes,
                    "status": "draft" if save_draft else "pending_approval",
                    "created_by": state["manager"]["name"],
                    "created_at": now_iso(),
                }
                state.setdefault("product_revisions", []).append(revision)
                product["opt_status"] = "draft_ready"
                product["last_optimized_at"] = revision["created_at"]
                record_activity(
                    state,
                    "catalog",
                    "Optimization draft saved" if save_draft else "Optimization draft sent to approval",
                    f"{product.get('name') or product.get('title')} · {len(field_changes)} field(s) changed · {revision['status']}.",
                )
                write_database(state)
            self.send_api_json(200, {"revision": revision, "product": product})
            return

        match = re.fullmatch(r"/api/approvals/([^/]+)/(approve|reject)", path)
        if match:
            revision_id = unquote(match.group(1))
            action = match.group(2)
            read_json_body(self)
            with STATE_LOCK:
                state = normalize_state(read_database())
                revision = revision_for(state, revision_id)
                if revision is None:
                    self.send_api_json(404, {"detail": "Revision not found"})
                    return
                if revision.get("status") != "pending_approval":
                    self.send_api_json(409, {"detail": "This revision has already been reviewed"})
                    return
                product = find_product(state, revision.get("product_id"))
                if product is None:
                    self.send_api_json(404, {"detail": "Product not found"})
                    return
                now_ = now_iso()
                if action == "approve":
                    revision["status"] = "approved"
                    for field, change in revision.get("field_changes", {}).items():
                        product[field] = change.get("after")
                    product["opt_status"] = "published"
                    product["last_optimized_at"] = now_
                    recompute_product(state, product)
                    for listing in state.get("marketplace_listings", []):
                        if listing.get("global_product_id") == product.get("asin"):
                            listing["title"] = product.get("title") or product.get("name")
                            listing["description"] = product.get("description", "")
                            listing["status"] = "Live & In Sync"
                    record_activity(
                        state,
                        "approval",
                        "Listing revision approved · published to mock Amazon",
                        f"{product.get('name') or product.get('title')} ({product.get('asin')}) published to mock Amazon.",
                    )
                    message = "Revision approved and published to mock Amazon"
                else:
                    revision["status"] = "rejected"
                    product["opt_status"] = "needs_optimization"
                    record_activity(
                        state,
                        "approval",
                        "Listing revision rejected",
                        f"Optimization revision for {product.get('name') or product.get('title')} was rejected.",
                    )
                    message = "Revision rejected"
                write_database(state)
            self.send_api_json(200, {"revision": revision, "product": product, "message": message})
            return

        if path == "/api/sync":
            body = read_json_body(self)
            if body is None:
                self.send_api_json(400, {"detail": "Invalid JSON request"})
                return
            with STATE_LOCK:
                state = normalize_state(read_database())
                operation_id = uuid.uuid4().hex
                started = now_iso()
                state["sync_state"] = {"status": "running", "operation_id": operation_id, "started_at": started}
                write_database(state)
                now_ = now_iso()
                synced = 0
                for entry in list(state.get("amazon_catalog", [])):
                    asin = entry.get("asin")
                    marketplace_id = entry.get("marketplace_id", US_MARKETPLACE_ID)
                    product = next(
                        (p for p in state.get("products", [])
                         if p.get("asin") == asin and p.get("marketplace_id") == marketplace_id),
                        None,
                    )
                    payload = {
                        "name": entry.get("title") or entry.get("name"),
                        "title": entry.get("title") or entry.get("name"),
                        "bullets": entry.get("bullets") or [],
                        "description": entry.get("description") or "",
                        "backend_keywords": entry.get("backend_keywords") or [],
                        "images": entry.get("images") or [],
                        "price": float(entry.get("price", 0) or 0),
                    }
                    stock = float(entry.get("stock", 0) or 0)
                    if product is None:
                        product = {
                            "id": uuid.uuid4().hex,
                            "asin": asin,
                            "sku": entry.get("sku", asin),
                            "marketplace_id": marketplace_id,
                            "source": "amazon_sync",
                            "name": payload["name"],
                            "title": payload["title"],
                            "category": "General",
                            "price": payload["price"],
                            "bullets": payload["bullets"],
                            "description": payload["description"],
                            "backend_keywords": payload["backend_keywords"],
                            "images": payload["images"],
                            "sellable_units": stock,
                            "stock": stock,
                            "days_of_supply": round(stock / 10.0, 1),
                            "daily_velocity": 10.0,
                            "competitor_price": payload["price"],
                            "market_price": payload["price"],
                            "min_floor": round(payload["price"] * 0.8, 2),
                            "max_price": round(payload["price"] * 1.2, 2),
                            "unit_cost": round(payload["price"] * 0.5, 2),
                            "lead_time_days": 21,
                            "supplier": "Mock Amazon Supplier",
                            "po_draft_id": None,
                            "suppressed": bool(entry.get("suppressed")),
                            "last_synced_at": now_,
                            "sync_status": "synced",
                            "last_optimized_at": None,
                        }
                        recompute_product(state, product)
                        state.get("products", []).append(product)
                        state.setdefault("global_products", []).append(dict(product))
                        state.setdefault("sales_history", {})[product["sku"]] = [10] * 30
                    else:
                        product.update(payload)
                        product["sellable_units"] = stock
                        product["stock"] = stock
                        product["days_of_supply"] = round(stock / max(product.get("daily_velocity", 10), 0.1), 1)
                        product["last_synced_at"] = now_
                        product["sync_status"] = "synced"
                        recompute_product(state, product)
                    ensure_listings(state, product)
                    synced += 1
                state["sync_state"] = {
                    "status": "completed",
                    "operation_id": operation_id,
                    "started_at": started,
                    "completed_at": now_,
                    "products_synced": synced,
                }
                record_activity(
                    state,
                    "sync",
                    "Mock Amazon seller data synced",
                    f"{synced} product(s) upserted by ASIN and marketplace.",
                )
                write_database(state)
            self.send_api_json(202, {
                "operation_id": operation_id,
                "status": "completed",
                "products_synced": synced,
                "message": "Mock sync complete",
            })
            return

        if path.startswith("/api/"):
            self.api_not_found()
            return

        self.send_json(404, {"detail": "Not found"})
        return

    def do_PATCH(self):
        path = urlparse(self.path).path
        match = re.fullmatch(r"/api/products/([^/]+)", path)
        if not match:
            self.send_api_json(404, {"detail": "Not found"})
            return
        body = read_json_body(self)
        if body is None:
            self.send_api_json(400, {"detail": "Invalid JSON request"})
            return
        numeric_fields = ("price", "stock", "min_floor", "max_price", "unit_cost", "daily_velocity")
        with STATE_LOCK:
            state = normalize_state(read_database())
            product = find_product(state, unquote(match.group(1)))
            if product is None:
                self.send_api_json(404, {"detail": "Product not found"})
                return
            changed = []
            for field, value in body.items():
                if field not in ("title", "bullets", "description", "backend_keywords", "images", "price",
                                 "stock", "category", "supplier", "name", "min_floor", "max_price",
                                 "unit_cost", "lead_time_days", "daily_velocity"):
                    continue
                if field in numeric_fields:
                    try:
                        value = float(value)
                    except (TypeError, ValueError):
                        self.send_api_json(422, {"detail": f"{field} must be a number"})
                        return
                if field == "stock":
                    product["sellable_units"] = value
                    product["days_of_supply"] = round(value / max(product.get("daily_velocity", 10), 0.1), 1)
                if field == "daily_velocity":
                    product["days_of_supply"] = round(product.get("stock", 0) / max(value, 0.1), 1)
                product[field] = value
                changed.append(field)
            recompute_product(state, product)
            record_activity(
                state,
                "catalog",
                "Product updated",
                f"{product.get('name') or product.get('title')} · {', '.join(changed) if changed else 'no changes'}",
            )
            write_database(state)
        self.send_api_json(200, {"product": product})


if __name__ == "__main__":
    threading.Thread(target=simulator_loop, daemon=True, name="mock-simulator").start()
    server = ThreadingHTTPServer((HOST, PORT), DashboardHandler)
    print(f"AmzSphere mock dashboard running at http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping AmzSphere server.", flush=True)
    finally:
        server.server_close()