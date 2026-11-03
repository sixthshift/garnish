// The schema as a page to look at: tables, columns, foreign keys, indexes,
// checks and triggers read out of SQLite itself, drawn as a Mermaid ER diagram
// and a card per table. Read from a database the migrations built, so it shows
// what the store is, not what the Drizzle mirror says it is.

import type { Database } from "bun:sqlite";

export type SchemaColumn = { name: string; type: string; notNull: boolean; primaryKey: boolean; default: string | null };
export type SchemaForeignKey = { from: string; table: string; to: string; onDelete: string };
export type SchemaIndex = { name: string; unique: boolean; columns: string[] };
export type SchemaTable = {
  name: string;
  columns: SchemaColumn[];
  foreignKeys: SchemaForeignKey[];
  indexes: SchemaIndex[];
  checks: string[];
  triggers: { name: string; sql: string }[];
};

/**
 * A reference SQLite cannot hold: ids kept in a JSON column. Drawn dashed, so
 * the diagram shows where the database does not keep a link honest.
 */
export type SoftReference = { table: string; column: string; references: string; note: string };

export const SOFT_REFERENCES: readonly SoftReference[] = [
  { table: "meal_plan_entry", column: "choices", references: "ingredient", note: "choices JSON key" },
  { table: "meal_plan_entry", column: "choices", references: "food", note: "choices JSON value" },
];

/** A CHECK's expression, its parentheses balanced to two levels deep. */
const CHECK = /CHECK\s*\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/gi;

/** Every table of `db` but SQLite's own, by name. Reads only. */
export function readSchema(db: Database): SchemaTable[] {
  const tables = db.query("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {
    name: string;
    sql: string;
  }[];
  const triggers = db.query("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all() as {
    name: string;
    tbl_name: string;
    sql: string;
  }[];
  return tables.map(({ name, sql }) => {
    const columns = (
      db.query(`PRAGMA table_info("${name}")`).all() as { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }[]
    ).map((c) => ({ name: c.name, type: c.type, notNull: c.notnull === 1, primaryKey: c.pk > 0, default: c.dflt_value }));
    const foreignKeys = (db.query(`PRAGMA foreign_key_list("${name}")`).all() as { from: string; table: string; to: string; on_delete: string }[]).map((f) => ({
      from: f.from,
      table: f.table,
      to: f.to,
      onDelete: f.on_delete,
    }));
    const indexes = (db.query(`PRAGMA index_list("${name}")`).all() as { name: string; unique: number; origin: string }[])
      .filter((i) => i.origin !== "pk")
      .map((i) => ({
        name: i.name,
        unique: i.unique === 1,
        columns: (db.query(`PRAGMA index_info("${i.name}")`).all() as { name: string }[]).map((c) => c.name),
      }));
    return {
      name,
      columns,
      foreignKeys,
      indexes,
      checks: [...sql.matchAll(CHECK)].map((m) => m[1]!.trim()),
      triggers: triggers.filter((t) => t.tbl_name === name).map((t) => ({ name: t.name, sql: t.sql })),
    };
  });
}

/** A Mermaid type token: letters only, as erDiagram needs. */
const mermaidType = (type: string) => type.replace(/[^A-Za-z]/g, "") || "ANY";

/**
 * A Mermaid `erDiagram` of `tables`, or of the ones named in `only`: a box per
 * table, a line per foreign key (labelled with its column, on-delete rule and
 * "?" when nullable), and a dashed line per soft reference. A key to a table
 * left out is not drawn. Pure.
 */
