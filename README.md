# Garnish

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

`bun run dev` does not touch the database. The first start creates `./data/`, migrates `garnish.db` and seeds the default units, so a fresh clone opens on an empty recipe list; see [Seed](#seed) for the three demo recipes that ship. Recipes you add or import stay put across restarts.

To throw the database away and start from a known state:

```bash
bun run dev:seed
```

It wipes `DATA_DIR`'s database and images, migrates, seeds the default units the server always seeds, then adds fifteen generated recipes — the same fifteen every time. Run it when you want disposable data to look at; it never runs on its own. Backups are not touched.

In VS Code, the `dev` task (Terminal → Run Build Task, or `Cmd/Ctrl+Shift+B`) runs the same command in a dedicated panel.

The app icons are generated, not drawn by hand. `src/components/shell/Logo.tsx` is the only source for the mark; after changing it, regenerate every file in `public/icons/` and `public/apple-touch-icon.png`:

```bash
bun run icons
```

## Lint and format

Biome, configured in `biome.json` the way the design system is. The devcontainer runs it as the editor's formatter on save; from the terminal:

```bash
bun run lint      # biome check: format, imports and lint rules, read-only
bun run format    # biome format --write
```

## Test

The gate, run before every commit:

```bash
bun run check   # tsc --noEmit
bun run test    # vitest run, under Bun
```

Both must pass. `bun run test` is the only way to run the tests; `bun test` is a different runner and will not work.

## Seed

The server seeds the default units itself on every start, so this is optional. `bun run seed` migrates and seeds the database in `DATA_DIR` without starting the server; `--sample` also adds three demo recipes, one with three parts:

```bash
bun run seed
bun run seed --sample
```

Both are idempotent: existing units and recipes are left alone. `bun run migrate` applies pending migrations only.

The sample recipes also carry a favourite, a source URL and two logged cooks, so the list filters, the recipe footer and the timeline all have something to show.

## Use

- **Recipes** (`/`) — search, filter by tags (any or all), foods and favourites, sort, or press the dice for a random recipe. Grid or list view is remembered per device; `/` anywhere outside a text field opens the search dialog.
- **A recipe** — tick ingredients and steps off as you go, switch between the per-part and merged ingredient lists, scale by servings, and use the ⋯ menu for Edit, Cook, Duplicate, Copy link, Copy ingredients, Copy as Cooklang, Print and Delete.
- **Made this** — the button beside "last made" logs a cook: date, comment and an optional photo. Logged cooks appear as a timeline under the notes, and the newest one sets the recipe's last-made date. Cook mode's final card offers the same button.
- **Cook** — one card at a time, full screen, with part pills, swipe or arrow keys, and the screen kept awake.
- **Settings** (`/settings`) — tabs for Foods, Units, Aisles, Tags, Export, Appearance and Alerts. The first four are editable tables with search, merge and a delete that lists the recipes it affects; Export downloads every recipe as JSON (images referenced by URL, not included); Appearance holds the light / dark / system theme toggle; Alerts switches on timer alerts for this device (see [Timer alerts](#timer-alerts)).

- **A step's photo** — the editor's ⋮ menu on a step row has "Add image": it uploads to `POST /api/steps/:id/image` and shows on the step's card on the recipe page and in cook mode. Save the recipe first if the step is new — a step that has never been saved has nothing to attach a photo to.

Photos live on disk under `DATA_DIR/images/` (logged-cook photos under `images/timeline/`, step photos under `images/steps/`, served by `GET /api/images/steps/:file`), not in the database — see [Backup](#backup).

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

`GET /api/health` answers `{"ok":true,"version":"1.2.3"}` while the server is up — the version is the build's, and Settings prints it at the foot of the page too.

## AI import

Pasted text — a photo's text, an email, a page that gave nothing up — can be read into a recipe by a hosted model. It is off until a key is set, and the paste option is hidden until then; every other import path works without it.

Five environment variables, on the host or in the container:

| Variable | Default | What it is |
|---|---|---|
| `AI_API_KEY` | _(unset)_ | The provider's API key. Setting it is the whole of the setup; unset, the option is hidden |
| `AI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | Any OpenAI-compatible endpoint, without the `/chat/completions` |
| `AI_MODEL` | `gemini-flash-lite-latest` | The model to ask. The default is Google's rolling alias, so it follows releases without a change here |
| `AI_RESTYLE_MODEL` | _(`AI_MODEL`)_ | The model the house style pass asks (M37.4), when it should differ from the import's. The prompt and the seeded statements are written to read well on whatever model is passed in, so this is a preference, not a fix |
| `AI_PLANNER_MODEL` | _(`AI_MODEL`)_ | The model the week's proposal asks (M39.4), when it should differ from the import's. A preference in the same way: the planner guide and the prompt are written to read well on whatever is passed in |

To try the house style on a real recipe without writing anything, from the author's steps even if the recipe was restyled already:

```bash
bun run restyle "Slow Cooked Shredded Beef Ragu Pasta"              # the guide's enabled statements, on AI_RESTYLE_MODEL
bun run restyle beef-ragu --part "Full recipe" --model gemini-flash-lite-latest,gemini-3.6-flash
bun run restyle beef-ragu --rules my-statements.txt --prompt         # one statement per line; print the prompt too
```

Each model's rewrite is printed with the facts check's verdict and the step count before and after. A statement or prompt change should read well on two models before it is kept.

To try the planner guide on a real week without writing anything:

```bash
bun run propose                                                      # the coming week, all seven days, dinner, on AI_PLANNER_MODEL
bun run propose --week 2026-09-21 --days mon,tue,wed --meals breakfast,dinner --model gemini-flash-lite-latest,gemini-3.6-flash
bun run propose --rules my-statements.txt --prompt                   # one statement per line; print the prompt and stop
```

`--week` takes any date in the week wanted, normalised to its Monday, and defaults to the coming week (the household is usually filling next week, not the one under way); `--days` picks which of its seven days to open, `mon` to `sun`, and defaults to all of them; `--meals` picks which meals open a slot on each of those days and defaults to dinner, as the Propose sheet does. Each model's proposal is printed as a table (day, meal, recipe, reason), with the check's dropped and unfilled counts and the time taken. Nothing is written either way.

The defaults are Google's Gemini free tier, so a key from [AI Studio](https://aistudio.google.com/apikey) is all that is needed. Any OpenAI-compatible provider works instead — Mistral, Groq, OpenRouter, or an Ollama on the LAN (`AI_BASE_URL=http://ollama.lan:11434/v1`, any non-empty key):

```bash
AI_API_KEY=sk-... AI_BASE_URL=https://api.groq.com/openai/v1 AI_MODEL=llama-3.3-70b-versatile bun run start
```

`docker/docker-compose.yml` passes all five through from the host, so `AI_API_KEY=... docker compose up -d` from `docker/` is enough.

Note that Gemini's free tier may train on what is sent to it. What is sent is the recipe text you pasted, which for a public recipe page costs nothing; use a paid tier or a local model for anything you would not publish.

## Timer alerts

A timer's toast and buzz only reach a page that is open: the phone freezes a backgrounded app, so with the screen off nothing rings at zero. Settings › Alerts turns on Web Push for the device it is opened on — the browser asks once, and from then on the server wakes the phone when a timer ends, screen off or app closed, and a tap on the notification opens the recipe. Each device is switched on from its own Settings.

What it needs:

- HTTPS, as every service worker does. On an iPhone, add Garnish to the home screen first (Safari in a tab cannot receive push); on Android, Chrome works installed or not.
- The server able to reach the push services outbound (`web.push.apple.com`, `fcm.googleapis.com`). Nothing comes in from the internet.
- Nothing to configure: the signing key pair is made on first use and kept in the database. `PUSH_CONTACT` (a `mailto:` or `https:` URL) overrides the contact the push services see, which defaults to this project's page.

## Run with Docker

Everything Docker lives in `docker/`: the `Dockerfile`, its ignore file, and the compose file, which is the canonical way to run Garnish. The compose file pulls the image GitHub Actions publishes to `ghcr.io/sixthshift/garnish` on every push to `main` (`.github/workflows/docker.yml`: the tests gate the build, and the image is built for amd64 and arm64). Each push is tagged `latest`, its new version (see Versions below) and its commit sha, so `:latest` is the rolling one and `:1.2.3` pins. Nothing is built on the machine that runs it:

```bash
cd docker
docker compose up -d
```

Garnish is then on http://localhost:3000 (the compose file publishes port 3000). All state lives in the named volume `garnish-data`, mounted at `/data` inside the container: `garnish.db`, `images/` and `backups/`. Migrations run on every start, so a fresh volume is set up on first boot.

To update, pull the new image and restart; the volume is untouched:

```bash
docker compose pull
docker compose up -d
```

`docker compose down` stops and removes the container. The volume survives; only `docker compose down -v` deletes it.

To pin a version rather than follow `latest`:

```bash
GARNISH_IMAGE=ghcr.io/sixthshift/garnish:1.2.3 docker compose up -d
```


To run something other than the published image, say a local build, point `GARNISH_IMAGE` at it. The build context is the repo root:

```bash
docker build -f docker/Dockerfile -t garnish:local .
GARNISH_IMAGE=garnish:local docker compose up -d
```

The commands in the next two sections are run from `docker/` too.

## Versions

Nobody edits the version by hand. Every push to `main` bumps `package.json` before the image is built, by what the commits since the last tag ask for:

| In a commit message | Bump |
|---|---|
| `feat: …` or `feat(scope): …` | minor — `1.2.3` → `1.3.0` |
| `feat!: …`, `fix(db)!: …`, or a `BREAKING CHANGE: …` footer | major — `1.2.3` → `2.0.0` |
| anything else, prose subjects included | patch — `1.2.3` → `1.2.4` |

Once the image publishes, the workflow commits the bumped `package.json` back to `main` as `chore(release): vX.Y.Z [skip ci]` and pushes a matching `vX.Y.Z` tag, so the repository, the git tags and the registry all say the same number. A failed build spends no version.

The build inlines the number, so a running container can be asked what it is: `curl http://localhost:3000/api/health`, or read it at the foot of Settings. `bun run version:next` is the same bump run locally; it writes `package.json` and prints the new version.

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
