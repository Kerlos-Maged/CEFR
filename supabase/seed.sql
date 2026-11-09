-- supabase/seed.sql
-- Local development fixtures ONLY. All content below is fictional and exists purely to
-- exercise the schema, RLS policies, and public read paths during local development and
-- integration tests. No real church, person, credential, or source is represented.
--
-- Loaded by `supabase db reset` (see [db.seed] in config.toml). Idempotent.

insert into public.churches (id, slug, status, city, district, latitude, longitude, dedication_date, rite, metadata)
values (
  '11111111-1111-1111-1111-111111111111',
  'demo-church',
  'active',
  'Cairo',
  'Demo District',
  30.044400,
  31.235700,
  'c. 19th century',
  'coptic_orthodox',
  '{"fixture": true}'::jsonb
)
on conflict (id) do nothing;

insert into public.church_translations (church_id, language_code, name, description)
values
  ('11111111-1111-1111-1111-111111111111', 'en', 'Demo Church', 'A fictional church used for local development.'),
  ('11111111-1111-1111-1111-111111111111', 'ar', 'كنيسة تجريبية', 'كنيسة وهمية للاستخدام في التطوير المحلي.')
on conflict (church_id, language_code) do nothing;

insert into public.objects (
  id, church_id, public_id, object_type, approximate_date, location_in_church,
  default_language, status, published_at, archived_at, archive_reason
)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'AB12CD34EF',
    'icon',
    '18th century',
    'north wall, nave',
    'en',
    'published',
    now() - interval '30 days',
    null,
    null
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'GH56JK78MN',
    'wall_painting',
    'unknown',
    null,
    'en',
    'draft',
    null,
    null,
    null
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'PQ90RS12TV',
    'inscription',
    '14th century',
    'south aisle',
    'en',
    'historical_review',
    null,
    null,
    null
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'WX34YZ56AB',
    'iconostasis',
    '19th century',
    'sanctuary',
    'en',
    'church_review',
    null,
    null,
    null
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000005',
    '11111111-1111-1111-1111-111111111111',
    'CD78EF90GH',
    'manuscript',
    'c. 1700',
    null,
    'en',
    'archived',
    now() - interval '400 days',
    now() - interval '10 days',
    'Demo fixture archived to exercise the archive path.'
  )
on conflict (id) do nothing;

insert into public.object_translations (object_id, language_code, title, description, is_complete)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    'en',
    'Demo Icon of the Theotokos',
    'A fictional icon used to exercise public read paths.',
    true
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    'ar',
    'أيقونة تجريبية للوالدة الإله',
    'أيقونة وهمية لاختبار مسارات القراءة العامة.',
    true
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    'en',
    'Unpublished wall painting',
    'Draft content that must never be publicly visible.',
    false
  )
on conflict (object_id, language_code) do nothing;

insert into public.media (
  id, object_id, media_type, storage_path, bucket, mime_type, size_bytes,
  width, height, permission_status, is_public, attribution, sort_order
)
values (
  '22222222-2222-4222-8222-222222222222',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'image',
  'demo/icon-theotokos.jpg',
  'object-media',
  'image/jpeg',
  204800,
  1200,
  1600,
  'granted',
  true,
  'Demo fixture image',
  0
)
on conflict (id) do nothing;

insert into public.media_translations (media_id, language_code, caption, alt_text)
values
  (
    '22222222-2222-4222-8222-222222222222',
    'en',
    'Demo icon',
    'Fictional icon of the Theotokos used for local development.'
  )
on conflict (media_id, language_code) do nothing;

insert into public.claims (id, object_id, claim_text, claimed_value, verification, is_public, sort_order)
values (
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'The demo icon is dated to the 18th century.',
  '18th century',
  'verified',
  true,
  0
)
on conflict (id) do nothing;

insert into public.sources (id, title, author, year, citation, source_type)
values (
  '44444444-4444-4444-8444-444444444444',
  'Fictional Catalogue of Coptic Art',
  'A. Placeholder',
  '1999',
  'Placeholder, Fictional Catalogue of Coptic Art (1999), p. 1.',
  'book'
)
on conflict (id) do nothing;

insert into public.claim_sources (claim_id, source_id, note)
values (
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  'Demonstration citation for local development.'
)
on conflict (claim_id, source_id) do nothing;

insert into public.object_aliases (alias, object_id)
values ('ZZ99YY88XX', 'aaaaaaaa-0000-4000-8000-000000000001')
on conflict (alias) do nothing;

-- Local editor and administrator logins. Request a magic link on /en/login, then open
-- http://127.0.0.1:54324 to retrieve it from Supabase's local Inbucket mail catcher.
-- Never use this seed against a hosted or production Supabase project.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555501',
    'authenticated', 'authenticated', 'editor@example.com', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Editor"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555502',
    'authenticated', 'authenticated', 'reviewer@example.com', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Historical Reviewer"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555503',
    'authenticated', 'authenticated', 'approver@example.com', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Church Approver"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-4555-8555-555555555504',
    'authenticated', 'authenticated', 'admin@example.com', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Demo Platform Admin"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email',
  null,
  now(),
  now()
from auth.users
where email in ('editor@example.com', 'reviewer@example.com', 'approver@example.com', 'admin@example.com')
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, display_name, is_platform_admin)
values
  ('55555555-5555-4555-8555-555555555501', 'Demo Editor', false),
  ('55555555-5555-4555-8555-555555555502', 'Demo Historical Reviewer', false),
  ('55555555-5555-4555-8555-555555555503', 'Demo Church Approver', false),
  ('55555555-5555-4555-8555-555555555504', 'Demo Platform Admin', true)
on conflict (id) do update
set display_name = excluded.display_name,
    is_platform_admin = excluded.is_platform_admin;

insert into public.church_memberships (user_id, church_id, role)
values
  ('55555555-5555-4555-8555-555555555501', '11111111-1111-1111-1111-111111111111', 'editor'),
  ('55555555-5555-4555-8555-555555555502', '11111111-1111-1111-1111-111111111111', 'historical_reviewer'),
  ('55555555-5555-4555-8555-555555555503', '11111111-1111-1111-1111-111111111111', 'church_approver')
on conflict (user_id, church_id, role) do nothing;
