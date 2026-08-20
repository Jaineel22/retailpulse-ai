# RetailPulse AI — Phase 1 API Documentation

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

---

## Status codes used

| Code | Meaning |
|---|---|
| 200 | Successful read/update/delete |
| 201 | Successful creation |
| 400 | Validation failure / bad request |
| 401 | Missing, invalid, or expired authentication |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate email/name/SKU/inventory record) |
| 500 | Unexpected server error |
