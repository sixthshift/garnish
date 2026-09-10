# garnish

A personal recipe manager. Single household, runs on the LAN, no public exposure.

## Docs

- [`docs/intent.md`](docs/intent.md) — why, and what it refuses to do
- [`docs/architecture.md`](docs/architecture.md) — stack, data model, scaling, API, persistence rules
- [`docs/decisions.md`](docs/decisions.md) — decision log; add a row to reverse one, don't edit
- [`docs/scope.md`](docs/scope.md) — v1, later, open, never
- [`docs/plan.md`](docs/plan.md) — implementation tasks and the loop protocol; the only doc the loop edits

Keep the argument in `docs/`; keep operating constraints here.

## Constraints

- **Store:** SQLite via `bun:sqlite` is the only store. No file export in v1. Recipes are mastered in the DB.
- **Schema:** Mealie's shapes outside recipe internals, minus users and groups. `https://demo.mealie.io/openapi.json` is the reference.
- **Tie-breaker:** when unsure about any product or schema question, do what Mealie does.
- **Recipe internals:** a recipe is an ordered list of named components; each owns its ingredients and may hold several steps. Sub-recipes hang off `food.recipe_id`; the column exists, the behaviour is deferred.
- **Auth:** none. No users table, no sessions.
- **AI:** none in v1. Design the recipe document so a future `claude -p` import returns exactly what the editor saves.
- **Frontend:** React + Tailwind 4 via Bun HTML imports. Phone-first PWA.
- **UI kit:** `@sixthshift/design-system` (Jason's personal system). Subpath imports only, e.g. `@sixthshift/design-system/button`. Check its exports before writing any UI element. Missing primitives are built locally from its pieces.
- **Locale:** metric, en-AU spelling. UUID ids, zod validation, images on disk.
- **Deploy:** one Docker container, SQLite file on a volume.
- **Cooklang:** borrow sections, `=` fixed quantities, servings scaling, aisle config. Do not adopt the file format.

## Conventions

Copy decisions from the incumbents by default; diverge only where this file says to. Both are AGPL-3.0 — this project is not distributed, so the licenses don't bind, but do not paste their source in.


Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
