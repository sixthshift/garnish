import { createFileRoute } from "@tanstack/react-router";
import { handleExportJson } from "../../server/api/export";

/** GET /api/export.json — every recipe plus the reference tables (M34.1). */
export const Route = createFileRoute("/api/export.json")({
  server: {
    handlers: {
      GET: () => handleExportJson(),
    },
  },
});
