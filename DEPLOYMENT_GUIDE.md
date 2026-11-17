# HavonaShield — Production Deployment (Cloudflare)

HavonaShield runs entirely on Cloudflare:

| Piece | Cloudflare product |
|---|---|
| API + web app + landing page | **Workers** (with Static Assets) |
| Database connection pooling | **Hyperdrive** → managed PostgreSQL (Neon recommended) |
| Live threat/news refresh (every 15 min) | **Cron Triggers** |
| Login / API throttling | **Workers Rate Limiting** |
| DNS, TLS, WAF, DDoS | Cloudflare zone for `havonashield.tech` |
| `hello@havonashield.tech` | **Email Routing** (free) |

Domains:

| Host | Serves |
|---|---|
| `havonashield.tech` | Marketing landing page |
| `www.havonashield.tech` | 301 → `havonashield.tech` |
| `app.havonashield.tech` | The application (schools sign in here) |
| `demo.havonashield.tech` | Same app, with a one-click **read-only demo** |

---

## 1. One-time setup

### 1.1 Cloudflare account & domain
1. Create a Cloudflare account and **subscribe to Workers Paid ($5/month)**. Password hashing and Hyperdrive need more CPU time than the free plan allows.
2. **Add site** → `havonashield.tech` → Free plan. Cloudflare shows two nameservers.
3. At your domain registrar (where you bought `.tech`), replace the nameservers with Cloudflare's. Wait until the zone shows **Active**.
4. In **SSL/TLS** set the mode to **Full (strict)**, and turn on **Always Use HTTPS**.

### 1.2 PostgreSQL database
Create a managed Postgres database. [Neon](https://neon.tech) works well with Hyperdrive (pick the region closest to Nigeria, e.g. `eu-central-1` Frankfurt or `eu-west-2` London). Copy the **direct** (non-pooled) connection string, e.g.:

```
postgres://user:password@ep-xxx.eu-central-1.aws.neon.tech/havonashield?sslmode=require
```

### 1.3 Create the Hyperdrive config
```bash
npm ci
npx wrangler login
npx wrangler hyperdrive create havonashield-db --caching-disabled \
  --connection-string="postgres://user:password@host/havonashield?sslmode=require"
```
Paste the returned `id` into `wrangler.jsonc` → `hyperdrive[0].id`.

> ⚠️ Keep `--caching-disabled`. With caching on, users would briefly see stale data after saving, and revoked sessions would keep working for up to a minute.

### 1.4 Secrets
```bash
# 64-byte random secret for signing session tokens (required)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" | npx wrangler secret put JWT_SECRET

# Live threat intelligence (free keys, both recommended)
npx wrangler secret put OTX_API_KEY        # https://otx.alienvault.com → Settings → API key
npx wrangler secret put ABUSEIPDB_API_KEY  # https://www.abuseipdb.com/account/api (1,000 checks/day free)
```
Without `OTX_API_KEY` the threat monitor only shows security news (OTX no longer allows anonymous access). Without `ABUSEIPDB_API_KEY` the IP-check box reports "not configured".

### 1.5 Database schema and content
```bash
export DATABASE_URL="postgres://user:password@host/havonashield?sslmode=require"
npm run db:migrate     # create tables
npm run db:seed        # training courses (safe to re-run)
npm run db:seed-demo   # read-only demo school (re-run any time to reset it)
```

### 1.6 Deploy
```bash
npm run deploy
```
`wrangler.jsonc` declares the four hostnames as **Custom Domains**, so Cloudflare creates the DNS records and certificates automatically on the first deploy.

### 1.7 Onboard your first school
```bash
npm run school:create -- --name "Federal Government College Enugu" \
  --admin-email ict@fgcenugu.edu.ng --admin-name "Chukwuemeka Okafor" --state Enugu
```
This prints a **temporary password**. Send it to the school admin securely and ask them to change it under **Settings → Security**. The school admin then adds their DPO, teachers and staff from **Settings → Team**.

### 1.8 Email (hello@havonashield.tech)
Dashboard → `havonashield.tech` → **Email → Email Routing** → enable, then add a rule `hello@` → your inbox. The landing page and the "Request access" links use this address. To change it, edit `client/src/lib/brand.ts` and `client/landing.html`.

---

## 2. Continuous deployment (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`) runs on every PR and every push to `main`. It typechecks, builds, starts the Worker against a throwaway Postgres, and runs the API security test suite.
- **Deploy** (`.github/workflows/deploy.yml`) runs after CI passes on `main`. It applies migrations, upserts the course content, and runs `wrangler deploy`.

Add these under **GitHub → Settings → Secrets and variables → Actions** (environment `production`):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token from the "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Shown on the Workers & Pages overview page |
| `DATABASE_URL` | Direct Postgres URL (used only for migrations) |

---

## 3. Recommended Cloudflare security settings

In the `havonashield.tech` zone:
- **Security → WAF → Managed rules**: enable the Cloudflare Free Managed Ruleset.
- **Security → Bots**: turn on Bot Fight Mode.
- **Security → WAF → Rate limiting rules** (optional second layer): `URI Path equals /api/auth/login` → 20 requests / 1 min per IP → Block.
- **SSL/TLS → Edge Certificates**: minimum TLS 1.2, HSTS on (the app already sends `Strict-Transport-Security`).

The app itself enforces:
- per-school data isolation
- role-based permissions (admin / DPO / teacher / staff)
- input validation
- login rate limiting (10 attempts/min per IP+email)
- instant session revocation on password change or deactivation
- CSP and other security headers
- a read-only demo

---

## 4. Local development

```bash
docker compose up -d                 # Postgres on :5432 (or use a local install)
cp .dev.vars.example .dev.vars
npm run db:migrate && npm run db:seed && npm run db:seed-demo
npm run school:create -- --name "Dev School" --admin-email admin@dev.ng --admin-name "Dev Admin"
npm run dev                          # builds the client and serves everything on http://localhost:8787
npm run dev:client                   # optional: Vite hot reload on :5173 (proxies /api to :8787)
```
Locally, `localhost` acts as a demo host, so the **Explore the demo** button appears on the sign-in page. The landing page is at http://localhost:8787/landing.

Tests (with `npm run dev` running):
```bash
TEST_ADMIN_EMAIL=admin@dev.ng TEST_ADMIN_PASSWORD='<printed password>' npm test
```

To trigger the feed-refresh cron locally:
```bash
curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*"
```

---

## 5. Operations

| Task | How |
|---|---|
| Logs / errors | Dashboard → Workers → `havonashield` → **Logs** (observability is enabled) |
| Roll back | Dashboard → Workers → Deployments → **Rollback**, or `npx wrangler rollback` |
| Schema change | Edit `shared/schema.ts` → `npm run db:generate` → commit the new file in `migrations/` |
| Reset demo | `DATABASE_URL=… npm run db:seed-demo` |
| Backups | Neon keeps point-in-time restore (7 days on the free tier, longer on paid plans) |
| Rotate JWT secret | `wrangler secret put JWT_SECRET` (signs everyone out) |
