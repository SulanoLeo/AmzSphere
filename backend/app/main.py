from contextlib import asynccontextmanager
import hashlib
import hmac
import json
import secrets
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, Response
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.config import get_settings
from backend.app.db import SessionLocal, engine
from backend.app.models import (
    AgentOperation,
    CatalogItem,
    InventorySnapshot,
    ListingHealthEvent,
    OutboxEvent,
    PurchaseOrder,
    SalesDaily,
    Seller,
    Vendor,
)
from backend.app.schemas import (
    AmazonOAuthStart,
    CatalogOptimizeRequest,
    OperationAccepted,
    OperationView,
    PurchaseOrderDecision,
    WebhookAccepted,
)
from backend.app.services.encryption import encrypt_refresh_token
from backend.app.services.inventory import latest_inventory_for_items, sales_windows_for_items, velocity_summary
from backend.app.services.listing_health import (
    ListingHealthParseError,
    parse_listing_item_status_change,
    validate_amazon_signature,
)
from backend.app.routers.listings import router as listings_router
from backend.app.routers.procurement import router as procurement_router
from backend.app.routers.procurement_pdf import router as procurement_pdf_router
from backend.app.routers.procurement_pdf_preview import (
    router as procurement_pdf_preview_router,
)
from backend.app.routers.telemetry import router as telemetry_router
from backend.app.tasks.amazon_writes import router as amazon_writes_router


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
    await app.state.redis.ping()
    yield
    await app.state.redis.aclose()
    await engine.dispose()


app = FastAPI(title="AmzSphere Operations API", version="1.0.0", lifespan=lifespan)

