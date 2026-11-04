import { backupZipRoute, restoreRoute } from "./backup";
import { importLibraryRoute } from "./importLibrary";

/** Settings' server routes, all Settings › Backup's: a whole library brought in, the backup taken, and a restore. Server only. */
export const settingsApiRoutes = [importLibraryRoute, backupZipRoute, restoreRoute] as const;
