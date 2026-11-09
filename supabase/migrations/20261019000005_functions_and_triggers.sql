-- 20261019000005_functions_and_triggers.sql
-- Helper functions, workflow transition functions, guard trigger, updated_at triggers,
-- profile provisioning, and the translation-status view.
-- Implements docs/architecture/security-and-permissions.md §4 and database-schema.md §4.7/§6.
--
-- Design notes:
--   * Helper functions live in `public` (Supabase only ships `auth.uid()`); they are
--     SECURITY DEFINER with a pinned search_path so policy evaluation is not itself
--     blocked by RLS on church_memberships / profiles.
--   * `transition_object_status()` is the ONLY sanctioned writer of objects.status.
--     The guard trigger rejects any direct status change unless the function raised the
--     `app.allow_status_change` transaction-local flag.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger churches_set_updated_at
  before update on public.churches
  for each row execute function public.set_updated_at();

create trigger church_translations_set_updated_at
  before update on public.church_translations
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger objects_set_updated_at
  before update on public.objects
  for each row execute function public.set_updated_at();

create trigger object_translations_set_updated_at
  before update on public.object_translations
  for each row execute function public.set_updated_at();

create trigger claims_set_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.set_updated_at();

create trigger media_translations_set_updated_at
  before update on public.media_translations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile provisioning from auth.users
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
create function public.has_church_role(p_church uuid, p_role public.membership_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.church_memberships m
    where m.church_id = p_church
      and m.user_id = auth.uid()
      and m.role = p_role
  );
$$;

create function public.is_church_member(p_church uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.church_memberships m
    where m.church_id = p_church
      and m.user_id = auth.uid()
  );
$$;

create function public.is_any_church_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.church_memberships m
    where m.user_id = auth.uid()
  );
$$;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_platform_admin
  );
$$;

