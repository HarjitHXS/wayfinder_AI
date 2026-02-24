import { Request, Response } from 'express';
import { AgentManager } from '../agents/manager';
import { TaskQueue, QueueItem } from '../utils/queue';
import sessionManager from '../utils/sessionManager';
import browserPool from '../utils/browserPool';
import { randomUUID } from 'crypto';

interface ExecuteRequest {
  taskDescription: string;
  startUrl: string;
}

// Initialize browser pool on startup
let browserInitialized = false;
async function initializeBrowserPool() {
  if (!browserInitialized) {
    try {
      await browserPool.initialize();
      browserInitialized = true;
    } catch (error) {
      console.error('[Controller] Failed to initialize browser pool:', error);
      throw error;
    }
  }
}

// Create queue with processor
const queue = new TaskQueue<ExecuteRequest>(async (item: QueueItem<ExecuteRequest>) => {
  try {
    console.log(`[Queue] Processing task ${item.id}`);

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'wayfinder-demo';
    const manager = new AgentManager(projectId);

    const task = await manager.executeTask(item.data.taskDescription, item.data.startUrl, item.id);
    sessionManager.updateSession(item.id, task);

    console.log(`[Queue] ✅ Completed task ${item.id}`);
  } catch (error) {
    console.error(`[Queue] ❌ Failed task ${item.id}:`, error);
    const errorTask = {
      id: item.id,
      taskDescription: item.data.taskDescription,
      status: 'failed' as const,
      steps: [],
      currentScreenshot: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    sessionManager.updateSession(item.id, errorTask);
  }
});

export async function executeTask(req: Request, res: Response) {
  try {
    const { taskDescription, startUrl } = req.body as ExecuteRequest;

    if (!taskDescription || !startUrl) {
      return res.status(400).json({ error: 'taskDescription and startUrl are required' });
    }

    // Initialize browser pool if needed
    await initializeBrowserPool();

    const sessionId = randomUUID().substring(0, 8);
    const pendingTask = {
      id: sessionId,
      taskDescription,
      status: 'pending' as const,
      steps: [],
      currentScreenshot: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create session and queue task
    sessionManager.createSession(sessionId, pendingTask);
    queue.enqueue(sessionId, { taskDescription, startUrl });

    res.json({
      sessionId,
      task: pendingTask,
      message: 'Task queued for execution',
      queueLength: queue.getQueueLength(),
    });
  } catch (error) {
    console.error('[executeTask] Error:', error);
    res.status(500).json({ error: 'Failed to execute task', details: error instanceof Error ? error.message : String(error) });
  }
}

export async function getTaskStatus(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;

    const task = sessionManager.getSession(sessionId);
    if (!task) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error getting task status:', error);
    res.status(500).json({ error: 'Failed to get task status' });
  }
}

export async function analyzeWebsite(req: Request, res: Response) {
  try {
    const { url } = req.body as { url: string };

    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    // Initialize browser pool if needed
    await initializeBrowserPool();

    console.log('[analyzeWebsite] Analyzing:', url);
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'wayfinder-demo';
    const manager = new AgentManager(projectId);

    const analysis = await manager.analyzeWebsite(url);
    console.log('[analyzeWebsite] ✅ Analysis complete');

    res.json(analysis);
  } catch (error) {
    console.error('[analyzeWebsite] Error:', error);
    res.status(500).json({ error: 'Failed to analyze website', details: error instanceof Error ? error.message : String(error) });
  }
}

export async function cleanupSession(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    sessionManager.deleteSession(sessionId);
    res.json({ message: 'Session cleaned up' });
  } catch (error) {
    console.error('Error cleaning up session:', error);
    res.status(500).json({ error: 'Failed to cleanup session' });
  }
}

export async function getStats(req: Request, res: Response) {
  try {
    const stats = sessionManager.getStats();
    res.json({
      queueLength: queue.getQueueLength(),
      isProcessing: queue.isProcessing(),
      ...stats,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
}
