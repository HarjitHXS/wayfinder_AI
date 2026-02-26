import { Request, Response } from 'express';
import { AgentManager } from '../agents/manager';
import { TaskQueue, QueueItem } from '../utils/queue';
import sessionManager from '../utils/sessionManager';
import browserPool from '../utils/browserPool';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { saveTask } from '../utils/historyManager';
import { isFirebaseEnabled } from '../firebase/admin';

interface ExecuteRequest {
  taskDescription: string;
  startUrl: string;
  uid?: string;
}

interface ContinueRequest {
  instruction: string;
  inputs?: {
    email?: string;
    password?: string;
  };
}

interface ContinueQueueRequest {
  instruction: string;
  inputs?: {
    email?: string;
    password?: string;
  };
  uid: string;
}

type AgentQueuePayload =
  | { kind: 'execute'; data: ExecuteRequest }
  | { kind: 'continue'; data: ContinueQueueRequest };

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
const queue = new TaskQueue<AgentQueuePayload>(async (item: QueueItem<AgentQueuePayload>) => {
  try {
    console.log(`[Queue] Processing task ${item.id}`);

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'autosteer';
    const manager = new AgentManager(projectId);

    if (item.data.kind === 'execute') {
      const task = await manager.executeTask(item.data.data.taskDescription, item.data.data.startUrl, item.id);
      sessionManager.updateSession(item.id, task);

      // Persist to Firestore if user was authenticated
      if (item.data.data.uid) {
        await saveTask(item.data.data.uid, task);
      }
    } else {
      const existingTask = sessionManager.getSession(item.id);
      if (!existingTask) {
        throw new Error('Session not found for continue');
      }

      const task = await manager.continueTask(
        existingTask,
        item.data.data.instruction,
        item.id,
        item.data.data.inputs
      );
      sessionManager.updateSession(item.id, task);

      if (item.data.data.uid) {
        await saveTask(item.data.data.uid, task);
      }
    }

    console.log(`[Queue] ✅ Completed task ${item.id}`);
  } catch (error) {
    console.error(`[Queue] ❌ Failed task ${item.id}:`, error);
    const taskDescription = item.data.kind === 'execute'
      ? item.data.data.taskDescription
      : item.data.data.instruction;
    const uid = item.data.kind === 'execute'
      ? item.data.data.uid
      : item.data.data.uid;
    const errorTask = {
      id: item.id,
      taskDescription,
      status: 'failed' as const,
      steps: [],
      currentScreenshot: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    sessionManager.updateSession(item.id, errorTask);

    // Persist failed tasks too for history
    if (uid) {
      await saveTask(uid, errorTask);
    }
  }
});

export async function executeTask(req: AuthRequest, res: Response) {
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

    // Create session and queue task (include uid if authenticated)
    sessionManager.createSession(sessionId, pendingTask, req.user?.uid);
    queue.enqueue(sessionId, { kind: 'execute', data: { taskDescription, startUrl, uid: req.user?.uid } });

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

export async function continueTask(req: AuthRequest, res: Response) {
  try {
    const { sessionId } = req.params;
    const { instruction, inputs } = req.body as ContinueRequest;

    if (!instruction) {
      return res.status(400).json({ error: 'instruction is required' });
    }

    const firebaseEnabled = isFirebaseEnabled();
    if (firebaseEnabled && !req.user?.uid) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
    }

    const entry = sessionManager.getSessionEntry(sessionId);
    if (!entry) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (firebaseEnabled && (!entry.ownerUid || entry.ownerUid !== req.user?.uid)) {
      return res.status(403).json({ error: 'Forbidden. Session does not belong to user.' });
    }

    if (entry.task.status === 'running' || entry.task.status === 'pending') {
      return res.status(409).json({ error: 'Task is already running' });
    }

    await initializeBrowserPool();

    const pendingTask = {
      ...entry.task,
      taskDescription: instruction,
      status: 'pending' as const,
      updatedAt: new Date(),
    };

    sessionManager.updateSession(sessionId, pendingTask);
    queue.enqueue(sessionId, {
      kind: 'continue',
      data: { instruction, inputs, uid: req.user?.uid || '' }
    });

    res.json({
      sessionId,
      task: pendingTask,
      message: 'Continue queued for execution',
      queueLength: queue.getQueueLength(),
    });
  } catch (error) {
    console.error('[continueTask] Error:', error);
    res.status(500).json({ error: 'Failed to continue task', details: error instanceof Error ? error.message : String(error) });
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
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'autosteer';
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

