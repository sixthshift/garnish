# garnish

A personal recipe manager. Single household, runs on the LAN.

Docs: [intent](docs/intent.md) · [architecture](docs/architecture.md) · [decisions](docs/decisions.md) · [scope](docs/scope.md)

## Prerequisites

- [Bun](https://bun.sh) 1.4 or newer (`bun --version`). Older Bun cannot run the built server.
- Docker with Compose v2, only for the container route below.

Nothing else: SQLite is built into Bun, and all state is files under one directory.

## Develop

Install dependencies:

```bash
bun install
```

Run the dev server (Vite via Nitro, on http://localhost:3000, bound to all interfaces so it is reachable from the host through the dev container's published port):

```bash
bun run dev
```

`bun run dev` runs `bun run dev:seed` before it starts Vite: it wipes `DATA_DIR`'s database and images, migrates, seeds the default units the server always seeds, then adds fifty generated recipes — the same fifty every time. Dev data is disposable by design, so every start is from a known state. Backups are not touched. To start without touching the database:

```bash
bun run dev:keep
```

The first start creates `./data/`, migrates `garnish.db` and seeds the default units. `bun run dev:keep` on a fresh clone leaves the recipe list empty; see [Seed](#seed) for the three demo recipes that ship.

In VS Code, the `dev` task (Terminal → Run Build Task, or `Cmd/Ctrl+Shift+B`) runs the same command in a dedicated panel.

## Test

The gate, run before every commit:

```bash
bun run check   # tsc --noEmit
bun run test    # vitest run, under Bun
```

Both must pass. `bun run test` is the only way to run the tests; `bun test` is a different runner and will not work.

## Seed

The server seeds the default units itself on every start, so this is optional. `bun run seed` migrates and seeds the database in `DATA_DIR` without starting the server; `--sample` also adds three demo recipes, one with three components:

```bash
bun run seed
bun run seed --sample
```

Both are idempotent: existing units and recipes are left alone. `bun run migrate` applies pending migrations only.

The sample recipes also carry a favourite, a source URL and two logged cooks, so the list filters, the recipe footer and the timeline all have something to show.

## Use

- **Recipes** (`/`) — search, filter by tags (any or all), foods and favourites, sort, or press the dice for a random recipe. Grid or list view is remembered per device; `/` anywhere outside a text field opens the search dialog.
- **A recipe** — tick ingredients and steps off as you go, switch between the per-component and merged ingredient lists, scale by servings, and use the ⋯ menu for Edit, Cook, Duplicate, Copy link, Copy ingredients, Print and Delete.
- **Made this** — the button beside "last made" logs a cook: date, comment and an optional photo. Logged cooks appear as a timeline under the notes, and the newest one sets the recipe's last-made date. Cook mode's final card offers the same button.
- **Cook** — one card at a time, full screen, with component pills, swipe or arrow keys, and the screen kept awake.
- **Settings** (`/settings`) — tabs for Foods, Units, Aisles, Tags and Appearance. The first four are editable tables with search, merge and a delete that lists the recipes it affects; Appearance holds the light / dark / system theme toggle.

Photos live on disk under `DATA_DIR/images/` (logged-cook photos under `images/timeline/`), not in the database — see [Backup](#backup).

## Run

Build, then start the production server (on http://localhost:3000):

```bash
bun run build
bun run start
```

Environment:

- `DATA_DIR` — where `garnish.db`, `images/` and `backups/` live. Defaults to `./data`. Created if missing.
- `PORT` — the production server's port. Defaults to 3000.

Both apply to every `bun run` command here (`start`, `seed`, `migrate`, `backup`), for example:

```bash
DATA_DIR=/srv/garnish PORT=8080 bun run start
```

`GET /api/health` answers `{"ok":true}` while the server is up.

## Run with Docker

Build the image and start it in the background:

```bash
docker compose up -d --build
```

garnish is then on http://localhost:3000 (`docker-compose.yml` publishes port 3000). All state lives in the named volume `garnish-data`, mounted at `/data` inside the container: `garnish.db`, `images/` and `backups/`. Migrations run on every start, so a fresh volume is set up on first boot.

To update, pull the source and rebuild; the volume is untouched:

```bash
git pull
docker compose up -d --build
```

`docker compose down` stops and removes the container. The volume survives; only `docker compose down -v` deletes it.

## Backup

Write a compacted snapshot of the live database into the volume's `backups/` directory. It uses `VACUUM INTO`, so it is safe while the server is running:

```bash
docker compose exec garnish bun run backup
```

This prints the new file, named `garnish-YYYYMMDD-HHmmss.db` (UTC). Copy it out of the container onto the host:

```bash
docker compose cp garnish:/data/backups/garnish-20260910-093000.db ./garnish-20260910-093000.db
```

Images are not in the database. To keep them too, copy the whole directory: `docker compose cp garnish:/data/images ./images`.

Outside Docker the same command works against `DATA_DIR` (default `./data`):

```bash
bun run backup
```

## Restore

Stop the service, replace the database in the volume with the backup, remove the WAL sidecars, and start again. The one-off container mounts the volume so nothing has to be running:

```bash
docker compose stop garnish
docker compose cp garnish:/data/backups/garnish-20260910-093000.db ./restore.db
docker compose run --rm --no-deps -v "$PWD/restore.db:/restore.db:ro" garnish \
  sh -c 'cp /restore.db /data/garnish.db && rm -f /data/garnish.db-wal /data/garnish.db-shm'
docker compose start garnish
```

If the backup is already on the host, skip the `cp` step and mount that file instead of `./restore.db`. Copy `images/` back the same way if it was backed up.

Outside Docker, stop the server, then copy the backup over `$DATA_DIR/garnish.db` and delete `garnish.db-wal` and `garnish.db-shm` next to it before starting again.
