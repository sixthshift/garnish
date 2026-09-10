# Using Claude Code and Codex in this DevContainer

Claude Code and Codex run inside the container, following the personal devcontainer standard (see the `devcontainer` skill in dotfiles — the source of truth for versions and conventions).

## Setup

1. **Ensure Docker is running**, Codex is logged in on the host (`~/.codex/auth.json` must exist), and `ssh-agent` has your key (`ssh-add --apple-use-keychain`, or `AddKeysToAgent yes` in `~/.ssh/config`) — git auth inside the container comes from agent forwarding, not mounted keys.
2. **Open in VS Code** → `Dev Containers: Reopen in Container` (first build takes a few minutes).
3. **Authenticate Claude** once, inside the container:

```bash
claude auth login
```

Claude config persists in `claude-config`. Host Codex auth is imported into the separate `codex-config` volume during container creation; subsequent token refreshes stay container-local. Both volumes survive rebuilds.

## Every start

`.devcontainer/post-start.sh` runs on each container start (~15s): it reinstalls Claude Code, Codex, and the global dev tools to current, then runs `bun install` so a branch switch can't leave `node_modules` stale. Every step tolerates failure — if a download can't reach the network you get a warning on stderr and the version baked into the image, never a container that refuses to start. Edit the script and restart; no rebuild needed. Same for the aliases in `.devcontainer/shell-config.sh` — edit, then open a new shell.

## Using Claude Code

```bash
claude       # interactive
clauded      # claude --dangerously-skip-permissions (alias)
```

## Using Codex

```bash
codex        # interactive
codexd       # codex --yolo (alias)
```

## Isolation model — what's actually true

`clauded` and `codexd` are acceptable here because of what this container can and cannot reach:

- ✅ **No host filesystem** beyond this project's workspace and the explicit read-only Codex credential file.
- ✅ **No SSH keys in the container** — agent forwarding only; keys can be used for git, never read.
- ✅ **No docker socket** — the host Docker daemon is unreachable.
- ⚠️ **Full network egress.** A prompt-injected agent could exfiltrate anything readable inside the container: this project's source, agent credentials, and whatever is in `.devcontainer/.env`. Accepted risk — keep only low-value dev credentials in `.env`. If this project ever holds credentials whose theft would hurt, add the egress firewall (see the skill's optional blocks).
- ⚠️ Both agents run as **root inside the container** — full access within it, by design.

## Project specifics

**No database service.** garnish stores data in SQLite via `bun:sqlite`, in a file inside the workspace — there is no `db` container, no `DATABASE_URL`, and no entry in the skill's host port registry. Backup is a file copy. If the project ever moves to Postgres, re-run the `devcontainer` skill rather than hand-adding a service.

Forwarded ports:

| Port | What |
|---|---|
| 3000 | Garnish API / app (`Bun.serve` default) |
| 5173 | Vite dev server — only if a separate Vite server is ever added; Bun's HTML-import bundler doesn't need it |
| 4983 | Drizzle Studio — forwarded on request; drizzle isn't a dependency yet, and `drizzle-kit` is **not** installed globally (the skill installs it only alongside the Postgres block) |

## Volumes and persistence

- `claude-config` → `/root/.claude` — auth/settings, survives rebuilds
- `codex-config` → `/root/.codex` — imported host auth plus container settings, survives rebuilds
- `garnish-node-modules` → `/workspace/node_modules` — container-private so Linux and macOS native binaries don't collide

No `postgres-data` or `dind-storage` — neither sidecar is in use. Note that the SQLite file lives on the workspace bind mount, so it persists on the host and is **not** covered by a container volume.

## Departures from standard

- **Port 4983 forwarded without the Postgres/drizzle block.** Requested explicitly. The port is published but nothing listens on it until drizzle is added; `drizzle-kit` is not installed, since the skill scopes that to the Postgres block.

## Troubleshooting

Rebuild from the Command Palette: `Dev Containers: Rebuild Container`.
