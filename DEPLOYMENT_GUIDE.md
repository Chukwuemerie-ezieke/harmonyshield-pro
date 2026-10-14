# HarmonyShield Pro — Deployment Guide

This guide covers multiple deployment options from simplest to most robust. Choose the approach that fits your needs and budget.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development](#2-local-development)
3. [Deploy to Railway (Recommended)](#3-deploy-to-railway-recommended)
4. [Deploy to Render](#4-deploy-to-render)
5. [Deploy to a VPS (DigitalOcean / Linode)](#5-deploy-to-a-vps-digitalocean--linode)
6. [Deploy to Vercel (Frontend) + Railway (Backend)](#6-deploy-to-vercel-frontend--railway-backend)
7. [PostgreSQL Migration](#7-postgresql-migration)
8. [Environment Variables Reference](#8-environment-variables-reference)
9. [SSL & Domain Setup](#9-ssl--domain-setup)
10. [Monitoring & Maintenance](#10-monitoring--maintenance)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

Before deploying, ensure you have:

- **Node.js 18+** installed (check with `node -v`)
- **npm 9+** installed (check with `npm -v`)
- **Git** installed (check with `git -v`)
- A **GitHub account** (code is at `github.com/Chukwuemerie-ezieke/harmonyshield-pro`)
- A hosting account on your chosen platform

### Clone the Repository

```bash
git clone https://github.com/Chukwuemerie-ezieke/harmonyshield-pro.git
cd harmonyshield-pro
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# REQUIRED for production — use a long random string (32+ characters).
# The server will REFUSE TO START in production if this is missing or shorter
# than 32 characters. It never falls back to a default secret in production.
JWT_SECRET=your-very-long-random-secret-string-here

# OPTIONAL — comma-separated list of allowed CORS origins (empty = same-origin only)
ALLOWED_ORIGINS=

# OPTIONAL — enhances threat intelligence feeds
OTX_API_KEY=your-otx-api-key

# OPTIONAL — required for live IP reputation checks. Without it, the
# /api/ip-check endpoint reports reputation as unavailable (503) and returns
# no simulated data.
ABUSEIPDB_API_KEY=your-abuseipdb-api-key

# Server port (most platforms set this automatically)
PORT=5000
NODE_ENV=production
```

> **Generate a JWT secret:** Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` to generate a secure random string.

---

## 2. Local Development

```bash
# Start dev server with hot reload
npm run dev
```

Open `http://localhost:5000` — login with `admin@fgcenugu.edu.ng` / `demo123`.

### Build and test production locally

```bash
npm run build
npm start
```

---

## 3. Deploy to Railway (Recommended)

[Railway](https://railway.app) is the simplest option — it auto-detects Node.js apps, provides free SQLite persistence, and offers a generous free tier.

### Steps

1. **Sign up** at [railway.app](https://railway.app) with your GitHub account

2. **Create a new project** → "Deploy from GitHub Repo"

3. **Select** `Chukwuemerie-ezieke/harmonyshield-pro`

4. **Set environment variables** in the Railway dashboard:
   - `JWT_SECRET` = your random secret string
   - `NODE_ENV` = `production`
   - `OTX_API_KEY` = your OTX key (optional)
   - `ABUSEIPDB_API_KEY` = your AbuseIPDB key (optional)

5. **Set build and start commands** in Settings:
   - Build: `npm install && npm run build`
   - Start: `npm start`

6. **Deploy** — Railway will build and start your app automatically

7. **Get your URL** — Railway assigns a `.railway.app` subdomain. You can add a custom domain later.

### Railway with PostgreSQL (Optional Upgrade)

If you want to use PostgreSQL instead of SQLite:

1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway will provide a `DATABASE_URL` environment variable
3. Follow the [PostgreSQL Migration](#7-postgresql-migration) section below
4. Redeploy

### Estimated Cost
- **Free tier**: 500 hours/month, 1 GB RAM — sufficient for light usage
- **Hobby plan**: $5/month — persistent storage, custom domains, always-on

---

## 4. Deploy to Render

[Render](https://render.com) offers free web services with auto-deploy from GitHub.

### Steps

1. **Sign up** at [render.com](https://render.com) with your GitHub account

2. **Create a New Web Service** → Connect your GitHub repo

3. **Configure:**
   - Name: `harmonyshield-pro`
   - Runtime: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **Set environment variables** (same as Railway above)

5. **Deploy**

### Important Note on Render Free Tier

Render's free tier spins down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. For production use, upgrade to the Starter plan ($7/month).

SQLite works on Render, but the filesystem resets on each deploy. For persistent data, either:
- Use Render's managed PostgreSQL ($7/month) with the migration guide below
- Or use an external database service

---

## 5. Deploy to a VPS (DigitalOcean / Linode)

For full control, deploy to a virtual private server. This guide uses **Ubuntu 22.04+**.

### Step 1: Set Up the Server

```bash
# SSH into your server
ssh root@your-server-ip

# Update packages
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (reverse proxy)
apt install -y nginx
```

### Step 2: Clone and Build

```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone the repo
git clone https://github.com/Chukwuemerie-ezieke/harmonyshield-pro.git
cd harmonyshield-pro

# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env  # Edit with your values

# Build
npm run build
```

### Step 3: Start with PM2

```bash
# Start the app
pm2 start dist/index.cjs --name harmonyshield-pro

# Auto-start on reboot
pm2 startup
pm2 save
```

### Step 4: Configure Nginx

```bash
nano /etc/nginx/sites-available/harmonyshield-pro
```

Add:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
ln -s /etc/nginx/sites-available/harmonyshield-pro /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 5: Add SSL with Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

### Updating the App

```bash
cd /var/www/harmonyshield-pro
git pull
npm install
npm run build
pm2 restart harmonyshield-pro
```

### Estimated Cost
- **DigitalOcean**: $6/month (1 GB RAM, 25 GB disk)
- **Linode**: $5/month (1 GB RAM, 25 GB disk)

---

## 6. Deploy to Vercel (Frontend) + Railway (Backend)

For a split deployment (free frontend hosting + separate backend):

### Frontend on Vercel

1. Fork/clone the repo
2. Modify `client/src/lib/queryClient.ts` to point to your Railway backend URL
3. Deploy only the `client/` folder to Vercel
4. Set the build output to `dist/public`

### Backend on Railway

1. Deploy the full repo to Railway (as in Option 3)
2. Add CORS headers in `server/routes.ts` for your Vercel domain

> This approach is more complex. Railway-only (Option 3) is simpler for most use cases.

---

## 7. PostgreSQL Migration

The app has a **dual-driver storage layer** (`server/storage.ts`). It selects
its database driver automatically from the `DATABASE_URL` environment variable
at startup — no code changes are required to switch:

| `DATABASE_URL` | Driver | Schema source | Use case |
|----------------|--------|---------------|----------|
| **unset** | `drizzle-orm/better-sqlite3` | `server/db-schema.ts` (`sqliteTable`) | Zero-config dev/test. A local `data.db` is created and seeded automatically. |
| **set** | `drizzle-orm/node-postgres` (`pg` Pool) | `shared/schema.ts` (`pgTable`) | Production. |

Every storage method is `async`, so the same API serves both the synchronous
SQLite driver and the asynchronous PostgreSQL driver. On startup the server logs
which driver it chose (`[Storage] Using PostgreSQL driver` / `... SQLite driver`).

### Step 1: Set Up PostgreSQL

Use any PostgreSQL provider:
- **Railway PostgreSQL** — click "Add Service" → "PostgreSQL" in your Railway project
- **Supabase** — free tier at [supabase.com](https://supabase.com)
- **Neon** — serverless PostgreSQL at [neon.tech](https://neon.tech)
- **Self-hosted** — `apt install postgresql` on your VPS

You'll get a connection string like:
```
postgresql://user:password@host:5432/database
```

### Step 2: Set the Connection String

Add to your production environment (`.env` or your platform's variables):
```env
DATABASE_URL=postgresql://user:password@host:5432/harmonyshield
```

Setting this is **all that is needed** to switch the running app to PostgreSQL.
There are no source edits — the driver branch is already implemented.

### Step 3: Apply the Committed Migrations

Drizzle migrations for the PostgreSQL schema are generated from
`shared/schema.ts` and **committed** to the `./migrations` directory. Apply them
to your database before the first start:

```bash
# Apply the committed SQL migrations in ./migrations
DATABASE_URL=postgresql://... npm run db:migrate

# Alternatively, for a quick first provision, push the schema directly:
DATABASE_URL=postgresql://... npm run db:push
```

If you later change `shared/schema.ts`, regenerate the migration files (this
needs only the schema, not a live database) and commit the result:

```bash
npm run db:generate   # writes new SQL into ./migrations
```

### Step 4: Build, Start, and Seed

```bash
npm run build
DATABASE_URL=postgresql://... npm start
```

The demo-data seed still runs automatically on first startup: when the `schools`
table is empty the app seeds schools, users (including the demo admin
`admin@fgcenugu.edu.ng` / `demo123`), compliance items, threats, incidents,
training courses, news, and audit entries.

### Important Notes

- `shared/schema.ts` (the `pgTable` definitions) is the source of truth for the
  PostgreSQL migrations; `server/db-schema.ts` is the matching `sqliteTable`
  mirror used only when `DATABASE_URL` is unset.
- Timestamps are written explicitly as ISO strings in application code, so the
  schema does not rely on a database-side `now()` default.
- Keep both schema files in sync when you add or change columns, then run
  `npm run db:generate` and commit the new migration.

---

## 8. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** (production) | insecure dev fallback (dev only) | JWT signing key (min 32 chars). In production the server refuses to start if it is missing or weak; in development an insecure fallback is used with a warning |
| `ALLOWED_ORIGINS` | No | — (same-origin only) | Comma-separated list of origins allowed via CORS |
| `PORT` | No | `5000` | HTTP port. Most platforms set this automatically |
| `NODE_ENV` | No | `development` | Set to `production` for production builds |
| `OTX_API_KEY` | No | — | AlienVault OTX API key for enhanced threat feeds |
| `ABUSEIPDB_API_KEY` | No | — | AbuseIPDB key for live IP reputation checks. Without it, `/api/ip-check` reports reputation as unavailable (503) with no simulated data |
| `DATABASE_URL` | No | — (SQLite) | PostgreSQL connection string. When set, the app uses the PostgreSQL driver; when unset it uses the zero-config SQLite driver. See [PostgreSQL Migration](#7-postgresql-migration) |

### Getting Free API Keys

**AlienVault OTX:**
1. Go to [otx.alienvault.com](https://otx.alienvault.com)
2. Create a free account
3. Go to Settings → API Key
4. Copy your key

**AbuseIPDB:**
1. Go to [abuseipdb.com](https://www.abuseipdb.com)
2. Create a free account
3. Go to API → Create Key
4. Free tier: 1,000 checks per day

---

## 9. SSL & Domain Setup

### Custom Domain on Railway/Render

1. In your platform's dashboard, go to Settings → Custom Domains
2. Add your domain (e.g., `app.harmonyshield.ng`)
3. Update your DNS:
   - Add a `CNAME` record pointing to your platform's assigned URL
   - SSL is provisioned automatically

### Custom Domain on VPS

Use Certbot (already covered in the VPS section):
```bash
certbot --nginx -d app.harmonyshield.ng
```

Certbot auto-renews certificates. Verify with:
```bash
certbot renew --dry-run
```

---

## 10. Monitoring & Maintenance

### Health Check

The app exposes a public, unauthenticated health endpoint that is intentionally
served outside `/api` (so it is never throttled by the API rate limiter) and
performs a lightweight database readiness check:

```bash
curl https://your-domain.com/healthz
# -> 200 {"status":"ok","uptime":123.4,"timestamp":"...","db":"up"}
# -> 503 {"status":"degraded",...,"db":"down"} if the DB is unreachable
```

Use `/healthz` for load-balancer / orchestrator liveness and readiness probes.
It never returns secrets. (The live-feed status is a separate concern - see
`GET /api/feeds/status`.)

### Logs

The server emits **structured JSON** request logs (one line per `/api` request)
with `timestamp`, `method`, `path`, `status`, `durationMs` and a per-request
`requestId` (also returned to clients in the `X-Request-Id` response header).
Response bodies are never logged, so JWTs and passwords from `/api/auth/*` are
not leaked into the logs.

- **Railway/Render**: Check the dashboard logs
- **VPS with PM2**: `pm2 logs harmonyshield-pro`
- **VPS Nginx**: `tail -f /var/log/nginx/access.log`

### Optional error tracking

Unhandled errors flow through a single hook that is a **no-op by default**.
Set either of these environment variables to enable reporting:

- `ERROR_WEBHOOK` - a URL that receives a JSON `POST` per unhandled error
  (`{ message, stack, context, timestamp }`, no secrets). Delivery is
  best-effort and failures never affect the response.
- `SENTRY_DSN` - when set, errors are emitted as structured JSON log lines
  tagged for a log drain / Sentry sidecar to forward. (No Sentry SDK is bundled;
  add it to `package.json` and the esbuild allowlist in `script/build.ts` if you
  want native delivery.)

### Database Backup (SQLite)

```bash
# Stop the app first
pm2 stop harmonyshield-pro

# Copy the database
cp data.db data.db.backup.$(date +%Y%m%d)

# Restart
pm2 start harmonyshield-pro
```

### Database Backup (PostgreSQL)

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Updating

```bash
cd /path/to/harmonyshield-pro
git pull origin main
npm install
npm run build
# Restart your process manager (pm2 restart, or redeploy on Railway/Render)
```

---

## 11. Troubleshooting

### App won't start

```bash
# Check Node version (need 18+)
node -v

# Check if port is in use
lsof -i :5000

# Check environment variables are set
echo $JWT_SECRET
echo $NODE_ENV
```

### Login fails

- Ensure the app has seeded the demo data (check server logs on first startup)
- Verify `JWT_SECRET` is set and hasn't changed between restarts
- Try the demo credentials: `admin@fgcenugu.edu.ng` / `demo123`

### Live feeds not working

- RSS feeds work without any API keys
- OTX: check that `OTX_API_KEY` is valid (or it falls back to public API)
- AbuseIPDB: without a key, IP checks return simulated data
- Check the feed status: `GET /api/feeds/status`

### SQLite "database is locked" errors

This happens under heavy concurrent writes. Solutions:
- Add WAL mode: the app already uses it by default
- For production with multiple users, migrate to PostgreSQL (see section 7)

### Build fails

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Ensure TypeScript compiles
npm run check

# Rebuild
npm run build
```

---

## Deployment Checklist

Before going live, verify:

- [ ] `JWT_SECRET` is set to a unique, long random string (not the default)
- [ ] `NODE_ENV` is set to `production`
- [ ] Health check responds (`GET /healthz` returns 200)
- [ ] Live feeds are working (`/api/feeds/status`)
- [ ] Login works with demo credentials
- [ ] SSL certificate is active (HTTPS)
- [ ] Custom domain is configured (if applicable)
- [ ] Database backups are scheduled
- [ ] Server logs are accessible
- [ ] Firewall allows only ports 80/443 (VPS deployments)

---

## Recommended Deployment

For most users, **Railway** offers the best balance of simplicity and reliability:

1. Zero configuration — auto-detects Node.js
2. Free tier for testing, $5/month for production
3. One-click PostgreSQL addon when ready to scale
4. Auto-deploy on every GitHub push
5. Built-in SSL and custom domain support

Start with Railway + SQLite, and migrate to PostgreSQL when your user base grows beyond a single school.
