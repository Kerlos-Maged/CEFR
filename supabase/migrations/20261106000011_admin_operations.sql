-- Administration history and atomic church archival.

create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity_type, entity_id, created_at desc);

alter table public.admin_audit_log enable row level security;
grant select, insert on public.admin_audit_log to authenticated;

create policy admin_audit_log_admin_read
  on public.admin_audit_log for select
  to authenticated
  using (public.is_platform_admin());

create policy admin_audit_log_admin_insert
  on public.admin_audit_log for insert
  to authenticated
  with check (public.is_platform_admin() and actor_id = auth.uid());

-- Church records are archived rather than hard-deleted so published identifiers and audit history
-- remain resolvable. Replace the broad Phase 3 policy, which also allowed hard deletes.
drop policy if exists churches_admin_write on public.churches;
create policy churches_admin_insert
  on public.churches for insert
  to authenticated
  with check (public.is_platform_admin());
create policy churches_admin_update
  on public.churches for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create function public.audit_admin_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_entity_id text;
  v_details jsonb;
begin
  if tg_table_name = 'church_memberships' then
    v_entity_id := coalesce(new.id, old.id)::text;
    if tg_op = 'INSERT' then
      v_action := 'membership_granted';
      v_details := jsonb_build_object('user_id', new.user_id, 'church_id', new.church_id, 'role', new.role);
    else
      v_action := 'membership_revoked';
      v_details := jsonb_build_object('user_id', old.user_id, 'church_id', old.church_id, 'role', old.role);
    end if;
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), v_action, 'membership', v_entity_id, coalesce(v_details, '{}'::jsonb));
  elsif tg_table_name = 'profiles' then
    if new.is_platform_admin is distinct from old.is_platform_admin then
      insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
      values (
        auth.uid(),
        case when new.is_platform_admin then 'platform_admin_granted' else 'platform_admin_revoked' end,
        'user',
        new.id::text,
        jsonb_build_object('is_platform_admin', new.is_platform_admin)
      );
    end if;
  elsif tg_table_name = 'churches' then
    v_entity_id := coalesce(new.id, old.id)::text;
    if tg_op = 'INSERT' then
      v_action := 'church_created';
      v_details := jsonb_build_object('slug', new.slug, 'status', new.status);
    elsif new.status is distinct from old.status and new.status = 'archived' then
      v_action := 'church_archived';
      v_details := jsonb_build_object('slug', new.slug, 'status', new.status);
    else
      v_action := 'church_updated';
      v_details := jsonb_build_object('slug', new.slug, 'status', new.status);
    end if;
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), v_action, 'church', v_entity_id, coalesce(v_details, '{}'::jsonb));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger church_memberships_audit
  after insert or delete on public.church_memberships
  for each row execute function public.audit_admin_mutation();
create trigger profiles_admin_flag_audit
  after update of is_platform_admin on public.profiles
  for each row execute function public.audit_admin_mutation();
create trigger churches_admin_audit
  after insert or update on public.churches
  for each row execute function public.audit_admin_mutation();

create function public.archive_church(p_church_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_status public.entity_status;
  v_object record;
  v_notes text := nullif(btrim(p_notes), '');
begin
  if not public.is_platform_admin() then
    raise exception 'platform administrator role required' using errcode = '42501';
  end if;
  if v_notes is null then
    raise exception 'archive notes are required' using errcode = '22023';
  end if;

  select status into v_church_status
    from public.churches
   where id = p_church_id
   for update;
  if not found then
    raise exception 'church not found' using errcode = 'P0002';
  end if;
  if v_church_status = 'archived' then return; end if;

  for v_object in
    select id, status from public.objects
     where church_id = p_church_id and status <> 'archived'
     order by id
  loop
    if v_object.status in ('historical_review', 'church_review') then
      perform public.transition_object_status(v_object.id, 'draft', v_notes);
      v_object.status := 'draft';
    end if;
    if v_object.status in ('published', 'draft') then
      perform public.transition_object_status(v_object.id, 'archived', v_notes);
    end if;
  end loop;

  update public.churches set status = 'archived', updated_at = now() where id = p_church_id;
end;
$$;

revoke all on function public.archive_church(uuid, text) from public, anon;
grant execute on function public.archive_church(uuid, text) to authenticated;
