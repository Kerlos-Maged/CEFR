-- 20261019000003_init_content_tables.sql
-- Heritage content: objects, translations, claims, sources, joins, media.
-- Implements docs/architecture/database-schema.md §4.6-4.13.

create table public.objects (
  id                 uuid                primary key default gen_random_uuid(),
  church_id          uuid                not null references public.churches (id) on delete restrict,
  public_id          char(10)            not null,
  object_type        text                not null,
  approximate_date   text,
  location_in_church text,
  default_language   text                not null default 'en' references public.languages (code),
  status             public.object_status not null default 'draft',
  materials          text,
  dimensions         text,
  condition_notes    text,
  published_at       timestamptz,
  archived_at        timestamptz,
  archive_reason     text,
  created_by         uuid                references public.profiles (id),
  created_at         timestamptz         not null default now(),
  updated_at         timestamptz         not null default now(),
  constraint objects_public_id_key unique (public_id),
  constraint objects_public_id_format_check check (public_id ~ '^[0-9A-HJKMNP-TV-Z]{10}$'),
  constraint objects_object_type_check check (
    object_type in (
      'icon',
      'wall_painting',
      'fresco',
      'architectural_feature',
      'wood_carving',
      'iconostasis',
      'inscription',
      'manuscript',
      'liturgical_object',
      'other'
    )
  ),
  constraint objects_published_at_status_check check (
    published_at is null or status in ('published', 'archived')
  ),
  constraint objects_archived_at_status_check check (
    archived_at is null or status = 'archived'
  )
);

create index objects_church_id_idx on public.objects (church_id);
create index objects_status_idx on public.objects (status);
create index objects_status_church_idx on public.objects (status, church_id);

create table public.object_translations (
  id            bigint      generated always as identity primary key,
  object_id     uuid        not null references public.objects (id) on delete cascade,
  language_code text        not null references public.languages (code),
  title         text        not null,
  description   text,
  is_complete   boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint object_translations_unique unique (object_id, language_code)
);

create index object_translations_object_id_idx on public.object_translations (object_id);

create table public.claims (
  id           uuid                     primary key default gen_random_uuid(),
  object_id    uuid                     not null references public.objects (id) on delete cascade,
  claim_text   text                     not null,
  claimed_value text,
  verification public.verification_status not null default 'uncertain',
  is_public    boolean                  not null default true,
  sort_order   integer                  not null default 0,
  created_by   uuid                     references public.profiles (id),
  created_at   timestamptz              not null default now(),
  updated_at   timestamptz              not null default now()
);

create index claims_object_id_idx on public.claims (object_id);
create index claims_object_public_idx on public.claims (object_id, is_public);

create table public.sources (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  author      text,
  year        text,
  citation    text,
  url         text,
  source_type text,
  created_by  uuid        references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint sources_source_type_check check (
    source_type is null
    or source_type in ('book', 'article', 'archive', 'oral', 'web', 'other')
  )
);

create table public.claim_sources (
  claim_id   uuid        not null references public.claims (id) on delete cascade,
  source_id  uuid        not null references public.sources (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  primary key (claim_id, source_id)
);

create index claim_sources_source_id_idx on public.claim_sources (source_id);

create table public.object_sources (
  object_id  uuid        not null references public.objects (id) on delete cascade,
  source_id  uuid        not null references public.sources (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  primary key (object_id, source_id)
);

create index object_sources_source_id_idx on public.object_sources (source_id);

create table public.media (
  id                uuid                    primary key default gen_random_uuid(),
  object_id         uuid                    not null references public.objects (id) on delete cascade,
  media_type        public.media_type       not null,
  storage_path      text                    not null,
  bucket            text                    not null default 'object-media',
  mime_type         text                    not null,
  size_bytes        bigint                  not null,
  width             integer,
  height            integer,
  duration_seconds  numeric(7, 2),
  checksum          text,
  copyright_holder  text,
  attribution       text,
  permission_status public.permission_status not null default 'pending',
  is_public         boolean                 not null default false,
  sort_order        integer                 not null default 0,
  created_by        uuid                    references public.profiles (id),
  created_at        timestamptz             not null default now(),
  updated_at        timestamptz             not null default now(),
  constraint media_size_bytes_check check (size_bytes >= 0),
  constraint media_publish_gate_check check (
    not is_public or permission_status in ('granted', 'public_domain')
  )
);

create index media_object_id_idx on public.media (object_id);
create index media_object_sort_idx on public.media (object_id, sort_order);
create index media_permission_status_idx on public.media (permission_status);

create table public.media_translations (
  id            bigint      generated always as identity primary key,
  media_id      uuid        not null references public.media (id) on delete cascade,
  language_code text        not null references public.languages (code),
  caption       text,
  alt_text      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint media_translations_unique unique (media_id, language_code)
);

create index media_translations_media_id_idx on public.media_translations (media_id);

-- Deferred FK for the church cover image (media is created above).
alter table public.churches
  add constraint churches_cover_media_id_fkey
  foreign key (cover_media_id) references public.media (id) on delete set null;
