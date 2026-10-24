-- 003: tables that existed in models.py but not in 001/002, plus region widening.

-- Widen sellers.region (us-east-1 does not fit in varchar(8)).
ALTER TABLE sellers ALTER COLUMN region TYPE VARCHAR(32);

CREATE TABLE IF NOT EXISTS listing_health_events (
    id UUID NOT NULL,
    seller_id UUID NOT NULL,
    notification_id VARCHAR(128) NOT NULL,
    notification_type VARCHAR(80) NOT NULL,
    asin VARCHAR(10) NOT NULL,
    sku VARCHAR(80) NOT NULL,
    marketplace_id VARCHAR(32) NOT NULL,
    listing_status VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL,
    error_codes JSONB NOT NULL,
    error_messages JSONB NOT NULL,
    is_suppressed BOOLEAN NOT NULL,
    raw_payload JSONB NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id),
    FOREIGN KEY (seller_id) REFERENCES sellers (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_listing_health_review_queue ON listing_health_events (status, received_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_listing_health_events_notification_id ON listing_health_events (notification_id);
CREATE INDEX IF NOT EXISTS ix_listing_health_item ON listing_health_events (asin, marketplace_id);
CREATE INDEX IF NOT EXISTS ix_listing_health_events_asin ON listing_health_events (asin);

CREATE TABLE IF NOT EXISTS amazon_write_outbox (
    id UUID NOT NULL,
    event_id UUID NOT NULL,
    action_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    routing_target VARCHAR(128) NOT NULL,
    status VARCHAR(24) NOT NULL,
    attempt_count INTEGER NOT NULL,
    available_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    last_error VARCHAR(160),
    PRIMARY KEY (id),
    FOREIGN KEY (event_id) REFERENCES listing_health_events (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_amazon_write_outbox_pending ON amazon_write_outbox (status, available_at, created_at);
CREATE INDEX IF NOT EXISTS ix_amazon_write_outbox_event_id ON amazon_write_outbox (event_id);

CREATE TABLE IF NOT EXISTS pending_pdf_generations (
    id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,
    vendor_id UUID,
    batch_token VARCHAR(128) NOT NULL,
    execution_strategy VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(24) NOT NULL,
    pdf_data BYTEA,
    error_details TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_pending_pdf_generations_purchase_order_id ON pending_pdf_generations (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_pending_pdf_batch_status ON pending_pdf_generations (batch_token, status);
CREATE INDEX IF NOT EXISTS ix_pending_pdf_vendor ON pending_pdf_generations (vendor_id, status);
CREATE INDEX IF NOT EXISTS ix_pending_pdf_generations_batch_token ON pending_pdf_generations (batch_token);
CREATE INDEX IF NOT EXISTS ix_pending_pdf_generations_vendor_id ON pending_pdf_generations (vendor_id);
