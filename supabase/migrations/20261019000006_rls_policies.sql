-- 20261019000006_rls_policies.sql
-- Row Level Security, grants, and policies.
-- Implements docs/architecture/security-and-permissions.md §3-4.
--
-- Roles: anon (public visitor), authenticated (signed-in staff), service_role (server-only,
-- bypasses RLS and is not granted anything here). RLS is enabled on every table; the
-- `authenticated` role is granted broad table privileges which RLS then narrows.

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------
alter table public.languages enable row level security;
alter table public.churches enable row level security;
alter table public.church_translations enable row level security;
alter table public.profiles enable row level security;
alter table public.church_memberships enable row level security;
alter table public.objects enable row level security;
alter table public.object_translations enable row level security;
alter table public.claims enable row level security;
alter table public.sources enable row level security;
alter table public.claim_sources enable row level security;
alter table public.object_sources enable row level security;
alter table public.media enable row level security;
alter table public.media_translations enable row level security;
alter table public.review_records enable row level security;
alter table public.publication_history enable row level security;
alter table public.object_aliases enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_daily enable row level security;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- Public-readable tables (RLS further restricts which rows anon may see).
grant select on
  public.languages,
  public.churches,
  public.church_translations,
  public.objects,
  public.object_translations,
  public.claims,
  public.sources,
  public.claim_sources,
  public.object_sources,
  public.media,
  public.media_translations,
  public.object_aliases
to anon;

-- Authenticated staff may attempt reads/writes on content tables; RLS is the gate.
grant select, insert, update, delete on
  public.languages,
  public.churches,
  public.church_translations,
  public.profiles,
  public.church_memberships,
  public.objects,
  public.object_translations,
  public.claims,
  public.sources,
  public.claim_sources,
  public.object_sources,
  public.media,
  public.media_translations,
  public.object_aliases
to authenticated;

-- Audit/analytics tables: read-only to authenticated; writes go through SECURITY DEFINER
-- functions or the service-role client (which bypasses RLS).
grant select on
  public.review_records,
  public.publication_history,
  public.analytics_events,
  public.analytics_daily
to authenticated;

grant select on public.object_translation_status to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- Workflow functions are callable only by authenticated users.
revoke execute on function public.transition_object_status(uuid, public.object_status, text) from public;
grant execute on function public.transition_object_status(uuid, public.object_status, text) to authenticated;
revoke execute on function public.record_review(uuid, public.review_type, public.review_decision, text) from public;
grant execute on function public.record_review(uuid, public.review_type, public.review_decision, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies: languages
-- ---------------------------------------------------------------------------
create policy languages_public_read
  on public.languages for select
  to anon, authenticated
  using (true);

create policy languages_admin_write
  on public.languages for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: churches
-- ---------------------------------------------------------------------------
create policy churches_public_read
  on public.churches for select
  to anon
  using (status = 'active');

create policy churches_member_read
  on public.churches for select
  to authenticated
  using (status = 'active' or public.is_church_member(id) or public.is_platform_admin());

create policy churches_admin_write
  on public.churches for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: church_translations
-- ---------------------------------------------------------------------------
create policy church_translations_public_read
  on public.church_translations for select
  to anon
  using (exists (
    select 1 from public.churches c
    where c.id = church_id and c.status = 'active'
  ));

create policy church_translations_member_read
  on public.church_translations for select
  to authenticated
  using (
    exists (select 1 from public.churches c where c.id = church_id and c.status = 'active')
    or public.is_church_member(church_id)
    or public.is_platform_admin()
  );

create policy church_translations_admin_write
  on public.church_translations for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: profiles
-- ---------------------------------------------------------------------------
create policy profiles_self_read
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_platform_admin());

create policy profiles_admin_write
  on public.profiles for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: church_memberships
-- ---------------------------------------------------------------------------
create policy church_memberships_self_read
  on public.church_memberships for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create policy church_memberships_admin_write
  on public.church_memberships for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: objects
-- ---------------------------------------------------------------------------
create policy objects_public_read
  on public.objects for select
  to anon
  using (
    status = 'published'
    and exists (select 1 from public.churches c where c.id = church_id and c.status = 'active')
  );

create policy objects_member_read
  on public.objects for select
  to authenticated
  using (
    (status = 'published'
      and exists (select 1 from public.churches c where c.id = church_id and c.status = 'active'))
    or public.is_church_member(church_id)
    or public.is_platform_admin()
  );

create policy objects_editor_insert
  on public.objects for insert
  to authenticated
  with check (
    status = 'draft'
    and (public.has_church_role(church_id, 'editor') or public.is_platform_admin())
  );

create policy objects_editor_update
  on public.objects for update
  to authenticated
  using (
    (public.has_church_role(church_id, 'editor') and status = 'draft')
    or public.is_platform_admin()
  )
  with check (
    (public.has_church_role(church_id, 'editor') and status = 'draft')
    or public.is_platform_admin()
  );

create policy objects_admin_delete
  on public.objects for delete
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: object_translations
-- ---------------------------------------------------------------------------
create policy object_translations_public_read
  on public.object_translations for select
  to anon
  using (public.is_object_published(object_id));

create policy object_translations_member_read
  on public.object_translations for select
  to authenticated
  using (
    public.is_object_published(object_id)
    or public.is_church_member(public.object_church_id(object_id))
    or public.is_platform_admin()
  );

create policy object_translations_write
  on public.object_translations for all
  to authenticated
  using (public.can_write_object_content(object_id))
  with check (public.can_write_object_content(object_id));

