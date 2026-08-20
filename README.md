# RetailPulse AI

RetailPulse AI is an AI-powered retail operations and analytics platform. This repository is being built in phases; **Phase 1 (backend foundation) and Phase 2 (integrations, webhooks & sync) are complete**. Later phases (ML forecasting, an AI assistant, the React frontend, and Docker deployment) are **not** implemented yet.

## Monorepo layout

```
RetailPulseAI/
├── backend/     ← Phase 1+2: Node.js/Express/MongoDB REST API + integrations (implemented)
├── frontend/    ← Phase 5+: React/Vite UI (not yet implemented)
├── ml-service/  ← Phase 3: FastAPI ML service (not yet implemented)
├── data/        ← reserved for future data assets
├── scripts/     ← reserved for future cross-project scripts
├── docs/        ← API documentation
├── docker/      ← Phase 5: containerization (not yet implemented)
└── README.md
```

## Phase 1 — Backend Foundation

### Tech stack

- Node.js + Express (REST API)
- MongoDB + Mongoose (persistence)
- JWT (`jsonwebtoken`) for authentication
- `bcryptjs` for password hashing
- Zod for request validation
- Jest + Supertest + `mongodb-memory-server` for isolated automated tests

### Architecture

```
routes → controllers → services → models
                ↑
    middleware (auth, rbac, validation, error handling)
```

- **routes** — endpoint definitions only
- **controllers** — HTTP request/response handling
- **services** — business logic and database access
- **models** — Mongoose schemas
- **validators** — Zod schemas for request bodies
- **middleware** — authentication, RBAC, validation, centralized error handling
- **config** — environment loading, MongoDB connection

### Domain models

- **User** — `name`, `email` (unique), `password` (hashed, never returned), `role` (`admin`\|`operator`\|`analyst`), `isActive`
- **Vendor** — `name` (unique), `contactEmail`, `contactPhone`, `address`, `status`
- **Product** — `name`, `sku` (unique), `description`, `category`, `price`, `vendor` (ref → Vendor), `isActive`
- **Inventory** — `product` (ref → Product, unique), `quantity`, `reservedQuantity`, `reorderThreshold`, derived `status`
- **Order** — `orderNumber` (auto-generated, unique), `vendor` (ref → Vendor), `items[]` (ref → Product, quantity, server-computed `unitPrice`/`subtotal`), `totalAmount`, `status`, `createdBy` (ref → User)

### RBAC permission matrix

| Resource | Create | Read | Update | Delete |
|---|---|---|---|---|
| Vendors | admin, operator | any authenticated | admin, operator | admin |
| Products | admin, operator | any authenticated | admin, operator | admin |
| Inventory | admin, operator | any authenticated | admin, operator | admin |
| Orders | admin, operator | any authenticated | admin, operator (status only) | admin |
| Users | — | admin (list); admin or self (get by id) | — | — |

Full endpoint list and example requests/responses: [`docs/API.md`](docs/API.md).

### Getting started

```bash
cd backend
npm install
cp .env.example .env   # then edit JWT_SECRET / MONGODB_URI as needed
```

Requires a running MongoDB instance for `dev`/`start`/`seed` (tests do not need one — they use an in-memory MongoDB).

```bash
npm run dev             # start with nodemon (auto-restart)
npm run start            # start normally
npm test                 # run the automated test suite (mongodb-memory-server)
npm run test:coverage    # run tests with a coverage report
npm run seed              # populate MongoDB with deterministic sample data
```

The API listens on `PORT` (default `5000`); health check at `GET /health`.

### Seed data

`npm run seed` clears the `users`, `vendors`, `products`, `inventory`, and `orders` collections in the configured database and recreates a **fixed, reproducible** dataset every time it runs (no randomness): 3 users (one per role), 3 vendors, 9 products, 9 inventory records spanning `in_stock`/`low_stock`/`out_of_stock`, and 5 orders across different statuses. The script refuses to run when `NODE_ENV=production`.

Seeded dev accounts (local development only — never commit real credentials):

| Role | Email | Password |
|---|---|---|
| admin | admin@retailpulse.ai | Admin123! |
| operator | operator@retailpulse.ai | Operator123! |
| analyst | analyst@retailpulse.ai | Analyst123! |

### Testing strategy

- `tests/env.setup.js` sets a test-only `JWT_SECRET` before any module loads.
- `tests/setup.js` starts an in-memory MongoDB (`mongodb-memory-server`) once per test file, clears all collections after each test, and tears everything down afterward — no real MongoDB instance is touched.
- Suites cover: registration/login/`me` (including password hashing and password never being returned), RBAC (per-role allow/deny, cross-user data access prevention on `/api/users/:id`), and CRUD + validation + authorization for vendors, products, inventory, and orders.
- 45 Phase 1 tests across 6 suites (see the "Phase 2" section below for the combined total).

### Known Phase 1 limitations

