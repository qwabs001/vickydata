# Supabase Database Setup (keldatagh.com)

To fix "max clients reached" and enable login, use the **pooled** connection string.

## Steps

### 1. Get pooled connection string from Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. **Project Settings** (gear icon) → **Database**
4. Scroll to **Connection string**
5. Choose **URI** tab
6. Select **Transaction** mode (recommended) or **Session**
7. Copy the connection string — it should:
   - Use `pooler.supabase.com` (not `db.xxx.supabase.co`)
   - Use port **6543** (not 5432)
   - Look like: `postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`

### 2. Add Prisma params

Append this to the end of the URL:

```
?connection_limit=1
```

If you get 500 errors when saving (e.g. payment settings), try **removing** `pgbouncer=true` – Supabase Supavisor 1.21+ may not need it and it can cause issues. Use only:

```
?connection_limit=1
```

### 3. Set in Vercel

1. Vercel Dashboard → your project → **Settings** → **Environment Variables**
2. Edit `DATABASE_URL` (or add it)
3. Paste the full URL with params
4. Save and redeploy

### Example final URL

```
postgresql://postgres.abcdefgh:YourPassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres?connection_limit=1
```
