-- What went wrong, kept where the household can read it (decisions.md row 166).
--
-- One row per failure the app noticed: a server function or an /api route
-- that threw, an error a browser caught and sent back, or a model call that
-- failed or whose answer a check refused. Settings › Diagnostics lists them,
-- newest first; the same event is also one JSON line on stdout for
-- `docker logs`. Nothing here is the household's data: a backup leaves it
-- out, a restore starts it empty, and the repository keeps only the newest
-- few hundred rows.
--
-- `source` is where it was noticed, `name` what failed there (a server
-- function's name, a route's path, a page), `message` the one line a person
-- reads, `detail` a JSON object with the rest (a stack, a check report), and
-- `version` the build that recorded it, so an old failure on an old build
-- reads as such.
--
-- Same conventions as 001_init.sql: UUID text ids, ISO 8601 UTC timestamps.

CREATE TABLE diagnostic_event (
  id          TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  source      TEXT NOT NULL CHECK (source IN ('server', 'browser', 'ai')),
  level       TEXT NOT NULL CHECK (level IN ('error', 'warning')),
  name        TEXT NOT NULL,
  message     TEXT NOT NULL,
  detail      TEXT,
  version     TEXT NOT NULL
);

CREATE INDEX diagnostic_event_occurred_at ON diagnostic_event (occurred_at);
