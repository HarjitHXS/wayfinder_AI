import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// Rate limiting store
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiting middleware
 * Prevents brute force attacks and DoS
 */
export function rateLimit(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetTime < now) {
          rateLimitStore.delete(k);
        }
      }
    }
    
    const entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetTime < now) {
      // New window
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      return next();
    }
    
    if (entry.count >= options.maxRequests) {
      return res.status(429).json({
        error: options.message || 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
    }
    
    entry.count++;
    next();
  };
}

/**
 * Input validation middleware
 */
export function validateTaskInput(req: AuthRequest, res: Response, next: NextFunction) {
  const { taskDescription, startUrl } = req.body;
  
  // Validate taskDescription
  if (!taskDescription || typeof taskDescription !== 'string') {
    return res.status(400).json({ error: 'Invalid taskDescription' });
  }
  
  if (taskDescription.length > 5000) {
    return res.status(400).json({ error: 'taskDescription too long (max 5000 characters)' });
  }
  
  // Sanitize taskDescription - remove control characters
  req.body.taskDescription = taskDescription.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Validate startUrl
  if (!startUrl || typeof startUrl !== 'string') {
    return res.status(400).json({ error: 'Invalid startUrl' });
  }
  
  try {
    const url = new URL(startUrl);
    
    // Prevent SSRF attacks - only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are allowed' });
    }
    
    // Prevent access to internal networks
    const hostname = url.hostname.toLowerCase();
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254', // AWS metadata service
      'metadata.google.internal', // GCP metadata service
    ];
    
    if (blockedHosts.some(blocked => hostname === blocked || hostname.endsWith('.' + blocked))) {
      return res.status(400).json({ error: 'Access to internal URLs is not allowed' });
    }
    
    // Block private IP ranges
    if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname)) {
      return res.status(400).json({ error: 'Access to private IP addresses is not allowed' });
    }
    
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  next();
}

/**
 * Validate continue task input
 */
export function validateContinueInput(req: AuthRequest, res: Response, next: NextFunction) {
  const { instruction, inputs } = req.body;
  
  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: 'Invalid instruction' });
  }
  
  if (instruction.length > 5000) {
    return res.status(400).json({ error: 'instruction too long (max 5000 characters)' });
  }
  
  // Sanitize instruction
  req.body.instruction = instruction.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Validate inputs if provided
  if (inputs) {
    if (typeof inputs !== 'object') {
      return res.status(400).json({ error: 'Invalid inputs format' });
    }
    
    // Sanitize input values
    for (const key in inputs) {
      if (typeof inputs[key] === 'string') {
        inputs[key] = inputs[key].substring(0, 1000); // Limit length
        inputs[key] = inputs[key].replace(/[\x00-\x1F\x7F]/g, ''); // Remove control chars
      }
    }
  }
  
  next();
}

/**
 * Validate voice input
 */
export function validateVoiceInput(req: Request, res: Response, next: NextFunction) {
  const { audioBase64, text } = req.body;
  
  if (audioBase64) {
    if (typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Invalid audioBase64 format' });
    }
    
    // Limit audio size (50MB base64 = ~37MB raw)
    if (audioBase64.length > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'Audio file too large (max 50MB)' });
    }
    
    // Validate base64 format
    if (!/^[A-Za-z0-9+/=]+$/.test(audioBase64)) {
      return res.status(400).json({ error: 'Invalid base64 encoding' });
    }
  }
  
  if (text) {
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text format' });
    }
    
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long (max 5000 characters)' });
    }
    
    // Sanitize text
    req.body.text = text.replace(/[\x00-\x1F\x7F]/g, '');
  }
  
  next();
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeError(error: any): string {
  if (!error) return 'An error occurred';
  
  // In production, don't expose detailed error messages
  if (process.env.NODE_ENV === 'production') {
    // Log the full error for debugging
    console.error('[Security] Error sanitized:', error);
    
    // Return generic message
    if (error.code === 'ECONNREFUSED') return 'Service temporarily unavailable';
    if (error.code === 'ETIMEDOUT') return 'Request timeout';
    if (error.code === 'ENOTFOUND') return 'Resource not found';
    
    return 'An error occurred processing your request';
  }
  
  // In development, return the message but sanitize paths
  const message = error.message || String(error);
  return message.replace(/\/[^\s]+(\/[^\s]+)+/g, '[PATH]');
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ error: 'Request timeout' });
      }
    }, timeoutMs);
    
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
}

/**
 * Security logging middleware
 */
export function securityLogger(req: AuthRequest, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const userId = req.user?.uid || 'anonymous';
    const ip = req.ip || req.socket.remoteAddress;
    
    // Log suspicious activity
    if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
      console.warn(`[Security] ${res.statusCode} ${req.method} ${req.path} - User: ${userId}, IP: ${ip}, Duration: ${duration}ms`);
    }
    
    // Log slow requests (potential DoS)
    if (duration > 30000) {
      console.warn(`[Security] Slow request: ${req.method} ${req.path} - ${duration}ms, User: ${userId}`);
    }
  });
  
  next();
}
