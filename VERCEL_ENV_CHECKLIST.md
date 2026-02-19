# Vercel Environment Variables – What You Need for Database & App

Add these in **Vercel** → your project → **Settings** → **Environment Variables**.  
Enable each variable for **Production** (and Preview/Development if you use them), then **Save** and **Redeploy**.

---

## 1. Database (required for DB ↔ Vercel)

These are what the app uses to talk to Supabase. Without them, you get "Database temporarily unavailable".

| Variable | Value | Notes |
|----------|--------|--------|
| **DATABASE_URL** | See below | **Must use port 6543 and pgbouncer for Vercel.** |
| **DIRECT_DATABASE_URL** | See below | Used by Prisma for migrations; can use same pooler URL. |

### DATABASE_URL (copy this exactly, replace password if yours is different)

```
postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
```

- **Port must be 6543** (transaction mode for serverless).
- **Must include `pgbouncer=true`** in the query string.
- Host must be **pooler.supabase.com** (not `db.yezeyzqalpiefanrosws.supabase.co`).

### DIRECT_DATABASE_URL (same password; pooler is fine)

```
postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
```

Or you can use port 5432 for this one if you prefer; migrations usually run from your machine. For consistency, using 6543 is fine.

---

## 2. App & auth (required for app to run correctly)

| Variable | Value | Notes |
|----------|--------|--------|
| **NEXT_PUBLIC_APP_URL** | `https://keldatagh.com` | Your live site URL. |
| **NEXTAUTH_URL** | `https://keldatagh.com` | Same as app URL. |
| **NEXTAUTH_SECRET** | (generate one) | Run: `openssl rand -base64 32` and paste the output. |
| **NODE_ENV** | `production` | Vercel often sets this; you can set it if missing. |
| **NEXT_PUBLIC_APP_NAME** | `Keldatagh` | Optional; for branding. |

---

## 3. Supabase (if you use Supabase features in the app)

| Variable | Value | Notes |
|----------|--------|--------|
| **NEXT_PUBLIC_SUPABASE_URL** | `https://yezeyzqalpiefanrosws.supabase.co` | From Supabase project settings. |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | From Supabase project settings (anon/public key). |

---

## 4. Optional (payments, uploads, etc.)

| Variable | When to add |
|----------|-------------|
| **PAYSTACK_SECRET_KEY**, **NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY** | If you use Paystack (or set in Admin → Payment Settings). |
| **CLOUDINARY_CLOUD_NAME**, **CLOUDINARY_API_KEY**, **CLOUDINARY_API_SECRET** | If you use logo/file uploads via Cloudinary. |

---

## Checklist

- [ ] **DATABASE_URL** is set with **port 6543** and **`pgbouncer=true`**.
- [ ] **DIRECT_DATABASE_URL** is set (same or similar pooler URL).
- [ ] **NEXT_PUBLIC_APP_URL** = `https://keldatagh.com`
- [ ] **NEXTAUTH_URL** = `https://keldatagh.com`
- [ ] **NEXTAUTH_SECRET** is set (random string from `openssl rand -base64 32`).
- [ ] All variables are enabled for **Production** (and Preview if you use it).
- [ ] You clicked **Save** after editing.
- [ ] You **Redeployed** (Deployments → ⋯ → Redeploy) after changing env vars.

---

## Where to get Supabase values

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **Settings** → **Database**.
3. Under **Connection string**, choose **URI** and **Transaction** (or Session if you only use 5432 for DIRECT).
4. Copy the URI and ensure:
   - Host: `aws-1-eu-west-1.pooler.supabase.com` (or your pooler host).
   - Port: **6543** for DATABASE_URL.
   - Password is your database password (same as in Supabase).

---

## After changing env vars

1. **Redeploy** the project (Deployments → latest → ⋯ → Redeploy).
2. Wait for the deploy to finish.
3. Test login, signup, or any action that uses the database.
4. If you have admin access, open `https://keldatagh.com/api/debug/db-config` to confirm it shows port **6543** and transaction mode.

The connection between the database and Vercel depends on **DATABASE_URL** (and **DIRECT_DATABASE_URL**) being set correctly and using **6543 + pgbouncer**. Once those are in place and you redeploy, the app can communicate with the database properly.
