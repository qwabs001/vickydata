# GhBundle Reseller API Proxy

Use this **Cloudflare Worker** when your server IP is blocked by Vercel Checkpoint (403 Forbidden).  
The proxy forwards requests to ghbundle.com; Vercel sees Cloudflare's IP instead of yours.

## Quick setup

1. **Install Wrangler** (Cloudflare CLI):

   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:

   ```bash
   wrangler login
   ```

3. **Set the target URL** in `wrangler.toml` (default: `https://ghbundle.com`).

4. **Deploy**:

   ```bash
   cd reseller-api-proxy
   wrangler deploy
   ```

5. **Use the Worker URL** as your base URL:
   ```
   https://ghbundle-api-proxy.<your-subdomain>.workers.dev/api/v1
   ```
   (Replace with the URL Wrangler prints after deploy.)

## For agents getting 403 Forbidden

If you see:
```
403 Forbidden
ID: cpt1::xxx-xxx-xxx
```

1. Ask GhBundle admin to deploy this proxy.
2. Change your base URL from `https://ghbundle.com/api/v1` to the proxy URL above.
3. Keep using the same auth headers (X-API-KEY, X-SIGNATURE, X-TIMESTAMP, X-NONCE).
4. Your original IP is forwarded via X-Forwarded-For, so IP allowlist checks still work.

## Custom domain (optional)

In Cloudflare Dashboard → Workers → your worker → Triggers → Custom Domains, add e.g. `api.ghbundle.com` so agents can use `https://api.ghbundle.com/api/v1`.
