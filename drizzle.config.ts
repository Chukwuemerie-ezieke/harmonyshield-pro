import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * The runtime storage layer (server/storage.ts) is dual-driver: it uses
 * PostgreSQL when DATABASE_URL is set and SQLite otherwise. Migrations, however,
 * only matter for the PostgreSQL deployment target, so this config always
 * targets the PostgreSQL dialect using the pgTable definitions in
 * shared/schema.ts (the source of truth).
 *
 *   - `npm run db:generate` emits SQL migrations into ./migrations from the
 *     schema alone (no live database required). These files are committed.
 *   - `npm run db:push` / `npm run db:migrate` apply the schema to the database
 *     referenced by DATABASE_URL. Run these as a deploy-time step against your
 *     PostgreSQL instance (see DEPLOYMENT_GUIDE.md). The SQLite dev/test
 *     database is created automatically at runtime and needs no migrations.
 */
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://user:password@localhost:5432/harmonyshield",
  },
});
