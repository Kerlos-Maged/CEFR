-- The platform default language is data, while the currently shipped UI supports en/ar.

alter table public.languages
  add column is_default boolean not null default false;

update public.languages set is_default = (code = 'en');

create unique index languages_single_default_idx
  on public.languages (is_default)
  where is_default;

create function public.set_platform_default_language(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform administrator role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.languages where code = p_code and is_active) then
    raise exception 'language is missing or inactive' using errcode = '22023';
  end if;

  update public.languages set is_default = false where is_default;
  update public.languages set is_default = true where code = p_code;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'platform_default_language_changed', 'language', p_code, jsonb_build_object('code', p_code));
end;
$$;

revoke all on function public.set_platform_default_language(text) from public, anon;
grant execute on function public.set_platform_default_language(text) to authenticated;
