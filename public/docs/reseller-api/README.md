# GhBundle Reseller API (v1)

**Base URL:** `https://ghbundle.com/api/v1`

**Alternative (if your IP is blocked):** Use the proxy URL from your admin (e.g. `https://ghbundle-reseller-api-proxy.xxx.workers.dev/api/v1`).

This API lets approved **agents/resellers** fetch data services, place wallet-funded orders, track status, and receive webhook updates.

## 1) Authentication

### Simple auth (recommended)

Send your API key in every request. No signing, no IP restrictions.

**Option A — Header**
```http
X-API-KEY: your_api_key
```

**Option B — Bearer token**
```http
Authorization: Bearer your_api_key
```

**Example — fetch balance**
```bash
curl -s "https://ghbundle.com/api/v1/balance" \
  -H "X-API-KEY: your_api_key"
```

**Example — create order**
```bash
curl -s -X POST "https://ghbundle.com/api/v1/orders" \
  -H "X-API-KEY: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"service_id":"svc_xxx","phone":"233XXXXXXXXX","qty":1,"client_order_id":"order-123"}'
```

### Advanced — HMAC signing (optional)

If you prefer signed requests with replay protection, send these headers:

- `X-API-KEY`, `X-SIGNATURE`, `X-TIMESTAMP`, `X-NONCE`

Payload format: `METHOD + "\n" + PATH_WITH_QUERY + "\n" + RAW_BODY + "\n" + TIMESTAMP + "\n" + NONCE`

```js
const crypto = require("crypto");
const method = "POST";
const path = "/api/v1/orders";
const body = JSON.stringify({ service_id: "cmabc123", phone: "233245001122", qty: 1, client_order_id: "agent-001" });
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = crypto.randomBytes(12).toString("hex");
const payload = [method, path, body, timestamp, nonce].join("\n");
const signature = crypto.createHmac("sha256", API_SECRET).update(payload).digest("hex");
```

### HTTPS

Production requests must use HTTPS.

---

## 2) Endpoints

### Services

- `GET /services`
- Query: `network`, `page`, `limit`
- Returns active services with current agent pricing.

### Balance

- `GET /balance`
- Returns agent wallet balance.

### Orders

- `POST /orders`
- `GET /orders`
- `GET /orders/{order_id}`
- `POST /orders/{order_id}/cancel`

#### Create Order Body

```json
{
  "service_id": "svc_123",
  "phone": "233XXXXXXXXX",
  "qty": 1,
  "client_order_id": "agent-unique-123"
}
```

#### Order Rules

1. Service must exist and be active.
2. Total = service price × qty.
3. Wallet must be sufficient.
4. If insufficient, order is rejected with `INSUFFICIENT_BALANCE` and no debit occurs.
5. If accepted, wallet debit + order creation are atomic in one DB transaction.
6. Fulfillment runs asynchronously and updates order status.
7. Failed/canceled orders can be refunded based on workflow.

### Webhooks

- `POST /webhooks`
- `GET /webhooks`
- `DELETE /webhooks/{id}`

Payload on order status update:

```json
{
  "event": "order.updated",
  "order_id": "ord_abc",
  "client_order_id": "agent-unique-123",
  "status": "success",
  "amount": 12.5,
  "currency": "GHS",
  "timestamp": "2026-02-18T11:00:00.000Z",
  "signature": "<hmac_sha256(raw_payload_without_signature, webhook_secret)>"
}
```

Webhook headers:

- `X-Webhook-Event`
- `X-Webhook-Id`
- `X-Webhook-Signature`

Retry policy:

- up to 10 attempts
- exponential backoff
- failures move to dead-letter after max attempts

---

## 3) Idempotency

`client_order_id` is required on `POST /orders`.

If the same agent sends the same `client_order_id` again, the API returns the original order response (no duplicate debit/order).

---

## 4) Statuses

Order status values returned by API:

- `pending`
- `processing`
- `success`
- `failed`
- `canceled`
- `refunded`

---

## 5) Rate Limits

Default limit: `60 requests/minute` per API credential (configurable per key).

When exceeded:

- HTTP `429`
- `Retry-After` header included

---

## 6) Error Format

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Wallet balance is too low for this order.",
    "details": {}
  }
}
```

Common codes:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `INVALID_SIGNATURE`
- `INVALID_TIMESTAMP`
- `REPLAY_REQUEST`
- `RATE_LIMIT_EXCEEDED`
- `INVALID_REQUEST`
- `NOT_FOUND`
- `INSUFFICIENT_BALANCE`
- `CONFLICT`
- `INTERNAL_ERROR`

---

## 7) Agent Onboarding Checklist

1. Admin creates your agent account and wallet.
2. Admin generates API key (and secret if using HMAC).
3. Use base URL `https://ghbundle.com/api/v1` (or proxy if your IP is blocked).
4. Send `X-API-KEY` or `Authorization: Bearer <key>` on every request.
5. Sync services (`GET /services`) and cache for short periods.
6. Use `client_order_id` for every order.
7. Subscribe webhook endpoint and verify signatures.
8. Reconcile orders periodically using `GET /orders/{order_id}`.

---

## 8) Troubleshooting

### Quick test (simple auth)

```bash
curl -s "https://ghbundle.com/api/v1/balance" \
  -H "X-API-KEY: your_api_key"
```

Success: JSON with `currentBalance`, `totalAdded`, `totalSpent`. Failure: JSON with `error.code`.

### Common issues

- **Use simple auth** — Just send `X-API-KEY` or `Authorization: Bearer <key>`. No signing needed. No IP restrictions.
- **403 Forbidden** — Use the proxy URL if your IP is blocked.

### Other errors

- **403 Forbidden (cpt1::…)** — Use the proxy URL instead of ghbundle.com to avoid IP blocking.
- **401 INVALID_SIGNATURE** / **INVALID_TIMESTAMP** / **REPLAY_REQUEST** (HMAC only) — Use simple auth instead.
- **400 INSUFFICIENT_BALANCE** — Top up wallet before placing orders.
- **429 RATE_LIMIT_EXCEEDED** — Back off and retry after `Retry-After`.

