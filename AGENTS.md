# AGENTS.md

Operating instructions for anyone (human or AI) about to change this repo.
For run instructions aimed at a human skimming GitHub, see `README.md`.

## Purpose

NestJS microservice for personal and group finance management, multi-user,
with Keycloak-based auth and self-issued API Keys so an MCP agent can act on a
user's behalf. **Phase 1 only**: `groups`, `payment-methods`, `expenses`,
`api-keys` are built. `recurring-expenses` + cron, `card-statements` +
matching, and the standalone MCP server are Phase 2–4, not implemented yet.

## Running it locally

```bash
cp .env.example .env
docker compose up -d          # api-db, keycloak-db, keycloak, api
```

Faster iteration loop (compile locally instead of rebuilding the Docker image):

```bash
docker compose up -d api-db keycloak-db keycloak
npm run start:dev
```

API: `http://localhost:3000`, Swagger: `/docs`. Full walkthrough (test user,
curl examples) is in `README.md`.

## Conventions this repo follows

- **Layering** (`microservice-layered-architecture` skill, adapted to NestJS's
  module-by-feature layout): each module (`expenses/`, `groups/`, ...) has
  `<name>.controller.ts` → `<name>.service.ts` → `<name>.repository.ts`, plus
  `model/` (domain entities) and `dto/{request,response}/`. **Only the
  Repository imports `PrismaService`/`generated/prisma/*`** — Services never
  touch Prisma directly, and never call another module's Repository (they call
  that module's **Service** instead — e.g. `ExpensesService` asks
  `GroupsService`/`PaymentMethodsService`, never `GroupsRepository`). Mappers
  (`<name>.mapper.ts`, static methods) are the only place that converts
  between a Prisma row, a Model, and a response DTO. See the plan history
  for the full rationale if this needs re-explaining.
- **Controller/service naming + list responses**: `crud-controller-conventions`
  skill — `create`/`findById`/`search`/`patch`/`delete`, and every `search()`
  returns a `GenericSearchResponse` (`{ data, meta }`, offset `page`/`size`
  pagination, minified `data` items distinct from what `findById()` returns).
- **Wire format**: snake_case JSON in/out; internal TS stays camelCase.
  `src/common/interceptors/case-conversion.interceptor.ts` converts responses
  and request bodies automatically. Query DTOs can't rely on that interceptor
  (Express 5's `request.query` isn't safely mutable) — they use
  `@Expose({ name: 'snake_name' })` per field instead.
- **Errors**: RFC 7807 `application/problem+json` via
  `src/common/filters/problem-json.filter.ts`. Never let a raw exception or
  stack trace reach the client — extend that filter's mapping for new error
  cases instead of throwing unmapped errors.
- **Auth**: `KeycloakAuthGuard` (JWT via JWKS) and `ApiKeyAuthGuard`
  (SHA-256-hashed keys), plus a composite `AuthGuard` accepting either.
  Business endpoints (groups/payment-methods/expenses) use the composite
  guard; `api-keys` management endpoints use `KeycloakAuthGuard` only — an API
  Key must never manage other API Keys.
- **`userId` always comes from the verified token** (`@CurrentUser()`), never
  from the URL/body/query — this is deliberate (see "Non-obvious decisions").
- **`created_at` is persisted on every created resource**, including
  child/association rows (`@default(now())` on every Prisma model, no
  exceptions).
- **Every model's indexes are cross-checked against what its `search()`
  actually filters/sorts by** (`crud-controller-conventions` skill) — see the
  rationale comments right next to each `@@index(...)` in
  `prisma/schema.prisma`. Don't add an index reflexively for a new filter
  field, and don't strip one without checking why it's there first (some
  exist for FK constraint performance, not search).

## Non-obvious decisions (and why)

- **Offset pagination with a total count, not cursor-based** — explicit
  project decision, a deliberate departure from the `rest-api-guidelines`
  skill's own recommendation (its rules 160/254). If one specific collection
  later needs true cursor pagination for scale, change just that `search()`,
  not the whole convention.
- **Money is flat `amount` (Int, cents) + `currency` on `Expense`**, not the
  nested `Money` object `rest-api-guidelines` suggests — following the
  original spec's data model as source of truth.
