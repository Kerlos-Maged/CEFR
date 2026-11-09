-- 20261019000007_seed_languages.sql
-- Registry seed for supported languages (FR-ML-2). Idempotent.

insert into public.languages (code, name, native_name, direction, is_active)
values
  ('en', 'English', 'English', 'ltr', true),
  ('ar', 'Arabic', 'العربية', 'rtl', true)
on conflict (code) do nothing;
