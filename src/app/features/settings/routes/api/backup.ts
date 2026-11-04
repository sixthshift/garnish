import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../../../../../routes/root";
import { handleBackupZip, handleRestore } from "../../../../../server/api/backup";

/** GET /api/backup.zip — the whole household as a backup zip. */
export const backupZipRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/backup.zip",
  server: {
    handlers: {
      GET: () => handleBackupZip(),
    },
  },
});

/** POST /api/restore — check (`?check=1`) or restore a backup; a restore replaces everything. */
export const restoreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/restore",
  server: {
    handlers: {
      POST: ({ request }) => handleRestore(request),
    },
  },
});
