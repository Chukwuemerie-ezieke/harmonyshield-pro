import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
  test: {
    // Integration tests build the real Express app in-process and drive it with
    // supertest. They must run offline against the SQLite driver.
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    // These are set before any test module (and therefore server/storage.ts,
    // which selects its driver at module load) is imported:
    //   - NODE_ENV=test keeps the dev JWT fallback / warnings path.
    //   - JWT_SECRET is a dummy strong secret so token signing is deterministic.
    //   - SQLITE_PATH points the dual-driver storage layer at a throwaway file
    //     so the suite never clobbers the real data.db. DATABASE_URL stays
    //     unset so the SQLite driver is selected (no Postgres needed).
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-jwt-secret-value-that-is-long-enough-32plus",
      SQLITE_PATH: path.resolve(__dirname, "tests/.tmp-test.db"),
    },
    // Run the suite in a single fork so the one shared SQLite DB and the seeded
    // state are consistent across files, and the global rate limiter is not
    // tripped by parallel workers hammering /api.
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    globalSetup: ["./tests/global-setup.ts"],
  },
});
