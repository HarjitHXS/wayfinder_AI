import { Request, Response, NextFunction } from 'express';
import { isFirebaseEnabled, getFirebaseAuth } from '../firebase/admin';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    displayName?: string;
  };
}

/**
 * Optional authentication middleware
 * Verifies Firebase token if provided, but doesn't require it
 * Sets req.user if token is valid, otherwise leaves it undefined
 */
export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Firebase not enabled, skip auth
  if (!isFirebaseEnabled()) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // No token provided, continue without user
  }

  try {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decodedToken = await getFirebaseAuth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
    };
  } catch (error) {
    console.error('[Auth] Invalid token:', error);
    // Invalid token, but don't block the request - just continue without user
  }

  next();
}

/**
 * Required authentication middleware
 * Throws 401 if no valid Firebase token is provided
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!isFirebaseEnabled()) {
    return res.status(503).json({ error: 'Authentication not available' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized. Please provide a valid Firebase token.' });
  }

  next();
}
