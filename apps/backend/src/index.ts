import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as agentController from './controllers/agentController';
import * as voiceController from './controllers/voiceController';
import * as authController from './controllers/authController';
import * as historyManager from './utils/historyManager';
import sessionManager from './utils/sessionManager';
import { initializeFirebase } from './firebase/admin';
import { optionalAuth, requireAuth } from './middleware/auth';

dotenv.config();

// Initialize Firebase Admin SDK (optional, won't fail if not configured)
initializeFirebase();

const app: Express = express();
const port = process.env.BACKEND_PORT || process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Optional authentication middleware - adds user to request if token is valid
app.use(optionalAuth);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication Routes (optional Firebase)
app.get('/api/auth/verify', authController.verifyAuth);
app.post('/api/auth/signup', authController.signup);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/logout', authController.logout);
app.get('/api/auth/profile', requireAuth, authController.getUserProfile);
app.put('/api/auth/profile', requireAuth, authController.updateUserProfile);
app.get('/api/auth/subscription', requireAuth, authController.getSubscription);

// Agent Routes
app.post('/api/agent/execute', agentController.executeTask);
app.get('/api/agent/status/:sessionId', agentController.getTaskStatus);
app.post('/api/agent/analyze', agentController.analyzeWebsite);
app.post('/api/agent/cleanup/:sessionId', agentController.cleanupSession);
app.get('/api/agent/history', requireAuth, historyManager.getTaskHistory);
app.get('/api/agent/history/:taskId', requireAuth, historyManager.getTaskDetail);
app.delete('/api/agent/history/:taskId', requireAuth, historyManager.deleteTask);
app.get('/api/stats', historyManager.getStats);

// Voice API Routes
app.post('/api/voice/transcribe', voiceController.transcribeAudio);
app.post('/api/voice/synthesize', voiceController.synthesizeSpeech);

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

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(port, () => {
  console.log(`🚀 Wayfinder AI Backend running on port ${port}`);
  console.log(`📊 Dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`🔐 Firebase Auth: ${process.env.FIREBASE_SERVICE_ACCOUNT ? '✅ Enabled' : '⚪ Disabled'}`);
  console.log(`💾 Task History: ${process.env.FIREBASE_SERVICE_ACCOUNT ? '✅ Available for signed-in users' : '⚪ Disabled'}`);
});
