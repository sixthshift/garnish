// The backup routes (M40.3, M40.5) against a temp DATA_DIR: the download, the
// check that writes nothing, a refused file, and a restore that replaces.
import { expect, test } from "vitest";
import backups from "../../../src/db/models/backup/repo";
import recipes from "../../../src/db/models/recipe/repo";
import { BACKUP_JSON } from "../../../src/domain/backup";
import type { RestoreCheck, RestoreDone } from "../../../src/lib/backup";
import { readZip, writeZip } from "../../../src/lib/zip";
import { backupZipRoute, restoreRoute } from "../../../src/routes/api/backup";
import { handleBackupZip, handleRestore } from "../../../src/server/api/backup";
import { IDS, sampleBackup } from "../../helpers/backup";
import { testRouter } from "../../helpers/routes";
import { useTempDataDir } from "../../helpers/server";
import { PNG_BYTES } from "../../helpers/zip";

useTempDataDir();

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Response | Promise<Response>;
const handlersOf = (route: { options: { server?: unknown } }) => (route.options.server as { handlers?: Record<string, Handler> } | undefined)?.handlers ?? {};

const IMAGES = [`images/${IDS.recipe}.png`, `images/steps/${IDS.step}.png`, `images/timeline/${IDS.event}.png`];

/** The sample backup as a zip, with its three images. */
const sampleZip = () =>
  writeZip([
    { name: BACKUP_JSON, bytes: new TextEncoder().encode(JSON.stringify(sampleBackup())), compress: true },
    ...IMAGES.map((name) => ({ name, bytes: PNG_BYTES })),
  ]);

const upload = (bytes: Uint8Array, query = "") => {
  const body = new FormData();
  body.append("file", new File([bytes as BlobPart], "garnish-backup.zip", { type: "application/zip" }));
  return new Request(`http://localhost/api/restore${query}`, { method: "POST", body });
};

test("GET /api/backup.zip downloads a backup named for the moment", async () => {
  const res = await handleBackupZip(new Date("2026-10-07T09:15:00Z"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/zip");
  expect(res.headers.get("content-disposition")).toBe('attachment; filename="garnish-backup-20261007-091500.zip"');
  const entries = await readZip(new Uint8Array(await res.arrayBuffer()));
  const json = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === BACKUP_JSON)!.bytes));
  expect(json.garnish).toMatchObject({ format: "garnish-backup", version: 1 });
  expect(json.units.length).toBeGreaterThan(0); // seeded at boot
});

test("?check=1 answers what the backup holds beside what is here, and writes nothing", async () => {
  const before = backups.read();
  const res = await handleRestore(upload(await sampleZip(), "?check=1"));
  expect(res.status).toBe(200);
  const body = (await res.json()) as RestoreCheck;
  expect(body.createdAt).toBe(sampleBackup().garnish.createdAt);
  expect(body.backup).toMatchObject({ recipes: 1, timeline: 1, plan: 1, shopping: 1, images: 3 });
  expect(body.current.recipes).toBe(0);
  expect(body.current.units).toBeGreaterThan(0);
  expect(backups.read()).toEqual(before);
});

test("a refused file answers every problem and writes nothing", async () => {
  const before = backups.read();
  const broken = sampleBackup();
  broken.plan[0]!.recipeId = "99999999-0000-4000-8000-000000000000";
  const zip = await writeZip([{ name: BACKUP_JSON, bytes: new TextEncoder().encode(JSON.stringify(broken)) }]);
  for (const query of ["?check=1", ""]) {
    const res = await handleRestore(upload(zip, query));
    expect(res.status).toBe(400);
    const { problems } = (await res.json()) as { problems: string[] };
    expect(problems[0]).toBe("plan[0].recipeId: recipe 99999999-0000-4000-8000-000000000000 is not in the backup");
    expect(problems).toHaveLength(1); // the images are checked only once the JSON holds together
  }
  expect(backups.read()).toEqual(before);

  const empty = await handleRestore(upload(new Uint8Array()));
  expect(((await empty.json()) as { problems: string[] }).problems).toEqual(["That file is empty"]);
  const none = await handleRestore(new Request("http://localhost/api/restore", { method: "POST", body: new FormData() }));
  expect(none.status).toBe(400);
});

test("a restore replaces the household and names the snapshot", async () => {
  const res = await handleRestore(upload(await sampleZip()), new Date("2026-10-07T10:30:00Z"));
  expect(res.status).toBe(200);
  const body = (await res.json()) as RestoreDone;
  expect(body.snapshot).toBe("garnish-pre-restore-20261007-103000.db");
  expect(body.counts.recipes).toBe(1);
  expect(recipes.get("hollandaise")?.name).toBe("Hollandaise");
  const { garnish: _, ...expected } = sampleBackup();
  expect(backups.read()).toEqual(expected);
});

test("the routes wire GET and POST to the handlers", async () => {
  testRouter("/");
  expect(backupZipRoute.fullPath).toBe("/api/backup.zip");
  expect(restoreRoute.fullPath).toBe("/api/restore");
  expect(handlersOf(backupZipRoute).POST).toBeUndefined();
  expect(handlersOf(restoreRoute).GET).toBeUndefined();
  const zip = await handlersOf(backupZipRoute).GET!({ request: new Request("http://localhost/api/backup.zip"), params: {} });
  expect(zip.headers.get("content-type")).toBe("application/zip");
  const checked = await handlersOf(restoreRoute).POST!({ request: upload(await sampleZip(), "?check=1"), params: {} });
  expect(checked.status).toBe(200);
});
