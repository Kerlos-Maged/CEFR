-- 20261019000001_init_enums.sql
-- Enum types for the Coptic Heritage Digital Platform.
-- Implements docs/architecture/database-schema.md §3.

create type public.object_status as enum (
  'draft',
  'historical_review',
  'church_review',
  'published',
  'archived'
);

create type public.entity_status as enum (
  'active',
  'archived'
);

create type public.media_type as enum (
  'image',
  'audio'
);

create type public.permission_status as enum (
  'granted',
  'public_domain',
  'pending',
  'restricted'
);

create type public.verification_status as enum (
  'verified',
  'uncertain',
  'disputed'
);

create type public.membership_role as enum (
  'editor',
  'historical_reviewer',
  'church_approver'
);

create type public.review_type as enum (
  'historical_review',
  'church_approval'
);

create type public.review_decision as enum (
  'approved',
  'rejected',
  'changes_requested'
);

create type public.analytics_event_type as enum (
  'page_view',
  'language_select',
  'audio_play',
  'audio_complete'
);
