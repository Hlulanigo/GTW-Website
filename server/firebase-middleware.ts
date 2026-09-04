import type { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from './firebase-admin';
import logger from './logger';

export interface FirebaseRequest extends Request {
  firebaseUser?: {
    uid: string;
    email?: string;
    emailVerified: boolean;
  };
}

/**
 * Middleware to verify Firebase ID token
 */
export async function requireFirebaseAuth(
  req: FirebaseRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await verifyFirebaseToken(idToken);
      
      req.firebaseUser = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified || false,
      };

      next();
    } catch (error) {
      logger.error('Token verification failed', { error });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware to verify email is verified
 */
export async function requireEmailVerified(
  req: FirebaseRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.firebaseUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.firebaseUser.emailVerified) {
    return res.status(403).json({ 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  next();
}

/**
 * Optional auth middleware - doesn't fail if no token provided
 */
export async function optionalFirebaseAuth(
  req: FirebaseRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];

      try {
        const decodedToken = await verifyFirebaseToken(idToken);
        
        req.firebaseUser = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified || false,
        };
      } catch (error) {
        // Token invalid but continue without auth
        logger.warn('Optional auth: Invalid token provided', { error });
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error', { error });
    next();
  }
}
