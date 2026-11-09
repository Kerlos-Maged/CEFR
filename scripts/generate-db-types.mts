/**
 * Generates `lib/db/database.types.ts` from the real SQL migrations.
 *
 * The Supabase CLI equivalent is `supabase gen types typescript --local`, which requires
 * the Docker-based local stack. This script instead boots the migrations in an in-process
 * PostgreSQL (PGlite), introspects the resulting schema, and emits the same
 * Supabase-compatible `Database` type shape. Both approaches read the same source of truth
 * (`supabase/migrations/*.sql`).
 *
 * Run with: `npm run db:types:pglite`
 * (or, with Docker available: `npm run db:types`).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptsDir);
const migrationsDir = join(projectRoot, "supabase", "migrations");
const outputPath = join(projectRoot, "lib", "db", "database.types.ts");

interface EnumRow {
  name: string;
  label: string;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  is_nullable: "YES" | "NO";
  data_type: string;
  udt_name: string;
  is_identity: "YES" | "NO";
  column_default: string | null;
  table_type: "BASE TABLE" | "VIEW";
}

interface ForeignKeyRow {
  name: string;
  source_table: string;
  columns: string[];
  target_table: string;
  foreign_columns: string[];
}

interface FunctionRow {
  name: string;
  identity_args: string;
  n_defaults: number;
  result: string;
}

async function bootstrap(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
  `);
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}

function mapType(udt: string, enumNames: Set<string>): string {
  if (enumNames.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
  switch (udt) {
    case "uuid":
    case "text":
    case "varchar":
    case "character":
    case "bpchar":
    case "name":
    case "citext":
    case "timestamptz":
    case "timestamp":
    case "date":
    case "time":
    case "timetz":
      return "string";
    case "bool":
    case "boolean":
      return "boolean";
    case "int2":
    case "int4":
    case "int8":
    case "numeric":
    case "float4":
    case "float8":
    case "oid":
      return "number";
    case "json":
    case "jsonb":
      return "Json";
    default:
      return "unknown";
  }
}

function parseArgs(
  identityArgs: string,
  nDefaults: number,
): { name: string; type: string; optional: boolean }[] {
  const trimmed = identityArgs.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(",").map((part) => part.trim());
  return parts.map((part, index) => {
    const spaceAt = part.indexOf(" ");
    const name = spaceAt === -1 ? part : part.slice(0, spaceAt);
    const rawType = spaceAt === -1 ? "" : part.slice(spaceAt + 1);
    const type = rawType.includes(".") ? rawType.slice(rawType.lastIndexOf(".") + 1) : rawType;
    const optional = index >= parts.length - nDefaults;
    return { name, type: type.split(" ")[0], optional };
  });
}

function mapResult(result: string, enumNames: Set<string>): string {
  const type = result.trim();
  if (type.startsWith("TABLE(")) {
    const inner = type.slice(type.indexOf("(") + 1, type.lastIndexOf(")"));
    const fields = inner
      .split(",")
      .map((part) => part.trim())
      .map((part) => {
        const spaceAt = part.indexOf(" ");
        const name = spaceAt === -1 ? part : part.slice(0, spaceAt);
        let fieldType = spaceAt === -1 ? "" : part.slice(spaceAt + 1);
        if (fieldType.includes(".")) fieldType = fieldType.slice(fieldType.lastIndexOf(".") + 1);
        fieldType = fieldType.split("(")[0].trim();
        return `${name}: ${mapType(fieldType, enumNames)}`;
      });
    return `{ ${fields.join("; ")} }[]`;
  }
  if (type === "void") return "undefined";
  if (type === "trigger") return "unknown";
  if (type.includes(".")) return mapType(type.slice(type.lastIndexOf(".") + 1), enumNames);
  return mapType(type, enumNames);
}

function emitDatabase(
  enums: Map<string, string[]>,
  columns: ColumnRow[],
  foreignKeys: ForeignKeyRow[],
  functions: FunctionRow[],
): string {
  const enumNames = new Set(enums.keys());

  const tables = new Map<string, ColumnRow[]>();
  const views = new Map<string, ColumnRow[]>();
  for (const column of columns) {
    const target = column.table_type === "VIEW" ? views : tables;
    const list = target.get(column.table_name) ?? [];
    list.push(column);
    target.set(column.table_name, list);
  }

  const lines: string[] = [];
  lines.push("/**");
  lines.push(" * GENERATED FILE — do not edit by hand.");
  lines.push(" *");
  lines.push(" * Source of truth: supabase/migrations/*.sql");
  lines.push(" * Regenerate with: npm run db:types:pglite  (Docker: npm run db:types)");
  lines.push(" */");
  lines.push("");
  lines.push(
    "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];",
  );
  lines.push("");
  lines.push("export type Database = {");
  lines.push("  public: {");
  lines.push("    Tables: {");

  for (const [tableName, tableColumns] of [...tables.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push(`      ${tableName}: {`);
    lines.push("        Row: {");
    for (const column of tableColumns) {
      const base = mapType(column.udt_name, enumNames);
      const type = column.is_nullable === "YES" ? `${base} | null` : base;
      lines.push(`          ${column.column_name}: ${type};`);
    }
    lines.push("        };");

    lines.push("        Insert: {");
    for (const column of tableColumns) {
      const base = mapType(column.udt_name, enumNames);
      const optional =
        column.is_nullable === "YES" ||
        column.is_identity === "YES" ||
        column.column_default !== null;
      const type = column.is_nullable === "YES" ? `${base} | null` : base;
      lines.push(`          ${column.column_name}${optional ? "?" : ""}: ${type};`);
    }
    lines.push("        };");

    lines.push("        Update: {");
    for (const column of tableColumns) {
      const base = mapType(column.udt_name, enumNames);
      const type = column.is_nullable === "YES" ? `${base} | null` : base;
      lines.push(`          ${column.column_name}?: ${type};`);
    }
    lines.push("        };");

    lines.push("        Relationships: [");
    for (const fk of foreignKeys.filter((item) => item.source_table === tableName)) {
      lines.push("          {");
      lines.push(`            foreignKeyName: "${fk.name}";`);
      lines.push(`            columns: [${fk.columns.map((column) => `"${column}"`).join(", ")}];`);
      lines.push("            isOneToOne: false;");
      lines.push(`            referencedRelation: "${fk.target_table}";`);
      lines.push(
        `            referencedColumns: [${fk.foreign_columns.map((column) => `"${column}"`).join(", ")}];`,
      );
      lines.push("          },");
    }
    lines.push("        ];");
    lines.push("      };");
  }

  lines.push("    };");
  lines.push("    Views: {");

  for (const [viewName, viewColumns] of [...views.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push(`      ${viewName}: {`);
    lines.push("        Row: {");
    for (const column of viewColumns) {
      const base = mapType(column.udt_name, enumNames);
      const type = column.is_nullable === "YES" ? `${base} | null` : base;
      lines.push(`          ${column.column_name}: ${type};`);
    }
    lines.push("        };");
    lines.push("        Relationships: [];");
    lines.push("      };");
  }

  lines.push("    };");
  lines.push("    Functions: {");

  for (const fn of [...functions].sort((a, b) => a.name.localeCompare(b.name))) {
    const args = parseArgs(fn.identity_args, fn.n_defaults);
    lines.push(`      ${fn.name}: {`);
    if (args.length === 0) {
      lines.push("        Args: Record<PropertyKey, never>;");
    } else {
      lines.push("        Args: {");
      for (const arg of args) {
        lines.push(
          `          ${arg.name}${arg.optional ? "?" : ""}: ${mapType(arg.type, enumNames)};`,
        );
      }
      lines.push("        };");
    }
    lines.push(`        Returns: ${mapResult(fn.result, enumNames)};`);
    lines.push("      };");
  }

  lines.push("    };");
  lines.push("    Enums: {");
  for (const [name, labels] of [...enums.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`      ${name}: ${labels.map((label) => `"${label}"`).join(" | ")};`);
  }
  lines.push("    };");
  lines.push("    CompositeTypes: {");
  lines.push("      [_ in never]: never;");
  lines.push("    };");
  lines.push("  };");
  lines.push("};");
  lines.push("");
  lines.push(HELPERS);
  lines.push("");
  lines.push("export const Constants = {");
  lines.push("  public: {");
  lines.push("    Enums: {");
  for (const [name, labels] of [...enums.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`      ${name}: [${labels.map((label) => `"${label}"`).join(", ")}],`);
  }
  lines.push("    },");
  lines.push("  },");
  lines.push("} as const;");

  return lines.join("\n");
}

const HELPERS = `type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;`;

async function main(): Promise<void> {
  const db = await bootstrap();

  const enumRows = await db.query<EnumRow>(`
    select t.typname as name, e.enumlabel as label
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      join pg_enum e on e.enumtypid = t.oid
     where n.nspname = 'public'
     order by t.typname, e.enumsortorder
  `);
  const enums = new Map<string, string[]>();
  for (const row of enumRows.rows) {
    const labels = enums.get(row.name) ?? [];
    labels.push(row.label);
    enums.set(row.name, labels);
  }

  const columnRows = await db.query<ColumnRow>(`
    select c.table_name, c.column_name, c.is_nullable, c.data_type, c.udt_name,
           c.is_identity, c.column_default, t.table_type
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and t.table_type in ('BASE TABLE', 'VIEW')
     order by c.table_name, c.ordinal_position
  `);

  const fkRows = await db.query<ForeignKeyRow>(`
    select con.conname as name,
           src.relname as source_table,
           (select array_agg(att.attname order by u.ord)
              from unnest(con.conkey) with ordinality u(attnum, ord)
              join pg_attribute att on att.attrelid = con.conrelid and att.attnum = u.attnum) as columns,
           tgt.relname as target_table,
           (select array_agg(att.attname order by u.ord)
              from unnest(con.confkey) with ordinality u(attnum, ord)
              join pg_attribute att on att.attrelid = con.confrelid and att.attnum = u.attnum) as foreign_columns
      from pg_constraint con
      join pg_class src on src.oid = con.conrelid
      join pg_class tgt on tgt.oid = con.confrelid
      join pg_namespace n on n.oid = src.relnamespace
     where n.nspname = 'public' and con.contype = 'f'
     order by src.relname, con.conname
  `);

  const functionRows = await db.query<FunctionRow>(`
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as identity_args,
           p.pronargdefaults as n_defaults,
           pg_get_function_result(p.oid) as result
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
     order by p.proname
  `);

  const output = `${emitDatabase(enums, columnRows.rows, fkRows.rows, functionRows.rows)}\n`;
  writeFileSync(outputPath, output, "utf8");
  await db.close();

  process.stdout.write(
    `Generated ${outputPath} (${enums.size} enums, ${columnRows.rows.length} columns, ${functionRows.rows.length} functions).\n`,
  );
}

await main();
