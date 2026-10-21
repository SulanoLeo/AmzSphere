import uuid

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