app.include_router(listings_router)
app.include_router(procurement_router)
app.include_router(procurement_pdf_router)
app.include_router(procurement_pdf_preview_router)
app.include_router(amazon_writes_router)
app.include_router(telemetry_router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


async def require_platform_key(x_platform_key: str | None = Header(default=None)) -> None:
    configured = settings.platform_api_key
    if configured is None:
        raise HTTPException(status_code=503, detail="PLATFORM_API_KEY is not configured")
    expected = configured.get_secret_value()
    if not x_platform_key or not hmac.compare_digest(x_platform_key, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def require_workspace_user(x_workspace_user: str | None) -> str:
    user = (x_workspace_user or "").strip().lower()
    if not user or len(user) > 254 or "\n" in user or "\r" in user:
        raise HTTPException(status_code=401, detail="Authenticated workspace user required")
    return user


def assert_seller_tenant(seller: Seller | None, workspace_user: str) -> Seller:
    if seller is None or seller.tenant_id.strip().lower() != workspace_user:
        raise HTTPException(status_code=404, detail="Seller not found")
    return seller


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "mode": "production" if settings.sp_api_enabled else "disabled"}


@app.post(
    "/api/v1/webhooks/amazon-notifications",
    status_code=202,
    response_model=WebhookAccepted,
)
async def amazon_notifications_webhook(
    request: Request,
    x_amz_sns_message_signature: str | None = Header(default=None, alias="x-amz-sns-message-signature"),
    x_workspace_user: str | None = Header(default=None),
) -> WebhookAccepted:
    """Ingest Amazon SP-API notifications and stage listing-health events.

    The endpoint validates the request signature placeholder, parses
    LISTING_ITEM_STATUS_CHANGE payloads, deduplicates by notification id, and
    writes a pending_review listing_health_events record. Heavy remediation
    logic is deferred to consumers of the staging table.
    """
    workspace_user = require_workspace_user(x_workspace_user)
    body = await request.body()

    settings = get_settings()
    notification_secret = settings.amazon_notifications_secret.get_secret_value() if settings.amazon_notifications_secret else None
    if not validate_amazon_signature(body=body, signature=x_amz_sns_message_signature, secret=notification_secret):
        raise HTTPException(status_code=401, detail="Invalid Amazon notification signature")

    try:
        envelope = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        event = parse_listing_item_status_change(envelope)
    except ListingHealthParseError as error:
        raise HTTPException(status_code=422, detail=str(error))

    async with SessionLocal() as session:
        seller = await session.scalar(select(Seller).where(Seller.tenant_id == workspace_user))
        if seller is None:
            raise HTTPException(status_code=404, detail="Seller not found for workspace user")

        existing = await session.scalar(
            select(ListingHealthEvent).where(ListingHealthEvent.notification_id == event.notification_id)
        )
        if existing is not None:
            return WebhookAccepted(
                accepted=True,
                notification_id=event.notification_id,
                event_id=str(existing.id),
                reason="duplicate",
            )

        record = ListingHealthEvent(
            seller_id=seller.id,
            notification_id=event.notification_id,
            notification_type=event.notification_type,
            asin=event.asin,
            sku=event.sku,
            marketplace_id=event.marketplace_id,
            listing_status=event.listing_status,
            status="pending_review",
            error_codes=event.error_codes,
            error_messages=event.error_messages,
            is_suppressed=event.is_suppressed,
            raw_payload=event.raw_payload,
        )
        session.add(record)
        await session.flush()
        event_id = str(record.id)
        await session.commit()

    return WebhookAccepted(
        accepted=True,
        notification_id=event.notification_id,
        event_id=event_id,
    )


@app.get("/api/v1/sellers", dependencies=[Depends(require_platform_key)])
async def list_workspace_sellers(x_workspace_user: str | None = Header(default=None)) -> list[dict]:
    workspace_user = require_workspace_user(x_workspace_user)
    async with SessionLocal() as session:
        sellers = (await session.scalars(
            select(Seller).where(Seller.tenant_id == workspace_user).order_by(Seller.created_at)
        )).all()
        return [{
            "id": str(seller.id),
            "merchant_id": seller.merchant_id,
            "marketplace_id": seller.marketplace_id,
            "region": seller.region,
        } for seller in sellers]


@app.get("/api/v1/auth/amazon/start", dependencies=[Depends(require_platform_key)])
async def amazon_oauth_start(
    request: Request,
    tenant_id: str = Query(min_length=1, max_length=254),
    x_workspace_user: str | None = Header(default=None),
) -> dict:
    workspace_user = require_workspace_user(x_workspace_user)
    if tenant_id.strip().lower() != workspace_user:
        raise HTTPException(status_code=403, detail="OAuth tenant must match the authenticated user")
    if not settings.sp_api_application_id:
        raise HTTPException(status_code=503, detail="SP_API_APPLICATION_ID is not configured")
    state = secrets.token_urlsafe(32)
    value = json.dumps({"tenant_id": tenant_id, "issued_at": datetime.now(timezone.utc).isoformat()})
    await request.app.state.redis.setex(f"amzsphere:oauth:state:{state}", settings.oauth_state_ttl_seconds, value)
    consent_parameters = {
        "application_id": settings.sp_api_application_id,
        "state": state,
    }
    if settings.sp_api_application_version:
        consent_parameters["version"] = settings.sp_api_application_version
    consent_url = "https://sellercentral.amazon.com/apps/authorize/consent?" + urlencode(consent_parameters)
    return {"authorization_url": consent_url, "expires_in": settings.oauth_state_ttl_seconds}


@app.get("/api/v1/auth/amazon/callback")
async def amazon_oauth_callback(
    request: Request,
    state: str,
    spapi_oauth_code: str,
    selling_partner_id: str,
) -> dict:
    raw_state = await request.app.state.redis.getdel(f"amzsphere:oauth:state:{state}")
    if not raw_state:
        raise HTTPException(status_code=400, detail="OAuth state is invalid, expired, or already used")
    if settings.lwa_client_id is None or settings.lwa_client_secret is None:
        raise HTTPException(status_code=503, detail="LWA application credentials are not configured")
    async with httpx.AsyncClient(timeout=httpx.Timeout(20)) as client:
        response = await client.post(
            "https://api.amazon.com/auth/o2/token",
            data={
                "grant_type": "authorization_code",
                "code": spapi_oauth_code,
                "client_id": settings.lwa_client_id.get_secret_value(),
                "client_secret": settings.lwa_client_secret.get_secret_value(),
                "redirect_uri": settings.oauth_redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
        )
        response.raise_for_status()
        credentials = response.json()
    refresh_token = credentials.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=502, detail="LWA authorization response did not include a refresh token")

    callback_state = json.loads(raw_state)
    encrypted_token = encrypt_refresh_token(refresh_token)
    async with SessionLocal() as session:
        seller = await session.scalar(select(Seller).where(
            Seller.tenant_id == callback_state["tenant_id"],
            Seller.merchant_id == selling_partner_id,
            Seller.marketplace_id == settings.sp_api_marketplace_id,
        ))
        if seller:
            seller.lwa_refresh_token_encrypted = encrypted_token
        else:
            seller = Seller(
                tenant_id=callback_state["tenant_id"],
                merchant_id=selling_partner_id,
                marketplace_id=settings.sp_api_marketplace_id,
                region=settings.sp_api_aws_region,
                endpoint=settings.sp_api_endpoint,
                lwa_refresh_token_encrypted=encrypted_token,
            )
            session.add(seller)
            await session.flush()
        await session.commit()
    return RedirectResponse(url=f"{settings.web_app_url.rstrip('/')}/?amazon_connected=1", status_code=303)


@app.post("/api/v1/catalog/optimize", status_code=202, response_model=OperationAccepted, dependencies=[Depends(require_platform_key)])
async def queue_catalog_optimization(
    payload: CatalogOptimizeRequest,
    idempotency_key: str = Header(min_length=8, max_length=128, alias="Idempotency-Key"),
    x_workspace_user: str | None = Header(default=None),
) -> OperationAccepted:
    workspace_user = require_workspace_user(x_workspace_user)
    if not settings.sp_api_enabled:
        raise HTTPException(status_code=503, detail="SP-API integration is disabled")
    async with SessionLocal() as session:
        seller = assert_seller_tenant(await session.get(Seller, payload.seller_id), workspace_user)
        catalog_query = select(CatalogItem).where(
            CatalogItem.seller_id == payload.seller_id,
            CatalogItem.asin == payload.asin,
        )
        if payload.sku:
            catalog_query = catalog_query.where(CatalogItem.sku == payload.sku)
        matches = (await session.scalars(catalog_query)).all()
        if seller is None or not matches:
            raise HTTPException(status_code=404, detail="Seller catalog item not found")
        if len(matches) > 1:
            raise HTTPException(status_code=409, detail="ASIN maps to multiple seller SKUs; provide sku")
        item = matches[0]
        prior = await session.scalar(select(AgentOperation).where(
            AgentOperation.seller_id == seller.id,
            AgentOperation.idempotency_key == idempotency_key,
        ))
        if prior:
            return OperationAccepted(operation_id=prior.id, status=prior.status)
        operation = AgentOperation(
            seller_id=seller.id,
            operation_type="catalog_optimize",
            status="queued",
            asin=item.asin,
            request_payload={
                "asin": item.asin,
                "sku": item.sku,
                "marketplace_id": seller.marketplace_id,
                "optimization_mode": payload.optimization_mode,
                "helium10_api_key": payload.helium10_api_key,
            },
            idempotency_key=idempotency_key,
        )
        session.add(operation)
        await session.flush()
        session.add(OutboxEvent(
            event_type="backend.app.tasks.catalog.optimize_listing",
            payload={"args": [str(operation.id)]},
        ))
        await session.commit()
        return OperationAccepted(operation_id=operation.id, status=operation.status)


@app.post("/api/v1/catalog/operations/{operation_id}/approve", status_code=202, dependencies=[Depends(require_platform_key)])
async def approve_catalog_operation(operation_id: uuid.UUID, x_workspace_user: str | None = Header(default=None)) -> dict:
    workspace_user = require_workspace_user(x_workspace_user)
    if not settings.sp_api_enabled or settings.sp_api_dry_run:
        raise HTTPException(status_code=503, detail="SP-API writes are disabled")
    async with SessionLocal() as session:
        operation = await session.get(AgentOperation, operation_id)
        if operation is None:
            raise HTTPException(status_code=404, detail="Operation not found")
        assert_seller_tenant(await session.get(Seller, operation.seller_id), workspace_user)
        if operation.status != "review_required":
            raise HTTPException(status_code=409, detail="Operation is not awaiting review")
        operation.status = "approved"
        session.add(OutboxEvent(
            event_type="backend.app.tasks.catalog.submit_approved_listing",
            payload={"args": [str(operation.id)]},
        ))
        await session.commit()
        return {"operation_id": str(operation.id), "status": operation.status}


@app.post("/api/v1/catalog/helium10/token", dependencies=[Depends(require_platform_key)])
async def set_helium10_token(
    request: Request,
    x_workspace_user: str | None = Header(default=None),
) -> dict:
    workspace_user = require_workspace_user(x_workspace_user)
    body = await request.json()
    token = (body or {}).get("helium10_api_key")
    if not token or not isinstance(token, str):
        raise HTTPException(status_code=422, detail="helium10_api_key is required")
    # Stored server-side keyed by workspace user; production should encrypt at rest.
    await request.app.state.redis.setex(
        f"amzsphere:helium10:token:{workspace_user}",
        86400 * 30,
        token,
    )
    return {"ok": True}


@app.get("/api/v1/catalog/helium10/status", dependencies=[Depends(require_platform_key)])
async def get_helium10_status(
    request: Request,
    x_workspace_user: str | None = Header(default=None),
) -> dict:
    workspace_user = require_workspace_user(x_workspace_user)
    stored = await request.app.state.redis.get(f"amzsphere:helium10:token:{workspace_user}")
    return {"connected": bool(stored)}


@app.get("/api/v1/operations/{operation_id}", response_model=OperationView, dependencies=[Depends(require_platform_key)])
async def get_operation(operation_id: uuid.UUID, x_workspace_user: str | None = Header(default=None)) -> AgentOperation:
    workspace_user = require_workspace_user(x_workspace_user)
    async with SessionLocal() as session:
        operation = await session.get(AgentOperation, operation_id)
        if operation is None:
            raise HTTPException(status_code=404, detail="Operation not found")
        assert_seller_tenant(await session.get(Seller, operation.seller_id), workspace_user)
        return operation


@app.get("/api/v1/dashboard", dependencies=[Depends(require_platform_key)])
async def get_dashboard(seller_id: uuid.UUID, x_workspace_user: str | None = Header(default=None)) -> dict:
    workspace_user = require_workspace_user(x_workspace_user)
    async with SessionLocal() as session:
        seller = assert_seller_tenant(await session.scalar(
            select(Seller).where(Seller.id == seller_id).with_for_update()
        ), workspace_user)
        items = (await session.scalars(select(CatalogItem).options(selectinload(CatalogItem.vendor)).where(
            CatalogItem.seller_id == seller.id
        ))).all()
        item_ids = [item.id for item in items]
        inventory_by_item = await latest_inventory_for_items(session, item_ids)
        sales_by_item = await sales_windows_for_items(session, item_ids)
        products = []
        for item in items:
            snapshot = inventory_by_item.get(item.id)
            windows = sales_by_item.get(item.id, (0, 0, 0))
            stock = snapshot.sellable_quantity if snapshot else None
            products.append({
                "asin": item.asin,
                "sku": item.sku,
                "product_type": item.product_type,
                "vendor": item.vendor.name if item.vendor else None,
                **velocity_summary(stock, *windows),
            })
        purchase_orders = (await session.scalars(
            select(PurchaseOrder).options(selectinload(PurchaseOrder.vendor))
            .where(PurchaseOrder.seller_id == seller.id, PurchaseOrder.status == "pending_review")
            .order_by(PurchaseOrder.created_at.desc())
        )).all()
        return {
            "seller_id": str(seller.id),
            "marketplace_id": seller.marketplace_id,
            "products": products,
            "pending_purchase_orders": [
                {"id": str(po.id), "vendor_id": str(po.vendor_id), "vendor": po.vendor.name, "status": po.status,
                 "currency": po.currency, "total_amount_minor": po.total_amount_minor, "lines": po.lines}
                for po in purchase_orders
            ],
        }


@app.post("/api/v1/inventory/sellers/{seller_id}/scan", status_code=202, dependencies=[Depends(require_platform_key)])
async def queue_inventory_scan(seller_id: uuid.UUID, x_workspace_user: str | None = Header(default=None)) -> dict:
    workspace_user = require_workspace_user(x_workspace_user)
    async with SessionLocal() as session:
        assert_seller_tenant(await session.get(Seller, seller_id), workspace_user)
        operation = AgentOperation(
            seller_id=seller_id,
            operation_type="inventory_scan",
            status="queued",
            idempotency_key=f"inventory-scan:{uuid.uuid4()}",
        )
        session.add(operation)
        await session.flush()
        session.add(OutboxEvent(
            event_type="backend.app.tasks.inventory.scan_seller_inventory",
            payload={"args": [str(seller_id), str(operation.id)]},
        ))
        await session.commit()
        return {"operation_id": str(operation.id), "status": "queued"}


@app.post("/api/v1/sellers/{seller_id}/sync", status_code=202, dependencies=[Depends(require_platform_key)])
async def queue_seller_sync(
    seller_id: uuid.UUID,
    idempotency_key: str = Header(min_length=8, max_length=128, alias="Idempotency-Key"),
    x_workspace_user: str | None = Header(default=None),
) -> dict:
    workspace_user = require_workspace_user(x_workspace_user)
    if not settings.sp_api_enabled:
        raise HTTPException(status_code=503, detail="SP-API integration is disabled")
    async with SessionLocal() as session:
        seller = assert_seller_tenant(await session.get(Seller, seller_id), workspace_user)
        active = await session.scalar(select(AgentOperation).where(
            AgentOperation.seller_id == seller.id,
            AgentOperation.operation_type == "seller_data_sync",
            AgentOperation.status.in_(("queued", "running")),
        ).order_by(AgentOperation.created_at.desc()).limit(1))
        if active:
            return {"operation_id": str(active.id), "status": active.status}
        prior = await session.scalar(select(AgentOperation).where(
            AgentOperation.seller_id == seller_id,
            AgentOperation.idempotency_key == idempotency_key,
        ))
        if prior:
            return {"operation_id": str(prior.id), "status": prior.status}
        operation = AgentOperation(
            seller_id=seller_id,
            operation_type="seller_data_sync",
            status="queued",
            idempotency_key=idempotency_key,
        )
        session.add(operation)
        await session.flush()
        session.add(OutboxEvent(
            event_type="backend.app.tasks.ingestion.sync_seller_data",
            payload={"args": [str(seller_id), str(operation.id)]},
        ))
        await session.commit()
        return {"operation_id": str(operation.id), "status": operation.status}


@app.get("/api/v1/purchase-orders/{purchase_order_id}/pdf", dependencies=[Depends(require_platform_key)])
async def download_purchase_order_pdf(purchase_order_id: uuid.UUID, x_workspace_user: str | None = Header(default=None)) -> Response:
    workspace_user = require_workspace_user(x_workspace_user)
    async with SessionLocal() as session:
        purchase_order = await session.get(PurchaseOrder, purchase_order_id)
        if purchase_order is None or purchase_order.pdf_bytes is None:
            raise HTTPException(status_code=404, detail="Purchase order PDF not found")
        assert_seller_tenant(await session.get(Seller, purchase_order.seller_id), workspace_user)
        return Response(
            content=purchase_order.pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="purchase-order-{purchase_order.id}.pdf"'},
        )


@app.post("/api/v1/purchase-orders/{purchase_order_id}/decision", dependencies=[Depends(require_platform_key)])
async def decide_purchase_order(
    purchase_order_id: uuid.UUID,
    decision: PurchaseOrderDecision,
    x_workspace_user: str | None = Header(default=None),
) -> dict:
    workspace_user = require_workspace_user(x_workspace_user)
    async with SessionLocal() as session:
        purchase_order = await session.get(PurchaseOrder, purchase_order_id)
        if purchase_order is None:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        assert_seller_tenant(await session.get(Seller, purchase_order.seller_id), workspace_user)
        if purchase_order.status != "pending_review":
            raise HTTPException(status_code=409, detail="Purchase order is no longer pending review")
        purchase_order.status = "approved" if decision.action == "approve" else "denied"
        purchase_order.reviewed_at = datetime.now(timezone.utc)
        purchase_order.reviewed_by = decision.reviewer_id
        await session.commit()
        return {"purchase_order_id": str(purchase_order.id), "status": purchase_order.status}