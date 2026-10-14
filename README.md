# HarmonyShield Pro — EdTech Cybersecurity Suite

**HarmonyShield Pro** is a comprehensive cybersecurity compliance and threat management platform built specifically for Nigerian educational institutions. It helps schools achieve and maintain compliance with the **Nigeria Data Protection Regulation (NDPR)** while providing real-time threat monitoring, incident response workflows, and staff cybersecurity training — all through one unified dashboard.

> Developed by **Harmony Digital Consults Ltd**

---

## What It Does

HarmonyShield Pro addresses the growing cybersecurity challenges facing Nigerian schools. It provides:

- **NDPR Compliance Management** — Track and manage all 12 NDPR compliance requirements with weighted scoring, evidence uploads, and deadline tracking. Each school gets a real-time compliance score out of 100%.

- **Real-Time Threat Monitoring** — Live feeds from verified cybersecurity sources (The Hacker News, BleepingComputer, Dark Reading, Krebs on Security) combined with threat intelligence from AlienVault OTX and IP reputation checks via AbuseIPDB.

- **Incident Response Workflow** — A structured 6-step incident response process (Identify → Contain → Eradicate → Recover → Lessons → Close) with action tracking, affected system logging, and full audit trails.

- **Staff Training & Awareness** — Cybersecurity training courses with quizzes, progress tracking, and pass/fail scoring. Covers phishing awareness, password security, data handling, and NDPR basics.

- **Multi-School Administration** — Manage multiple schools from a single platform. Each school has isolated data with its own compliance scores, incidents, and user accounts.

- **Role-Based Access Control** — Four user roles (Admin, DPO, Staff, Teacher) with JWT-based authentication and scoped data access per school.

- **Audit Logging** — Every significant action is logged with timestamps, user identity, and entity references for compliance audits.

- **Analytics & Reports** — Dashboard with compliance trends, threat summaries, training completion rates, and incident statistics.

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **Regulatory Compliance** | Stay compliant with NDPR/NDPC requirements — avoid fines and sanctions |
| **Proactive Security** | Monitor live threats relevant to the education sector before they impact your school |
| **Incident Readiness** | Structured response workflow ensures nothing is missed during a security incident |
| **Staff Awareness** | Reduce human-error breaches by training staff on cybersecurity best practices |
| **Centralized Management** | One platform for all schools under your administration |
| **Audit-Ready** | Complete audit trail for every action — ready for NDPC inspections |
| **Cost-Effective** | Free-tier APIs for threat intelligence; no expensive SIEM licenses needed |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| **Backend** | Express 5, Node.js, TypeScript |
| **Database** | SQLite (via better-sqlite3) — PostgreSQL-ready schema via Drizzle ORM |
| **Auth** | JWT (jsonwebtoken) + bcryptjs password hashing |
| **Live Feeds** | RSS Parser, AlienVault OTX API, AbuseIPDB API |
| **Build** | Vite 7, esbuild, tsx |
| **ORM** | Drizzle ORM with Zod validation |

---

## Pages

| Page | Description |
|------|-------------|
| **Login** | JWT authentication with email/password, demo credentials helper |
| **Dashboard** | Overview cards (compliance score, active threats, incidents, training), charts, live news feed |
| **Compliance** | NDPR compliance checklist with status tracking, weighted scoring, progress bar |
| **Threat Monitor** | Live threat feed from OTX, severity filtering, IP reputation checker, education-sector flagging |
| **Training** | Course catalog with descriptions, quizzes, progress tracking per user |
| **Incident Response** | Report incidents, 6-step workflow, action items, affected systems tracking |
| **Reports** | Compliance trends, incident summaries, training analytics, exportable data |
| **Settings** | School profile, user management, feed API key configuration, system preferences |

---

## Database Schema (11 Tables)

