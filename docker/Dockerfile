# garnish — one container, SQLite on a volume. See docs/architecture.md.
#
# Built from the repo root: `docker build -f docker/Dockerfile .`. The build
# context's ignore file is Dockerfile.dockerignore beside this file. GitHub
# Actions (.github/workflows/docker.yml) builds and publishes it to ghcr.io on
# every push to main; docker-compose.yml here pulls that image.
#
# Bun is pinned to the same version as .devcontainer/Dockerfile; the tag must
# be Bun 1.4 or newer (docs/decisions.md row 32: 1.3.x cannot parse the built
# server). test/docker/dockerfile.test.ts asserts the pin and the contract below.

# --- Stage 1: install and build -------------------------------------------
FROM oven/bun:1.4.2 AS build
WORKDIR /app

# Dependencies first so the install layer is cached while source changes.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# `build` sets NODE_ENV=production itself. The prerender step boots the server
# once, which creates ./data inside this stage; it is not copied forward.
RUN bun run build

# --- Stage 2: runtime ------------------------------------------------------
# `-slim` is Debian slim plus Bun: bun:sqlite is built into the binary and
# .output bundles every dependency, so nothing else is needed at runtime.
FROM oven/bun:1.4.2-slim
WORKDIR /app

COPY --from=build /app/.output ./.output

# Boot (src/server.ts) creates DATA_DIR, migrates and seeds before the first
# request, so migrations run on every start; no separate step is needed.
# HOST=0.0.0.0 so the Nitro bun preset listens beyond the container loopback.
ENV DATA_DIR=/data \
    NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# garnish.db, images/ and backups/ all live here. Runs as root, like Mealie's
# default, so a bind-mounted host directory works without ownership setup.
VOLUME /data
EXPOSE 3000

# The slim image has no curl; Bun's own fetch probes the liveness route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["bun", "run", ".output/server/index.mjs"]
