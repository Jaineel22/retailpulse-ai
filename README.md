# RetailPulse AI

RetailPulse AI is an AI-powered retail operations and analytics platform. This repository is being built in phases; **Phase 1 (backend foundation) is complete**. Later phases (integrations, ML forecasting, an AI assistant, the React frontend, and Docker deployment) are **not** implemented yet.

## Monorepo layout

```
RetailPulseAI/
├── backend/     ← Phase 1: Node.js/Express/MongoDB REST API (implemented)
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
- 45 tests across 6 suites, all passing as of the last run (`npm test`).

### Known Phase 1 limitations

- Order status updates accept any valid enum value; there is no enforced state-transition machine (e.g. nothing stops `pending` → `delivered` directly). This is a deliberate simplification for Phase 1.
- Orders do not automatically adjust inventory quantities — inventory and order management are independent domains in Phase 1; reconciling them is left for a later phase.
- No rate limiting, Helmet, or hardened CORS configuration yet — deferred to the security-hardening phase, per the approved architecture.
- No ESLint/TypeScript type-checking is configured (plain JavaScript project); `npm test` and manual smoke testing were used to verify correctness.

### Explicitly out of scope for Phase 1

Commerce integrations/webhooks, the FastAPI ML service, LLM/AI assistant features, the React frontend, and Docker/deployment are **not** implemented — they belong to later phases per the approved architecture.