| Table | Purpose |
|-------|---------|
| `schools` | School profiles with NDPC registration |
| `users` | User accounts with bcrypt-hashed passwords |
| `sessions` | JWT session tokens |
| `compliance_items` | NDPR compliance checklist per school |
| `threats` | Stored threat intelligence records |
| `incidents` | Security incident reports |
| `incident_actions` | Actions taken during incident response |
| `training_courses` | Cybersecurity course catalog |
| `training_progress` | Per-user course completion tracking |
| `news_articles` | Cached cybersecurity news |
| `audit_log` | System-wide audit trail |

---

## Live Data Feeds

| Feed | Source | API Key Required |
|------|--------|-----------------|
| **Cybersecurity News** | The Hacker News, BleepingComputer, Dark Reading, Krebs on Security (RSS) | No — free, public RSS feeds |
| **Threat Intelligence** | AlienVault OTX (public activity feed) | Optional — enhances results with subscribed pulses |
| **IP Reputation** | AbuseIPDB | Yes — free tier available (1,000 checks/day) |

All feeds use a **15-minute server-side cache** to minimize API calls and improve response times.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Chukwuemerie-ezieke/harmonyshield-pro.git
cd harmonyshield-pro

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your values (see below)

# Start development server
npm run dev
```

The app will be running at `http://localhost:5000`.

### Demo Credentials

