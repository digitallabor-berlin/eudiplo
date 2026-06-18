# AGENTS.md

> Operating guide for AI coding agents (and humans new to the repo) working on
> the EUDIPLO codebase. Optimised for "what do I need to know to make a useful
> change without breaking anything?".
>
> Keep this file up to date when you change build/dev workflows, add an app or
> package, or apply local-only patches that need to survive future upstream
> merges (see §6).

---

## 1. Project overview

EUDIPLO is an OpenWallet Foundation middleware that abstracts EUDI Wallet
protocols (OID4VCI / OID4VP, SD-JWT VC, mDOC, Token Status List) behind a
single HTTP API. It is **open source (Apache-2.0)** and developed on GitHub at
`openwallet-foundation/eudiplo`. This repository may track that upstream, so
*local-only changes must be documented in §6 so they survive merges*.

---

## 2. Repository layout

```
eudiplo/                       # pnpm workspace root
├── apps/
│   ├── backend/               # NestJS API — the actual middleware (Node 22+)
│   ├── client/                # Angular 22 admin UI
│   ├── webhook/               # Cloudflare Worker — sample relying-party webhook
│   └── kms-reference/         # Cloudflare Worker — reference external KMS
├── packages/
│   └── eudiplo-sdk-core/      # framework-agnostic TS SDK (built with tsup)
├── docs/                      # MkDocs site + Compodoc output
├── scripts/                   # codegen + ops scripts (tsx / ts-node)
├── deployment/                # k8s, docker-compose deployment artifacts
├── schemas/                   # generated JSON schemas
├── biome.json                 # repo-wide lint/format config (Biome)
├── pnpm-workspace.yaml        # workspace config (no Turbo; pnpm -r is the runner)
├── tsconfig.base.json         # shared TS base
├── .env                       # local dev env vars (gitignored)
└── AGENTS.md                  # ← this file
```

Workspace globs: `apps/*`, `packages/*`. The root `package.json` orchestrates
everything via `pnpm -r --parallel` (no Turbo / Nx).

---

## 3. Toolchain

| Tool         | Version             | Notes                                              |
|--------------|---------------------|----------------------------------------------------|
| Node         | >= 22 (engines)     | Node 26 also works locally                         |
| pnpm         | 11.1.0 (pinned)     | declared in root `packageManager`                  |
| Python       | 3.x + venv          | only needed for `pnpm run doc:*` (MkDocs/Mike)     |
| TypeScript   | ^6                  | per-package; client uses Angular's bundled tsc     |
| Biome        | (devDep of backend) | linting + formatting; **not** ESLint               |
| Vitest       | for backend tests   | client tests use Angular's `ng test` (vitest too)  |
| Wrangler     | ^4                  | for `apps/webhook` and `apps/kms-reference`        |

Lock everything via the existing `pnpm-lock.yaml`. Do **not** run `npm install`
or `yarn` — they will desync the lockfile.

---

## 4. Common commands

Run from the repo root unless noted.

```bash
# One-time setup
pnpm install
pnpm run setup:python          # only if you'll touch docs

# Start everything in parallel (backend + client + workers)
pnpm run dev

# Start only one app
pnpm run dev:backend
pnpm run dev:client
pnpm --filter @eudiplo/webhook dev
pnpm --filter kms-reference dev

# Build / lint / test (all workspaces)
pnpm run build
pnpm run lint
pnpm run lint:fix
pnpm run test

# OpenAPI / SDK codegen
pnpm run gen:api               # needs backend running on :3000
pnpm run gen:sdk               # rebuilds packages/eudiplo-sdk-core
pnpm run gen:all

# Docs
pnpm run doc:watch             # serve docs locally (needs Python venv)
pnpm run doc:build             # full doc build (strict)
```

### Default dev URLs

| Service                | URL                              | Notes                                |
|------------------------|----------------------------------|--------------------------------------|
| Backend (NestJS)       | http://localhost:3000            | from `PUBLIC_URL` in `.env`          |
| Backend Swagger JSON   | http://localhost:3000/api/docs-json | used by `pnpm run gen:api`          |
| Client (Angular)       | http://localhost:4200            | first build can take ~30 s           |
| Webhook (workerd)      | http://localhost:8787            | inspector on **9230** (see §6)       |
| KMS reference (workerd)| http://localhost:8788            | inspector on **9231** (see §6)       |

---

## 5. Conventions

- **Lint/format**: Biome. Run `pnpm run lint:fix` before committing.
  Client uses Angular ESLint in addition.
