import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Seller(Base):
    __tablename__ = "sellers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    merchant_id: Mapped[str] = mapped_column(String(64), nullable=False)
    marketplace_id: Mapped[str] = mapped_column(String(32), nullable=False)
    region: Mapped[str] = mapped_column(String(8), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False)
    lwa_refresh_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    catalog_items: Mapped[list["CatalogItem"]] = relationship(back_populates="seller")

    __table_args__ = (UniqueConstraint("tenant_id", "merchant_id", "marketplace_id"),)


class CatalogItem(Base):
    __tablename__ = "catalog_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id", ondelete="CASCADE"), nullable=False)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("vendors.id"))
    asin: Mapped[str] = mapped_column(String(10), nullable=False)
    sku: Mapped[str] = mapped_column(String(80), nullable=False)
    product_type: Mapped[str] = mapped_column(String(100), nullable=False)
    listing_attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    seller: Mapped[Seller] = relationship(back_populates="catalog_items")
    sales: Mapped[list["SalesDaily"]] = relationship(back_populates="item")
    inventory: Mapped[list["InventorySnapshot"]] = relationship(back_populates="item")
    vendor: Mapped["Vendor | None"] = relationship()

    __table_args__ = (
        UniqueConstraint("seller_id", "sku"),
        Index("ix_catalog_items_seller_asin", "seller_id", "asin"),
    )


class SalesDaily(Base):
    __tablename__ = "sales_daily"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    catalog_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("catalog_items.id", ondelete="CASCADE"), nullable=False)
    sales_date: Mapped[date] = mapped_column(Date, nullable=False)
    units_ordered: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="sp_api")

    item: Mapped[CatalogItem] = relationship(back_populates="sales")

    __table_args__ = (UniqueConstraint("catalog_item_id", "sales_date", "source"),)


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    catalog_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("catalog_items.id", ondelete="CASCADE"), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    sellable_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    item: Mapped[CatalogItem] = relationship(back_populates="inventory")

    __table_args__ = (Index("ix_inventory_snapshots_item_time", "catalog_item_id", "captured_at"),)


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id", ondelete="CASCADE"), nullable=False)
    vendor_code: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    address: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    po_spec: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("seller_id", "vendor_code"),)


class AgentOperation(Base):
    __tablename__ = "agent_operations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id", ondelete="CASCADE"), nullable=False)
    operation_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    asin: Mapped[str | None] = mapped_column(String(10))
    request_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    result_payload: Mapped[dict | None] = mapped_column(JSONB)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(80))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("seller_id", "idempotency_key"),
        Index("ix_agent_operations_status_created", "status", "created_at"),
    )


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(160), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(String(160))

    __table_args__ = (Index("ix_outbox_pending", "status", "available_at", "created_at"),)


class KeywordObservation(Base):
    __tablename__ = "keyword_observations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id", ondelete="CASCADE"), nullable=False)
    catalog_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("catalog_items.id", ondelete="CASCADE"), nullable=False)
    operation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_operations.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    query: Mapped[str] = mapped_column(String(512), nullable=False)
    organic_rank: Mapped[int | None] = mapped_column(Integer)
    indexed: Mapped[bool] = mapped_column(default=False, nullable=False)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("operation_id", "provider", "query"),
        Index("ix_keyword_observations_seller_item_time", "seller_id", "catalog_item_id", "observed_at"),
    )


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id", ondelete="CASCADE"), nullable=False)
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending_review")
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    total_amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    lines: Mapped[list] = mapped_column(JSONB, nullable=False)
    pdf_bytes: Mapped[bytes | None] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[str | None] = mapped_column(String(128))
    vendor: Mapped[Vendor] = relationship()

    __table_args__ = (Index("ix_purchase_orders_review_queue", "seller_id", "status", "created_at"),)


class AmazonFeed(Base):
    __tablename__ = "amazon_feeds"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    operation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_operations.id", ondelete="CASCADE"), nullable=False)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id", ondelete="CASCADE"), nullable=False)
    feed_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    feed_document_id: Mapped[str | None] = mapped_column(String(128))
    result_document_id: Mapped[str | None] = mapped_column(String(128))
    processing_status: Mapped[str] = mapped_column(String(32), nullable=False, default="SUBMITTED")
    notification_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    processing_summary: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (UniqueConstraint("operation_id"),)