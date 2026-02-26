import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { config } from './config';
import * as agentController from './controllers/agentController';
import * as voiceController from './controllers/voiceController';
import * as authController from './controllers/authController';
import * as historyManager from './utils/historyManager';
import sessionManager from './utils/sessionManager';
import { initializeFirebase } from './firebase/admin';
import { optionalAuth, requireAuth } from './middleware/auth';
import {
  rateLimit,
  validateTaskInput,
  validateContinueInput,
  validateVoiceInput,
  sanitizeError,
  requestTimeout,
  securityLogger,
} from './middleware/security';

dotenv.config();

// Initialize Firebase Admin SDK (optional, won't fail if not configured)
initializeFirebase();

const app: Express = express();

// Trust proxy - important for rate limiting and IP detection
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS with strict settings
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (config.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: config.security.corsMaxAgeSeconds,
}));

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security logging
app.use(securityLogger);

// General request timeout
app.use(requestTimeout(config.security.requestTimeoutMs));

// Optional authentication middleware - adds user to request if token is valid
app.use(optionalAuth);

// Health check - no rate limit
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication Routes (optional Firebase) - stricter rate limiting
const authRateLimit = rateLimit({ windowMs: config.rateLimits.auth.windowMs, maxRequests: config.rateLimits.auth.maxRequests, message: 'Too many authentication attempts' });

app.get('/api/auth/verify', authController.verifyAuth);
app.post('/api/auth/signup', authRateLimit, authController.signup);
app.post('/api/auth/login', authRateLimit, authController.login);
app.post('/api/auth/logout', authController.logout);
app.get('/api/auth/profile', authController.getUserProfile);
app.put('/api/auth/profile', authController.updateUserProfile);
app.get('/api/auth/subscription', authController.getSubscription);

// Agent Routes - moderate rate limiting
const agentRateLimit = rateLimit({ windowMs: config.rateLimits.agent.windowMs, maxRequests: config.rateLimits.agent.maxRequests, message: 'Too many requests' });

app.post('/api/agent/execute', agentRateLimit, validateTaskInput, agentController.executeTask);
app.post('/api/agent/continue/:sessionId', agentRateLimit, validateContinueInput, agentController.continueTask);
app.get('/api/agent/status/:sessionId', agentController.getTaskStatus);
app.post('/api/agent/analyze', agentRateLimit, validateTaskInput, agentController.analyzeWebsite);
app.post('/api/agent/cleanup/:sessionId', agentController.cleanupSession);
app.get('/api/agent/history', historyManager.getTaskHistory);
app.get('/api/agent/history/:taskId', historyManager.getTaskDetail);
app.delete('/api/agent/history/:taskId', historyManager.deleteTask);
app.get('/api/stats', historyManager.getStats);

// Voice API Routes - rate limiting for voice
const voiceRateLimit = rateLimit({ windowMs: config.rateLimits.voice.windowMs, maxRequests: config.rateLimits.voice.maxRequests, message: 'Too many voice requests' });

app.post('/api/voice/transcribe', voiceRateLimit, validateVoiceInput, voiceController.transcribeAudio);
app.post('/api/voice/synthesize', voiceRateLimit, validateVoiceInput, voiceController.synthesizeSpeech);

// SSE streaming endpoint — pushes task updates in real-time
app.get('/api/agent/stream/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  let lastStepCount = -1;
  let lastStatus = '';

  const interval = setInterval(() => {
    const task = sessionManager.getSession(sessionId);
    if (!task) return;

    // Only send when something changed
    const currentStepCount = task.steps?.length ?? 0;
    if (currentStepCount !== lastStepCount || task.status !== lastStatus) {
      lastStepCount = currentStepCount;
      lastStatus = task.status;
      res.write(`data: ${JSON.stringify(task)}\n\n`);
    }

    // Close stream when task finishes
    if (task.status === 'completed' || task.status === 'failed') {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify(task)}\n\n`);
      res.end();
    }
  }, 400); // Check every 400ms

  // Clean up if client disconnects
  req.on('close', () => {
    clearInterval(interval);
  });
});

// Error handling middleware - sanitize errors to prevent information leakage
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  
  // Don't expose internal error details
  const safeMessage = sanitizeError(err);
  const statusCode = (err as any).statusCode || 500;
  
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : safeMessage,
  });
});

app.listen(config.port, () => {
  console.log(`🚀 Wayfinder AI Backend running on port ${config.port}`);
  console.log(`📊 Dashboard: ${config.frontendUrl}`);
  console.log(`🔐 Firebase Auth: ${config.firebase.enabled ? '✅ Enabled' : '⚪ Disabled'}`);
  console.log(`💾 Task History: ${config.firebase.enabled ? '✅ Available for signed-in users' : '⚪ Disabled'}`);
});
