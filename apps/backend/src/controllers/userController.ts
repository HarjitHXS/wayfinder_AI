import { Request, Response } from 'express';
import admin from 'firebase-admin';
import { FieldValue, getFirestore } from '../utils/firebase';

function normalizeUsername(username: string): { id: string; displayName: string } {
  const displayName = username.trim();
  const id = displayName.toLowerCase().replace(/\s+/g, '_');
  return { id, displayName };
}

export async function login(req: Request, res: Response) {
  try {
    const db = getFirestore();
    const { username } = req.body as { username: string };

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'username is required' });
    }

    const { id, displayName } = normalizeUsername(username);
    const userRef = db.collection('users').doc(id);
    const statsRef = db.collection('metrics').doc('users');

    await db.runTransaction(async (tx: admin.firestore.Transaction) => {
      const userSnap = await tx.get(userRef);
      const isNewUser = !userSnap.exists;

      if (isNewUser) {
        tx.set(userRef, {
          displayName,
          loginCount: 1,
          createdAt: FieldValue.serverTimestamp(),
          lastLoginAt: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(userRef, {
          loginCount: FieldValue.increment(1),
          lastLoginAt: FieldValue.serverTimestamp(),
        });
      }

      tx.set(statsRef, {
        totalUsers: FieldValue.increment(isNewUser ? 1 : 0),
        totalLogins: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    res.json({ success: true, userId: id, displayName });
  } catch (error) {
    console.error('[login] Error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
}

export async function getUserStats(req: Request, res: Response) {
  try {
    const db = getFirestore();
    const statsRef = db.collection('metrics').doc('users');
    const statsSnap = await statsRef.get();
    const data = statsSnap.exists ? statsSnap.data() : {};

    res.json({
      totalUsers: data?.totalUsers || 0,
      totalLogins: data?.totalLogins || 0,
    });
  } catch (error) {
    console.error('[getUserStats] Error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
}

export async function submitFeedback(req: Request, res: Response) {
  try {
    const db = getFirestore();
    const { username, rating, comment } = req.body as { username: string; rating: number; comment?: string };

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'username is required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    const feedbackRef = db.collection('feedback');
    await feedbackRef.add({
      username: username.trim(),
      rating,
      comment: comment?.trim() || '',
      createdAt: FieldValue.serverTimestamp(),
    });

    const summaryRef = db.collection('metrics').doc('feedback');
    await summaryRef.set({
      totalRatings: FieldValue.increment(1),
      ratingSum: FieldValue.increment(rating),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true });
  } catch (error) {
    console.error('[submitFeedback] Error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
}

export async function getFeedbackSummary(req: Request, res: Response) {
  try {
    const db = getFirestore();
    const summaryRef = db.collection('metrics').doc('feedback');
    const summarySnap = await summaryRef.get();
    const data = summarySnap.exists ? summarySnap.data() : {};

    const totalRatings = Number(data?.totalRatings || 0);
    const ratingSum = Number(data?.ratingSum || 0);
    const averageRating = totalRatings > 0 ? ratingSum / totalRatings : 0;

    res.json({
      averageRating: Number(averageRating.toFixed(2)),
      totalRatings,
    });
  } catch (error) {
    console.error('[getFeedbackSummary] Error:', error);
    res.status(500).json({ error: 'Failed to get feedback summary' });
  }
}
