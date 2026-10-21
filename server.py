from __future__ import annotations

import asyncio
import logging
import os
import secrets
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from threading import RLock
from typing import Literal

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from database import ConcurrentStateUpdate, get_state_store
from simulator import build_simulator, now_iso, record_activity, tick_is_due
from scoring import compute_opt_score, impact_rank
from local_server import (
    US_MARKETPLACE_ID,
    PAGE_SIZE_DEFAULT,
    normalize_state,
    find_product,
    revision_for,
    recompute_product,
    build_suggested_copy,
    ensure_listings,
    OPT_FIELDS,
)


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DATABASE_PATH = Path(os.environ.get("MOCK_DB_PATH", ROOT / "mock_db.json"))
TICK_SECONDS = 10
LOCK = RLock()
LOGGER = logging.getLogger("amzsphere")
DATA_MODE = os.environ.get("AMZ_DATA_MODE", "mock").strip().lower()
SIMULATOR = build_simulator(DATA_MODE)
WRITE_ATTEMPTS = 3


def read_database() -> dict:
    with LOCK:
        state, version = get_state_store().read()
        state["_database_version"] = version
        return state


def write_database(state: dict) -> None:
    with LOCK:
        persisted_state = {key: value for key, value in state.items() if key != "_database_version"}
        get_state_store().write(persisted_state, state.get("_database_version"))


def public_state(state: dict) -> dict:
    state.pop("_database_version", None)
    state["generated_at"] = now_iso()
    return state


def update_database(mutation):
    for _attempt in range(WRITE_ATTEMPTS):
        with LOCK:
            state = read_database()
            result = mutation(state)
            try:
                write_database(state)
            except ConcurrentStateUpdate:
                continue
            return result
    raise HTTPException(status_code=409, detail="State changed repeatedly; retry this action.")


def tick_database() -> dict:
    for _attempt in range(WRITE_ATTEMPTS):
        with LOCK:
            state = read_database()
            if not tick_is_due(state):
                return public_state(state)
            SIMULATOR.tick(state)
            try:
                write_database(state)
            except ConcurrentStateUpdate:
                continue
            return public_state(state)
    raise HTTPException(status_code=409, detail="Simulator state changed repeatedly; retry the tick.")


async def simulator_loop() -> None:
    while True:
        try:
            with LOCK:
                state = read_database()
                SIMULATOR.tick(state)
                write_database(state)
        except asyncio.CancelledError:
            raise
        except Exception:
            LOGGER.exception("Simulator tick failed")
        await asyncio.sleep(TICK_SECONDS)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = None if os.environ.get("VERCEL") else asyncio.create_task(simulator_loop())
    yield
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="AmzSphere Mock Operations API", lifespan=lifespan)


class ApprovalDecision(BaseModel):
    action: Literal["approve", "deny"]


class ProcurementLine(BaseModel):
    sku: str = Field(min_length=1, max_length=80)
    units: int = Field(gt=0, le=100000)


class ProductUpdate(BaseModel):
    asin: str = Field(min_length=1, max_length=20)
    title: str | None = None
    description: str | None = None


class AgentActionRequest(BaseModel):
    action: Literal["catalog_push", "procurement_po"]
    asin: str | None = Field(default=None, min_length=1, max_length=20)
    items: list[ProcurementLine] = Field(default_factory=list, max_length=50)


class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    sku: str = Field(min_length=1, max_length=80)
    asin: str = Field(min_length=1, max_length=20)
    title: str | None = None
    category: str | None = None
    price: float | None = None
    stock: float | None = None
    daily_velocity: float | None = None
    marketplace_id: str | None = None
    bullets: list[str] | None = None
    description: str | None = None
    backend_keywords: list[str] | None = None
    images: list[str] | None = None
    supplier: str | None = None
    min_floor: float | None = None
    max_price: float | None = None
    unit_cost: float | None = None
    lead_time_days: int | None = None


