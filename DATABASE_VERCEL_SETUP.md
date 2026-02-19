# Database Setup for Vercel Deployment

## Required Environment Variables in Vercel

To enable your Supabase database to communicate with Vercel, you need to set the following environment variables in your Vercel project settings:

### 1. Database Connection Strings (REQUIRED)

#### Option A: Session Pooler (Recommended for Vercel)
```env
DATABASE_URL=postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require&connection_limit=1
DIRECT_DATABASE_URL=postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

#### Option B: Transaction Pooler (Alternative - Port 6543)
```env
DATABASE_URL=postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
DIRECT_DATABASE_URL=postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### 2. Supabase Configuration (REQUIRED)
```env
NEXT_PUBLIC_SUPABASE_URL=https://yezeyzqalpiefanrosws.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllemV5enFhbHBpZWZhbnJvc3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDYzOTcsImV4cCI6MjA4NzA4MjM5N30.0ezTudXLlZ_6_wFoXM2dmJdzOHzKZHmmYRRHOF4aoIA
```

### 3. NextAuth Configuration (REQUIRED)
```env
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-domain.vercel.app
```

### 4. App Configuration (REQUIRED)
```env
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NEXT_PUBLIC_APP_NAME=Keldatagh
NODE_ENV=production
```

## How to Set Environment Variables in Vercel

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project: **keldatagh**
3. Navigate to **Settings** → **Environment Variables**
4. Add each variable above:
   - **Key**: `DATABASE_URL`
   - **Value**: Your connection string
   - **Environment**: Select all (Production, Preview, Development)
5. Repeat for all variables listed above

## Important Notes

### 1. Use Pooled Connection (Not Direct)
- ✅ **DO USE**: `pooler.supabase.com` (port 5432 or 6543)
- ❌ **DON'T USE**: Direct connection `db.xxx.supabase.co` (port 5432)

**Why?** Vercel uses serverless functions that create many connections. The pooler manages connections efficiently and prevents "too many connections" errors.

### 2. SSL Mode Required
- Always include `sslmode=require` in your connection string
- Supabase requires SSL for all connections

### 3. Connection Limit
- Include `connection_limit=1` to prevent connection exhaustion
- This is especially important for serverless environments

### 4. IP Allowlisting (Usually NOT Required)
- Supabase pooler connections typically don't require IP allowlisting
- If you encounter connection issues, check Supabase Dashboard → Settings → Database → Connection Pooling
- Ensure "Connection Pooling" is enabled

### 5. Direct URL for Migrations
- `DIRECT_DATABASE_URL` is used by Prisma for migrations
- Can use the same pooler URL or direct connection URL
- Direct connection may be needed for some migration operations

## Testing the Connection

After setting environment variables in Vercel:

1. **Redeploy** your application (Vercel will use new env vars)
2. Check build logs for Prisma connection:
   - Should see: `Prisma schema loaded from prisma/schema.prisma`
   - Should see: `Datasource "db": PostgreSQL database "postgres"`
3. Test database queries in your app

## Troubleshooting

### Error: "Can't reach database server"
- ✅ Check `DATABASE_URL` is set correctly in Vercel
- ✅ Verify password is correct (no extra spaces)
- ✅ Ensure `sslmode=require` is included
- ✅ Check Supabase project is active

### Error: "Too many connections"
- ✅ Use pooled connection (port 5432 or 6543)
- ✅ Add `connection_limit=1` to connection string
- ✅ Check Supabase Dashboard → Database → Connection Pooling is enabled

### Error: "SSL connection required"
- ✅ Add `sslmode=require` to connection string
- ✅ Ensure using `pooler.supabase.com` domain

### Migrations Fail
- ✅ Check `DIRECT_DATABASE_URL` is set
- ✅ Try using direct connection URL for migrations:
  ```env
  DIRECT_DATABASE_URL=postgresql://postgres:globNFK8uziL24H7@db.yezeyzqalpiefanrosws.supabase.co:5432/postgres?sslmode=require
  ```

## Current Configuration Summary

Based on your project:
- **Project Reference**: `yezeyzqalpiefanrosws`
- **Region**: `aws-1-eu-west-1`
- **Connection Type**: Session Pooler (port 5432)
- **Password**: `globNFK8uziL24H7`

## Quick Setup Checklist

- [ ] Set `DATABASE_URL` in Vercel environment variables
- [ ] Set `DIRECT_DATABASE_URL` in Vercel environment variables
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` in Vercel
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
- [ ] Set `NEXTAUTH_SECRET` in Vercel (generate new secret)
- [ ] Set `NEXTAUTH_URL` to your Vercel domain
- [ ] Set `NEXT_PUBLIC_APP_URL` to your Vercel domain
- [ ] Set `NODE_ENV=production` in Vercel
- [ ] Redeploy application
- [ ] Run database migrations (if not already done)
- [ ] Test database connection in deployed app

## Generate NextAuth Secret

Run this command to generate a secure secret:
```bash
openssl rand -base64 32
```

Copy the output and use it as your `NEXTAUTH_SECRET` value in Vercel.
