# Development

How to work on Garnish from a checkout. Running it for a household is the [README](../README.md); the argument behind it is in [intent](intent.md), [architecture](architecture.md) and [decisions](decisions.md).

## Prerequisites

- [Bun](https://bun.sh) 1.4 or newer (`bun --version`). Older Bun cannot run the built server.
- Docker, only to build the image yourself ([Building the image](#building-the-image)).

Nothing else: SQLite is built into Bun, and all state is files under one directory.

## Develop

Install dependencies:

```bash
bun install
```

Run the dev server (Vite via Nitro, on http://localhost:9988, bound to all interfaces so it is reachable from the host through the dev container's published port). 9988 is garnish's port everywhere: dev, `bun run start` and the Docker image. `http://garnish.localhost:9988` works too, and with the machine-wide Traefik proxy running so does `http://garnish.localhost` (see `.devcontainer/CLAUDE_CODE_USAGE.md`):

```bash
bun run dev
```

`bun run dev` does not touch the database. The first start creates `./data/`, migrates `garnish.db` and seeds the default units, so a fresh clone opens on an empty recipe list; see [Seed](#seed) for the three demo recipes. Recipes you add or import stay put across restarts.

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
bun run lint    # Biome
bun run e2e     # Playwright over the production build
```

All four must pass; CI runs the same four before it builds the image. `bun run test` is the only way to run the tests; `bun test` is a different runner and will not work. `bun run e2e` builds the app itself and serves it on port 9989 over an empty database, so the dev server can stay up; it needs Playwright's Chromium once per machine, `bunx playwright install chromium`. A failed spec leaves a screenshot and a trace in `test-results/` (`bunx playwright show-trace <trace.zip>`).

Which layer a new test belongs in, and the helpers each one has: [`testing.md`](testing.md).

## Seed

The server seeds the default units itself on every start, so this is optional. `bun run seed` migrates and seeds the database in `DATA_DIR` without starting the server; `bun run dev:sample` also adds three demo recipes, one with three parts:

```bash
bun run seed
bun run dev:sample
```

Both are idempotent: existing units and recipes are left alone. `bun run migrate` applies pending migrations only.

The sample recipes also carry a favourite, a source URL and two logged cooks, so the list filters, the recipe footer and the timeline all have something to show.

## Run from a build

Build, then start the production server (on http://localhost:9988):

```bash
bun run build
bun run start
```

Environment:

- `DATA_DIR` — where `garnish.db`, `images/` and `backups/` live. Defaults to `./data`. Created if missing.
- `PORT` — the production server's port. Defaults to 9988.

Both apply to every `bun run` command here (`start`, `seed`, `migrate`, `backup`, `restore`), for example:

```bash
DATA_DIR=/srv/garnish PORT=8080 bun run start
```

`GET /api/health` answers `{"ok":true,"version":"1.2.3"}` while the server is up — the version is the build's, and Settings prints it at the foot of the page too.

## Backup and restore from the command line

The README covers backup and restore from Settings and over HTTP, which is how a running container does it. From a checkout, against `DATA_DIR`:

Outside Docker, `bun run backup` writes one into `DATA_DIR/backups/` (default `./data/backups/`), named `garnish-backup-YYYYMMDD-HHmmss.zip` (UTC):

```bash
bun run backup
```

`bun run restore` replaces everything with a backup, after the same full check the Settings restore makes and keeping the database and photos as they were under `backups/`:

```bash
bun run restore garnish-backup-20261007-091500.zip
```

## AI while developing

`.env` is loaded by `bun run dev`, so the AI is configured there exactly as the README describes for a deployment: `AI_PROVIDER` and that provider's variables. With `AI_PROVIDER=claude-code`, the Claude Code binary is the one the Agent SDK installed in `node_modules`; the image instead copies it to `/usr/local/bin/claude` and names it with `CLAUDE_CODE_EXECUTABLE`, which can point anywhere else too.

### Trying the AI on real recipes

The labs ask whichever provider `AI_PROVIDER` names; `--model` names models of that provider.

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

## Building the image

GitHub Actions builds and publishes the image on every push to `main` (`.github/workflows/docker.yml`: the tests gate the build, and it is built for amd64 and arm64). Each push is tagged `latest`, its new version and its commit sha.

To run something other than the published image, say a local build, point `GARNISH_IMAGE` at it. The build context is the repo root:

```bash
docker build -f docker/Dockerfile -t garnish:local .
GARNISH_IMAGE=garnish:local docker compose up -d
```

## Versions and releases

Nobody edits the version by hand. Every push to `main` bumps `package.json` before the image is built, by what the commits since the last tag ask for:

| In a commit message | Bump |
|---|---|
| `feat: …` or `feat(scope): …` | minor — `1.2.3` → `1.3.0` |
| `feat!: …`, `fix(db)!: …`, or a `BREAKING CHANGE: …` footer | major — `1.2.3` → `2.0.0` |
| anything else, prose subjects included | patch — `1.2.3` → `1.2.4` |

Once the image publishes, the workflow commits the bumped `package.json` back to `main` as `chore(release): vX.Y.Z [skip ci]`, pushes a matching `vX.Y.Z` tag and publishes it on the [releases page](https://github.com/sixthshift/garnish/releases) with notes generated from the commits since the last one, so the repository, the git tags, the releases and the registry all say the same number. A failed build spends no version.

The build inlines the number, so a running container can be asked what it is: `curl http://localhost:9988/api/health`, or read it at the foot of Settings. `bun run version:next` is the same bump run locally; it writes `package.json` and prints the new version.
