# VickyData Production Deployment (vickydata.com)

## Quick deploy (Vercel / auto-deploy)

1. Push to your `main` or `dev001` branch – Vercel will auto-deploy.
2. Ensure env vars are set in the Vercel dashboard (see below).
3. Run migrations against production DB (one-time or after schema changes):
   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```
4. After first deploy: sign in as admin → Settings → Payment Settings → save Moolre credentials.

## Environment variables

Set these in your hosting platform (Vercel, Railway, etc.) before deploying:

```env
# Database – Supabase: MUST use pooled connection (port 6543) to avoid "max clients reached"
# Supabase Dashboard → Settings → Database → Connection string → Transaction mode
# Append: ?pgbouncer=true&connection_limit=1
# Example: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-xx-x.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# NextAuth (required for auth)
NEXTAUTH_SECRET="<run: openssl rand -base64 32>"
NEXTAUTH_URL="https://vickydata.com"

# App
NEXT_PUBLIC_APP_URL="https://vickydata.com"
NEXT_PUBLIC_APP_NAME="VickyData"
NODE_ENV="production"

# Payments (optional – can be set in Admin → Payment Settings instead)
MOOLRE_API_USER=""
MOOLRE_PUB_KEY=""
MOOLRE_SECRET_KEY=""
MOOLRE_ACCOUNT_NUMBER=""
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY="pk_live_xxxxx"
PAYSTACK_SECRET_KEY="sk_live_xxxxx"
PAYSTACK_WEBHOOK_SECRET="whsec_xxxxx"
```

## Supabase connection (required)

Use the **pooled** connection string (port **6543**), not direct (5432):

1. Supabase Dashboard → **Project Settings** → **Database**
2. Under "Connection string", select **URI** and **Transaction** (or Session) mode
3. Copy the URL (it uses `pooler.supabase.com` and port 6543)
4. Append: `?pgbouncer=true&connection_limit=1`
5. Set as `DATABASE_URL` in Vercel

## Database setup

1. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

2. Seed data (if needed):
   ```bash
   npx prisma db seed
   ```

## Build & start

```bash
npm run build
npm start
```

## Post-deploy checklist

- [ ] `NEXTAUTH_URL` points to `https://vickydata.com`
- [ ] `NEXTAUTH_SECRET` is set and kept secret
- [ ] `DATABASE_URL` is valid and reachable
- [ ] Moolre: credentials in Admin → Payment Settings; callback URL in Moolre dashboard: `https://vickydata.com/api/payments/moolre/callback`
- [ ] Paystack webhook URL (legacy optional): `https://vickydata.com/api/webhooks/paystack`

## Reseller API proxy (when agent IPs are blocked)

If agents get **403 Forbidden (cpt1::…)** because their server IP is blocked by Vercel Checkpoint:

1. Deploy the Cloudflare Worker proxy:
   ```bash
   cd reseller-api-proxy
   npx wrangler login
   npx wrangler deploy
   ```
2. Share the Worker URL with affected agents:  
   `https://<worker-name>.<subdomain>.workers.dev/api/v1`
3. Agents use that as base URL instead of `https://vickydata.com/api/v1`. Same auth, same endpoints.