- **Tests**: Vitest. Backend tests live under `apps/backend/test/` and next to
  source. E2E via `pnpm --filter @eudiplo/backend test:e2e`.
- **Commits**: semantic-release is in use; commit messages must follow
  Conventional Commits (`feat:`, `fix:`, `chore:` …) or releases will be wrong.
- **TypeScript style**: `strict` everywhere. The SDK now also enables
  `noPropertyAccessFromIndexSignature` (see §6.4) — match the strictness of
  the package you edit.
- **No new top-level deps** without consulting maintainers — this is an OWF
  project with a CODEOWNERS file. Add deps to the right workspace, not the root.
- **Secrets**: never commit anything that lives in `.env`. The repo's
  `.gitignore` already covers `.env*` patterns.

---

## 6. Local-only fixes (preserve across upstream merges)

These changes are *not yet* upstreamed. When pulling new commits from upstream
(`git pull` from `openwallet-foundation/eudiplo`), check whether any of these
files have been modified upstream and reapply the patches below if a merge
clobbered them. Each section is self-contained so you can re-do it from scratch.

### 6.1 Wrangler dev inspector ports (avoid `9229` collision)

**Problem.** `wrangler dev` defaults its V8 inspector to port `9229`. Both
`apps/webhook` and `apps/kms-reference` run via `wrangler dev` in parallel, so
one of them crashes with `Address already in use (127.0.0.1:9229)`.

**Fix.** Pin a dedicated `inspector_port` per worker, and give each its own
HTTP `port`:

`apps/webhook/wrangler.jsonc` — inside the existing `"dev": { ... }` block:

```jsonc
"dev": {
  "port": 8787,
  "inspector_port": 9230,
  "local_protocol": "http"
}
```

`apps/kms-reference/wrangler.jsonc` — same idea:

```jsonc
"dev": {
  "port": 8788,
  "inspector_port": 9231,
  "local_protocol": "http"
}
```

After reapplying, restart any running `pnpm run dev`. Smoke test:

```bash
lsof -i :8787 -i :8788 -i :9230 -i :9231 | grep LISTEN
```

### 6.2 Backend `.env` is a symlink to the root `.env`

**Problem.** `apps/backend/src/app.module.ts` configures `ConfigModule.forRoot`
without an `envFilePath`, so NestJS reads `.env` relative to the process cwd.
Under `pnpm -r --parallel dev` the backend's cwd is `apps/backend/`, so it
ignores the populated root `.env` and fails Joi validation
(`MASTER_SECRET / AUTH_CLIENT_ID / AUTH_CLIENT_SECRET is required`).

**Fix.** Maintain a single source of truth via symlink. Run once after a
clean checkout:

```bash
# from repo root
rm -f apps/backend/.env
ln -s ../../.env apps/backend/.env
```

`.gitignore` covers both paths, so the symlink is never committed.

**Alternative (more invasive, upstream-friendly):** add `envFilePath` to
`ConfigModule.forRoot` in `apps/backend/src/app.module.ts` so it looks for the
root `.env` regardless of cwd. If you go this route, drop the symlink and the
copy of `MASTER_SECRET` etc. from `apps/backend/.env`, then propose the patch
upstream so this whole section can be removed.

### 6.3 Client resolves `@eudiplo/sdk-core` from source

**Problem.** `apps/client` consumes `@eudiplo/sdk-core` as a workspace package.
If the SDK has never been built, `apps/client/node_modules/@eudiplo/sdk-core`
points to a `dist/` that doesn't contain `*.d.ts`, and the Angular esbuild
plugin fails with `TS7016: Could not find a declaration file for module
'@eudiplo/sdk-core'`. This is a fresh-checkout footgun and will trip any new
contributor running `pnpm run dev` without first building the SDK.

**Fix.** Add TypeScript path mappings so the Angular compiler resolves the SDK
straight from its TypeScript source, sidestepping `dist/` entirely.

Edit `apps/client/tsconfig.json` — add the last two entries to `compilerOptions.paths`:

```jsonc
"paths": {
  "@eudiplo/sdk-angular": ["../../packages/eudiplo-sdk-angular/src/index.ts"],
  "@eudiplo/sdk-angular/*": ["../../packages/eudiplo-sdk-angular/src/*"],
  "@eudiplo/sdk-core":   ["../../packages/eudiplo-sdk-core/src/index.ts"],
  "@eudiplo/sdk-core/*": ["../../packages/eudiplo-sdk-core/src/*"]
}
```

After reapplying, clear stale Angular caches before restarting the dev server:

