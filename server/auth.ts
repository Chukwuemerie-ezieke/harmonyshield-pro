import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_EXPIRY = "7d";
const MIN_JWT_SECRET_LENGTH = 32;
const DEV_JWT_SECRET = "harmonyshield-dev-secret";

/**
 * Resolve the JWT secret with a fail-fast policy:
 * - In production, the server REFUSES to boot unless JWT_SECRET is set and
 *   is at least MIN_JWT_SECRET_LENGTH characters long. It never falls back to
 *   the hardcoded dev secret in production.
 * - Outside production, an unset or weak secret is allowed (so the demo keeps
 *   working) but a loud warning is logged whenever the dev fallback is used.
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be set to a strong value (at least ${MIN_JWT_SECRET_LENGTH} characters) in production. ` +
          "The server will not start with a missing, weak, or default secret. " +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
      );
    }
    return secret;
  }

  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    console.warn(
      "\u26A0\uFE0F  [auth] JWT_SECRET is unset or weak - using an INSECURE development fallback. " +
        "Set a strong JWT_SECRET (>= 32 chars) before deploying to production.",
    );
    return secret || DEV_JWT_SECRET;
  }

  return secret;
}

// Resolve once at module load so production fails fast at startup.
const JWT_SECRET = resolveJwtSecret();

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: number, email: string, schoolId: number, role: string): string {
  return jwt.sign({ id: userId, email, schoolId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): { id: number; email: string; schoolId: number; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; email: string; schoolId: number; role: string };
  } catch {
    return null;
  }
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        schoolId: number;
        role: string;
      };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  req.user = decoded;
  next();
}
