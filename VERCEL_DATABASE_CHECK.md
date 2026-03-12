# Vercel Database Connection Check

## Current Configuration

Use this **recommended** `DATABASE_URL` for Vercel:
```
postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
```

✅ **This is correct** - it uses:
- `pooler.supabase.com` (not `db.`)
- Port `6543` (transaction mode)
- `pgbouncer=true`
- `connection_limit=1` (good for serverless)

## Action Required: Verify Vercel Environment Variables

The `MaxClientsInSessionMode` error means Vercel might be using a different `DATABASE_URL` or it's not set at all.

### Step 1: Check Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **BundleArena** project
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL` and verify it matches:

```
postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
```

### Step 2: If DATABASE_URL is Missing or Different

1. Click **Edit** on `DATABASE_URL` (or **Add** if missing)
2. Set the value to:
   ```
   postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
   ```
3. Make sure it's enabled for **Production**, **Preview**, and **Development**
4. Click **Save**

### Step 3: Redeploy

After updating the environment variable:
1. Go to **Deployments** tab
2. Click **⋯** (three dots) on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger a redeploy

## Why this fixes it

`MaxClientsInSessionMode` means session pooling was used under serverless load.  
Transaction mode (`6543` + `pgbouncer=true`) avoids this by reusing pooled connections per transaction.

## Verify It's Working

After redeploying, check:
1. Login should work without `MaxClientsInSessionMode` errors
2. Check Vercel function logs for any database connection warnings
3. The app should show "Service temporarily unavailable" (503) instead of raw Prisma errors if connection issues occur

## Troubleshooting

If errors persist:

1. **Check Supabase Dashboard:**
   - Go to your Supabase project → Settings → Database
   - Verify the connection pooler is enabled
   - Check if there are connection limits on your plan

2. **Check Vercel Logs:**
   - Go to Vercel → Your Project → Functions → View Logs
   - Look for database connection errors

3. **Verify Environment Variables:**
   - Make sure `DATABASE_URL` is set for all environments (Production, Preview, Development)
   - Check for typos or extra spaces

4. **Supabase Plan Limits:**
   - Free tier: Limited concurrent connections
   - Pro tier: Higher limits
   - If on free tier, consider upgrading or optimizing connection usage
