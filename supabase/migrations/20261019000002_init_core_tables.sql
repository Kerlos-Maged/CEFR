-- 20261019000002_init_core_tables.sql
-- Core registry tables: languages, churches, profiles, memberships, church translations.
-- Implements docs/architecture/database-schema.md §4.1-4.5 (and 4.3).
--
-- NOTE: this schema is intentionally extension-free (no citext / pg_trgm / pgcrypto).
-- gen_random_uuid() is built into PostgreSQL 13+. Slugs are stored lowercase with a
-- format check instead of citext. See docs/architecture/architecture-decisions.md (ADR-014).
-- churches.cover_media_id is declared without its FK here; the FK is added in
-- 20261019000003_init_content_tables.sql once media exists (circular dependency).

create table public.languages (
  code        text        primary key,
  name        text        not null,
  native_name text        not null,
  direction   text        not null default 'ltr',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  constraint languages_direction_check check (direction in ('ltr', 'rtl')),
  constraint languages_code_format_check check (code ~ '^[a-z]{2,8}(-[a-z0-9]{2,8})*$')
);

create table public.churches (
  id              uuid                 primary key default gen_random_uuid(),
  slug            text                 not null,
  status          public.entity_status not null default 'active',
  city            text,
  district        text,
  latitude        numeric(9, 6),
  longitude       numeric(9, 6),
  dedication_date text,
  rite            text                 default 'coptic_orthodox',
  cover_media_id  uuid,
  metadata        jsonb                not null default '{}'::jsonb,
  created_at      timestamptz          not null default now(),
  updated_at      timestamptz          not null default now(),
  constraint churches_slug_key unique (slug),
  constraint churches_slug_format_check check (slug ~ '^[a-z0-9-]{3,60}$')
);

create index churches_status_idx on public.churches (status);

create table public.profiles (
  id                uuid        primary key references auth.users (id) on delete cascade,
  display_name      text        not null,
  is_platform_admin boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index profiles_is_platform_admin_idx
  on public.profiles (is_platform_admin)
  where is_platform_admin;

create table public.church_memberships (
  id         uuid                  primary key default gen_random_uuid(),
  user_id    uuid                  not null references public.profiles (id) on delete cascade,
  church_id  uuid                  not null references public.churches (id) on delete cascade,
  role       public.membership_role not null,
  created_at timestamptz           not null default now(),
  created_by uuid                  references public.profiles (id),
  constraint church_memberships_unique unique (user_id, church_id, role)
);

create index church_memberships_user_id_idx on public.church_memberships (user_id);
create index church_memberships_church_id_idx on public.church_memberships (church_id);
create index church_memberships_church_role_idx on public.church_memberships (church_id, role);

create table public.church_translations (
  id            bigint      generated always as identity primary key,
  church_id     uuid        not null references public.churches (id) on delete cascade,
  language_code text        not null references public.languages (code),
  name          text        not null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint church_translations_unique unique (church_id, language_code)
);

create index church_translations_church_id_idx on public.church_translations (church_id);
