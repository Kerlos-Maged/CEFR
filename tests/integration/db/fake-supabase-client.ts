import type { PGlite } from "@electric-sql/pglite";

/**
 * A deliberately tiny, PostgREST-shaped adapter over PGlite that implements **only** the query
 * chains the public data-access layer (`lib/db/objects.ts`, `lib/admin/data.ts`) actually uses:
 *
 *   client.from(table).select(cols).eq(col, val)[.eq(col, val)].maybeSingle() / .single() / await
 *   client.rpc(fn, args)                     // -> { data: row[], error }
 *
 * It exists so the real DAL functions can be executed end-to-end against the real migrations in
 * tests, without Docker or a hosted Supabase project. It is **not** a general PostgREST emulator:
 * anything beyond the supported syntax throws, so a test can never silently pass against a
 * mis-modelled client.
 *
 * Embeds (`media ( id, mime_type )`) are translated to correlated `jsonb_agg` sub-selects using the
 * foreign-key relationships declared in the migrations, matching how PostgREST returns related rows.
 */

export interface FakeSupabaseError {
  message: string;
  code?: string;
}

export interface FakeQueryResult {
  data: unknown;
  error: FakeSupabaseError | null;
}

interface SelectNode {
  name: string;
  children: SelectNode[];
}

/** Relationship map keyed by child alias: parentTable.childAlias -> { table, fk } (FK on child). */
const RELATIONSHIPS: Record<string, { table: string; fk: string }> = {
  object_translations: { table: "object_translations", fk: "object_id" },
  media: { table: "media", fk: "object_id" },
  claims: { table: "claims", fk: "object_id" },
  publication_history: { table: "publication_history", fk: "object_id" },
  review_records: { table: "review_records", fk: "object_id" },
  object_sources: { table: "object_sources", fk: "object_id" },
  media_translations: { table: "media_translations", fk: "media_id" },
  claim_sources: { table: "claim_sources", fk: "claim_id" },
  sources: { table: "sources", fk: "id" },
  church_translations: { table: "church_translations", fk: "church_id" },
  church_memberships: { table: "church_memberships", fk: "user_id" },
};

/**
 * Tokenizes the subset of PostgREST select syntax used by the DAL. Whitespace/newlines are
 * collapsed; a name followed by `(` starts a nested embed; commas separate siblings.
 */
export function parseSelect(select: string): SelectNode[] {
  const src = select.replace(/\s+/g, " ").trim();
  let idx = 0;

  function readList(): SelectNode[] {
    const list: SelectNode[] = [];
    let current = "";
    while (idx < src.length) {
      const ch = src[idx];
      if (ch === "(") {
        idx += 1;
        const name = current.trim();
        const children = readList();
        list.push({ name, children });
        current = "";
        continue;
      }
      if (ch === ")") {
        idx += 1;
        if (current.trim()) list.push({ name: current.trim(), children: [] });
        return list;
      }
      if (ch === ",") {
        if (current.trim()) list.push({ name: current.trim(), children: [] });
        current = "";
        idx += 1;
        continue;
      }
      current += ch;
      idx += 1;
    }
    if (current.trim()) list.push({ name: current.trim(), children: [] });
    return list;
  }

  return readList();
}

interface QueryState {
  table: string;
  select: string | null;
}

class FakeQuery implements PromiseLike<FakeQueryResult> {
  private readonly state: QueryState;
  private readonly filters: [string, unknown][] = [];
  private readonly disjunctions: [string, unknown][] = [];
  private head = false;

  constructor(
    private readonly db: PGlite,
    table: string,
  ) {
    this.state = { table, select: null };
  }