- **JWT verification uses `node:crypto`'s `createPublicKey({ format: 'jwk' })`**
  instead of `jwks-rsa`/`jwk-to-pem` — avoids pulling in `jose` (ESM-only,
  breaks under Jest without extra config) and `elliptic` (known vulnerability,
  no fix, via `jwk-to-pem`), with zero added dependencies.
- **Keycloak's `KC_HOSTNAME` is pinned** (`docker-compose.yml`) so a token's
  `iss` claim is stable regardless of whether the caller hit Keycloak via
  `localhost` or the internal Docker network name. `KEYCLOAK_ISSUER_URL`
  (expected `iss`, external/pinned) and `KEYCLOAK_JWKS_URI` (where this
  process actually fetches keys from — internal network when running in
  Docker) are separate env vars for exactly this reason; see the comment in
  `keycloak-auth.guard.ts` before collapsing them back into one.
- **Migrations apply automatically on `docker compose up`** via a one-shot
  `migrate` service (`Dockerfile`'s `migrate` build target — keeps the full
  Prisma CLI, unlike the pruned `runtime` target) that runs
  `prisma migrate deploy` and gates `api`'s startup with
  `depends_on: condition: service_completed_successfully`. To add a new
  migration during development, edit `prisma/schema.prisma` and run
  `npx prisma migrate dev --name <description>` against the running `api-db`
  from the host — never hand-edit an already-applied migration's `.sql`.
- **Prisma generator uses `moduleFormat = "cjs"`** (`prisma/schema.prisma`) —
  this project is CommonJS (Nest's default) but Prisma 7's generated client is
  ESM by default, which breaks `require()` under Node/Jest without this.
- **`.claude/`, `.windsurf/`, `.agents/`, `skills-lock.json` are gitignored on
  purpose** (`gitignore-agent-tooling` skill) — don't remove that just because
  `prisma generate` or another CLI wants to write there again.
- **Any group member can `patch`/`delete` an expense**, not just its
  creator — the spec doesn't restrict this explicitly; flagged as a judgment
  call, revisit if it turns out to be wrong.
- **`ExpenseSplit.userId` is indexed even though no endpoint uses it yet**
  (decided 2026-08-24) — kept on purpose in anticipation of a "my
  balance"/"who owes whom" endpoint, since the splits model already exists
  and the index is cheap to carry. If that feature still hasn't landed in a
  few months, revisit whether to drop it.
- **Enums stay as Prisma's generated enums** (`generated/prisma/enums`),
  imported directly in Models/DTOs/Services — not duplicated as app-owned
  enums. They're string constants, not entities; `microservice-layered-architecture`
  itself allows Enums in every layer.
- **Unit tests mock the layer directly below, not Prisma/DB** — a Service
  mocks its own Repository plus any other module's Service it calls
  (never that module's Repository), a Controller mocks its Service, a
  Repository test (rare — mostly `buildWhere`-style query-building logic)
  mocks `PrismaService`. Direct class instantiation with plain
  `{ method: jest.fn() }` objects, not `Test.createTestingModule`, unless
  real DI resolution is actually being tested. `coverageThreshold.global.lines`
  is 80 in `package.json`; `prisma/prisma.service.ts` is excluded from
  `collectCoverageFrom` since it just wires up the real `PrismaClient`'s
  `$connect`/`$disconnect` lifecycle — not meaningfully unit-testable.

## Known gaps (deliberately out of scope right now)

- `POST /groups/:id/invite` — not implemented; the spec leaves the invite
  mechanism (email invite vs. direct lookup) as an open decision.
- `isRecurring`/`installments` are not wired into `POST /expenses`'s body yet —
  land with the `recurring-expenses` module (Phase 2).
- Phase 2 (`recurring-expenses` + monthly cron), Phase 3 (`card-statements` +
  matching), Phase 4 (standalone MCP server) are not built.

## Where to look next

- `README.md` — human-facing run instructions, script list, folder structure.
- `postman/personal-finance-service.postman_collection.json` — example
  requests, chained via collection variables.
- `prisma/schema.prisma` — full data model, including tables for phases not
  yet built (`RecurringTemplate`, `InstallmentPlan`, `CardStatement`,
  `StatementItem` already exist since `Expense` references them by FK).
