import type { Express } from "express";
import request from "supertest";
import { createApp } from "../server/app";

let cachedApp: Express | null = null;

/**
 * Build the real Express app once (seeding runs on first build) and reuse it
 * across tests. The httpServer returned by createApp is never told to listen;
 * supertest drives the app object directly in-process.
 */
export async function getApp(): Promise<Express> {
  if (!cachedApp) {
    const { app } = await createApp();
    cachedApp = app;
  }
  return cachedApp;
}

/**
 * Log in and return the bearer token for a seeded demo user. All seeded users
 * share the password "demo123".
 */
export async function login(
  email: string,
  password = "demo123",
): Promise<string> {
  const app = await getApp();
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  if (res.status !== 200 || !res.body.token) {
    throw new Error(
      `login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.token;
}

export function auth(token: string) {
  return `Bearer ${token}`;
}

// Seeded demo accounts (see seedDatabase in server/routes.ts).
export const SCHOOL1_ADMIN = "admin@fgcenugu.edu.ng"; // school 1 admin
export const SCHOOL1_DPO = "dpo@fgcenugu.edu.ng"; // school 1 dpo
export const SCHOOL1_TEACHER = "teacher@fgcenugu.edu.ng"; // school 1 teacher
export const SCHOOL2_ADMIN = "admin@queenscollege.edu.ng"; // school 2 admin
