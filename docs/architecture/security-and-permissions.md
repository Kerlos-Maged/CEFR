# Security and Permissions

> Document: `security-and-permissions.md`
> Status: Phase 1 — approved for implementation planning
> Related: [`requirements.md`](./requirements.md), [`architecture.md`](./architecture.md), [`database-schema.md`](./database-schema.md), [`api-contracts.md`](./api-contracts.md)

---

## 1. Security Principles

1. **Defense in depth:** application checks **and** database-enforced RLS. Hiding UI is never
   sufficient (ST-1).
2. **Least privilege:** the browser holds only the anon key + user session; the service-role key
   is server-only.
3. **Deny by default:** RLS enabled on every table; access must be explicitly granted.
4. **Server-side authorization is authoritative:** the client never sends a role or church scope
   it is trusted with; scope is derived from `church_memberships`.
5. **Immutability for audit:** review and publication history are append-only.
6. **Privacy by design:** no PII, no precise location, minimal analytics.

---

## 2. Roles and Scope

| Role | Scope | Storage |
| --- | --- | --- |
| Public visitor (`anon`) | global, unauthenticated | no account |
| Content editor | per church | `church_memberships.role='editor'` |
| Historical reviewer | per church | `church_memberships.role='historical_reviewer'` |
| Church approver | per church | `church_memberships.role='church_approver'` |
| Platform administrator | global | `profiles.is_platform_admin=true` |

- A user may hold **multiple memberships** (several roles, several churches).
- Platform admin is **not** a church membership and does not automatically imply church roles.
- Public visitors can never modify anything.

---

## 3. Permission Matrix

Legend: ✅ allowed · ❌ denied · 🔶 allowed but restricted (notes) · — not applicable.

| Resource / action | Public | Editor | Hist. reviewer | Church approver | Platform admin |
| --- | --- | --- | --- | --- | --- |
| Read published object content | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read draft / in-review object | ❌ | 🔶 own church | 🔶 own church | 🔶 own church | ✅ all |
| Read claims & sources (internal) | 🔶 public claims only | 🔶 own church | 🔶 own church | 🔶 own church | ✅ |
| Create object | ❌ | 🔶 own church | ❌ | ❌ | ✅ |
| Update object fields | ❌ | 🔶 own church, `draft` only | ❌ | ❌ | ✅ |
| Delete object (hard) | ❌ | ❌ | ❌ | ❌ | 🔶 audited |
| Add/edit translations | ❌ | 🔶 own church, `draft` | ❌ | ❌ | ✅ |
| Add/edit claims & sources | ❌ | 🔶 own church, `draft` | 🔶 own church | ❌ | ✅ |
| Set claim verification | ❌ | ❌ | 🔶 own church | ❌ | ✅ |
| Upload / manage media | ❌ | 🔶 own church, `draft` | ❌ | ❌ | ✅ |
| Submit `draft → historical_review` | ❌ | 🔶 own church | ❌ | ❌ | ✅ |
| Historical decision (`historical_review`) | ❌ | ❌ | 🔶 own church | ❌ | ✅ |
| Church approval (`church_review → published`) | ❌ | ❌ | ❌ | 🔶 own church | 🔶 only with explicit audited override (Q6) |
| Unpublish `published → draft` | ❌ | ❌ | ❌ | 🔶 own church | ✅ |
| Archive `→ archived` | ❌ | ❌ | ❌ | 🔶 own church | ✅ |
| Manage churches (create/archive) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage users & memberships | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage languages | ❌ | ❌ | ❌ | ❌ | ✅ |
| Read analytics | ❌ | ❌ | ❌ | ❌ | ✅ |
| Export QR codes | ❌ | 🔶 own church | ❌ | 🔶 own church | ✅ |
| Read audit history | ❌ | 🔶 own church | 🔶 own church | 🔶 own church | ✅ |

Notes:
- "own church" always means a membership row exists for the object's `church_id`.
- Editors may edit only while the object is `draft`; review states are read-only to them.
- The church-approval publish step is deliberately exclusive; the platform admin override is
  **not implemented** in Phase 1 (see Q6) to preserve the church's authority.

---

## 4. Row Level Security Strategy

### 4.1 Helper functions (`SECURITY DEFINER`, `search_path` pinned)

```sql
-- True if the current user has the given role in the given church.
create function auth.has_church_role(p_church uuid, p_role membership_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from church_memberships m
    where m.church_id = p_church
      and m.user_id = auth.uid()
      and m.role = p_role
  );
$$;

-- True if the current user is a member of the church (any role).
create function auth.is_church_member(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from church_memberships m
    where m.church_id = p_church and m.user_id = auth.uid()
  );
$$;

create function auth.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.is_platform_admin
  );
$$;
```

