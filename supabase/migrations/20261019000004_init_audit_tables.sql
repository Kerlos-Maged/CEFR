-- 20261019000004_init_audit_tables.sql
-- Append-only audit/history tables plus analytics and QR alias tables.
-- Implements docs/architecture/database-schema.md §4.14-4.18.

create table public.review_records (
  id          bigint                 generated always as identity primary key,
  object_id   uuid                   not null references public.objects (id) on delete cascade,
  actor_id    uuid                   not null references public.profiles (id) on delete restrict,
  review_type public.review_type     not null,
  decision    public.review_decision not null,
  notes       text,
  created_at  timestamptz            not null default now()
);

create index review_records_object_id_idx on public.review_records (object_id);
create index review_records_object_created_idx on public.review_records (object_id, created_at desc);

create table public.publication_history (
  id          bigint               generated always as identity primary key,
  object_id   uuid                 not null references public.objects (id) on delete cascade,
  actor_id    uuid                 references public.profiles (id),
  from_status public.object_status,
  to_status   public.object_status not null,
  notes       text,
  created_at  timestamptz          not null default now()
);

create index publication_history_object_id_idx on public.publication_history (object_id);
create index publication_history_object_created_idx
  on public.publication_history (object_id, created_at desc);
create index publication_history_created_idx on public.publication_history (created_at);

create table public.object_aliases (
  alias      char(10)    primary key,
  object_id  uuid        not null references public.objects (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint object_aliases_alias_format_check check (alias ~ '^[0-9A-HJKMNP-TV-Z]{10}$')
);

create index object_aliases_object_id_idx on public.object_aliases (object_id);

create table public.analytics_events (
  id            bigint                   generated always as identity primary key,
  event_type    public.analytics_event_type not null,
  object_id     uuid                     references public.objects (id) on delete set null,
  church_id     uuid                     references public.churches (id) on delete set null,
  language_code text                     references public.languages (code),
  session_hash  text,
  referrer_type text,
  occurred_at   timestamptz              not null default now(),
  constraint analytics_events_referrer_check check (
    referrer_type is null
    or referrer_type in ('qr', 'direct', 'internal', 'external')
  )
);

create index analytics_events_occurred_idx on public.analytics_events (occurred_at);
create index analytics_events_object_occurred_idx
  on public.analytics_events (object_id, occurred_at);
create index analytics_events_church_occurred_idx
  on public.analytics_events (church_id, occurred_at);

-- Daily rollup. Deliberately has no FKs so aggregates survive object/church deletion.
-- Nullable dimension columns are made unique via coalesce expressions.
create table public.analytics_daily (
  day           date                       not null,
  object_id     uuid,
  church_id     uuid,
  language_code text,
  event_type    public.analytics_event_type not null,
  count         integer                    not null default 0,
  constraint analytics_daily_count_check check (count >= 0)
);

create unique index analytics_daily_pk on public.analytics_daily (
  day,
  coalesce(object_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(church_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(language_code, ''),
  event_type
);