-- Object-scoped helpers used by RLS policies (avoid policy recursion on objects).
create function public.object_church_id(p_object_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.church_id from public.objects o where o.id = p_object_id;
$$;

create function public.is_object_published(p_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.objects o
    join public.churches c on c.id = o.church_id
    where o.id = p_object_id
      and o.status = 'published'
      and c.status = 'active'
  );
$$;

create function public.can_write_object_content(p_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.objects o
    where o.id = p_object_id
      and o.status = 'draft'
      and (
        public.has_church_role(o.church_id, 'editor')
        or public.is_platform_admin()
      )
  );
$$;

create function public.claim_object_id(p_claim_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.object_id from public.claims c where c.id = p_claim_id;
$$;

create function public.media_object_id(p_media_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.object_id from public.media m where m.id = p_media_id;
$$;

-- ---------------------------------------------------------------------------
-- Workflow transition function (sole writer of objects.status)
-- ---------------------------------------------------------------------------
create function public.transition_object_status(
  p_object_id uuid,
  p_to public.object_status,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obj public.objects%rowtype;
begin
  select * into v_obj from public.objects where id = p_object_id for update;
  if not found then
    raise exception 'object not found' using errcode = 'P0002';
  end if;

  if (v_obj.status, p_to) not in (
    ('draft', 'historical_review'),
    ('historical_review', 'church_review'),
    ('historical_review', 'draft'),
    ('church_review', 'published'),
    ('church_review', 'draft'),
    ('published', 'draft'),
    ('published', 'archived'),
    ('draft', 'archived')
  ) then
    raise exception 'illegal transition % -> %', v_obj.status, p_to using errcode = 'P0001';
  end if;

  if v_obj.status = 'draft' and p_to = 'historical_review' then
    if not (public.has_church_role(v_obj.church_id, 'editor') or public.is_platform_admin()) then
      raise exception 'editor role required' using errcode = '42501';
    end if;
  elsif v_obj.status = 'historical_review' and p_to in ('church_review', 'draft') then
    if not (public.has_church_role(v_obj.church_id, 'historical_reviewer') or public.is_platform_admin()) then
      raise exception 'historical reviewer role required' using errcode = '42501';
    end if;
  elsif v_obj.status = 'church_review' and p_to = 'published' then
    -- Publishing is exclusively the church approver's decision (no admin override; Q6).
    if not public.has_church_role(v_obj.church_id, 'church_approver') then
      raise exception 'church approver role required' using errcode = '42501';
    end if;
  elsif v_obj.status = 'church_review' and p_to = 'draft' then
    if not (public.has_church_role(v_obj.church_id, 'church_approver') or public.is_platform_admin()) then
      raise exception 'church approver role required' using errcode = '42501';
    end if;
  elsif v_obj.status = 'published' and p_to = 'draft' then
    if not (public.has_church_role(v_obj.church_id, 'church_approver') or public.is_platform_admin()) then
      raise exception 'approver or admin required' using errcode = '42501';
    end if;
  elsif v_obj.status = 'published' and p_to = 'archived' then
    if not (public.has_church_role(v_obj.church_id, 'church_approver') or public.is_platform_admin()) then
      raise exception 'approver or admin required' using errcode = '42501';
    end if;
  elsif v_obj.status = 'draft' and p_to = 'archived' then
    if not (public.has_church_role(v_obj.church_id, 'church_approver') or public.is_platform_admin()) then
      raise exception 'approver or admin required' using errcode = '42501';
    end if;
  end if;

  perform set_config('app.allow_status_change', 'true', true);

  update public.objects
     set status = p_to,
         published_at = case
           when p_to = 'published' then coalesce(published_at, now())
           when p_to = 'archived' then published_at
           else null
         end,
         archived_at = case when p_to = 'archived' then now() else null end,
         archive_reason = case when p_to = 'archived' then p_notes else null end,
         updated_at = now()
   where id = p_object_id;

  perform set_config('app.allow_status_change', 'false', true);

  insert into public.publication_history (object_id, actor_id, from_status, to_status, notes)
  values (p_object_id, auth.uid(), v_obj.status, p_to, p_notes);
end;
$$;

create function public.record_review(
  p_object_id uuid,
  p_review_type public.review_type,
  p_decision public.review_decision,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.object_status;
begin
  select status into v_status from public.objects where id = p_object_id for update;
  if not found then
    raise exception 'object not found' using errcode = 'P0002';
  end if;

  if p_review_type = 'historical_review' and v_status <> 'historical_review' then
    raise exception 'object is not awaiting historical review' using errcode = 'P0001';
  end if;
  if p_review_type = 'church_approval' and v_status <> 'church_review' then
    raise exception 'object is not awaiting church approval' using errcode = 'P0001';
  end if;
  if p_decision <> 'approved' and (p_notes is null or btrim(p_notes) = '') then
    raise exception 'notes are required when not approving' using errcode = '22023';
  end if;

  insert into public.review_records (object_id, actor_id, review_type, decision, notes)
  values (p_object_id, auth.uid(), p_review_type, p_decision, p_notes);

  if p_decision = 'approved' then
    if p_review_type = 'historical_review' then
      perform public.transition_object_status(p_object_id, 'church_review', p_notes);
    else
      perform public.transition_object_status(p_object_id, 'published', p_notes);
    end if;
  else
    perform public.transition_object_status(p_object_id, 'draft', p_notes);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Immutability guard for objects
-- ---------------------------------------------------------------------------
create function public.enforce_object_immutables()
returns trigger
language plpgsql
as $$
begin
  if new.church_id is distinct from old.church_id then
    raise exception 'objects.church_id is immutable' using errcode = '42501';
  end if;
  if new.public_id is distinct from old.public_id then
    raise exception 'objects.public_id is immutable' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and coalesce(current_setting('app.allow_status_change', true), 'false') <> 'true' then
    raise exception 'objects.status must be changed through transition_object_status()'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger objects_enforce_immutables
  before update on public.objects
  for each row execute function public.enforce_object_immutables();

-- ---------------------------------------------------------------------------
-- Translation completeness view (admin dashboard, FR-ML-7)
-- ---------------------------------------------------------------------------
create view public.object_translation_status
with (security_invoker = true)
as
select
  o.id as object_id,
  l.code as language_code,
  (t.id is not null) as has_row,
  coalesce(t.is_complete, false) as is_complete
from public.objects o
cross join public.languages l
left join public.object_translations t
  on t.object_id = o.id and t.language_code = l.code;
