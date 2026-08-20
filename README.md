# RetailPulse AI

RetailPulse AI is an AI-powered retail operations and analytics platform. This repository is being built in phases; **Phase 1 (backend foundation), Phase 2 (integrations, webhooks & sync), and Phase 3 (analytics, forecasting & anomaly detection) are complete**. Later phases (the AI assistant/LLM layer, the React frontend, and Docker deployment) are **not** implemented yet.

## Monorepo layout

```
RetailPulseAI/
├── backend/     ← Phase 1+2+3: Node.js/Express/MongoDB REST API + integrations + ML orchestration (implemented)
├── ml-service/  ← Phase 3: Python/FastAPI forecasting + anomaly detection (implemented)
├── frontend/    ← Phase 5+: React/Vite UI (not yet implemented)
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

### Explicitly out of scope (as of Phase 2)

The FastAPI ML service, forecasting/anomaly detection, LLM/AI assistant features, the React frontend, and Docker/deployment were **not** implemented at the end of Phase 2. Phase 3 (below) adds the ML service; the rest remain future phases.

---

## Phase 3 — Analytics, Forecasting & Anomaly Detection

Adds MongoDB aggregation-based analytics endpoints, a separate Python/FastAPI ML service for demand forecasting and anomaly detection, and the Node-side orchestration/persistence layer connecting them — without touching Phase 1/2's auth, RBAC, integrations, or webhook logic.

```
MongoDB historical data (inventoryevents)
        │
        ▼
Node validates product exists + caller is authorized
        │  GET /forecast/{productId} or /anomalies/{productId}
        ▼
FastAPI ML service (feature engineering, model training/inference, metrics)
        │  JSON response
        ▼
Node validates the response shape — rejects anything malformed, never persists corrupt data
        │
        ▼
MongoDB: Prediction / Anomaly persisted
        │
        ▼