export function erDiagram(tables: readonly SchemaTable[], only?: ReadonlySet<string>, soft: readonly SoftReference[] = SOFT_REFERENCES): string {
  const shown = tables.filter((t) => only === undefined || only.has(t.name));
  const names = new Set(shown.map((t) => t.name));
  const lines = ["erDiagram"];
  for (const t of shown) {
    lines.push(`  ${t.name} {`);
    for (const c of t.columns) {
      const keys = [c.primaryKey ? "PK" : "", t.foreignKeys.some((f) => f.from === c.name) ? "FK" : ""].filter(Boolean).join(",");
      const nullable = !c.notNull && !c.primaryKey ? ' "nullable"' : "";
      lines.push(`    ${mermaidType(c.type)} ${c.name}${keys ? ` ${keys}` : ""}${nullable}`);
    }
    lines.push("  }");
  }
  for (const t of shown) {
    for (const f of t.foreignKeys) {
      if (!names.has(f.table)) continue;
      const nullable = !t.columns.find((c) => c.name === f.from)?.notNull;
      const rule = f.onDelete === "NO ACTION" ? "" : ` (${f.onDelete.toLowerCase()})`;
      lines.push(`  ${f.table} ||--o{ ${t.name} : "${f.from}${rule}${nullable ? " ?" : ""}"`);
    }
  }
  for (const s of soft) {
    if (names.has(s.table) && names.has(s.references)) lines.push(`  ${s.references} |o..o{ ${s.table} : "${s.note} (no FK)"`);
  }
  return lines.join("\n");
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function card(t: SchemaTable, soft: readonly SoftReference[]): string {
  const rows = t.columns
    .map((c) => {
      const fk = t.foreignKeys.find((f) => f.from === c.name);
      const loose = soft.filter((s) => s.table === t.name && s.column === c.name);
      const reference = fk
        ? `→ <a href="#t-${fk.table}">${fk.table}</a>.${fk.to}${fk.onDelete === "NO ACTION" ? "" : ` <span class="muted">on delete ${fk.onDelete.toLowerCase()}</span>`}`
        : loose
            .map(
              (s) => `<span class="muted">⇢ ${escapeHtml(s.note)} → </span><a href="#t-${s.references}">${s.references}</a> <span class="muted">(no FK)</span>`
            )
            .join("<br>");
      return `<tr><td><code>${escapeHtml(c.name)}</code>${c.primaryKey ? ' <span class="tag">PK</span>' : ""}</td><td>${escapeHtml(c.type)}</td><td>${c.notNull || c.primaryKey ? "" : '<span class="muted">null</span>'}</td><td>${reference}</td><td>${c.default === null ? "" : `<code>${escapeHtml(c.default)}</code>`}</td></tr>`;
    })
    .join("");
  const list = (title: string, items: string[]) => (items.length === 0 ? "" : `<h4>${title}</h4><ul>${items.join("")}</ul>`);
  return `<section class="card" id="t-${t.name}"><h3>${t.name}</h3>
<table><thead><tr><th>column</th><th>type</th><th></th><th>references</th><th>default</th></tr></thead><tbody>${rows}</tbody></table>
${list(
  "Indexes",
  t.indexes.map((i) => `<li>${i.unique ? "unique " : ""}(${i.columns.join(", ")}) <span class="muted">${escapeHtml(i.name)}</span></li>`)
)}${list(
  "Checks",
  t.checks.map((c) => `<li><code>${escapeHtml(c)}</code></li>`)
)}${list(
  "Triggers",
  t.triggers.map((x) => `<li><b>${escapeHtml(x.name)}</b><pre>${escapeHtml(x.sql)}</pre></li>`)
)}</section>`;
}

/** The pinned Mermaid the page loads; the cards need nothing but the page. */
export const MERMAID_SRC = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js";

/**
 * The whole page: an optional close-up diagram of the `focus` tables, the
 * diagram of everything, then a card per table. Light and dark both. Pure.
 */
export function schemaHtml(tables: readonly SchemaTable[], options: { focus?: readonly string[]; soft?: readonly SoftReference[] } = {}): string {
  const soft = options.soft ?? SOFT_REFERENCES;
  const focus = options.focus?.filter((name) => tables.some((t) => t.name === name)) ?? [];
  const triggers = tables.reduce((n, t) => n + t.triggers.length, 0);
  const diagram = (id: string, title: string, only?: ReadonlySet<string>) =>
    `<h2 id="${id}">${title}</h2><div class="diagram"><pre class="mermaid">${escapeHtml(erDiagram(tables, only, soft))}</pre></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>garnish schema</title>
<style>
:root{--bg:#faf7f4;--fg:#2a2420;--muted:#8a7d72;--line:#e3dbd3;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#ece6e0;--muted:#a3968b;--line:#3a332e;--card:#24201d}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}h1{margin:0 0 4px}.muted{color:var(--muted)}
.diagram{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;overflow:auto;margin:12px 0 28px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;overflow:auto}
.card h3{margin:0 0 8px}.card h4{margin:12px 0 4px;font-size:13px;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{text-align:left;padding:3px 6px;border-bottom:1px solid var(--line);vertical-align:top}
.tag{font-size:11px;padding:1px 6px;border-radius:6px;background:var(--line)}
ul{margin:0;padding-left:18px;font-size:13px}pre{white-space:pre-wrap;font-size:12px;margin:4px 0}a{color:inherit}nav a{margin-right:12px}
</style></head><body><main>
<h1>garnish schema</h1>
<p class="muted">Read from a database the migrations built: ${tables.length} tables, ${triggers} trigger${triggers === 1 ? "" : "s"}. Dashed lines are ids held in JSON, which no foreign key keeps honest. Regenerate with <code>bun run db:diagram</code>.</p>
<nav>${focus.length > 0 ? '<a href="#focus">Focus</a>' : ""}<a href="#all">Everything</a><a href="#tables">Tables</a></nav>
${focus.length > 0 ? diagram("focus", `Focus: ${focus.join(", ")}`, new Set(focus)) : ""}
${diagram("all", "Everything")}
<h2 id="tables">Tables</h2><div class="grid">${tables.map((t) => card(t, soft)).join("\n")}</div>
</main>
<script src="${MERMAID_SRC}"></script>
<script>mermaid.initialize({startOnLoad:true,theme:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"neutral",er:{useMaxWidth:false}});</script>
</body></html>
`;
}
