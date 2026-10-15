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


class AgentActionRequest(BaseModel):
    action: Literal["catalog_push", "procurement_po"]
    asin: str | None = Field(default=None, min_length=1, max_length=20)
    items: list[ProcurementLine] = Field(default_factory=list, max_length=50)


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


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")