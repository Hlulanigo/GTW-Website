import type { Express } from 'express';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { db } from './storage';
import { requireFirebaseAuth, type FirebaseRequest } from './firebase-middleware';
import { getUserByUid, sendPushNotification } from './firebase-admin';
import logger from './logger';

/**
 * Register Firebase authentication routes
 */
export function registerFirebaseAuthRoutes(app: Express) {
  /**
   * Sync Firebase user with local database
   * Called after Firebase authentication on client
   */
  app.post('/api/firebase/sync-user', requireFirebaseAuth, async (req: FirebaseRequest, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      if (!firebaseUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, phone } = req.body;

      // Get full Firebase user data
      const fbUser = await getUserByUid(firebaseUser.uid);
      if (!fbUser) {
        return res.status(404).json({ error: 'Firebase user not found' });
      }

      // Check if user exists in database
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, firebaseUser.uid))
        .limit(1);

      if (existingUser.length > 0) {
        // Update existing user
        const [updatedUser] = await db
          .update(users)
          .set({
            name: name || existingUser[0].name,
            phone: phone || existingUser[0].phone,
            verified: fbUser.emailVerified,
          })
          .where(eq(users.id, firebaseUser.uid))
          .returning();

        return res.json({
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            phone: updatedUser.phone,
            emailVerified: fbUser.emailVerified,
            verified: updatedUser.verified,
            rating: updatedUser.rating,
            role: updatedUser.role,
            subscriptionTier: updatedUser.subscriptionTier,
            subscriptionStatus: updatedUser.subscriptionStatus,
            createdAt: updatedUser.createdAt,
          },
        });
      }

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          id: firebaseUser.uid,
          email: fbUser.email || '',
          name: name || fbUser.displayName || 'User',
          phone: phone || fbUser.phoneNumber || null,
          passwordHash: 'firebase-auth', // Placeholder since Firebase handles auth
          verified: fbUser.emailVerified,
        })
        .returning();

      res.status(201).json({
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          phone: newUser.phone,
          emailVerified: fbUser.emailVerified,
          verified: newUser.verified,
          rating: newUser.rating,
          role: newUser.role,
          subscriptionTier: newUser.subscriptionTier,
          subscriptionStatus: newUser.subscriptionStatus,
          createdAt: newUser.createdAt,
        },
      });
    } catch (error) {
      logger.error('User sync error', { error });
      res.status(500).json({ error: 'Failed to sync user' });
    }
  });

  /**
   * Get current user profile
   */
  app.get('/api/firebase/me', requireFirebaseAuth, async (req: FirebaseRequest, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      if (!firebaseUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get user from database
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, firebaseUser.uid))
        .limit(1);

      if (userResult.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult[0];

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        emailVerified: firebaseUser.emailVerified,
        rating: user.rating,
        verified: user.verified,
        role: user.role,
        suspended: user.suspended,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
      });
    } catch (error) {
      logger.error('Get user error', { error });
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  /**
   * Update user profile
   */
  app.put('/api/firebase/profile', requireFirebaseAuth, async (req: FirebaseRequest, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      if (!firebaseUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, phone } = req.body;

      const [updatedUser] = await db
        .update(users)
        .set({
          name: name || undefined,
          phone: phone || undefined,
        })
        .where(eq(users.id, firebaseUser.uid))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        rating: updatedUser.rating,
        verified: updatedUser.verified,
      });
    } catch (error) {
      logger.error('Update profile error', { error });
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  /**
   * Register or update FCM token for push notifications
   */
  app.post('/api/firebase/fcm-token', requireFirebaseAuth, async (req: FirebaseRequest, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      if (!firebaseUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { fcmToken } = req.body;

      if (!fcmToken) {
        return res.status(400).json({ error: 'FCM token is required' });
      }

      // Update user's FCM token in database
      await db
        .update(users)
        .set({ fcmToken })
        .where(eq(users.id, firebaseUser.uid));

      logger.info('FCM token updated', { userId: firebaseUser.uid });

      res.json({ message: 'FCM token registered successfully' });
    } catch (error) {
      logger.error('FCM token registration error', { error });
      res.status(500).json({ error: 'Failed to register FCM token' });
    }
  });

  /**
   * Remove FCM token (on logout)
   */
  app.delete('/api/firebase/fcm-token', requireFirebaseAuth, async (req: FirebaseRequest, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      if (!firebaseUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await db
        .update(users)
        .set({ fcmToken: null })
        .where(eq(users.id, firebaseUser.uid));

      logger.info('FCM token removed', { userId: firebaseUser.uid });

      res.json({ message: 'FCM token removed successfully' });
    } catch (error) {
      logger.error('FCM token removal error', { error });
      res.status(500).json({ error: 'Failed to remove FCM token' });
    }
  });

  /**
   * Test push notification (for development)
   */
  app.post('/api/firebase/test-notification', requireFirebaseAuth, async (req: FirebaseRequest, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      if (!firebaseUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get user's FCM token
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, firebaseUser.uid))
        .limit(1);

      if (userResult.length === 0 || !userResult[0].fcmToken) {
        return res.status(404).json({ error: 'FCM token not found' });
      }

      const user = userResult[0];

      // Send test notification
      await sendPushNotification(user.fcmToken, {
        title: 'Test Notification',
        body: 'This is a test push notification from your app!',
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
      });

      res.json({ message: 'Test notification sent successfully' });
    } catch (error) {
      logger.error('Test notification error', { error });
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });
}