These functions are `security definer` so policy evaluation is not itself blocked by RLS on
`church_memberships`; their body is minimal and audited.

### 4.2 Representative policies

**`objects`**

```sql
-- Public read: published objects in active churches only.
create policy objects_public_read on objects for select to anon
  using (
    status = 'published'
    and exists (select 1 from churches c
                where c.id = objects.church_id and c.status = 'active')
  );

-- Authenticated read: public objects plus anything in churches I belong to.
create policy objects_member_read on objects for select to authenticated
  using (
    (status = 'published'
      and exists (select 1 from churches c
                  where c.id = objects.church_id and c.status = 'active'))
    or auth.is_church_member(church_id)
    or auth.is_platform_admin()
  );

-- Editors create only in their own church, always as draft.
create policy objects_editor_insert on objects for insert to authenticated
  with check (
    auth.has_church_role(church_id, 'editor')
    and status = 'draft'
  );

-- Editors update only their own church's drafts (field editing).
create policy objects_editor_update on objects for update to authenticated
  using (auth.has_church_role(church_id, 'editor') and status = 'draft')
  with check (auth.has_church_role(church_id, 'editor') and status = 'draft');
```

Status transitions are **not** performed through `objects_update`; they go through the
`transition_object_status()` function (§4.3), so editors cannot bypass the workflow by writing
`status='published'`.

**`object_translations`, `media`, `media_translations`, `claims`, `object_sources`,
`claim_sources`** follow the same shape: public/anon read only when the parent object is
published and (for media) public; write only when the parent object is a `draft` in a church
where the user is an editor (or reviewer for claim verification).

**`profiles`**

```sql
create policy profiles_self_read on profiles for select to authenticated
  using (id = auth.uid() or auth.is_platform_admin());
create policy profiles_admin_all on profiles for all to authenticated
  using (auth.is_platform_admin()) with check (auth.is_platform_admin());
```

**`church_memberships`** — readable by the user for their own rows and by platform admins;
writable only by platform admins.

**`review_records`, `publication_history`** — `SELECT` for members of the object's church and
admins; **no** insert/update/delete policy (writes occur only inside `SECURITY DEFINER`
functions). Append-only.

**`languages`** — world-readable; writable by platform admins only.

**`analytics_events`** — no `SELECT` policy for anyone except admins via aggregate views; insert
performed with the service-role client in the analytics route handler (bypasses RLS), never by a
browser role.

### 4.3 Workflow transition function

```sql
create function public.transition_object_status(
  p_object_id uuid,
  p_to object_status,
  p_notes text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_obj objects%rowtype;
begin
  select * into v_obj from objects where id = p_object_id for update;
  if not found then raise exception 'object not found'; end if;

  -- Only the sanctioned transitions are allowed.
  if (v_obj.status, p_to) not in (
       ('draft','historical_review'),
       ('historical_review','church_review'),
       ('historical_review','draft'),
       ('church_review','published'),
       ('church_review','draft'),
       ('published','draft'),
       ('published','archived'),
       ('draft','archived')
     ) then
    raise exception 'illegal transition % -> %', v_obj.status, p_to;
  end if;

  -- Role checks per transition.
  if p_to = 'historical_review' then
    if not auth.has_church_role(v_obj.church_id,'editor') then
      raise exception 'editor role required';
    end if;
  elsif p_to in ('church_review','draft') and v_obj.status = 'historical_review' then
    if not auth.has_church_role(v_obj.church_id,'historical_reviewer') then
      raise exception 'historical reviewer role required';
    end if;
  elsif p_to = 'published' then
    if not auth.has_church_role(v_obj.church_id,'church_approver') then
      raise exception 'church approver role required';
    end if;
  elsif p_to = 'archived' or (v_obj.status='published' and p_to='draft') then
    if not (auth.has_church_role(v_obj.church_id,'church_approver')
            or auth.is_platform_admin()) then
      raise exception 'approver or admin required';
    end if;
  end if;

  update objects
     set status = p_to,
         published_at = case when p_to='published' then coalesce(published_at, now()) else published_at end,
         archived_at  = case when p_to='archived'  then now() else null end,
         updated_at   = now()
   where id = p_object_id;

  insert into publication_history(object_id, actor_id, from_status, to_status, notes)
  values (p_object_id, auth.uid(), v_obj.status, p_to, p_notes);
end;
$$;
```

Providers: `SECURITY DEFINER` plus explicit role checks guarantee FR-PB-9 (no publishing without
approval) even if the application is compromised.

> The function is granted to `authenticated` only. Direct `UPDATE objects SET status=...` is not
> permitted by any policy, so the function is the sole pathway.

