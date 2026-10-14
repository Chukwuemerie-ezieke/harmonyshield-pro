import type { Request, Response, NextFunction } from "express";

/**
 * Role-based authorization.
 *
 * `authMiddleware` (server/auth.ts) must run first so `req.user` is populated.
 * `requireRole(...roles)` then rejects any authenticated user whose role is not
 * in the allowed set with a 403 JSON response. If the request somehow reaches
 * here without a user (middleware misordered), we fail closed with 401.
 *
 * Documented role matrix (see FEAT-004 findings):
 *   - admin: full access to the whole app, including school/user administration.
 *   - dpo:   data-protection officer; may edit compliance and incidents.
 *   - admin + dpo: compliance edits and school settings.
 *   - staff / teacher / admin / dpo: incident create/update.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}

/**
 * Per-school ownership check.
 *
 * Loads a record by id with `loader`, then verifies it belongs to the
 * requesting user's school. Returns the record on success so callers can reuse
 * it, or sends the appropriate error response and returns `undefined`:
 *   - 404 if the record does not exist (do not leak existence across schools).
 *   - 403 if the record belongs to another school.
 *
 * The record is expected to expose a numeric `schoolId`. Callers that need to
 * resolve ownership through a parent (e.g. an incident action -> incident)
 * should pass a loader that returns the owning record.
 */
export async function verifyOwnership<T extends { schoolId?: number | null }>(
  req: Request,
  res: Response,
  loader: () => Promise<T | undefined>,
  notFoundMessage = "Not found",
): Promise<T | undefined> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return undefined;
  }

  const record = await loader();
  if (!record) {
    res.status(404).json({ message: notFoundMessage });
    return undefined;
  }

  if (record.schoolId !== req.user.schoolId) {
    res.status(403).json({ message: "You do not have access to this resource" });
    return undefined;
  }

  return record;
}
