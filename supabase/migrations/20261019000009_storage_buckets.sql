-- 20261019000009_storage_buckets.sql
-- Storage buckets and access policies for media (security-and-permissions.md §6).
--
-- Buckets:
--   * object-media : public-read bucket served over the CDN for published media.
--   * incoming     : private staging bucket for signed editor uploads prior to validation.
--
-- The `storage` schema is provided by Supabase Storage. When it is absent (for example the
-- Docker-free PGlite test harness), this migration is a deliberate no-op so the rest of the
-- schema still applies. Path convention: <church_id>/<object_id>/<uuid>.<ext>.

do $storage$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present; skipping bucket setup (expected outside Supabase)';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    (
      'object-media',
      'object-media',
      true,
      26214400,
      array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
    ),
    (
      'incoming',
      'incoming',
      false,
      26214400,
      array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
    )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  if to_regclass('storage.objects') is null then
    return;
  end if;

  execute 'alter table storage.objects enable row level security';

  -- object-media: anyone may read published media.
  execute 'drop policy if exists "object_media_public_read" on storage.objects';
  execute $p$create policy "object_media_public_read"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'object-media')$p$;

  -- object-media: only members who may edit the owning object may write.
  execute 'drop policy if exists "object_media_member_insert" on storage.objects';
  execute $p$create policy "object_media_member_insert"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'object-media'
      and public.can_write_object_content((storage.foldername(name))[2]::uuid)
    )$p$;

  execute 'drop policy if exists "object_media_member_update" on storage.objects';
  execute $p$create policy "object_media_member_update"
    on storage.objects for update
    to authenticated
    using (
      bucket_id = 'object-media'
      and public.can_write_object_content((storage.foldername(name))[2]::uuid)
    )$p$;

  execute 'drop policy if exists "object_media_member_delete" on storage.objects';
  execute $p$create policy "object_media_member_delete"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'object-media'
      and public.can_write_object_content((storage.foldername(name))[2]::uuid)
    )$p$;

  -- incoming: private staging; each member only sees/writes their church's objects.
  execute 'drop policy if exists "incoming_member_select" on storage.objects';
  execute $p$create policy "incoming_member_select"
    on storage.objects for select
    to authenticated
    using (
      bucket_id = 'incoming'
      and public.can_write_object_content((storage.foldername(name))[2]::uuid)
    )$p$;

  execute 'drop policy if exists "incoming_member_insert" on storage.objects';
  execute $p$create policy "incoming_member_insert"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'incoming'
      and public.can_write_object_content((storage.foldername(name))[2]::uuid)
    )$p$;

  execute 'drop policy if exists "incoming_member_update" on storage.objects';
  execute $p$create policy "incoming_member_update"
    on storage.objects for update
    to authenticated
    using (
      bucket_id = 'incoming'
      and public.can_write_object_content((storage.foldername(name))[2]::uuid)
    )$p$;

  execute 'drop policy if exists "incoming_member_delete" on storage.objects';
  execute $p$create policy "incoming_member_delete"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'incoming'
      and public.can_write_object_content((storage.foldername(name))[2]::uuid)
    )$p$;
end
$storage$;
