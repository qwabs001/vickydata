# Vercel Deployment Guide for VickyData

## Quick Start

1. **Connect Repository to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository: `qwabs001/vickydata`
   - Select branch: `dev001` (or `main`)

2. **Configure Environment Variables** (see below)

3. **Deploy**
   - Vercel will automatically build and deploy
   - After first deploy, run database migrations (see below)

## Step-by-Step Instructions

### Step 1: Connect Repository

1. Visit [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import Git Repository → Select **"qwabs001/vickydata"**
4. Configure Project:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

### Step 2: Set Environment Variables

Go to **Settings** → **Environment Variables** and add:

#### Required Variables

```env
# Database - Supabase Transaction Pooler (RECOMMENDED for Vercel)
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require

DIRECT_DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@db.kbzdbwaahfcxutelbmnm.supabase.co:5432/postgres?sslmode=require

# NextAuth (REQUIRED - Generate a new secret)
NEXTAUTH_SECRET=<GENERATE_NEW_SECRET_BELOW>
NEXTAUTH_URL=https://vickydata.com

# App Configuration
APP_URL=https://vickydata.com
APP_NAME=VickyData
NEXT_PUBLIC_APP_URL=https://vickydata.com
NEXT_PUBLIC_SITE_URL=https://vickydata.com
NEXT_PUBLIC_APP_NAME=VickyData
NODE_ENV=production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://kbzdbwaahfcxutelbmnm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_BwxSgxfY_P4Dc0sZ8uptsg_g6a0yZzZ
```

#### Optional Variables (Payment Providers)

```env
# Moolre (primary - can be set in Admin → Payment Settings)
MOOLRE_API_USER=
MOOLRE_PUB_KEY=
MOOLRE_SECRET_KEY=
MOOLRE_ACCOUNT_NUMBER=

# Paystack (legacy optional - can be set in Admin → Payment Settings)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_WEBHOOK_SECRET=whsec_xxxxx

# Cloudinary (optional - for logo/file uploads, or use logo URL instead)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Step 3: Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and paste it as `NEXTAUTH_SECRET` in Vercel.

### Step 4: Deploy

1. Click **"Deploy"** button
2. Wait for build to complete (2-5 minutes)
3. Your site will be live at: `https://vickydata-xxx.vercel.app`

### Step 5: Run Database Migrations

After first deployment, run migrations:

```bash
# Option 1: Using the migration script
export DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
export DIRECT_DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
npx prisma migrate deploy
```

**Note:** Migrations have already been run locally, so this step may not be needed unless you add new migrations.

### Step 6: Configure Custom Domain

1. Go to **Settings** → **Domains**
2. Add your domain: `vickydata.com`
3. Follow DNS configuration instructions
4. Wait for DNS propagation (5-30 minutes)

## Post-Deployment Checklist

- [ ] Environment variables are set correctly
- [ ] `NEXTAUTH_URL` matches your domain (`https://vickydata.com`)
- [ ] `NEXTAUTH_SECRET` is set and secure
- [ ] Database migrations are applied
- [ ] Custom domain is configured (if using `vickydata.com`)
- [ ] Payment provider credentials are set (Admin → Payment Settings)
- [ ] Test login/signup functionality
- [ ] Test data bundle purchase flow

## Troubleshooting

### Build Fails

1. Check build logs in Vercel dashboard
2. Ensure all environment variables are set
3. Verify `DATABASE_URL` is correct
4. Check that Prisma Client is generated (`prisma generate`)

### Database Connection Errors

1. Verify `DATABASE_URL` uses transaction pooler (port 6543) with `pgbouncer=true`
2. Check Supabase dashboard for IP allowlist settings
3. Ensure `sslmode=require` is in the connection string
4. Verify database password is correct

### Authentication Not Working

1. Verify `NEXTAUTH_SECRET` is set
2. Check `NEXTAUTH_URL` matches your domain exactly
3. Ensure cookies are enabled in browser
4. Check Vercel logs for errors

## Automatic Deployments

Vercel will automatically deploy when you push to:
- `main` branch → Production
- `dev001` branch → Preview (or configure as production)

To change production branch:
1. Go to **Settings** → **Git**
2. Select **Production Branch**
3. Choose `dev001` or `main`

## Environment Variables by Environment

You can set different values for:
- **Production** (main branch)
- **Preview** (other branches)
- **Development** (local)

Set variables for each environment as needed in Vercel dashboard.
