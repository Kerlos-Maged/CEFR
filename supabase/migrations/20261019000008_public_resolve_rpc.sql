-- 20261019000008_public_resolve_rpc.sql
-- Public QR id resolution (FR-QR-4/6).
--
-- The public page must distinguish "never existed" (404) from "retired/archived" (410)
-- without exposing in-progress objects. RLS hides drafts entirely from anon, so this
-- SECURITY DEFINER helper returns a row ONLY for ids that are published or archived;
-- draft / historical_review / church_review resolve to no row (a plain 404).

create function public.resolve_public_id(p_public_id text)
returns table (object_id uuid, canonical_public_id char(10), status public.object_status)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select o.id as object_id, o.public_id as canonical_public_id, o.status
      from public.objects o
     where o.public_id = p_public_id
       and o.status in ('published', 'archived')
    union all
    select o.id as object_id, o.public_id as canonical_public_id, o.status
      from public.object_aliases a
      join public.objects o on o.id = a.object_id
     where a.alias = p_public_id
       and o.status in ('published', 'archived')
  ) resolved
  limit 1;
$$;

grant execute on function public.resolve_public_id(text) to anon, authenticated;
