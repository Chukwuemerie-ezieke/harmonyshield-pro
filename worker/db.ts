import { Client } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export type Database = NodePgDatabase<typeof schema>;

/**
 * Opens a connection for the lifetime of one request / cron run.
 * In production the connection string comes from Hyperdrive, which keeps a
 * warm connection pool close to the database, so per-request clients are cheap.
 */
export async function openDb(connectionString: string): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new Client({ connectionString });
  await client.connect();
  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}
