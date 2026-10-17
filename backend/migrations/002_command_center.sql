-- AmzSphere Command Center: Multi-Channel E-Commerce Schema
-- PostgreSQL DDL

CREATE TABLE IF NOT EXISTS global_products (
    id              BIGSERIAL PRIMARY KEY,
    sku             VARCHAR(128) UNIQUE NOT NULL,
    base_title      TEXT NOT NULL,
    baseline_description TEXT,
    optimization_status VARCHAR(32) NOT NULL DEFAULT 'Needs SEO Boost',
    total_unified_stock INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
    id              BIGSERIAL PRIMARY KEY,
    global_product_id BIGINT NOT NULL REFERENCES global_products(id) ON DELETE CASCADE,
    platform        VARCHAR(32) NOT NULL,        -- amazon | shopify | ebay
    platform_sku    VARCHAR(128),                -- ASIN / Product ID / Item ID
    sync_state      VARCHAR(32) NOT NULL DEFAULT 'Syncing',  -- In Sync | Syncing | Error
    title           TEXT,
    price           NUMERIC(12,2),
    inventory       INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_shipments (
    id              BIGSERIAL PRIMARY KEY,
    order_id        VARCHAR(128) NOT NULL,
    platform_origin VARCHAR(32) NOT NULL,
    tracking_number VARCHAR(128) NOT NULL,
    carrier         VARCHAR(64) NOT NULL,        -- UPS | FedEx | DHL | Amazon Logistics
    status          VARCHAR(32) NOT NULL,        -- Label Created | In Transit | Out for Delivery | Delivered | Exception/Delayed
    estimated_delivery TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_global ON marketplace_listings(global_product_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON order_shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON order_shipments(carrier);