class ProductPatch(BaseModel):
    name: str | None = None
    title: str | None = None
    category: str | None = None
    price: float | None = None
    stock: float | None = None
    daily_velocity: float | None = None
    marketplace_id: str | None = None
    bullets: list[str] | None = None
    description: str | None = None
    backend_keywords: list[str] | None = None
    images: list[str] | None = None
    supplier: str | None = None
    min_floor: float | None = None
    max_price: float | None = None
    unit_cost: float | None = None
    lead_time_days: int | None = None
    suppressed: bool | None = None


class ProductImport(BaseModel):
    asin: str | None = None
    sku: str | None = None


class OptimizeSuggestion(BaseModel):
    title: str | None = None
    bullets: list[str] | None = None
    description: str | None = None
    backend_keywords: list[str] | None = None
    images: list[str] | None = None


class OptimizeRequest(BaseModel):
    suggested: OptimizeSuggestion | None = None
    save_draft: bool = False


class OptimizeBulkRequest(BaseModel):
    product_ids: list[str] | None = None


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "mode": DATA_MODE}


@app.get("/api/state")
def get_state() -> dict:
    return public_state(read_database())


@app.post("/api/simulator/tick")
def run_simulator_tick() -> dict:
    return tick_database()


@app.get("/api/cron/simulator")
def run_scheduled_tick(authorization: str | None = Header(default=None)) -> dict:
    cron_secret = os.environ.get("CRON_SECRET", "")
    if not cron_secret:
        raise HTTPException(status_code=503, detail="CRON_SECRET is not configured.")
    if not secrets.compare_digest(authorization or "", f"Bearer {cron_secret}"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return tick_database()


@app.post("/api/orders/{order_id}/decision")
def decide_order(order_id: str, decision: ApprovalDecision) -> dict:
    def apply_decision(state: dict) -> dict:
        order = next((item for item in state["orders"] if item["id"] == order_id), None)
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found")
        if order["status"] != "pending":
            raise HTTPException(status_code=409, detail="This workflow has already been reviewed")

        order["status"] = "approved" if decision.action == "approve" else "denied"
        order["reviewed_by"] = state["manager"]["name"]
        order["reviewed_at"] = now_iso()
        record_activity(
            state,
            "procurement",
            f"Purchase workflow {order['status']}",
            f"{order['id']} for {order['product_name']} was {order['status']} by {order['reviewed_by']}.",
        )
        return {"order": order, "activity": state["activity"][0]}

    return update_database(apply_decision)


@app.post("/api/agent-actions", status_code=202)
def stage_agent_action(request: AgentActionRequest) -> dict:
    def stage(state: dict) -> dict:
        jobs = []
        if request.action == "catalog_push":
            product = next((item for item in state["products"] if item["asin"] == request.asin), None)
            if product is None:
                raise HTTPException(status_code=404, detail="Catalog item not found")
            jobs.append({"type": "catalog_push", "asin": product["asin"], "sku": product["sku"]})
        else:
            products_by_sku = {item["sku"]: item for item in state["products"]}
            if not request.items:
                raise HTTPException(status_code=422, detail="At least one procurement item is required")
            if len({item.sku for item in request.items}) != len(request.items):
                raise HTTPException(status_code=422, detail="Procurement SKUs must be unique")
            for item in request.items:
                if item.sku not in products_by_sku:
                    raise HTTPException(status_code=404, detail=f"SKU {item.sku} not found")
                jobs.append({"type": "procurement_po", "sku": item.sku, "units": item.units})

        staged = state.setdefault("execution_queue", [])
        created = []
        for job in jobs:
            entry = {
                "id": str(uuid.uuid4()),
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
            "procurement" if request.action == "procurement_po" else "catalog",
            "Procurement action staged" if request.action == "procurement_po" else "Catalog update staged",
            f"{len(created)} action(s) staged in the sandbox; no Amazon or supplier calls were made.",
        )
        return {
            "jobs": created,
            "message": "Sandbox only: no Amazon or supplier calls were made.",
        }

    return update_database(stage)


@app.post("/api/products/sync", status_code=202)
async def sync_product(request: ProductUpdate) -> dict:
    def apply_sync(state: dict) -> dict:
        product = next((item for item in state.get("global_products", []) if item["asin"] == request.asin), None)
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        if request.title is not None:
            product["name"] = request.title
        if request.description is not None:
            product["description"] = request.description
        for listing in state.get("marketplace_listings", []):
            if listing.get("global_product_id") == request.asin:
                listing["status"] = "Syncing..."
                if request.title is not None:
                    listing["title"] = request.title
                if request.description is not None:
                    listing["description"] = request.description
        return {"asin": request.asin, "status": "Syncing..."}

    result = update_database(apply_sync)

    async def background_finish():
        await asyncio.sleep(3)
        def finish(state: dict) -> None:
            for listing in state.get("marketplace_listings", []):
                if listing.get("global_product_id") == request.asin:
                    listing["status"] = "Live & In Sync"
        update_database(finish)

    asyncio.create_task(background_finish())
    return {"success": True, "message": "Sync started", **result}


@app.get("/api/products")
def list_products(
    opt_status: str | None = None,
    low_stock: bool = False,
    suppressed: bool = False,
    search: str | None = None,
    sort: str | None = None,
    page: int = 1,
    page_size: int = PAGE_SIZE_DEFAULT,
):
    def apply(state: dict) -> dict:
        state = normalize_state(state)
        products = list(state.get("products", []))
        if opt_status:
            products = [p for p in products if p.get("opt_status") == opt_status]
        if low_stock:
            products = [p for p in products if p.get("days_of_supply", 0) < 15]
        if suppressed:
            products = [p for p in products if suppressed_for(state, p)]
        if search:
            needle = search.casefold()
            products = [
                p for p in products
                if needle in f"{p.get('name', '')} {p.get('title', '')} {p.get('asin', '')} {p.get('sku', '')} {p.get('category', '')}".casefold()
            ]
        if sort:
            reverse = sort.startswith("-")
            key = sort.lstrip("-")

            def sort_key(product):
                value = product.get(key)
                return (value is None, value if isinstance(value, (int, float)) else str(value or "").casefold())

            products.sort(key=sort_key, reverse=reverse)
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        total = len(products)
        total_pages = max(1, -(-total // page_size))
        start = (page - 1) * page_size
        return {
            "products": products[start:start + page_size],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    return update_database(apply)


@app.get("/api/products/{product_id}")
def get_product(product_id: str):
    def apply(state: dict) -> dict:
        state = normalize_state(state)
        product = find_product(state, product_id)
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"product": product}

    return update_database(apply)


@app.post("/api/products/import")
def import_product(request: ProductImport):
    ref = request.asin or request.sku
    if not ref:
        raise HTTPException(status_code=422, detail="asin or sku is required")

    def apply(state: dict) -> dict:
        state = normalize_state(state)
        entry = next(
            (e for e in state.get("amazon_catalog", [])
             if e.get("asin") == ref or e.get("sku") == ref),
            None,
        )
        if entry is None:
            raise HTTPException(status_code=404, detail="Product not found in mock Amazon catalog")
        now_ = now_iso()
        existing = next(
            (p for p in state.get("products", [])
             if p.get("asin") == entry.get("asin") and p.get("marketplace_id") == entry.get("marketplace_id", US_MARKETPLACE_ID)),
            None,
        )
        listing_fields = ("title", "bullets", "description", "backend_keywords", "images", "price", "stock")
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
                "id": str(uuid.uuid4()),
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
        return {"product": product, "message": message}

    return update_database(apply)


@app.post("/api/products")
def create_product(request: ProductCreate):
    def apply(state: dict) -> dict:
        state = normalize_state(state)
        if any(p.get("asin") == request.asin for p in state.get("products", [])):
            raise HTTPException(status_code=409, detail="Product with this ASIN already exists")
        if any(p.get("sku") == request.sku for p in state.get("products", [])):
            raise HTTPException(status_code=409, detail="Product with this SKU already exists")
        price = request.price or 0.0
        stock = request.stock or 0.0
        velocity = request.daily_velocity or 10.0
        product = {
            "id": str(uuid.uuid4()),
            "asin": request.asin,
            "sku": request.sku,
            "marketplace_id": request.marketplace_id or US_MARKETPLACE_ID,
            "source": "manual",
            "name": request.name,
            "title": request.title or request.name,
            "category": request.category or "General",
            "price": price,
            "bullets": request.bullets or [],
            "description": request.description or "",
            "backend_keywords": request.backend_keywords or [],
            "images": request.images or [],
            "sellable_units": stock,
            "stock": stock,
            "days_of_supply": round(stock / max(velocity, 0.1), 1),
            "daily_velocity": velocity,
            "competitor_price": price,
            "market_price": price,
            "min_floor": request.min_floor if request.min_floor is not None else round(price * 0.8, 2),
            "max_price": request.max_price if request.max_price is not None else round(price * 1.2, 2),
            "unit_cost": request.unit_cost if request.unit_cost is not None else round(price * 0.5, 2),
            "lead_time_days": request.lead_time_days or 21,
            "supplier": request.supplier or "Unknown Supplier",
            "po_draft_id": None,
            "suppressed": bool(request.suppressed),
            "last_synced_at": None,
            "sync_status": "not_synced",
            "last_optimized_at": None,
        }
        recompute_product(state, product)
        state.get("products", []).append(product)
        state.setdefault("global_products", []).append(dict(product))
        state.setdefault("sales_history", {})[request.sku] = [int(velocity)] * 30
        ensure_listings(state, product)
        record_activity(
            state,
            "catalog",
            "Product added to catalog",
            f"{request.name} ({request.sku}) added to catalog with {stock} units.",
        )
        return {"product": product, "message": "Product added to catalog"}

    return update_database(apply)


@app.patch("/api/products/{product_id}")
def patch_product(product_id: str, request: ProductPatch):
    def apply(state: dict) -> dict:
        state = normalize_state(state)
        product = find_product(state, product_id)
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        changed = []
        data = request.model_dump(exclude_unset=True)
        for field, value in data.items():
            if field in ("price", "stock", "min_floor", "max_price", "unit_cost", "daily_velocity"):
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    raise HTTPException(status_code=422, detail=f"{field} must be a number")
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
        return {"product": product}

    return update_database(apply)


@app.post("/api/products/optimize-bulk")
def optimize_bulk(request: OptimizeBulkRequest):
    def apply(state: dict) -> dict:
        state = normalize_state(state)
        if request.product_ids:
            targets = []
            for ref in request.product_ids:
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
                "id": str(uuid.uuid4()),
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
        return {"results": results, "count": len(results)}

    return update_database(apply)


@app.post("/api/products/{product_id}/optimize", status_code=200)
def optimize_product(product_id: str, request: OptimizeRequest):
    def apply(state: dict) -> dict:
        state = normalize_state(state)
        product = find_product(state, product_id)
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        suggested = request.suggested.model_dump(exclude_unset=True) if request.suggested else {}
        suggested = {k: v for k, v in suggested.items() if v is not None} or build_suggested_copy(state, product)
        field_changes = {}
        for field in OPT_FIELDS:
            before = product.get(field)
            after = suggested.get(field)
            if after is not None and after != before:
                field_changes[field] = {"before": before, "after": after}
        revision = {
            "id": str(uuid.uuid4()),
            "product_id": product["id"],
            "asin": product.get("asin"),
            "field_changes": field_changes,
            "status": "draft" if request.save_draft else "pending_approval",
            "created_by": state["manager"]["name"],
            "created_at": now_iso(),
        }
        state.setdefault("product_revisions", []).append(revision)
        product["opt_status"] = "draft_ready"
        product["last_optimized_at"] = revision["created_at"]
        record_activity(
            state,
            "catalog",
            "Optimization draft saved" if request.save_draft else "Optimization draft sent to approval",
            f"{product.get('name') or product.get('title')} · {len(field_changes)} field(s) changed · {revision['status']}.",
        )
        return {"revision": revision, "product": product}

    return update_database(apply)


@app.post("/api/approvals/{revision_id}/approve")
def approve_revision(revision_id: str):
    return _decide_revision(revision_id, "approve")


@app.post("/api/approvals/{revision_id}/reject")
def reject_revision(revision_id: str):
    return _decide_revision(revision_id, "reject")


def _decide_revision(revision_id: str, action: str):
    def apply(state: dict) -> dict:
        state = normalize_state(state)
        revision = revision_for(state, revision_id)
        if revision is None:
            raise HTTPException(status_code=404, detail="Revision not found")
        if revision.get("status") != "pending_approval":
            raise HTTPException(status_code=409, detail="This revision has already been reviewed")
        product = find_product(state, revision.get("product_id"))
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
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
        return {"revision": revision, "product": product, "message": message}

    return update_database(apply)


@app.post("/api/sync", status_code=202)
async def sync_products():
    def apply(state: dict) -> dict:
        state = normalize_state(state)
        operation_id = str(uuid.uuid4())
        started = now_iso()
        state["sync_state"] = {"status": "running", "operation_id": operation_id, "started_at": started}
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
            stock = float(entry.get("stock", 0) or 0)
            price = float(entry.get("price", 0) or 0)
            payload = {
                "name": entry.get("title") or entry.get("name"),
                "title": entry.get("title") or entry.get("name"),
                "bullets": entry.get("bullets") or [],
                "description": entry.get("description") or "",
                "backend_keywords": entry.get("backend_keywords") or [],
                "images": entry.get("images") or [],
                "price": price,
            }
            if product is None:
                product = {
                    "id": str(uuid.uuid4()),
                    "asin": asin,
                    "sku": entry.get("sku", asin),
                    "marketplace_id": marketplace_id,
                    "source": "amazon_sync",
                    "name": payload["name"],
                    "title": payload["title"],
                    "category": "General",
                    "price": price,
                    "bullets": payload["bullets"],
                    "description": payload["description"],
                    "backend_keywords": payload["backend_keywords"],
                    "images": payload["images"],
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
        return {
            "operation_id": operation_id,
            "status": "completed",
            "products_synced": synced,
            "message": "Mock sync complete",
        }

    return update_database(apply)


@app.get("/api/sync/status")
def sync_status():
    def apply(state: dict) -> dict:
        return state.get("sync_state", {"status": "not_synced"})

    return update_database(apply)


@app.get("/api/overview/summary")
def overview_summary():
    def apply(state: dict) -> dict:
        state = normalize_state(state)
        products = state.get("products", [])
        sellable_units = sum(p.get("sellable_units", p.get("stock", 0)) for p in products)
        reorder_flags = [p for p in products if p.get("days_of_supply", 0) < 15]
        pending_approvals = [r for r in state.get("product_revisions", []) if r.get("status") == "pending_approval"]
        needs_optimization = [p for p in products if p.get("opt_status") == "needs_optimization"]
        ranked = sorted(products, key=impact_rank, reverse=True)[:10]
        top_10 = [
            {
                "id": p.get("id"),
                "asin": p.get("asin"),
                "sku": p.get("sku"),
                "name": p.get("name") or p.get("title"),
                "opt_score": p.get("opt_score"),
                "opt_status": p.get("opt_status"),
                "impact": round(impact_rank(p), 2),
                "days_of_supply": p.get("days_of_supply"),
                "sellable_units": p.get("sellable_units", p.get("stock")),
                "opt_issues": p.get("opt_issues", []),
            }
            for p in ranked
        ]
        return {
            "catalog_items": len(products),
            "sellable_units": round(sellable_units, 1),
            "reorder_flags": len(reorder_flags),
            "pending_approvals": len(pending_approvals),
            "needs_optimization": len(needs_optimization),
            "top_10": top_10,
            "sync": state.get("sync_state", {"status": "not_synced"}),
        }

    return update_database(apply)
def shipping_webhook(payload: dict | None = None) -> dict:
    import random
    def apply(state: dict) -> dict:
        shipments = state.get("order_shipments", [])
        active = [s for s in shipments if s.get("status") in ("In Transit", "Label Created", "Out for Delivery")]
        subset = random.sample(active, min(2, len(active))) if active else []
        for s in subset:
            s["status"] = random.choice(["Exception/Delayed", "Out for Delivery"])
        return {"updated": [s["tracking_number"] for s in subset]}

    result = update_database(apply)
    return {"success": True, **result}


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")