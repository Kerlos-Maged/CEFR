-- Daily analytics aggregation, raw-event retention, and church-scoped dashboard reads.
-- Raw events stay private; the scheduled service-role job aggregates completed days and
-- removes raw rows older than the 90-day retention window.

alter table public.analytics_events
  add column aggregated_at timestamptz;

create index analytics_events_unaggregated_idx
  on public.analytics_events (occurred_at)
  where aggregated_at is null;

create policy analytics_daily_church_member_read
  on public.analytics_daily for select
  to authenticated
  using (church_id is not null and public.is_church_member(church_id));

create function public.aggregate_and_purge_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aggregated integer := 0;
  v_purged integer := 0;
begin
  with batch as materialized (
    select id, date_trunc('day', occurred_at)::date as day,
           object_id, church_id, language_code, event_type
      from public.analytics_events
     where aggregated_at is null
       and occurred_at < date_trunc('day', now())
     for update skip locked
  ),
  grouped as (
    select day, object_id, church_id, language_code, event_type, count(*)::integer as count
      from batch
     group by day, object_id, church_id, language_code, event_type
  ),
  daily_write as (
    insert into public.analytics_daily (day, object_id, church_id, language_code, event_type, count)
    select day, object_id, church_id, language_code, event_type, count
      from grouped
    on conflict (
      day,
      (coalesce(object_id, '00000000-0000-0000-0000-000000000000'::uuid)),
      (coalesce(church_id, '00000000-0000-0000-0000-000000000000'::uuid)),
      (coalesce(language_code, '')),
      event_type
    ) do update set count = public.analytics_daily.count + excluded.count
    returning 1
  )
  update public.analytics_events as events
     set aggregated_at = now()
    from batch
   where events.id = batch.id;

  get diagnostics v_aggregated = row_count;

  delete from public.analytics_events
   where occurred_at < now() - interval '90 days';
  get diagnostics v_purged = row_count;

  return jsonb_build_object('aggregated_events', v_aggregated, 'purged_events', v_purged);
end;
$$;

revoke all on function public.aggregate_and_purge_analytics() from public, anon, authenticated;
grant execute on function public.aggregate_and_purge_analytics() to service_role;
