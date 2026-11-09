-- Relationships let a church build a connected catalogue: icons from the same set,
-- shared subjects, artists/workshops, locations, and historical contexts.

alter table public.objects
  add constraint objects_id_church_id_key unique (id, church_id);

create table public.object_relations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  object_id uuid not null,
  related_object_id uuid not null,
  relationship_type text not null,
  description text,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint object_relations_object_church_fkey
    foreign key (object_id, church_id) references public.objects(id, church_id) on delete cascade,
  constraint object_relations_related_church_fkey
    foreign key (related_object_id, church_id) references public.objects(id, church_id) on delete cascade,
  constraint object_relations_distinct_objects_check check (object_id <> related_object_id),
  constraint object_relations_type_check check (relationship_type in (
    'same_subject', 'same_artist', 'same_workshop', 'part_of_set',
    'same_location', 'historical_context', 'inspired_by', 'related'
  )),
  constraint object_relations_unique unique (object_id, related_object_id, relationship_type)
);

create index object_relations_object_sort_idx on public.object_relations (object_id, sort_order);
create index object_relations_related_idx on public.object_relations (related_object_id);
create index object_relations_church_idx on public.object_relations (church_id);

create trigger object_relations_set_updated_at
  before update on public.object_relations
  for each row execute function public.set_updated_at();

alter table public.object_relations enable row level security;
grant select on public.object_relations to anon;
grant select, insert, update, delete on public.object_relations to authenticated;

create policy object_relations_public_read
  on public.object_relations for select to anon
  using (
    is_public
    and public.is_object_published(object_id)
    and public.is_object_published(related_object_id)
  );

create policy object_relations_member_read
  on public.object_relations for select to authenticated
  using (
    public.is_church_member(church_id)
    or public.is_platform_admin()
    or (is_public and public.is_object_published(object_id) and public.is_object_published(related_object_id))
  );

create policy object_relations_editor_insert
  on public.object_relations for insert to authenticated
  with check (
    public.can_write_object_content(object_id)
    and church_id = public.object_church_id(object_id)
    and church_id = public.object_church_id(related_object_id)
  );

create policy object_relations_editor_update
  on public.object_relations for update to authenticated
  using (public.can_write_object_content(object_id) or public.is_platform_admin())
  with check (
    (public.can_write_object_content(object_id) or public.is_platform_admin())
    and church_id = public.object_church_id(object_id)
    and church_id = public.object_church_id(related_object_id)
  );

create policy object_relations_editor_delete
  on public.object_relations for delete to authenticated
  using (public.can_write_object_content(object_id) or public.is_platform_admin());