Client, via GET /api/predictions/:productId or GET /api/anomalies
```

Full endpoint documentation, request/response examples, and the full forecasting/anomaly methodology writeup: [`docs/API.md`](docs/API.md) (see "Analytics" and "Predictions & Anomalies"). The `ml-service/` directory has its own [README](ml-service/README.md) with local run instructions.

### Why Python is a separate service from Node
Python provides the natural ML/data ecosystem (pandas, NumPy, scikit-learn) for feature engineering and model training; Node remains the primary application/API layer (auth, RBAC, orchestration, persistence). Each side does the part it's actually suited for.

### Why FastAPI reads MongoDB directly instead of Node sending it the data
The Phase 3 architecture explicitly shows `FastAPI → MongoDB`, and `pymongo` is a required dependency for exactly this reason. FastAPI reads the `inventoryevents` collection directly rather than Node serializing potentially large historical arrays into every request. Node still owns everything user-facing — it validates the product exists and the caller is authorized *before* calling FastAPI, and validates + persists the response *after*. FastAPI defines no duplicate Product/Order/Inventory model of its own.

### Why MongoDB aggregation for analytics
Analytical computation happens close to the data (`$match`/`$group`/`$sort`/`$project`/`$lookup`) rather than pulling raw documents into Node and reducing them in JavaScript — the database is far better at this than the application process is.

### Why RandomForestRegressor over HistGradientBoostingRegressor
Per-product training sets are small (tens of rows once lag/rolling warm-up rows are dropped). Random Forest's bagging/averaging is more stable and less prone to overfitting on small tabular datasets than gradient boosting, which typically needs more data to tune well, and it needs no learning-rate/iteration tuning to behave sensibly out of the box — which keeps its behavior (an ensemble of decision trees, averaged) easy to explain and defend.

### Why compare against a naive baseline
A model is only worth using if it improves on a simple existing strategy. The naive baseline used here is a walk-forward persistence forecast for evaluation (`prediction[t] = actual[t-1]`), and a repeated-last-value forecast for the genuine future horizon (there's no new ground truth to roll forward into the unknown future) — exactly the blueprint's own example.

### Why a chronological train/test split, never random
A random split lets rows *after* a test point end up in training, which leaks future information into a time-series model and produces misleadingly optimistic metrics. The model here trains on all but the most recent `ML_EVAL_DAYS` (default 14) days and is evaluated only on that held-out, always-later tail.

### Why Isolation Forest for anomaly detection
It's an efficient unsupervised approach for flagging unusual observations when no labeled anomaly data exists — true here, since nothing has been hand-labeled as anomalous. It isolates points via random partitioning rather than requiring a fitted distribution or labels.

### Why recommendations/LLM features are out of scope here
They belong to Phase 4 (the grounded AI assistant) per the approved architecture; Phase 3 is deterministic ML only — no generated natural-language explanations anywhere in this phase.

### New Mongoose models

- **InventoryEvent** — `product` (ref → Product), `type` (`restock`\|`sale`\|`adjustment`), `delta` (signed), `source`, `createdAt` only (immutable ledger). The canonical historical time series the ML service reads.
- **Prediction** — `product`, `horizonDays`, `modelName`, `predictedDemand[]`, `baselineForecast[]`, `mae`/`rmse`, `baselineMae`/`baselineRmse`, `modelBeatsBaseline`, `generatedAt`, `triggeredBy` (ref → User).
- **Anomaly** — `product`, `timestamp`, `score`, `reason`, `severity`, `triggeredBy`. Unique index on `(product, timestamp)` — re-running detection upserts rather than duplicating.

### New API endpoints

- `GET /api/analytics/summary` / `sales-trend` / `top-products` / `vendor-performance` — read-only, any authenticated role.
- `POST /api/predictions/run`, `GET /api/predictions/:productId`
- `POST /api/anomalies/run`, `GET /api/anomalies`

### RBAC additions

| Resource | Trigger (write) | Read |
|---|---|---|
| Analytics | — (read-only endpoints) | any authenticated |
| Predictions | admin, operator | any authenticated |
| Anomalies | admin, operator | any authenticated |

Same philosophy as Phase 2's sync trigger: `analyst` can read everything but cannot trigger ML/operational work.

### Seed data extension

`npm run seed` now also generates **60 days of deterministic historical `InventoryEvent` data per seeded product** (a seeded `mulberry32` PRNG — not `Math.random()` — so the exact same values are produced on every run), with a per-SKU demand profile (base level, linear trend, weekend multiplier, noise) plus two fixed, intentionally-injected anomalies (a sales spike on `NWT-001` and a sales drop on `CGL-002`) so anomaly detection has real signal to find when exercised manually. `InventoryEvent`/`Prediction`/`Anomaly` collections are cleared and reseeded on every run, same as every other seeded collection.

### Actual measured forecasting results

Run against the seeded data (60 days of history per product, 14-day chronological evaluation holdout): **the model beat the naive baseline on 8 of the 9 seeded products.**

| SKU | Model MAE | Baseline MAE | Beats baseline? |
|---|---|---|---|
| NWT-001 | 6.52 | 3.57 | **No** |
| NWT-002 | 2.08 | 2.21 | Yes |
| NWT-003 | 0.90 | 0.93 | Yes |
| ALP-001 | 1.83 | 4.29 | Yes |
| ALP-002 | 1.30 | 2.14 | Yes |
| ALP-003 | 1.12 | 1.21 | Yes |
| CGL-001 | 1.88 | 4.14 | Yes |
| CGL-002 | 2.72 | 4.86 | Yes |
| CGL-003 | 2.39 | 2.86 | Yes |

`NWT-001` has this dataset's strongest linear trend (+0.12/day). `RandomForestRegressor` cannot extrapolate beyond the range of target values it saw during training, so on a strongly, near-monotonically trending series the naive baseline — which by definition tracks yesterday's value, and therefore the trend itself — can be more competitive than a tree ensemble. This is reported as-measured rather than hidden or hyperparameter-tuned away.

Anomaly detection correctly recovered both intentionally-injected anomalies from the seed data at their exact dates, with `severity: "high"` and the correct directional `reason` text (verified via live manual testing against the seeded database).

### Testing strategy

- **Python**: 26 pytest tests (`ml-service/tests/`), no MongoDB required — `preprocessing`/`forecasting`/`anomaly_detection` all operate on plain pandas DataFrames, and the one route-level test file monkeypatches the two functions that touch MongoDB. Covers feature shape, lag correctness, no-leakage rolling means (including a test that corrupts a day's own value and asserts its own rolling mean is unaffected), chronological split ordering, model training, MAE/RMSE, baseline comparison, and anomaly output schema/severity/reason.
- **Node**: 101 tests across 14 suites (98 before + 3 new for the optional cron job), all passing (`npm test`) — covers analytics aggregation correctness (verified against hand-computed expected values), prediction/anomaly RBAC, successful persistence, ML-service-unreachable → safe `502` with nothing persisted, malformed-ML-response → rejected before persistence, and `INSUFFICIENT_HISTORY` → `400`.

### Known Phase 3 limitations

- `RandomForestRegressor`'s extrapolation limitation on strongly trending series (see measured results above) — a documented, expected characteristic of tree ensembles, not a bug.
- `InventoryEvent` history is synthetic and independent of the live `Inventory.quantity` snapshot — the two are not reconciled against each other in this phase.
- The optional cron job (`ENABLE_PREDICTION_CRON=true`) loops over products sequentially with no concurrency control or backoff between products; acceptable at this project's scale (explicitly no queue/broker), but would not scale to a large catalog.
- No authentication inside FastAPI — by design, it's an internal-only service; if it were ever exposed beyond localhost, it would need its own protection.
- No MAPE reporting or hyperparameter tuning (both explicitly OPTIONAL in the blueprint) — skipped in favor of the MUST-HAVE items.

### Explicitly out of scope

The LLM/AI assistant, recommendations, the React frontend, and Docker/deployment are **not** implemented — they belong to later phases per the approved architecture.
