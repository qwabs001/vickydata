# Why You Keep Seeing "Database temporarily unavailable"

## What’s actually wrong

Your **DATABASE_URL** in Vercel is probably using **Session mode** (port **5432**).  
On Vercel, each serverless function can open its own connection. In **Session mode**, each connection stays open for the whole request. With many requests or concurrent users, you quickly hit Supabase’s connection limit and get:

- "Database temporarily unavailable"
- "MaxClientsInSessionMode"
- 503 errors on login, signup, payment, etc.

So the problem isn’t that the link is “wrong” — it’s that **Session mode is a bad fit for serverless**.

---

## Fix: Use Transaction mode (port 6543)

**Transaction mode** (port **6543**) is meant for serverless:

- Connections are only used during a transaction, then returned to the pool.
- Many requests can share a small pool of connections.
- You avoid hitting the connection limit under load.

Use this **exact** value for `DATABASE_URL` in Vercel (replace with your real password if different):

```
postgresql://postgres.kbzdbwaahfcxutelbmnm:PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
```

Important:

- Host: `aws-1-eu-west-1.pooler.supabase.com` (pooler, not `db.`)
- Port: **6543** (transaction mode), not 5432
- Query: **`pgbouncer=true`** (required for transaction mode), plus `connection_limit=1` and `sslmode=require`

---

## Steps in Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your **VickyData** project.
2. Go to **Settings** → **Environment Variables**.
3. Find **`DATABASE_URL`**.
4. **Edit** (or add it if missing).
5. Set the value to:
   ```
   postgresql://postgres.kbzdbwaahfcxutelbmnm:PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
   ```
6. Enable it for **Production** (and Preview/Development if you use them).
7. Save.
8. **Redeploy**: **Deployments** → latest deployment → **⋯** → **Redeploy**.

After redeploy, try login, signup, and payment again. The “Database temporarily unavailable” and 503 errors should stop.

---

## If you’re sure you already use the pooler (5432)

If your URL already uses `pooler.supabase.com` and port **5432**:

- You are still in **Session mode**.
- Under load, the pool still gets exhausted.

So even with the “right” pooler link, you need to **switch to port 6543 and `pgbouncer=true`** as above. That’s what fixes the issue.

---

## Summary

| Issue | Cause | Fix |
|-------|--------|-----|
| "Database temporarily unavailable" | Connection pool limit hit | Use **port 6543** + **pgbouncer=true** |
| 503 on login/signup/payment | Same | Same URL in Vercel `DATABASE_URL` |
| "MaxClientsInSessionMode" | Too many session connections | Same |

Use the **6543** URL in Vercel, redeploy, and the database errors should go away.
