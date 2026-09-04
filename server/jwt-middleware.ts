import type { Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { users } from "../shared/schema";
import { db } from "./storage";
import {
  requireAuth as requireFirebaseAuth,
  optionalAuth as optionalFirebaseAuth,
  type AuthenticatedRequest,
} from "./firebase-admin";

export type { AuthenticatedRequest };

/**
 * Compatibility exports for routes that previously imported JWT middleware.
 * Firebase ID tokens are the single supported bearer-token format.
 */
export const requireAuth = requireFirebaseAuth;
export const optionalAuth = optionalFirebaseAuth;

/**
 * Require a Firebase-authenticated user with the admin role from PostgreSQL.
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const result = await db
      .select({ role: users.role, suspended: users.suspended })
      .from(users)
      .where(eq(users.id, req.user.uid))
      .limit(1);

    const user = result[0];
    if (!user) {
      return res.status(403).json({ error: "Admin account is not provisioned" });
    }

    if (user.suspended) {
      return res.status(403).json({ error: "Account is suspended" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    (req as AuthenticatedRequest & { userRole?: string }).userRole = "admin";
    next();
  } catch (error) {
    next(error);
  }
}