- Order status updates accept any valid enum value; there is no enforced state-transition machine (e.g. nothing stops `pending` → `delivered` directly). This is a deliberate simplification for Phase 1.
- Orders do not automatically adjust inventory quantities — inventory and order management are independent domains in Phase 1; reconciling them is left for a later phase.
- No rate limiting, Helmet, or hardened CORS configuration yet — deferred to the security-hardening phase, per the approved architecture.
- No ESLint/TypeScript type-checking is configured (plain JavaScript project); `npm test` and manual smoke testing were used to verify correctness.

---

## Phase 2 — Integrations, Webhooks & Sync

Adds an adapter-based commerce integration layer: a simulated external commerce provider, a normalized sync pipeline into the existing Product/Inventory/Order models, idempotent webhook ingestion, and full sync/event observability — without touching Phase 1's auth, RBAC, or domain CRUD.

```
Simulated external commerce provider
        │
        ▼
MockCommerceAdapter  (implements IntegrationAdapter)
        │  normalized data
        ▼
Sync service ──▶ Product / Inventory / Order (upsert by externalId)
        │
        ▼
      SyncLog (running → success | failed, with counts)

Webhook delivery ──▶ secret check ──▶ validation ──▶ idempotency check ──▶ domain update ──▶ WebhookEvent log
```

Full details, request/response examples, and the idempotency guarantee: [`docs/API.md`](docs/API.md) (see "Integrations & Sync" and "Webhooks").

### What's new

- **Adapter abstraction** (`backend/src/integrations/adapters/`) — `IntegrationAdapter` defines `fetchProducts()`/`fetchInventory()`/`fetchOrders()`; `MockCommerceAdapter` implements it against a simulated provider; `adapterFactory` resolves a provider string to an adapter instance; `ShopifyStubAdapter` is a second, deliberately-unimplemented adapter that only exists to prove another provider can be plugged in without touching the sync service.
- **Mock commerce provider** (`backend/src/integrations/mockCommerceProvider.js`) — fixed, paginated, deterministic data standing in for a real external commerce API. Never touches Mongoose models directly.
- **New models** — `Integration` (configured provider + `config.defaultVendor` + active state), `SyncLog` (per-sync observability: status, counts, error), `WebhookEvent` (idempotency ledger, unique `(provider, eventId)` index).
- **Extended models** — `Product` and `Order` gained optional `externalSource`/`externalId` fields with a partial unique index, enabling upsert-by-external-identity without constraining Phase 1's directly-created records.
- **`POST /api/integrations/:id/sync`** — full sync (products → inventory → orders), retried with exponential backoff on transient adapter failures, always producing a `SyncLog`.
- **`POST /api/webhooks/mock-commerce`** — idempotent webhook ingestion for `product.updated`, `inventory.updated`, `order.created`, `order.updated`, protected by a mock shared-secret header (`X-Webhook-Secret`).

### RBAC additions

| Resource | Create | Read | Trigger sync | Delete |
|---|---|---|---|---|
| Integrations | admin | any authenticated | admin, operator | — (not implemented; out of scope) |

Webhook ingestion has no JWT/RBAC — it's called by an external system, not a logged-in user — and is instead gated by the shared-secret header described above.

### Testing strategy (combined)

- **77 tests across 10 suites**, all passing as of the last run (`npm test`), covering Phase 1 (45) and Phase 2 (32: integrations/sync, webhooks, adapters, retry).
- Phase 2 additions: successful/failed sync with `SyncLog` verification, repeated-sync-does-not-duplicate (external ID upsert), RBAC on integration/sync endpoints, webhook validation (missing `eventId`, unsupported type, malformed payload), and — critically — a duplicate-webhook-delivery test that spies on the underlying Mongoose `save()` call to prove the domain mutation runs exactly once even though the HTTP endpoint is called twice.

### Known Phase 2 limitations

- **Single active integration per provider**: the webhook handler resolves the active `mock-commerce` integration via `Integration.findOne({ provider, isActive: true })` rather than being scoped by integration id in the URL — a deliberate simplification for a single-provider mock setup.
- **Idempotency keys are single-use**: once a `(provider, eventId)` pair is recorded, it is never reprocessed, even if the original attempt failed. A real retry would need a new `eventId` from the provider. See `docs/API.md` for the reasoning.
- **Webhook auth is a mock shared secret**, not a real HMAC payload signature — production-grade signature verification is deferred to the security-hardening phase.
- **No queue/broker**: sync runs synchronously within the request; retry is a simple in-process exponential backoff (2 retries, no jitter), not a background job.
- Order status updates via `order.updated` webhooks or sync still don't enforce a transition state machine (same simplification as Phase 1).

### Explicitly out of scope

The FastAPI ML service, forecasting/anomaly detection, LLM/AI assistant features, the React frontend, and Docker/deployment are **not** implemented — they belong to later phases per the approved architecture.