---

## 5. Application-Level vs Database-Enforced Checks

| Check | Application | Database |
| --- | --- | --- |
| Route protection (`/admin/*`) | ✅ middleware + server check | — |
| Role required for action | ✅ `requireChurchRole()` | ✅ RLS + transition function |
| Church scope | ✅ derived from membership | ✅ RLS `auth.is_church_member` |
| Public sees published only | ✅ filter in DAL | ✅ RLS `objects_public_read` |
| Legal status transitions | ✅ server action guards | ✅ `transition_object_status()` |
| Media publish gate | ✅ pre-publish validation | ✅ check constraint + RLS |
| Input shape/format | ✅ zod | ✅ column types/checks |
| Service-role isolation | ✅ server-only client | — (key never in browser) |
| Audit immutability | ✅ no client endpoints | ✅ no write policies on audit tables |

Application checks provide clear UX; database checks provide the security guarantee.

---

## 6. Storage Security

Buckets:

| Bucket | Public read | Write | Purpose |
| --- | --- | --- | --- |
| `object-media` | ✅ (published media only by path convention) | service role / signed upload | Published images & audio |
| `incoming` | ❌ | signed upload (editor+) | Staging for validation before promotion |

- Uploads use **signed upload URLs** issued server-side after an editor is authorized for the
  target church; the browser uploads directly to storage (no service key in the browser).
- On finalize, the server validates MIME (magic bytes), size, and dimensions, generates variants,
  writes the `media` row, then promotes from `incoming` to `object-media`.
- Storage object names are non-guessable UUID paths; public content is CDN-cached.
- If Q2 resolves to non-public media, replace public bucket reads with signed download URLs and a
  storage RLS policy tied to object status + membership.

---

## 7. Authentication & Session Management

- Supabase Auth with **email magic link** (primary) and optional OAuth; no passwords stored by
  the app.
- Sessions are HTTP-only cookies managed by `@supabase/ssr`; refreshed in middleware.
- Admin routes require a valid session **and** a role; an authenticated user with no role sees a
  neutral "no access" page.
- Sign-out clears the session cookie.
- No public registration of privileged access: new users are invited/authorized by a platform
  admin; self-signup (if enabled) grants no roles.

---

## 8. Rate Limiting and Abuse Prevention

| Surface | Limit (proposed) | Mechanism |
| --- | --- | --- |
| `/api/analytics` ingest | e.g. 60/min per IP-derived bucket | edge/route handler token bucket; never 500 to the visitor |
| Auth magic-link requests | Supabase built-in throttling | provider |
| Media upload sign requests | e.g. 30/hour/user | server check |
| Admin mutations | generous but logged | server check |

Rate limiting for public reads is delegated to CDN/edge; public pages are cached to absorb load.

---

## 9. Audit Logging

- `publication_history` — every status transition (who, from, to, notes, when).
- `review_records` — every review decision (who, stage, decision, notes, when).
- Admin membership changes and hard deletes — logged (application log + optional
  `admin_audit_log` if needed; see roadmap Phase 7).
- Logs exclude secrets and PII.

---

## 10. Backup and Recovery

- Supabase automated daily backups; enable PITR if the plan permits (validate during pilot).
- Target **RPO ≤ 24h** (or minutes with PITR), **RTO ≤ 4h**.
- Media in storage is versioned/retained; documented restore runbook.
- Quarterly restore drill in a non-production environment (roadmap Phase 9).
- Migrations are reversible-by-roll-forward; no destructive change without a backup checkpoint.

---

## 11. Threat Model (abbreviated STRIDE)

| Threat | Example | Control |
| --- | --- | --- |
| Spoofing | Fake session | Supabase JWT, HTTP-only cookies, server verification |
| Tampering | Editor sets status=published | Only `transition_object_status()` mutates status; RLS blocks direct write |
| Repudiation | "I never approved that" | Append-only `review_records` + `publication_history` |
| Information disclosure | Draft leaks via API | RLS anon read restricted to published; DAL filters |
| Denial of service | Analytics flood | Rate limiting, non-blocking ingest, CDN caching |
| Elevation of privilege | Editor grants self admin | Only platform admins write memberships; RLS |
| Credential leakage | Service key in bundle | Server-only import, lint guard, no `NEXT_PUBLIC_` |

---

## 12. Open Questions

- **Q2** non-public media → storage RLS + signed downloads.
- **Q6** admin publish override → add explicit audited branch to the transition function if
  approved.
- **Q3** data residency may dictate Supabase region and retention specifics.

See also `architecture-decisions.md` (ADR-004, ADR-006) for the reasoning behind RLS-centric
authorization and the transition function.
