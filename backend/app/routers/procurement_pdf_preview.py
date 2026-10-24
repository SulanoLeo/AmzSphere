"""PDF document streaming endpoint for AmzSphere B2B Procurement.

Serves compiled purchase order draft PDFs stored as binary blobs in the
``pending_pdf_generations`` table via native FastAPI binary streaming, and
provides a vendor dispatch confirmation action.
"""

from __future__ import annotations

import hmac
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import get_settings
from backend.app.db import SessionLocal
from backend.app.models import PendingPDFGeneration

router = APIRouter(prefix="/api/v1/procurement/pdf", tags=["Procurement PDF"])


async def get_async_db() -> AsyncSession:
    """FastAPI dependency that yields an async SQLAlchemy session."""
    async with SessionLocal() as session:
        yield session


class PDFPreviewResponse(BaseModel):
    """Metadata returned alongside the binary PDF stream for client introspection."""

    generation_id: UUID
    status: str
    content_type: str = "application/pdf"
    filename: str


class PDDispatchResponse(BaseModel):
    """Response for the vendor dispatch confirmation action."""

    generation_id: UUID
    status: str
    dispatched_at: str
    message: str


def _verify_admin_secret(x_admin_secret: str | None) -> None:
    """Verify the administrative webhook secret key using constant-time comparison."""
    settings = get_settings()
    configured = settings.admin_webhook_secret
    if configured is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_WEBHOOK_SECRET is not configured",
        )
    expected = configured.get_secret_value()
    if not x_admin_secret or not hmac.compare_digest(x_admin_secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin webhook secret",
        )


@router.get(
    "/preview/{generation_id}",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_200_OK: {
            "content": {"application/pdf": {}},
            "description": "Binary PDF document stream.",
        }
    },
)
async def preview_pdf(
    generation_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    x_admin_secret: str | None = Header(default=None, alias="x-admin-secret"),
) -> Response:
    """Stream a completed purchase order draft PDF to the browser.

    Verifies the ``pending_pdf_generations`` row exists and is marked
    ``completed``, then streams the raw ``pdf_data`` binary blob with
    ``Content-Type: application/pdf`` and an inline ``Content-Disposition``
    header so the browser renders it natively.
    """
    _verify_admin_secret(x_admin_secret)

    row = await db.get(PendingPDFGeneration, generation_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF generation record not found",
        )

    if row.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"PDF is not ready for preview (status: {row.status})",
        )

    if row.pdf_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF binary data is missing",
        )

    filename = f"PO_Draft_{generation_id}.pdf"

    return Response(
        content=row.pdf_data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Length": str(len(row.pdf_data)),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/{generation_id}/dispatch",
    status_code=status.HTTP_200_OK,
    response_model=PDDispatchResponse,
)
async def dispatch_pdf(
    generation_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    x_admin_secret: str | None = Header(default=None, alias="x-admin-secret"),
) -> PDDispatchResponse:
    """Confirm vendor dispatch for a compiled PDF draft.

    Transitions the ``pending_pdf_generations`` row from ``completed`` to
    ``dispatched`` and records the dispatch timestamp. Intended to be called
    from the PDF preview modal after a manager reviews and authorizes the
    document for vendor transmission.
    """
    _verify_admin_secret(x_admin_secret)

    async with db.begin():
        row = await db.get(PendingPDFGeneration, generation_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PDF generation record not found",
            )

        if row.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"PDF cannot be dispatched (status: {row.status})",
            )

        row.status = "dispatched"
        row.completed_at = datetime.now(timezone.utc)

    return PDDispatchResponse(
        generation_id=generation_id,
        status="dispatched",
        dispatched_at=datetime.now(timezone.utc).isoformat(),
        message="PDF draft confirmed for vendor dispatch.",
    )
