import { Response } from 'express';
import { isFirebaseEnabled, getFirestore } from '../firebase/admin';
import { AuthRequest } from '../middleware/auth';
import admin from 'firebase-admin';

/**
 * Save a completed/failed task to Firestore (no screenshots).
 * Called from the queue processor after task execution.
 */
export async function saveTask(
  uid: string,
  task: {
    id: string;
    taskDescription: string;
    status: string;
    steps: any[];
    startUrl?: string;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
  }
): Promise<string | null> {
  if (!isFirebaseEnabled()) {
    console.log('[TaskHistory] Firebase disabled, skipping save');
    return null;
  }

  try {
    const db = getFirestore();

    // Strip screenshots from steps — they are large base64 strings
    const sanitizedSteps = (task.steps || []).map((step: any) => ({
      stepNumber: step.stepNumber,
      description: step.description,
      action: step.action,
      result: step.result,
      timestamp: step.timestamp,
    }));

    const createdAt = task.createdAt instanceof Date ? task.createdAt : new Date();
    const updatedAt = task.updatedAt instanceof Date ? task.updatedAt : new Date();
    const durationSec = (updatedAt.getTime() - createdAt.getTime()) / 1000;

    const taskDoc = {
      taskId: task.id,
      status: task.status,
      input: {
        description: task.taskDescription,
        url: task.startUrl || '',
      },
      execution: {
        steps: sanitizedSteps,
        totalSteps: sanitizedSteps.length,
        duration: durationSec,
      },
      result: {
        success: task.status === 'completed',
        message:
          task.error ||
          (task.status === 'completed'
            ? 'Task completed successfully'
            : 'Task failed'),
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db
      .collection('users')
      .doc(uid)
      .collection('tasks')
      .doc(task.id)
      .set(taskDoc);

    // Update user task counters
    await db
      .collection('users')
      .doc(uid)
      .set(
        {
          subscription: {
            tasksUsed: admin.firestore.FieldValue.increment(1),
            tasksRemaining: admin.firestore.FieldValue.increment(-1),
          },
        },
        { merge: true }
      );

    console.log(`[TaskHistory] Saved task ${task.id} for user ${uid}`);
    return task.id;
  } catch (error) {
    console.error('[TaskHistory] Error saving task:', error);
    return null;
  }
}

/**
 * GET /api/agent/history
 * Get user's task history
 */
export async function getTaskHistory(req: AuthRequest, res: Response) {
  if (!isFirebaseEnabled()) {
    return res.status(503).json({
      error: 'Firebase not configured',
      message: 'Task history is only available when Firebase is enabled. Set FIREBASE_SERVICE_ACCOUNT to enable.',
    });
  }

  if (!req.user) {
    return res.status(401).json({
      error: 'Not authenticated',
      message: 'Please sign in to view your task history',
    });
  }

  try {
    const db = getFirestore();
    const tasksSnapshot = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('tasks')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const tasks = tasksSnapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
    }));

    return res.json({
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error('[TaskHistory] Error getting task history:', error);
    return res.status(500).json({ error: 'Failed to get task history' });
  }
}

/**
 * GET /api/agent/history/:taskId
 * Get specific task details
 */
export async function getTaskDetail(req: AuthRequest, res: Response) {
  if (!isFirebaseEnabled()) {
    return res.status(503).json({
      error: 'Firebase not configured',
      message: 'Task history is only available when Firebase is enabled.',
    });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { taskId } = req.params;

  try {
    const db = getFirestore();
    const taskDoc = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('tasks')
      .doc(taskId)
      .get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskData = taskDoc.data();
    return res.json({
      ...taskData,
      createdAt: taskData?.createdAt?.toDate?.() || new Date(),
      updatedAt: taskData?.updatedAt?.toDate?.() || new Date(),
    });
  } catch (error) {
    console.error('[TaskHistory] Error getting task detail:', error);
    return res.status(500).json({ error: 'Failed to get task detail' });
  }
}

/**
 * DELETE /api/agent/history/:taskId
 * Delete a task from history
 */
export async function deleteTask(req: AuthRequest, res: Response) {
  if (!isFirebaseEnabled()) {
    return res.status(503).json({
      error: 'Firebase not configured',
      message: 'Task history is only available when Firebase is enabled.',
    });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { taskId } = req.params;

  try {
    const db = getFirestore();
    
    // Verify ownership before deleting
    const taskDoc = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('tasks')
      .doc(taskId)
      .get();

    if (!taskDoc.exists) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Delete the task
    await taskDoc.ref.delete();

    // Increment tasksRemaining since they're deleting a saved task
    const userRef = db.collection('users').doc(req.user.uid);
    await userRef.update({
      'subscription.tasksRemaining': admin.firestore.FieldValue.increment(1),
      'subscription.tasksUsed': admin.firestore.FieldValue.increment(-1),
    });

    return res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('[TaskHistory] Error deleting task:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
}

/**
 * GET /api/agent/stats
 * Get user's statistics
 */
export async function getStats(req: AuthRequest, res: Response) {
  if (!isFirebaseEnabled()) {
    // Return basic stats even if not authenticated
    return res.json({
      authenticated: false,
      totalTasksExecuted: 0,
      message: 'Sign in to access your statistics',
    });
  }

  if (!req.user) {
    return res.json({
      authenticated: false,
      totalTasksExecuted: 0,
      message: 'Sign in to access your statistics',
    });
  }

  try {
    const db = getFirestore();
    
    // Get tasks count
    const tasksSnapshot = await db
      .collection('users')
      .doc(req.user.uid)
      .collection('tasks')
      .count()
      .get();

    // Get user subscription info
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();

    return res.json({
      authenticated: true,
      totalTasksExecuted: tasksSnapshot.data().count || 0,
      subscription: userData?.subscription || {},
      settings: userData?.settings || {},
    });
  } catch (error) {
    console.error('[Stats] Error getting stats:', error);
    return res.status(500).json({ error: 'Failed to get stats' });
  }
}
