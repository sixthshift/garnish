// `bun run db:diagram [--focus table,table] [--out path]`: the schema as an
// HTML page, read from a fresh in-memory database the migrations build, so it
// never touches the household's own. Written to .drizzle/schema.html by
// default, beside drizzle-kit's other scratch output (git-ignored).

import { openDatabase } from "../connection/open";
import { migrate } from "../migrations/migrate";
import { readSchema, schemaHtml } from "./diagram";

export const DEFAULT_OUT = ".drizzle/schema.html";

export type DiagramArgs = { out: string; focus: string[] };

/** CLI arguments after the script name. Pure; an unknown flag throws rather than being ignored. */
export function parseDiagramArgs(argv: readonly string[]): DiagramArgs {
  const args: DiagramArgs = { out: DEFAULT_OUT, focus: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    const value = argv[i + 1];
    if ((flag === "--out" || flag === "--focus") && (value === undefined || value.startsWith("--"))) throw new Error(`${flag} needs a value`);
    if (flag === "--out") args.out = value!;
    else if (flag === "--focus")
      args.focus = value!
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
    else throw new Error(`Unknown argument ${flag}. Usage: bun run db:diagram [--focus table,table] [--out path]`);
    i++;
  }
  return args;
}

if (import.meta.main) {
  const { out, focus } = parseDiagramArgs(process.argv.slice(2));
  const db = openDatabase(":memory:");
  try {
    migrate(db);
    const tables = readSchema(db);
    const unknown = focus.filter((name) => !tables.some((t) => t.name === name));
    if (unknown.length > 0) console.warn(`No table named ${unknown.join(", ")}; left out of the focus diagram.`);
    await Bun.write(out, schemaHtml(tables, { focus }));
    console.log(`${out}: ${tables.length} tables`);
  } finally {
    db.close();
  }
}
