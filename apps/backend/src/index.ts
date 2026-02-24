import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as agentController from './controllers/agentController';
// Temporarily disabled for UI testing
// import * as userController from './controllers/userController';

dotenv.config();

const app: Express = express();
const port = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.post('/api/agent/execute', agentController.executeTask);
app.get('/api/agent/status/:sessionId', agentController.getTaskStatus);
app.post('/api/agent/analyze', agentController.analyzeWebsite);
app.post('/api/agent/cleanup/:sessionId', agentController.cleanupSession);
app.get('/api/stats', agentController.getStats);

// Temporarily disabled Firebase routes for UI testing
// app.post('/api/users/login', userController.login);
// app.get('/api/users/stats', userController.getUserStats);
// app.post('/api/feedback', userController.submitFeedback);
// app.get('/api/feedback/summary', userController.getFeedbackSummary);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(port, () => {
  console.log(`🚀 Wayfinder AI Backend running on port ${port}`);
  console.log(`📊 Dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
