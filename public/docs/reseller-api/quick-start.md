# Agent Integration Quick Start

## Step 1: Get API credentials

Ask GhBundle admin for:

- API key (`X-API-KEY`)
- API secret (shown once)

## Step 2: Implement signing

For each request:

1. Build `timestamp` (unix seconds)
2. Build random `nonce`
3. Build payload:

```text
METHOD + "\n" + PATH_WITH_QUERY + "\n" + RAW_BODY + "\n" + TIMESTAMP + "\n" + NONCE
```

4. Sign payload with HMAC SHA-256 using your API secret
5. Send headers: `X-API-KEY`, `X-SIGNATURE`, `X-TIMESTAMP`, `X-NONCE`

## Step 3: Sync services

Call:

- `GET /api/v1/services`

Cache results short-term (1-5 minutes).

## Step 4: Check wallet

Call:

- `GET /api/v1/balance`

Only place orders if your balance is enough.

## Step 5: Place orders with idempotency

Call:

- `POST /api/v1/orders`

Always provide a unique `client_order_id` from your system.

## Step 6: Track order status

Use one or both:

- Poll `GET /api/v1/orders/{order_id}`
- Subscribe to webhooks (`POST /api/v1/webhooks`)

## Step 7: Verify webhooks

When webhook arrives:

- recompute signature from payload (without `signature` field)
- compare with `signature` field / `X-Webhook-Signature`
- accept only on exact match

## Step 8: Handle failures safely

- If create order returns `INSUFFICIENT_BALANCE`: top up and retry later.
- If `REPLAY_REQUEST`: regenerate nonce and resend.
- If `RATE_LIMIT_EXCEEDED`: retry after `Retry-After`.

