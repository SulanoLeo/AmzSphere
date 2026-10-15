create table if not exists public.amzsphere_state (
    id text primary key check (id = 'primary'),
    state jsonb not null,
    version bigint not null default 0 check (version >= 0),
    updated_at timestamptz not null default now()
);

alter table public.amzsphere_state enable row level security;

revoke all on table public.amzsphere_state from anon, authenticated;
grant all privileges on table public.amzsphere_state to service_role;