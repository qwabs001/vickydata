# Fix Database 500 Errors on keldatagh.com

If you see "Circuit breaker open" or 500 errors on all API routes, fix `DATABASE_URL` in Vercel.

## Step 1: Get connection string from Supabase

1. Go to https://supabase.com/dashboard
2. Select your project (Keldatagh - yezeyzqalpiefanrosws)
3. **Project Settings** (gear) → **Database**
4. Under **Connection string**, select **URI**
5. Choose **Transaction** mode
6. **Copy** the connection string (it uses `pooler.supabase.com` and port **6543**)
7. Replace `[YOUR-PASSWORD]` with your **actual database password**

## Step 2: Add params to the URL

At the end of the URL, add (use `&` if there is already a `?`):

```
?pgbouncer=true&connection_limit=1&sslmode=require
```

Example result:
```
postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
```

## Step 3: Reset password (if unsure)

1. Supabase → Project Settings → Database
2. Click **Reset database password**
3. Copy the new password
4. Use it in the connection string from Step 1

## Step 4: Set in Vercel

1. Vercel Dashboard → your project
2. **Settings** → **Environment Variables**
3. Find `DATABASE_URL` → **Edit**
4. Paste the full connection string (with `?pgbouncer=true&connection_limit=1&sslmode=require`)
5. **Save**

## Step 5: Redeploy

1. **Deployments** tab
2. Click **...** on latest deployment → **Redeploy**
3. Wait 2–3 minutes
4. Try https://keldatagh.com again

## Verify

Visit: https://keldatagh.com/api/health

- `{"ok":true,"database":"connected"}` = fixed
- `{"ok":false,"database":"disconnected"}` = still broken, recheck password and URL
