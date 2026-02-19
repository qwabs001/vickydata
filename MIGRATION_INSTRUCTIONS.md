# Database Migration Instructions

## Supabase Database Connection

**Session Pooler URL:** `postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`

**Direct URL:** `postgresql://postgres:globNFK8uziL24H7@db.yezeyzqalpiefanrosws.supabase.co:5432/postgres`

**Project URL:** `https://yezeyzqalpiefanrosws.supabase.co`

## Running Migrations

### Option 1: Using the Migration Script

```bash
cd /Users/qwabsimac/Documents/Keldatagh
./run-migrations.sh
```

### Option 2: Manual Command

```bash
cd /Users/qwabsimac/Documents/Keldatagh

export DATABASE_URL="postgresql://postgres:globNFK8uziL24H7@db.yezeyzqalpiefanrosws.supabase.co:5432/postgres?sslmode=require"
export DIRECT_DATABASE_URL="postgresql://postgres:globNFK8uziL24H7@db.yezeyzqalpiefanrosws.supabase.co:5432/postgres?sslmode=require"

npx prisma migrate deploy
npx prisma generate
```

### Option 3: Using npm script

```bash
cd /Users/qwabsimac/Documents/Keldatagh

export DATABASE_URL="postgresql://postgres:globNFK8uziL24H7@db.yezeyzqalpiefanrosws.supabase.co:5432/postgres?sslmode=require"
export DIRECT_DATABASE_URL="postgresql://postgres:globNFK8uziL24H7@db.yezeyzqalpiefanrosws.supabase.co:5432/postgres?sslmode=require"

npm run prisma:migrate
npm run prisma:generate
```

## Troubleshooting

### If you get "Can't reach database server" error:

1. **Check Supabase IP Allowlist:**
   - Go to Supabase Dashboard → Settings → Database
   - Check if your IP address is allowed
   - Add your current IP if needed

2. **Use Supabase SQL Editor:**
   - Go to Supabase Dashboard → SQL Editor
   - Run migrations manually by copying SQL from `prisma/migrations/*/migration.sql` files

3. **Use Supabase CLI:**
   ```bash
   # Install Supabase CLI
   brew install supabase/tap/supabase
   
   # Link to your project
   supabase link --project-ref yezeyzqalpiefanrosws
   
   # Run migrations
   supabase db push
   ```

## Available Migrations

The following migrations are ready to be applied:

1. `20250212000000_init` - Initial schema
2. `20250212120000_add_markup_percent` - Add markup percent
3. `20260215000000_add_payment_intents` - Add payment intents
4. `20260217010000_optimize_order_indexes` - Optimize order indexes
5. `20260218030000_add_reseller_api_models` - Add reseller API models
6. `20260218093000_add_agent_role` - Add agent role

## Environment Variables for Production

When deploying, set these environment variables:

```env
DATABASE_URL="postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require&connection_limit=1"
DIRECT_DATABASE_URL="postgresql://postgres.yezeyzqalpiefanrosws:globNFK8uziL24H7@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
NEXT_PUBLIC_SUPABASE_URL="https://yezeyzqalpiefanrosws.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllemV5enFhbHBpZWZhbnJvc3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MDYzOTcsImV4cCI6MjA4NzA4MjM5N30.0ezTudXLlZ_6_wFoXM2dmJdzOHzKZHmmYRRHOF4aoIA"
```
