import json
import mimetypes
import os
import re
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from simulator import MockSimulator, now_iso, record_activity, tick_is_due


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DATABASE_PATH = Path(os.environ.get("MOCK_DB_PATH", ROOT / "mock_db.json"))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
TICK_SECONDS = 10
STATE_LOCK = threading.RLock()
SIMULATOR = MockSimulator()


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

        relative_path = "index.html" if path == "/" else path.removeprefix("/static/")
        file_path = (STATIC_DIR / relative_path).resolve()
        if path != "/" and not path.startswith("/static/"):
            self.send_error(404)
            return
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

        self.send_json(404, {"detail": "Not found"})
        return


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