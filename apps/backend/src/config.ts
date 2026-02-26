/**
 * Centralized backend configuration
 * 
 * LOCAL DEVELOPMENT: Environment variables are optional, defaults to localhost
 * CLOUD RUN: Environment variables MUST be set via Cloud Run service configuration
 * 
 * This is the single source of truth for all backend configuration.
 */

export interface Config {
  port: number;
  isProduction: boolean;
  frontendUrl: string;
  allowedOrigins: string[];
  firebase: {
    enabled: boolean;
  };
  security: {
    requestTimeoutMs: number;
    corsMaxAgeSeconds: number;
    corsMaxAgeHours: number;
  };
  rateLimits: {
    auth: {
      windowMs: number;
      maxRequests: number;
    };
    agent: {
      windowMs: number;
      maxRequests: number;
    };
    voice: {
      windowMs: number;
      maxRequests: number;
    };
  };
}

const getConfig = (): Config => {
  // Determine if we're in production (Cloud Run sets NODE_ENV)
  const isProduction = process.env.NODE_ENV === 'production';

  // Port: local defaults to 3001, Cloud Run uses env var or defaults to 3000
  const port = parseInt(process.env.BACKEND_PORT || process.env.PORT || '3001', 10);

  // Frontend URL: local defaults to localhost:3000, production requires env var
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Parse allowed origins from FRONTEND_URL or explicit list
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || frontendUrl)
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  // Firebase: enabled only if service account is configured
  const firebaseEnabled = !!process.env.FIREBASE_SERVICE_ACCOUNT;

  return {
    port,
    isProduction,
    frontendUrl,
    allowedOrigins,
    firebase: {
      enabled: firebaseEnabled,
    },
    security: {
      requestTimeoutMs: 5 * 60 * 1000, // 5 minutes
      corsMaxAgeSeconds: 86400, // 24 hours
      corsMaxAgeHours: 24,
    },
    rateLimits: {
      auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
      },
      agent: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10,
      },
      voice: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 20,
      },
    },
  };
};

export const config = getConfig();