  select(columns: string, options?: { count?: string; head?: boolean }): this {
    this.state.select = columns;
    if (options?.head) this.head = true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  or(expression: string): this {
    const parts = expression.split(",");
    if (parts.length < 2) throw new Error("Unsupported .or() expression.");
    for (const part of parts) {
      const match = /^([a-z_]+)\.eq\.([0-9a-f-]{36})$/i.exec(part);
      if (!match) throw new Error(`Unsupported .or() predicate: ${part}`);
      this.disjunctions.push([match[1], match[2]]);
    }
    return this;
  }

  order(): this {
    // The DAL sorts in memory where ordering matters; not modelled here.
    return this;
  }

  async maybeSingle(): Promise<FakeQueryResult> {
    const result = await this.execute();
    if (result.error) return result;
    const rows = result.data as unknown[];
    if (rows.length > 1) return { data: null, error: { message: "more than one row returned" } };
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<FakeQueryResult> {
    const result = await this.execute();
    if (result.error) return result;
    const rows = result.data as unknown[];
    return rows.length === 1
      ? { data: rows[0], error: null }
      : { data: null, error: { message: "expected exactly one row" } };
  }

  then<TResult1 = FakeQueryResult, TResult2 = never>(
    onfulfilled?: ((value: FakeQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<FakeQueryResult> {
    try {
      const columns = this.columnSql();
      const where = this.whereSql();
      const sql = `select ${columns} from public.${this.state.table}${where}`;
      const result = await this.db.query<Record<string, unknown>>(sql, this.paramValues());
      return { data: result.rows, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  }

  private paramValues(): unknown[] {
    return [...this.filters, ...this.disjunctions].map(([, value]) => value);
  }

  private whereSql(): string {
    if (this.filters.length === 0 && this.disjunctions.length === 0) return "";
    const clauses = this.filters.map(([col], index) => `"${col}" = $${index + 1}`);
    if (this.disjunctions.length > 0) {
      const start = this.filters.length;
      clauses.push(
        `(${this.disjunctions
          .map(([col], index) => `"${col}" = $${start + index + 1}`)
          .join(" or ")})`,
      );
    }
    return ` where ${clauses.join(" and ")}`;
  }

  private columnSql(): string {
    if (!this.state.select) return "*";
    if (this.head) return "count(*)::int as count";
    const nodes = parseSelect(this.state.select);
    const parts: string[] = [];
    for (const node of nodes) {
      if (node.children.length === 0) {
        parts.push(`"${node.name}"`);
        continue;
      }
      if (node.name === "churches" && this.state.table === "objects") {
        const translations = node.children.find((child) => child.name === "church_translations");
        const translationPairs = (translations?.children ?? [])
          .filter((child) => child.children.length === 0)
          .map((child) => `'${child.name}', ct."${child.name}"`)
          .join(", ");
        const translationJson = translations
          ? `(select coalesce(jsonb_agg(jsonb_build_object(${translationPairs})), '[]'::jsonb)
               from public.church_translations ct where ct.church_id = church.id)`
          : "'[]'::jsonb";
        parts.push(
          `(select jsonb_build_object('slug', church.slug, 'church_translations', ${translationJson})
             from public.churches church where church.id = public.objects.church_id) as "churches"`,
        );
        continue;
      }
      if (this.state.table === "object_relations" && /^(source|target):objects!/.test(node.name)) {
        const alias = node.name.slice(0, node.name.indexOf(":"));
        const objectIdColumn = alias === "source" ? "object_id" : "related_object_id";
        const translationNode = node.children.find((child) => child.name === "object_translations");
        const objectFields = node.children.filter((child) => child !== translationNode);
        const objectPairs = objectFields
          .filter((child) => child.children.length === 0)
          .map((child) => `'${child.name}', related_object."${child.name}"`);
        if (translationNode) {
          const translationPairs = translationNode.children
            .filter((child) => child.children.length === 0)
            .map((child) => `'${child.name}', translation."${child.name}"`)
            .join(", ");
          objectPairs.push(
            `'object_translations', (select coalesce(jsonb_agg(jsonb_build_object(${translationPairs})), '[]'::jsonb) from public.object_translations translation where translation.object_id = related_object.id)`,
          );
        }
        parts.push(
          `(select jsonb_build_object(${objectPairs.join(", ")}) from public.objects related_object where related_object.id = public.object_relations."${objectIdColumn}") as "${alias}"`,
        );
        continue;
      }
      const rel = RELATIONSHIPS[node.name];
      if (!rel) throw new Error(`Unsupported embed: ${node.name}`);
      const pairs = node.children
        .filter((child) => child.children.length === 0)
        .map((child) => `'${child.name}', c."${child.name}"`)
        .join(", ");
      parts.push(
        `(select coalesce(jsonb_agg(jsonb_build_object(${pairs})), '[]'::jsonb)
           from public.${rel.table} c where c."${rel.fk}" = public.${this.state.table}."id") as "${node.name}"`,
      );
    }
    return parts.join(", ");
  }
}

export interface FakeSupabaseClient {
  from(table: string): FakeQuery;
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown>[] | null; error: FakeSupabaseError | null }>;
}

/** Wraps a PGlite instance as a minimal Supabase-shaped client used by DAL tests. */
export function createFakeClient(db: PGlite): FakeSupabaseClient {
  return {
    from(table: string) {
      return new FakeQuery(db, table);
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      try {
        const keys = Object.keys(args);
        const placeholders = keys.map((key, index) => `${key} => $${index + 1}`);
        const values = keys.map((key) => args[key]);
        const result = await db.query<Record<string, unknown>>(
          `select * from public.${fn}(${placeholders.join(", ")})`,
          values,
        );
        return { data: result.rows, error: null };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    },
  };
}
