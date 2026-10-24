import uuid
from typing import Any, Literal, Literal

from pydantic import BaseModel, ConfigDict, Field


class CatalogOptimizeRequest(BaseModel):
    seller_id: uuid.UUID
    asin: str = Field(min_length=10, max_length=10, pattern=r"^[A-Z0-9]{10}$")
    sku: str | None = Field(default=None, min_length=1, max_length=80)
    optimization_mode: str = Field(default="free", pattern=r"^(free|paid)$")
    helium10_api_key: str | None = Field(default=None, min_length=1, max_length=256)


class OperationAccepted(BaseModel):
    operation_id: uuid.UUID
    status: str


class OperationView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    operation_type: str
    status: str
    asin: str | None
    result_payload: dict | None
    error_code: str | None
    error_message: str | None


class AmazonOAuthStart(BaseModel):
    tenant_id: str = Field(min_length=1, max_length=128)


class PurchaseOrderDecision(BaseModel):
    action: str = Field(pattern=r"^(approve|deny)$")
    reviewer_id: str = Field(min_length=1, max_length=128)


class WebhookAccepted(BaseModel):
    accepted: bool
    notification_id: str
    event_id: str | None = None
    reason: str | None = None


class ListingRemediationApproval(BaseModel):
    event_id: uuid.UUID
    action_type: Literal["UPDATE_PRICE", "PATCH_CATALOG"]
    payload: dict[str, Any]


class ListingRemediationApprovalResponse(BaseModel):
    outbox_entry_id: uuid.UUID
    timestamp: str
    message: str


class BulkProcurementApprovalRequest(BaseModel):
    purchase_order_ids: list[str | int] = Field(min_length=1, max_length=200)
    execution_strategy: Literal["IMMEDIATE_STAGING", "CONSOLIDATE_BY_VENDOR"]


class BulkProcurementApprovalResponse(BaseModel):
    batch_token: str
    execution_strategy: str
    total_requested: int
    total_approved: int
    total_skipped: int
    vendor_groups: int
    message: str
    timestamp: str


class CompilePDFBatchResponse(BaseModel):
    processed: int
    succeeded: int
    failed: int
    batch_token: str | None = None
    message: str
    timestamp: str