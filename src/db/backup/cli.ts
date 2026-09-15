import { ensureDataDir } from "../../server/core/boot";
import { databasePath, openDatabase } from "../connection/open";
import { backup, backupsDir } from "./backup";

if (import.meta.main) {
  const dir = ensureDataDir();
  const db = openDatabase(databasePath(dir));
  try {
    const path = backup(db, backupsDir(dir));
    console.log(`${databasePath(dir)}: backed up to ${path}`);
  } finally {
    db.close();
  }
}
