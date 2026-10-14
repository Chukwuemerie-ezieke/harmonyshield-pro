import fs from "fs";
import path from "path";

/**
 * Remove any leftover throwaway SQLite database (and its WAL/SHM sidecar files)
 * before and after the test run so each run starts from a freshly seeded DB.
 * seedDatabase() short-circuits when schools already exist, so a stale file
 * would otherwise skip re-seeding.
 */
const dbPath =
  process.env.SQLITE_PATH || path.resolve(__dirname, ".tmp-test-db.sqlite");

function removeDbFiles() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
    }
  }
}

export function setup() {
  removeDbFiles();
}

export function teardown() {
  removeDbFiles();
}
