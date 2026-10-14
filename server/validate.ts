import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { fromError } from "zod-validation-error";

/**
 * Body-validation middleware factory.
 *
 * Given a zod schema, returns Express middleware that parses `req.body`:
 *   - On success, `req.body` is REPLACED with the parsed (and coerced/stripped)
 *     value so downstream handlers get a typed, trusted object.
 *   - On failure, responds 400 with a readable message built by
 *     zod-validation-error's `fromError`, never a 500 or a stack trace.
 *
 * The schema should already exclude server-controlled fields (e.g. `id`,
 * `schoolId`) via `.omit(...)`/`.partial()` at the call site, so clients can
 * never inject them.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const validationError = fromError(result.error);
      res.status(400).json({ message: validationError.toString() });
      return;
    }
    req.body = result.data;
    next();
  };
}
