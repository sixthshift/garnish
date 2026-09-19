-- Timer alerts by Web Push (decisions.md row 111).
--
-- A timer's toast and buzz only reach a page that is open: the phone freezes
-- a backgrounded app, so a cook who locks the screen for the twenty minutes
-- hears nothing at zero. The one thing that can wake the phone is a push
-- from a server, so the server has to know when each timer ends. Three tables:
--
-- `push_vapid` is the server's own signing key pair, made on first use and
-- kept for good, because a subscription is bound to the public key it was
-- made with and a new pair would orphan every phone. One row, ever; the CHECK
-- on the id is what makes it one.
--
-- `push_subscription` is one per browser that turned alerts on: the push
-- service's endpoint and the two keys the payload is encrypted to. The
-- endpoint is the identity -- the browser hands the same one back on every
-- read -- so it is UNIQUE and the page names its device by it.
--
-- `timer_alarm` is the timers the server has been asked to fire: one per
-- (device, timer), where `timer_id` is the page's own id for the chip that
-- started it, so a restart of the same chip replaces its alarm rather than
-- stacking one. `url` is the page the notification opens. A row goes when it
-- is sent, when the timer is paused or dismissed, or with its device.
--
-- Same conventions as 001_init.sql: UUID text ids, ISO 8601 UTC timestamps.

CREATE TABLE push_vapid (
  id          TEXT PRIMARY KEY CHECK (id = 'vapid'),
  public_key  TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE push_subscription (
  id         TEXT PRIMARY KEY,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE timer_alarm (
  id              TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES push_subscription(id) ON DELETE CASCADE,
  timer_id        TEXT NOT NULL,
  label           TEXT NOT NULL,
  url             TEXT NOT NULL DEFAULT '/',
  ends_at         TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (subscription_id, timer_id)
);
