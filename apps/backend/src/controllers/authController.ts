import { Request, Response } from 'express';
import { isFirebaseEnabled, getFirestore, getFirebaseAuth } from '../firebase/admin';
import { AuthRequest } from '../middleware/auth';
import admin from 'firebase-admin';

/**
 * Creates or updates user document in Firestore
 */
export async function createOrUpdateUser(uid: string, email?: string, displayName?: string) {
  if (!isFirebaseEnabled()) {
    return null;
  }

  try {
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    const userData = {
      uid,
      email: email || '',
      displayName: displayName || 'User',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      subscription: {
        plan: 'free',
        tasksRemaining: 10,
        tasksUsed: 0,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      settings: {
        notifications: true,
        theme: 'auto',
      },
    };

    // Use set with merge to update existing docs
    await userRef.set(userData, { merge: true });
    return userData;
  } catch (error) {
    console.error('[AuthController] Error creating/updating user:', error);
    throw error;
  }
}

/**
 * GET /api/auth/verify
 * Verifies if Firebase is enabled and user is authenticated
 */
export async function verifyAuth(req: AuthRequest, res: Response) {
  if (!isFirebaseEnabled()) {
    return res.status(503).json({
      enabled: false,
      message: 'Firebase authentication is not configured',
    });
  }

  if (req.user) {
    return res.json({
      enabled: true,
      authenticated: true,
      user: req.user,
    });
  }

  return res.json({
    enabled: true,
    authenticated: false,
    message: 'User not authenticated. Please login to save your task history.',
  });
}

/**
 * POST /api/auth/signup
 * Creates a new user account
 */
export async function signup(req: Request, res: Response) {
  if (!isFirebaseEnabled()) {
    return res.status(503).json({ error: 'Authentication not available' });
  }

  const { email, password, displayName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  // Check for password complexity
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    return res.status(400).json({
      error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    });
  }

  // Sanitize displayName
  const sanitizedDisplayName = displayName ? displayName.substring(0, 100).replace(/[\x00-\x1F\x7F]/g, '') : 'User';

  try {
    const auth = getFirebaseAuth();
    
    // Create Firebase user - don't log password
    console.log(`[Auth] Creating user account for email: ${email}`);
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: sanitizedDisplayName,
    });

    // Create user document in Firestore
    await createOrUpdateUser(userRecord.uid, email, sanitizedDisplayName);

    console.log(`[Auth] User created successfully: ${userRecord.uid}`);
    return res.status(201).json({
      message: 'User created successfully',
      uid: userRecord.uid,
      email: userRecord.email,
    });
  } catch (error: any) {
    console.error('[AuthController] Signup error:', error.code || error.message);

    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Email already in use' });
    }

    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (error.code === 'auth/weak-password') {
      return res.status(400).json({ error: 'Password is too weak' });
    }

    return res.status(500).json({ error: 'Failed to create user' });
  }
}

/**
 * POST /api/auth/login
 * This is handled client-side with Firebase SDK
 * This endpoint is just for documentation/testing
 */
export async function login(req: Request, res: Response) {
  if (!isFirebaseEnabled()) {
    return res.status(503).json({ error: 'Authentication not available' });
  }

  return res.json({
    message: 'Use Firebase Client SDK for login. After login, include ID token in Authorization header.',
    example: 'Authorization: Bearer <idToken>',
  });
}

/**
 * POST /api/auth/logout
 * Client-side logout (just for API consistency)
 */
export async function logout(req: AuthRequest, res: Response) {
  return res.json({
    message: 'Logout successful. Remove the token from your client.',
  });
}

/**
 * GET /api/auth/profile
 * Get user profile information
 */
export async function getUserProfile(req: AuthRequest, res: Response) {
  if (!isFirebaseEnabled() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.json(userDoc.data());
  } catch (error) {
    console.error('[AuthController] Error getting profile:', error);
    return res.status(500).json({ error: 'Failed to get profile' });
  }
}

/**
 * PUT /api/auth/profile
 * Update user profile
 */
export async function updateUserProfile(req: AuthRequest, res: Response) {
  if (!isFirebaseEnabled() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { displayName, theme, notifications } = req.body;

  try {
    const db = getFirestore();
    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (displayName) updateData.displayName = displayName;
    if (theme) updateData['settings.theme'] = theme;
    if (notifications !== undefined) updateData['settings.notifications'] = notifications;

    await db.collection('users').doc(req.user.uid).update(updateData);

    return res.json({
      message: 'Profile updated successfully',
      user: {
        uid: req.user.uid,
        ...updateData,
      },
    });
  } catch (error) {
    console.error('[AuthController] Error updating profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

/**
 * GET /api/auth/subscription
 * Get user subscription info
 */
export async function getSubscription(req: AuthRequest, res: Response) {
  if (!isFirebaseEnabled() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    return res.json({
      uid: req.user.uid,
      plan: userData?.subscription?.plan || 'free',
      tasksRemaining: userData?.subscription?.tasksRemaining || 0,
      tasksUsed: userData?.subscription?.tasksUsed || 0,
      resetDate: userData?.subscription?.resetDate,
    });
  } catch (error) {
    console.error('[AuthController] Error getting subscription:', error);
    return res.status(500).json({ error: 'Failed to get subscription' });
  }
}