```bash
rm -rf apps/client/.angular apps/client/dist apps/client/node_modules/.cache
```

**Upstream alternative.** If you'd rather keep the standard `dist/`-based
resolution, add a `predev` hook to `apps/client/package.json`:

```json
"predev": "pnpm --filter @eudiplo/sdk-core build"
```

…and drop the path mapping. We chose the path mapping locally because it gives
instant rebuilds and removes the SDK build step from the dev loop.

### 6.4 SDK stricter TS — `noPropertyAccessFromIndexSignature`

**Problem.** Once §6.3 is in place, the client compiles the SDK source under
its stricter `tsconfig`, which enables `noPropertyAccessFromIndexSignature`.
The SDK itself didn't have that rule on, so a few index-signature accesses
(notably `node._sd` in `packages/eudiplo-sdk-core/src/config/derive.ts`)
broke the client build.

**Fix.** Two coordinated changes:

1. Enable the rule in the SDK's own tsconfig so the SDK can't drift again.

   `packages/eudiplo-sdk-core/tsconfig.json` → add inside `compilerOptions`:
   ```jsonc
   "noPropertyAccessFromIndexSignature": true,
   ```

2. Fix the existing violations. Currently only one site, in
   `packages/eudiplo-sdk-core/src/config/derive.ts` around the
   `buildDisclosureFrame` helper:

   ```ts
   const existing = Array.isArray(node["_sd"])
     ? (node["_sd"] as unknown[])
     : [];
   if (!existing.includes(leaf)) {
     existing.push(leaf);
     node["_sd"] = existing;
   }
   ```

After reapplying, verify the SDK still typechecks:

```bash
cd packages/eudiplo-sdk-core && pnpm exec tsc --noEmit
```

If an upstream merge reintroduces dotted access on an index-signature property,
you'll see new `TS4111` errors — fix them the same way (bracket notation).

### 6.5 Merge checklist

Whenever you pull from upstream, run this quick audit so none of the above
gets silently undone:

```bash
# 1. Wrangler ports
grep -nE "inspector_port" apps/webhook/wrangler.jsonc apps/kms-reference/wrangler.jsonc

# 2. Backend env symlink
test -L apps/backend/.env && readlink apps/backend/.env

# 3. Client path mappings
grep -nE "@eudiplo/sdk-core" apps/client/tsconfig.json

# 4. SDK strict rule + bracket access
grep -n "noPropertyAccessFromIndexSignature" packages/eudiplo-sdk-core/tsconfig.json
grep -n '_sd' packages/eudiplo-sdk-core/src/config/derive.ts
```

If any line is missing/wrong, reapply the relevant subsection above.

---

## 7. Pitfalls / FAQ

- **`pnpm run dev` exits with `Address already in use (127.0.0.1:9229)`.**
  See §6.1 — the Wrangler inspector port collision.

- **Backend boots with `MASTER_SECRET is required`** even though the root
  `.env` is populated. See §6.2.

- **Angular dev server says `TS7016: Could not find a declaration file for
  module '@eudiplo/sdk-core'`.** See §6.3. If the patch is already in place,
  the Angular cache is probably stale — kill `ng serve`, then
  `rm -rf apps/client/.angular apps/client/dist apps/client/node_modules/.cache`
  and restart.

- **Stale dev server.** Angular's esbuild compiler caches under
  `apps/client/.angular/cache/<version>/eudiplo-client/`. Process restart
  alone isn't always enough when SDK / config / d.ts files change — wipe
  that directory.

- **OpenAPI / SDK regeneration.** `pnpm run gen:api` requires the backend
  running at `http://localhost:3000`. `pnpm run gen:sdk` is independent and
  rewrites `packages/eudiplo-sdk-core/src/api/*.gen.ts` — never hand-edit
  files with `.gen.ts` in the name.

- **Docs build needs Python.** `pnpm run setup:python` creates `./venv` and
  installs `requirements.txt`. Activate via `source venv/bin/activate` if you
  invoke `mkdocs` / `mike` directly.

---

## 8. When in doubt

- Read `CONTRIBUTING.MD` (sic — uppercase extension in this repo) for the
  upstream contribution flow.
- `MAINTAINERS.md` lists who to ping for protocol/architecture decisions.
- `docs/` is the canonical user-facing documentation; check there before
  inventing new behaviour.
- Don't introduce Turbo, Nx, or a different task runner without discussing it
  — the current `pnpm -r --parallel` setup is intentional.
- Don't bypass the OpenAPI → SDK pipeline by hand-editing generated files.