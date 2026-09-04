import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, extractToken, JWTPayload } from "./jwt";

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Middleware to require JWT authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }

  req.user = payload;
  next();
}

/**
 * Middleware to optionally verify JWT authentication
 * Does not fail if token is missing, but validates if present
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = extractToken(authHeader);

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

/**
 * Middleware to check if user has admin role
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  // Note: You'll need to add role checking to the JWT payload or fetch from database
  // For now, this assumes role info is added elsewhere
  // TODO: Implement role-based access control

  next();
}
