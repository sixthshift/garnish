# garnish

A personal recipe manager. Single household, runs on the LAN.

Docs: [intent](docs/intent.md) · [architecture](docs/architecture.md) · [decisions](docs/decisions.md) · [scope](docs/scope.md)

## Develop

To install dependencies:

```bash
bun install
```

To run the dev server (Vite, on http://localhost:5173):

```bash
bun run dev
```

To build and run the production server (on http://localhost:3000):

```bash
bun run build
bun run start
```

Environment:

- `DATA_DIR` — where `garnish.db`, `images/` and `backups/` live. Defaults to `./data`.
- `PORT` — the production server's port. Defaults to 3000.

Gate before committing: `bun run check && bun run test`.

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
