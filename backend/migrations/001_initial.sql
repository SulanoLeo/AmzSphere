create table if not exists sellers (
    id uuid primary key default gen_random_uuid(),
    tenant_id varchar(128) not null,
    merchant_id varchar(64) not null,
    marketplace_id varchar(32) not null,
    region varchar(8) not null,
    endpoint varchar(255) not null,
    lwa_refresh_token_encrypted text not null,
    created_at timestamptz not null default now(),
    unique (tenant_id, merchant_id, marketplace_id)
);

create table if not exists catalog_items (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references sellers(id) on delete cascade,
    asin varchar(10) not null,
    sku varchar(80) not null,
    product_type varchar(100) not null,
    listing_attributes jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (seller_id, sku)
);
create index if not exists ix_catalog_items_seller_asin on catalog_items(seller_id, asin);

create table if not exists sales_daily (
    id bigserial primary key,
    catalog_item_id uuid not null references catalog_items(id) on delete cascade,
    sales_date date not null,
    units_ordered integer not null check (units_ordered >= 0),
    source varchar(32) not null default 'sp_api',
    unique (catalog_item_id, sales_date, source)
);

create table if not exists inventory_snapshots (
    id bigserial primary key,
    catalog_item_id uuid not null references catalog_items(id) on delete cascade,
    captured_at timestamptz not null default now(),
    sellable_quantity integer not null check (sellable_quantity >= 0),
    reserved_quantity integer not null default 0 check (reserved_quantity >= 0)
);
create index if not exists ix_inventory_snapshots_item_time on inventory_snapshots(catalog_item_id, captured_at desc);

create table if not exists vendors (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references sellers(id) on delete cascade,
    vendor_code varchar(80) not null,
    name varchar(255) not null,
    email varchar(255),
    currency char(3) not null default 'USD',
    address jsonb not null default '{}'::jsonb,
    po_spec jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique (seller_id, vendor_code)
);
alter table catalog_items add column if not exists vendor_id uuid references vendors(id);
create index if not exists ix_catalog_items_vendor on catalog_items(vendor_id);

create table if not exists agent_operations (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references sellers(id) on delete cascade,
    operation_type varchar(64) not null,
    status varchar(32) not null default 'queued',
    asin varchar(10),
    request_payload jsonb not null default '{}'::jsonb,
    result_payload jsonb,
    idempotency_key varchar(128) not null,
    attempt_count integer not null default 0 check (attempt_count >= 0),
    error_code varchar(80),
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (seller_id, idempotency_key)
);
create index if not exists ix_agent_operations_status_created on agent_operations(status, created_at);

create table if not exists outbox_events (
    id uuid primary key default gen_random_uuid(),
    event_type varchar(160) not null,
    payload jsonb not null,
    status varchar(24) not null default 'pending',
    attempt_count integer not null default 0,
    available_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    published_at timestamptz,
    last_error varchar(160)
);
create index if not exists ix_outbox_pending on outbox_events(status, available_at, created_at);

create table if not exists keyword_observations (
    id bigserial primary key,
    seller_id uuid not null references sellers(id) on delete cascade,
    catalog_item_id uuid not null references catalog_items(id) on delete cascade,
    operation_id uuid not null references agent_operations(id) on delete cascade,
    provider varchar(64) not null,
    query varchar(512) not null,
    organic_rank integer,
    indexed boolean not null default false,
    observed_at timestamptz not null default now(),
    unique (operation_id, provider, query)
);
create index if not exists ix_keyword_observations_seller_item_time on keyword_observations(seller_id, catalog_item_id, observed_at desc);

create table if not exists purchase_orders (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references sellers(id) on delete cascade,
    vendor_id uuid not null references vendors(id),
    status varchar(32) not null default 'pending_review',
    currency char(3) not null,
    total_amount_minor bigint not null check (total_amount_minor >= 0),
    lines jsonb not null,
    pdf_bytes bytea,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by varchar(128)
);
create index if not exists ix_purchase_orders_review_queue on purchase_orders(seller_id, status, created_at);

create table if not exists amazon_feeds (
    id uuid primary key default gen_random_uuid(),
    operation_id uuid not null unique references agent_operations(id) on delete cascade,
    seller_id uuid not null references sellers(id) on delete cascade,
    feed_id varchar(128) unique,
    feed_document_id varchar(128),
    result_document_id varchar(128),
    processing_status varchar(32) not null default 'SUBMITTED',
    notification_id varchar(128) unique,
    processing_summary jsonb,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);