-- ---------------------------------------------------------------------------
-- Policies: claims
-- ---------------------------------------------------------------------------
create policy claims_public_read
  on public.claims for select
  to anon
  using (is_public and public.is_object_published(object_id));

create policy claims_member_read
  on public.claims for select
  to authenticated
  using (
    (is_public and public.is_object_published(object_id))
    or public.is_church_member(public.object_church_id(object_id))
    or public.is_platform_admin()
  );

create policy claims_insert
  on public.claims for insert
  to authenticated
  with check (public.can_write_object_content(object_id));

create policy claims_update
  on public.claims for update
  to authenticated
  using (
    public.can_write_object_content(object_id)
    or public.has_church_role(public.object_church_id(object_id), 'historical_reviewer')
    or public.is_platform_admin()
  )
  with check (
    public.can_write_object_content(object_id)
    or public.has_church_role(public.object_church_id(object_id), 'historical_reviewer')
    or public.is_platform_admin()
  );

create policy claims_delete
  on public.claims for delete
  to authenticated
  using (public.can_write_object_content(object_id) or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: sources (global; scoped via membership)
-- ---------------------------------------------------------------------------
create policy sources_public_read
  on public.sources for select
  to anon
  using (
    exists (
      select 1
      from public.claim_sources cs
      join public.claims c on c.id = cs.claim_id
      where cs.source_id = id
        and c.is_public
        and public.is_object_published(c.object_id)
    )
    or exists (
      select 1
      from public.object_sources os
      where os.source_id = id
        and public.is_object_published(os.object_id)
    )
  );

create policy sources_member_read
  on public.sources for select
  to authenticated
  using (true);

create policy sources_member_write
  on public.sources for all
  to authenticated
  using (public.is_any_church_member() or public.is_platform_admin())
  with check (public.is_any_church_member() or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: claim_sources
-- ---------------------------------------------------------------------------
create policy claim_sources_public_read
  on public.claim_sources for select
  to anon
  using (exists (
    select 1 from public.claims c
    where c.id = claim_id and c.is_public and public.is_object_published(c.object_id)
  ));

create policy claim_sources_member_read
  on public.claim_sources for select
  to authenticated
  using (true);

create policy claim_sources_write
  on public.claim_sources for all
  to authenticated
  using (public.can_write_object_content(public.claim_object_id(claim_id)) or public.is_platform_admin())
  with check (public.can_write_object_content(public.claim_object_id(claim_id)) or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: object_sources
-- ---------------------------------------------------------------------------
create policy object_sources_public_read
  on public.object_sources for select
  to anon
  using (public.is_object_published(object_id));

create policy object_sources_member_read
  on public.object_sources for select
  to authenticated
  using (true);

create policy object_sources_write
  on public.object_sources for all
  to authenticated
  using (public.can_write_object_content(object_id) or public.is_platform_admin())
  with check (public.can_write_object_content(object_id) or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: media
-- ---------------------------------------------------------------------------
create policy media_public_read
  on public.media for select
  to anon
  using (
    is_public
    and permission_status in ('granted', 'public_domain')
    and public.is_object_published(object_id)
  );

create policy media_member_read
  on public.media for select
  to authenticated
  using (
    (is_public
      and permission_status in ('granted', 'public_domain')
      and public.is_object_published(object_id))
    or public.is_church_member(public.object_church_id(object_id))
    or public.is_platform_admin()
  );

create policy media_write
  on public.media for all
  to authenticated
  using (public.can_write_object_content(object_id))
  with check (public.can_write_object_content(object_id));

-- ---------------------------------------------------------------------------
-- Policies: media_translations
-- ---------------------------------------------------------------------------
create policy media_translations_public_read
  on public.media_translations for select
  to anon
  using (exists (
    select 1 from public.media m
    where m.id = media_id
      and m.is_public
      and m.permission_status in ('granted', 'public_domain')
      and public.is_object_published(m.object_id)
  ));

create policy media_translations_member_read
  on public.media_translations for select
  to authenticated
  using (
    public.is_object_published(public.media_object_id(media_id))
    or public.is_church_member(public.object_church_id(public.media_object_id(media_id)))
    or public.is_platform_admin()
  );

create policy media_translations_write
  on public.media_translations for all
  to authenticated
  using (public.can_write_object_content(public.media_object_id(media_id)))
  with check (public.can_write_object_content(public.media_object_id(media_id)));

-- ---------------------------------------------------------------------------
-- Policies: review_records / publication_history (append-only, read by members/admins)
-- ---------------------------------------------------------------------------
create policy review_records_member_read
  on public.review_records for select
  to authenticated
  using (public.is_church_member(public.object_church_id(object_id)) or public.is_platform_admin());

create policy publication_history_member_read
  on public.publication_history for select
  to authenticated
  using (public.is_church_member(public.object_church_id(object_id)) or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: object_aliases (public QR redirect resolution)
-- ---------------------------------------------------------------------------
create policy object_aliases_public_read
  on public.object_aliases for select
  to anon
  using (true);

create policy object_aliases_member_read
  on public.object_aliases for select
  to authenticated
  using (true);

create policy object_aliases_admin_write
  on public.object_aliases for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Policies: analytics (admin read only; inserts via service role)
-- ---------------------------------------------------------------------------
create policy analytics_events_admin_read
  on public.analytics_events for select
  to authenticated
  using (public.is_platform_admin());

create policy analytics_daily_admin_read
  on public.analytics_daily for select
  to authenticated
  using (public.is_platform_admin());