| Email | Password | Role | School |
|-------|----------|------|--------|
| admin@fgcenugu.edu.ng | demo123 | Admin | Federal Government College Enugu |
| dpo@queenscollege.edu.ng | demo123 | DPO | Queens College Lagos |
| teacher@kbc.edu.ng | demo123 | Teacher | Kings British College Abuja |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes (for production) | Secret key for signing JWT tokens. Must be at least 32 characters. In production the server refuses to start if it is missing or weak; in development an insecure fallback is used with a warning |
| `ALLOWED_ORIGINS` | No | Comma-separated list of origins allowed via CORS. Empty = same-origin only (default) |
| `OTX_API_KEY` | No | AlienVault OTX API key — enhances threat feeds. Get one free at [otx.alienvault.com](https://otx.alienvault.com) |
| `ABUSEIPDB_API_KEY` | No | AbuseIPDB API key — enables live IP reputation checks. Without it, `/api/ip-check` reports reputation as unavailable (no simulated data). Get one free at [abuseipdb.com](https://www.abuseipdb.com) |
| `ERROR_WEBHOOK` | No | URL that receives a JSON `POST` for each unhandled server error (no secrets). Default: error tracking is a no-op |
| `SENTRY_DSN` | No | When set, unhandled errors are emitted as structured JSON log lines tagged for a Sentry sidecar / log drain. Default: no-op |
| `PORT` | No | Server port (defaults to 5000) |
| `NODE_ENV` | No | `development` or `production` |

---

## Observability & Sessions

- **Health check**: `GET /healthz` (public, outside auth and rate limiting) returns `{status, uptime, timestamp, db}` and performs a lightweight DB readiness check. Use it for load-balancer probes.
- **Structured logging**: each `/api` request logs one structured JSON line (`timestamp`, `method`, `path`, `status`, `durationMs`, `requestId`). A `X-Request-Id` header is returned to clients. Response bodies are never logged, so tokens and passwords from `/api/auth/*` are not leaked.
- **Optional error tracking**: unhandled errors flow through a hook that is a no-op unless `ERROR_WEBHOOK` or `SENTRY_DSN` is set (see the env table above).
- **Revocable sessions**: logging in creates a server-side session keyed by the JWT's `jti`. `POST /api/auth/logout` deletes that session so the token is rejected on subsequent requests - logout revokes the token server-side, it does not merely clear the client.

---

## Production Build

```bash
# Build frontend + backend
npm run build

# Start production server
npm start
```

This compiles the React frontend into static assets and bundles the Express server into `dist/index.cjs`.

---

## PostgreSQL Migration

The app currently runs on SQLite for simplicity and zero-config setup. The schema is designed for easy migration to PostgreSQL:

1. **`shared/schema.ts`** already contains full PostgreSQL types (using `pgTable`)
2. **`server/db-schema.ts`** is the SQLite mirror used at runtime
3. To migrate: install `pg` driver, update `server/storage.ts` to use `drizzle-orm/node-postgres`, and point imports to `shared/schema.ts`

See the **DEPLOYMENT_GUIDE.md** for detailed PostgreSQL migration steps.

---

## Project Structure

```
harmonyshield-pro/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── app-sidebar.tsx      # Navigation sidebar with user info + logout
│   │   │   └── ui/                  # shadcn/ui components
│   │   ├── lib/
│   │   │   ├── auth.tsx             # Auth context provider + hooks
│   │   │   ├── queryClient.ts       # TanStack Query + API request helper
│   │   │   └── utils.ts             # Utility functions
│   │   ├── pages/
│   │   │   ├── login.tsx            # Login page with demo credentials
│   │   │   ├── dashboard.tsx        # Main dashboard
│   │   │   ├── compliance.tsx       # NDPR compliance tracker
│   │   │   ├── threat-monitor.tsx   # Live threat monitoring
│   │   │   ├── training.tsx         # Training courses
│   │   │   ├── incident-response.tsx# Incident response workflow
│   │   │   ├── reports.tsx          # Analytics and reports
│   │   │   └── settings.tsx         # System settings
│   │   ├── App.tsx                  # Router + auth guard
│   │   ├── index.css                # Tailwind + theme variables
│   │   └── main.tsx                 # React entry point
│   └── index.html
├── server/
│   ├── auth.ts                      # JWT + bcrypt auth utilities
│   ├── db-schema.ts                 # SQLite runtime schema (mirrors pg schema)
│   ├── live-feeds.ts                # RSS, OTX, AbuseIPDB integrations
│   ├── routes.ts                    # All API routes + seed data
│   ├── storage.ts                   # Drizzle ORM CRUD operations
│   ├── index.ts                     # Express server entry
│   ├── static.ts                    # Static file serving (production)
│   └── vite.ts                      # Vite dev server integration
├── shared/
│   └── schema.ts                    # PostgreSQL-typed schema (for types + future migration)
├── .env.example                     # Environment variable template
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── drizzle.config.ts
```

---

## API Endpoints

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/healthz` | Public liveness/readiness probe (no auth, outside rate limiting). Returns `{status, uptime, timestamp, db}` and performs a lightweight DB check. |

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email + password, returns a JWT and creates a server-side session |
| POST | `/api/auth/logout` | Revoke the current token server-side (deletes its session); the token is rejected afterwards (requires Bearer token) |
| GET | `/api/auth/sessions` | List the current user's active session (requires Bearer token) |
| GET | `/api/auth/me` | Get current user from JWT |

### Dashboard & Data (all require Bearer token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Dashboard summary statistics |
| GET | `/api/compliance` | Compliance items for user's school |
| PATCH | `/api/compliance/:id` | Update compliance item status |
| GET | `/api/threats` | Stored + live threats |
| GET | `/api/incidents` | Incidents for user's school |
| POST | `/api/incidents` | Create a new incident |
| PATCH | `/api/incidents/:id` | Update incident status/step |
| GET | `/api/training/courses` | Available training courses |
| GET | `/api/training/progress` | User's training progress |
| POST | `/api/training/progress` | Start or complete a course |
| GET | `/api/reports/summary` | Reports data |
| GET | `/api/settings/school` | School settings |

### Live Feeds (require Bearer token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/live/news` | Live RSS news from 4 sources |
| GET | `/api/live/threats` | Live OTX threat intelligence |
| POST | `/api/live/check-ip` | Check IP reputation via AbuseIPDB |
| GET | `/api/live/status` | Feed health status |

---

## License

MIT

---

## Author

**Harmony Digital Consults Ltd**  
Cybersecurity consultancy specializing in NDPR compliance for Nigerian educational institutions.
