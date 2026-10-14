import fs from "fs";
import path from "path";

/**
 * Remove any leftover throwaway SQLite database (and its WAL/SHM sidecar files)
 * before and after the test run so each run starts from a freshly seeded DB.
 * seedDatabase() short-circuits when schools already exist, so a stale file
 * would otherwise skip re-seeding.
 */
// Clean every candidate throwaway DB path. vitest sets SQLITE_PATH via
// `test.env` for the test workers, but that value is not guaranteed to be
// present in this globalSetup process, so we also clean the configured default
// (tests/.tmp-test.db, see vitest.config.ts) and the legacy fallback. A stale
// file would otherwise make seedDatabase() short-circuit and leak state (e.g.
// users registered by a prior run) across runs.
const dbPaths = Array.from(
  new Set(
    [
      process.env.SQLITE_PATH,
      path.resolve(__dirname, ".tmp-test.db"),
      path.resolve(__dirname, ".tmp-test-db.sqlite"),
    ].filter((p): p is string => Boolean(p)),
  ),
);

function removeDbFiles() {
  for (const dbPath of dbPaths) {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      const file = `${dbPath}${suffix}`;
      if (fs.existsSync(file)) {
        fs.rmSync(file, { force: true });
      }
    }
  }
}

export function setup() {
  removeDbFiles();
}

export function teardown() {
  removeDbFiles();
}
