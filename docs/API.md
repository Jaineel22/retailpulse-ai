# RetailPulse AI — API Documentation (Phase 1 + Phase 2)

Base URL (local dev): `http://localhost:5000/api`

All request/response bodies are JSON. Authenticated routes require:

```
Authorization: Bearer <jwt>
```

## Response envelope

Success:
```json
{ "success": true, "message": "optional", "data": { } }
```

Error:
```json
{ "success": false, "message": "Human readable message", "errors": [ { "field": "email", "message": "Invalid email address" } ] }
```

## Roles

`admin`, `operator`, `analyst` — see the permission matrix in the root [README.md](../README.md#rbac-permission-matrix).

---

## Auth — `/api/auth`

### `POST /api/auth/register`
Public. Always creates a user with role `analyst` (role cannot be self-assigned).

Request:
```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "StrongPass123" }
```
Response `201`:
```json
{ "success": true, "message": "User registered successfully", "data": { "token": "...", "user": { "id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "analyst" } } }
```
Errors: `400` validation, `409` email already registered.

### `POST /api/auth/login`
Public.

Request:
```json
{ "email": "jane@example.com", "password": "StrongPass123" }
```
Response `200`: same shape as register. Errors: `400` validation, `401` invalid credentials.

### `GET /api/auth/me`
Auth required (any role).

Response `200`:
```json
{ "success": true, "data": { "user": { "id": "...", "name": "...", "email": "...", "role": "..." } } }
```
Errors: `401` missing/invalid/expired token.

---

## Users — `/api/users`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/api/users` | admin | List all users |
| GET | `/api/users/:id` | admin, or self | Any other user id returns `403` |

---

## Vendors — `/api/vendors`

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/api/vendors` | admin, operator | `409` on duplicate name |
| GET | `/api/vendors` | any authenticated | |
| GET | `/api/vendors/:id` | any authenticated | `404` if missing |
| PUT | `/api/vendors/:id` | admin, operator | Partial update |
| DELETE | `/api/vendors/:id` | admin | |

Vendor fields: `name` (required, unique), `contactEmail`, `contactPhone`, `address`, `status` (`active`\|`inactive`).

---

## Products — `/api/products`

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/api/products` | admin, operator | Validates the referenced vendor exists; `409` on duplicate SKU |
| GET | `/api/products` | any authenticated | Optional `?vendor=<id>&category=<name>` filters |
| GET | `/api/products/:id` | any authenticated | |
| PUT | `/api/products/:id` | admin, operator | |
| DELETE | `/api/products/:id` | admin | |

Product fields: `name`, `sku` (required, unique), `description`, `category`, `price` (>= 0), `vendor` (ObjectId, required), `isActive`.

---

## Inventory — `/api/inventory`

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/api/inventory` | admin, operator | One record per product; `409` if one already exists |
| GET | `/api/inventory` | any authenticated | |
| GET | `/api/inventory/:id` | any authenticated | |
| PUT | `/api/inventory/:id` | admin, operator | Adjust `quantity` / `reservedQuantity` / `reorderThreshold` |
| DELETE | `/api/inventory/:id` | admin | |

Inventory fields: `product` (ObjectId, required, unique), `quantity` (>= 0), `reservedQuantity` (>= 0), `reorderThreshold` (>= 0). `status` is a derived, read-only field: `in_stock` \| `low_stock` \| `out_of_stock`.

---

## Orders — `/api/orders`

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/api/orders` | admin, operator | Server computes `unitPrice`/`subtotal`/`totalAmount` from stored product prices — client-supplied prices are ignored |
| GET | `/api/orders` | any authenticated | Optional `?vendor=<id>&status=<status>` filters |
| GET | `/api/orders/:id` | any authenticated | |
| PUT | `/api/orders/:id` | admin, operator | Body: `{ "status": "confirmed" }`; status must be one of the enum values |
| DELETE | `/api/orders/:id` | admin | |

Order creation request:
```json
{
  "vendor": "<vendorId>",
  "items": [ { "product": "<productId>", "quantity": 3 } ]
}
```
All items' products must belong to the specified vendor, otherwise `400`.

Order statuses: `pending` → `confirmed` → `processing` → `shipped` → `delivered`, or `cancelled`. Phase 1 does not enforce a transition state machine — any valid enum value may be set by an authorized user.

Products and Orders created via sync/webhooks (Phase 2) additionally carry `externalSource` and `externalId`, which are omitted (`undefined`) for records created directly through this API — see the "Integrations & Sync" section below.

---

## Integrations & Sync — `/api/integrations`

### Architecture

```
External commerce provider (simulated)
        │  products / orders / inventory
        ▼
MockCommerceAdapter  (implements IntegrationAdapter)
        │  normalized, provider-agnostic arrays
        ▼
Sync service
        │
        ├──▶ Product   (upsert by externalSource + externalId)
        ├──▶ Inventory (upsert by product reference)
        ├──▶ Order     (upsert by externalSource + externalId)
        └──▶ SyncLog   (running → success | failed, with created/updated/skipped counts)
```

`IntegrationAdapter` (`backend/src/integrations/adapters/IntegrationAdapter.js`) defines the contract every provider adapter implements: `fetchProducts()`, `fetchInventory()`, `fetchOrders()`, each returning a plain array regardless of how many pages the provider needed internally. `MockCommerceAdapter` is the only implementation backing real functionality; `ShopifyStubAdapter` exists solely to prove the `adapterFactory` can resolve more than one provider without the sync service knowing anything provider-specific — calling any of its methods throws `"not yet implemented"`.

The mock provider (`backend/src/integrations/mockCommerceProvider.js`) simulates a real external commerce platform: it never touches Mongoose models, only returns fixed, paginated, provider-shaped data (5 products, 5 inventory records, 3 orders), exactly like a real paginated REST API would.

**Simplification:** a Phase 1 domain `Product`/`Order` requires a `vendor`. Since synced records don't come with a RetailPulse vendor, every `Integration` configures a `config.defaultVendor` — the vendor bucket all of that integration's synced products/orders attach to.

### `POST /api/integrations`
Roles: `admin`.

Request:
```json
{
  "name": "Mock Commerce (Primary)",
  "provider": "mock-commerce",
  "isActive": true,
  "config": { "defaultVendor": "<vendorId>", "pageSize": 2, "simulateFailure": false }
}
```
Response `201`: the created integration. Errors: `400` validation or `config.defaultVendor` does not reference an existing vendor, `409` duplicate name.

### `GET /api/integrations` / `GET /api/integrations/:id`
Roles: any authenticated (`admin`, `operator`, `analyst`).

### `GET /api/integrations/:id/sync-logs`
Roles: any authenticated. Returns that integration's `SyncLog` history, most recent first.

### `POST /api/integrations/:id/sync`
Roles: `admin`, `operator` (mirrors the write permissions used for vendors/products/inventory/orders elsewhere in the API — `analyst` is read-only).

Runs a full sync: fetches products, then inventory, then orders from the resolved adapter (in that order, so order line items can always resolve against already-synced products), upserting each into MongoDB by external identity, wrapped in a small retry (see below).

Response `200` (success):
```json
{
  "success": true,
  "message": "Sync completed successfully",
  "data": {
    "syncLog": {
      "status": "success",
      "counts": {
        "productsCreated": 5, "productsUpdated": 0, "productsSkipped": 0,
        "inventoryCreated": 5, "inventoryUpdated": 0, "inventorySkipped": 0,
        "ordersCreated": 3, "ordersUpdated": 0, "ordersSkipped": 0
      }
    }
  }
}
```
Running the same sync again produces `productsCreated: 0, productsUpdated: 5, ...` — proof that repeated syncs upsert by `externalId` rather than duplicating records.

Response `502` (adapter/provider failure — e.g. `config.simulateFailure: true`):
```json
{ "success": false, "message": "Sync failed", "data": { "syncLog": { "status": "failed", "error": "mock-commerce provider is unreachable (simulated outage)" } } }
```
The `SyncLog` is always persisted (with partial counts) even on failure, so a failed sync is fully observable.

Other errors: `400` integration not found / integration not active / bad integration id; `403` role not permitted.

### Retry & pagination
Each adapter fetch call (`fetchProducts`/`fetchInventory`/`fetchOrders`) is wrapped in `withRetry()` (`backend/src/utils/retry.js`): up to 2 retries with exponential backoff (50ms, 100ms), no jitter, no job queue. `MockCommerceAdapter` internally walks every page the mock provider returns (`hasMore`) and hands the sync service one flat array — the sync/webhook services never deal with pagination directly.

---

## Webhooks — `/api/webhooks/mock-commerce`

### Architecture

```
Webhook delivery (simulated provider)
        │
        ▼
X-Webhook-Secret check  ──── invalid/missing ───▶ 401
        │ valid
        ▼
Payload validation (Zod, per event type)  ─── invalid ───▶ 400
        │ valid
        ▼
Idempotency check (provider + eventId)
        │
        ├── already recorded ──▶ return 200 { duplicate: true }, no mutation
        │
        └── new event ──▶ record WebhookEvent (status: received)
                              │
                              ▼
                        Apply domain update (Product / Inventory / Order)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              status: processed   status: failed (safe error, no stack trace)
```

**No JWT here** — this endpoint is called by an external system, not a logged-in RetailPulse user. It is protected instead by a shared-secret header:

```
X-Webhook-Secret: <MOCK_COMMERCE_WEBHOOK_SECRET>
```

This is a **mock** authentication mechanism (static shared secret, no HMAC payload signature, no timestamp/replay window) — documented as such deliberately. Production-grade signature verification (HMAC over the raw body, as Stripe/Shopify do) is left for the security-hardening phase.

### Idempotency guarantee (critical)

`WebhookEvent` has a **unique MongoDB index on `(provider, eventId)`**. Processing:
1. Fast-path `findOne({ provider, eventId })` — if found, return `{ duplicate: true }` immediately with no domain mutation.
2. Otherwise `WebhookEvent.create(...)` — if this hits the unique index (a race between two concurrent identical deliveries), the duplicate-key error is caught and treated the same as step 1. This is what makes the guarantee correct under concurrency and survive an application restart, unlike an in-memory `Set`.
3. Only after the event is durably recorded does the domain handler run.

**Simplification:** once a `(provider, eventId)` pair is recorded — success or failure — it is permanently considered "seen." A failed event is not retried on replay of the same `eventId`; the (simulated) provider would need to send a new `eventId` to retry. Real-world webhook systems vary on this; Phase 2 picked the simpler, fully database-index-enforced behavior.

### `POST /api/webhooks/mock-commerce`

Request shape (discriminated by `type`):

```json
{ "eventId": "evt-10001", "provider": "mock-commerce", "type": "product.updated",
  "data": { "externalId": "mock-prod-001", "price": 29.99, "name": "...", "category": "...", "description": "..." } }
```
```json
{ "eventId": "evt-10002", "provider": "mock-commerce", "type": "inventory.updated",
  "data": { "externalId": "mock-prod-001", "quantity": 42, "reorderThreshold": 10 } }
```
```json
{ "eventId": "evt-10003", "provider": "mock-commerce", "type": "order.created",
  "data": { "externalId": "mock-order-101", "status": "pending",
            "items": [ { "externalProductId": "mock-prod-001", "quantity": 2 } ] } }
```
```json
{ "eventId": "evt-10004", "provider": "mock-commerce", "type": "order.updated",
  "data": { "externalId": "mock-order-101", "status": "shipped" } }
```

`product.updated`/`inventory.updated`/`order.updated` require the referenced product/order to already exist (created via a prior sync or `order.created` event) — resolved by `(externalSource, externalId)`, exactly like the sync upserts. `order.created` computes `unitPrice`/`subtotal`/`totalAmount` from the already-synced product's stored price — the webhook payload never supplies a price.

Responses:
- `201` new event, processed successfully — `{ "data": { "duplicate": false, "eventId": "...", "status": "processed" } }`
- `200` duplicate event, safely ignored — `{ "data": { "duplicate": true, "eventId": "...", "status": "processed" } }`
- `400` validation failure (missing `eventId`, unsupported `type`, malformed `data`), OR the event was recorded but its referenced product/order could not be resolved — `{ "data": { "eventId": "...", "error": "..." } }`
- `401` missing or invalid `X-Webhook-Secret`

---

## Status codes used

| Code | Meaning |
|---|---|
| 200 | Successful read/update/delete, or a safely-ignored duplicate webhook event |
| 201 | Successful creation |
| 400 | Validation failure / bad request / unresolvable external reference |
| 401 | Missing, invalid, or expired authentication (JWT or webhook secret) |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate email/name/SKU/inventory record) |
| 500 | Unexpected server error |
| 502 | Upstream integration/adapter failure (sync only) |
