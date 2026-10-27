# Garnish

A recipe manager for one household, running on your own network. It is made for the phone in the kitchen: install it to your home screen and it opens like an app, keeps the screen awake while you cook, and still shows your recipes when the Wi-Fi drops.

- **Recipes in parts.** A pie is a filling and a pastry, each with its own ingredients and steps. A part can be a recipe of its own, and scales with the one that uses it.
- **Import from anywhere.** Paste a link, or share a page from your phone's browser, and Garnish reads the recipe off it for you to check before it is saved. Mealie and Tandoor backups come across whole.
- **Cook mode.** One step at a time, full screen, with timers that can wake your phone when they finish.
- **Plan and shop.** A week of meals, and a shopping list grouped by aisle that merges what the week needs.
- **Optional AI.** Read a recipe out of pasted text, rewrite a method in your household's own style, or suggest a week of meals. Off unless you turn it on.

There are no accounts: everyone on your network shares one library. Do not expose it to the internet.

## Quick start

You need a machine on your network with [Docker](https://docs.docker.com/get-docker/) and Compose. Make a folder for Garnish and save this in it as `docker-compose.yml`:

```yaml
services:
  garnish:
    image: ghcr.io/sixthshift/garnish:latest
    ports:
      - "9988:9988"
    volumes:
      - ${GARNISH_DATA_DIR:-./data}:/data
    environment:
      DATA_DIR: /data
    restart: unless-stopped
```

Then, from that folder:

```bash
docker compose up -d
```

Open `http://<that machine>:9988`. It starts with an empty library and a set of metric units; **Add your first recipe** gets you going.

To serve it on another port, change the first number in `"9988:9988"`.

### On your phone

Open the same address in your phone's browser and add it to the home screen. Installing it as an app, reading recipes offline and timer alerts all need the page served over HTTPS, so put Garnish behind the reverse proxy you already use for your home services. Over plain `http://` everything else works in the browser.

## Using Garnish

- **Recipes** — search, filter by tag, food or favourites, sort, or roll the dice for something to cook.
- **A recipe** — scale it by servings, tick off ingredients and steps as you go, and switch between each part's ingredients and one merged list. The ⋯ menu edits, duplicates, prints, copies the ingredients, or exports it.
- **Cook** — one card per step, full screen. Start a timer from a step, and swipe or use the arrow keys between cards.
- **Made this** — log that you cooked it, with a date, a note and a photo. The history sits under the recipe.
- **Add a recipe** — from a web page's address, from a Mealie or Tandoor backup, or typed in yourself. On a phone where Garnish is installed, share a page to Garnish to import it.
- **Plan** — a week of meals, a recipe or a plain line in each slot; add the whole week to the shopping list in one tap.
- **Shopping** — one list for the household, grouped by aisle, with the same food from different recipes merged into one line.
- **Settings** — your foods, units, aisles and tags; the house style and the planner's guide; backup and restore; AI; MCP; appearance; and timer alerts for this device.

## Configuration

Garnish is configured with environment variables in the `environment:` section of `docker-compose.yml`. After changing them, run `docker compose up -d` again.

| Variable | What it does |
|---|---|
| `AI_PROVIDER` | Turns the AI on: `api` or `claude-code`. Unset, there is no AI and everything else works. See [AI](#ai) |
| `AI_API_KEY`, `AI_BASE_URL` | Used by `AI_PROVIDER=api` |
| `CLAUDE_CODE_OAUTH_TOKEN` | Used by `AI_PROVIDER=claude-code` |
| `AI_IMPORT_MODEL`, `AI_RESTYLE_MODEL`, `AI_PLANNER_MODEL` | Optional. Which model each feature asks, for either provider |
| `GARNISH_PUBLIC_URL` | Optional. Your tunnel's public address, for Settings › MCP to show and for a tunnel that does not tell Garnish it is https. See [MCP](#mcp) |
| `PUSH_CONTACT` | Optional. A `mailto:` or `https:` address the phone push services see for timer alerts |

To keep keys out of `docker-compose.yml`, put them in a file named `.env` beside it, `AI_API_KEY=...`, and write `AI_API_KEY: ${AI_API_KEY}` in the compose file. Compose fills it in.

### AI

`AI_PROVIDER` says how Garnish reaches a model, and each provider reads only its own settings. Pick one.

**With an API key** (`AI_PROVIDER=api`). Any model API that speaks the OpenAI request format works, which is nearly all of them. The default is Google's Gemini, whose free tier is enough; get a key at [AI Studio](https://aistudio.google.com/apikey):

```yaml
    environment:
      DATA_DIR: /data
      AI_PROVIDER: api
      AI_API_KEY: your-key
```

For another service, set its address and the model each feature asks, since the default models are Gemini's. For example Groq, or an Ollama on your network (Ollama ignores the key, but one must be set):

```yaml
      AI_BASE_URL: https://api.groq.com/openai/v1
      AI_IMPORT_MODEL: llama-3.3-70b-versatile
      AI_RESTYLE_MODEL: llama-3.3-70b-versatile
      AI_PLANNER_MODEL: llama-3.3-70b-versatile
```

Gemini's free tier may train on what it is sent. For an import that is the recipe text you gave it; use a paid tier or a local model for anything you would not publish.

**On a Claude subscription** (`AI_PROVIDER=claude-code`). If you pay for Claude Pro or Max, Garnish can use it through Claude Code instead of an API key. On any computer where Claude Code is signed in, run `claude setup-token` and use the token it prints:

```yaml
    environment:
      DATA_DIR: /data
      AI_PROVIDER: claude-code
      CLAUDE_CODE_OAUTH_TOKEN: sk-ant-oat01-...
```

Every feature asks Claude's Haiku model unless its model variable says `sonnet` or `opus`. It counts against the same usage limits as your own Claude use.

**Models.** Each feature has its own variable — `AI_IMPORT_MODEL` for reading recipes, `AI_RESTYLE_MODEL` for the house style, `AI_PLANNER_MODEL` for the meal planner — and each one unset uses the provider's default: Gemini Flash-Lite for `api`, Haiku for `claude-code`.

**Checking it.** Settings › AI shows which provider is on, whether its key is set (never the key itself) and each feature's model. **Test** checks the connection without spending anything. With Claude Code it can only confirm the token was found; your first import proves it works.

### MCP

Any AI assistant that speaks MCP — Claude (on the web, the phone or Claude Code), ChatGPT, or another — can search, read, add and change recipes, and work with the shopping list and the meal plan, through Garnish's MCP server. Ask it to "add this recipe to garnish" or "put the lasagne on Thursday".

Assistants on the web and the phone call MCP servers from their makers' servers, not from your phone, so the server needs a public https address. (A desktop client on your own network, such as Claude Code, can use `http://localhost` or a LAN address instead.) Everything else stays on your network: forward only these paths to Garnish, for example with a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (free, with a domain on Cloudflare) or [Tailscale Funnel](https://tailscale.com/kb/1223/funnel):

```
/.well-known/oauth-protected-resource*
/.well-known/oauth-authorization-server
/api/oauth/*
/api/mcp
```

That is all: the MCP server is always on, and works out its address from each request, so a request through the tunnel gets the tunnel's address and one on your network gets that one. Settings › MCP shows the address you opened Garnish at, which on your network is right for Claude Code; for Claude on the web or the phone, give it your tunnel's address with `/api/mcp` on the end. To have Settings show the public address instead, or if your tunnel does not send `X-Forwarded-Proto: https`, set it:

```yaml
    environment:
      GARNISH_PUBLIC_URL: https://garnish.example.com
```

**Connecting.** Settings › MCP shows the address. Add it to your assistant as a remote (Streamable HTTP) MCP server: in Claude, Settings › Connectors › Add custom connector; in Claude Code, `claude mcp add --transport http garnish https://garnish.example.com/api/mcp`, then `/mcp`. A Garnish page opens asking what the assistant may do — read, change, delete — and for the pairing code; press Allow. It stays connected until you press Disconnect in Settings › MCP, which lists every connected assistant.

**The pairing code.** Garnish makes it for you; there is nothing to set. It sits in Settings › MCP, hidden until you press Show, with Copy and Regenerate. It changes every time a connection is allowed, so a code that has been typed is never good twice, and Regenerate makes a new one whenever you like without disconnecting anything.

Before an assistant deletes anything, Garnish saves a backup to `backups/` in your data folder, which Settings › Backup can restore.

## Your data

Everything — the database and every photo — lives in one folder on the host: `data/` next to `docker-compose.yml`, or wherever `GARNISH_DATA_DIR` points (for example `GARNISH_DATA_DIR=/mnt/user/appdata/garnish` on Unraid, so its appdata backups cover it). `docker compose down` leaves it alone.

## Backup

A backup is the whole household in one zip: every recipe and its photos, the cook history, the meal plan, the shopping list and both guides. Download one from **Settings › Backup**, or from the machine running Garnish:

```bash
curl -fo garnish-backup.zip http://localhost:9988/api/backup.zip
```

Keep backups somewhere other than that machine.

Exporting a single recipe is different: the recipe's ⋯ menu saves it as JSON or Cooklang, to share or to keep.

## Restore

A restore **replaces** everything with the backup; it never merges. The whole file is checked first, and a file that fails the check changes nothing. Before anything is replaced, what was there is kept inside the data folder as `backups/garnish-pre-restore-<time>.db` and `backups/garnish-pre-restore-<time>-images/`.

From **Settings › Backup › Choose backup…**, Garnish shows what the backup holds beside what you have now, and Restore stays off until you tick "I understand this replaces everything". Or from the machine running Garnish:

```bash
curl -fF file=@garnish-backup.zip 'http://localhost:9988/api/restore?check=1'   # what it holds; changes nothing
curl -fF file=@garnish-backup.zip http://localhost:9988/api/restore
```

To undo a restore, put the kept copy back, using its time in place of `20261007-103000`:

```bash
docker compose stop garnish
docker compose run --rm --no-deps garnish sh -c '
  cd /data &&
  cp backups/garnish-pre-restore-20261007-103000.db garnish.db && rm -f garnish.db-wal garnish.db-shm &&
  rm -rf images && cp -r backups/garnish-pre-restore-20261007-103000-images images'
docker compose start garnish
```

## When something goes wrong

**Settings › Diagnostics** lists what went wrong, newest first: a failure on the server, an error a browser caught, a model call that failed, or a restyle or import whose check refused the model's answer. Tap one for its detail — the stack, the check's report, and the build that saw it. Every error screen also names the build it is running, so a screenshot says which version and commit it came from.

The same events are lines in the server's log, beside a line for every model call and how long it took:

```bash
docker compose logs garnish
```

## Updating

```bash
docker compose pull
docker compose up -d
```

Your data is untouched, and the database is brought up to date on start. The version and commit you are running are at the foot of Settings; what changed is on the [releases page](https://github.com/sixthshift/garnish/releases).

To stay on one version, name it in place of `latest`, for example `image: ghcr.io/sixthshift/garnish:1.2.3`.

## More

- [Development](docs/development.md) — working on Garnish from a checkout: the dev server, tests, building the image, releases.
- [Intent](docs/intent.md), [architecture](docs/architecture.md) and [decisions](docs/decisions.md) — why it is built the way it is.
