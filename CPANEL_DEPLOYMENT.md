# Deploy VickyData to cPanel

This app requires cPanel's **Application Manager** (Phusion Passenger) with **Node.js 20.9 or newer**. A PHP-only shared-hosting plan cannot run it. Confirm this with your host before moving the domain.

## 1. Prepare the domain

1. In cPanel, add `vickydata.com` as the app domain and enable **Force HTTPS Redirect** in **Domains**.
2. Point its DNS A record to the cPanel server; do not point it at two hosts at once.
3. Issue or renew its SSL certificate in **SSL/TLS Status**.
4. In **Domains → Redirects**, create a **Permanent (301)** wildcard redirect from `bundlearena.com` and `www.bundlearena.com` to `https://vickydata.com`.

If Redirects is unavailable, upload [`deployment/cpanel/bundlearena-redirect/.htaccess`](deployment/cpanel/bundlearena-redirect/.htaccess) to the old BundleArena document root. It preserves paths and query strings.

## 2. Upload the application

Use cPanel's **Git Version Control** to clone this repository outside `public_html`, for example `~/apps/vickydata`. Do not upload `.env`, `node_modules`, or `.next` from your computer.

In cPanel **Terminal**, run:

```bash
cd ~/apps/vickydata
npm ci
cp .env.example .env
chmod 600 .env
```

Set production values in `.env` (or in Application Manager environment variables). Never commit database passwords or payment secrets.

```env
NODE_ENV=production
NEXTAUTH_URL=https://vickydata.com
APP_URL=https://vickydata.com
NEXT_PUBLIC_APP_URL=https://vickydata.com
NEXT_PUBLIC_SITE_URL=https://vickydata.com
NEXT_PUBLIC_APP_NAME=VickyData
NEXTAUTH_SECRET=<a-new-value-from-openssl-rand-base64-32>
DATABASE_URL=<your-production-Supabase-pooled-connection-string>
```

Also add production Moolre, Paystack, Cloudinary, and Supabase values if used. Set `NEXTAUTH_SECRET` once and retain it; changing it logs out existing sessions.

## 3. Build and migrate

From the app directory:

```bash
npx prisma migrate deploy
npm run deploy:cpanel
mkdir -p tmp
```

`deploy:cpanel` creates the Next.js standalone runtime and puts its static assets in the runtime folder. Run it after every pull that changes the app.

## 4. Create the Node application

1. Open **Software → Application Manager → Register Application**.
2. Select `vickydata.com`, set the application path to `apps/vickydata`, choose **Production**, and deploy it.
3. Set the startup file to `app.js`. If the host exposes a “Node.js Selector” screen instead, set application root to `apps/vickydata`, application URL to `/`, and startup file to `app.js`.
4. Add the production environment variables in the application settings if Passenger does not load `.env`.
5. Restart the application. If there is no restart button, run `touch tmp/restart.txt` in Terminal.

## 5. Verify before announcing it

```bash
curl -I https://vickydata.com
curl -I https://vickydata.com/api/health
curl -I https://bundlearena.com
```

Expected: VickyData returns `200`, the health endpoint returns `200`, and BundleArena returns a `301` or `308` whose `Location` begins with `https://vickydata.com`.

Then sign in, make a small test order, verify the Moolre callback URL is `https://vickydata.com/api/payments/moolre/callback`, and check cPanel application logs for errors.

## Updating a release

Run `git pull --ff-only`, then `npm ci`, `npx prisma migrate deploy`, `npm run deploy:cpanel`, and `touch tmp/restart.txt`. Take a database backup before every migration.
