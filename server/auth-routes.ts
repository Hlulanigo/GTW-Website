import type { Express, Response } from "express";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, validatePasswordStrength } from "./password";
import { generateTokens, verifyRefreshToken, extractToken } from "./jwt";
import { db } from "./storage";
import { requireAuth, type AuthenticatedRequest } from "./jwt-middleware";
import logger from "./logger";
import { validateEmail } from "./validation";

export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function registerAuthRoutes(app: Express) {
  /**
   * Sign up - Create a new user account
   */
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name, phone } = req.body as SignUpRequest;

      // Validation
      if (!email || !password || !name) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["email", "password", "name"],
        });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: "Password does not meet requirements",
          requirements: passwordValidation.errors,
        });
      }

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(409).json({ error: "User already exists with this email" });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          name,
          phone: phone || null,
          passwordHash,
        })
        .returning();

      if (!newUser) {
        return res.status(500).json({ error: "Failed to create user" });
      }

      // Generate tokens
      const tokens = generateTokens(newUser.id, newUser.email);

      const response: AuthResponse = {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          phone: newUser.phone || undefined,
        },
        ...tokens,
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error("Signup error", { error });
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  /**
   * Sign in - Authenticate user with email and password
   */
  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body as SignInRequest;

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Find user
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (userResult.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const user = userResult[0];

      // Check if user is suspended
      if (user.suspended) {
        return res.status(403).json({ error: "Account is suspended" });
      }

      // Verify password
      const passwordMatch = await comparePassword(password, user.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate tokens
      const tokens = generateTokens(user.id, user.email);

      const response: AuthResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone || undefined,
        },
        ...tokens,
      };

      res.json(response);
    } catch (error) {
      logger.error("Signin error", { error });
      res.status(500).json({ error: "Failed to sign in" });
    }
  });

  /**
   * Refresh token - Get a new access token using refresh token
   */
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body as RefreshTokenRequest;

      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      const payload = verifyRefreshToken(refreshToken);
      if (!payload) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
      }

      // Verify user still exists
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (userResult.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userResult[0];

      // Generate new tokens
      const tokens = generateTokens(user.id, user.email);

      res.json(tokens);
    } catch (error) {
      logger.error("Refresh token error", { error });
      res.status(401).json({ error: "Failed to refresh token" });
    }
  });

  /**
   * Get current user profile
   */
  app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userResult.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userResult[0];

      const response = {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        rating: user.rating,
        verified: user.verified,
        role: user.role,
        suspended: user.suspended,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
      };

      res.json(response);
    } catch (error) {
      logger.error("Get user error", { error });
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  /**
   * Sign out (client-side only, but included for completeness)
   */
  app.post("/api/auth/signout", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Token invalidation would happen client-side
      // Optionally, you could implement a token blacklist in Redis
      res.json({ message: "Signed out successfully" });
    } catch (error) {
      logger.error("Signout error", { error });
      res.status(500).json({ error: "Failed to sign out" });
    }
  });

  /**
   * Change password
   */
  app.post("/api/auth/change-password", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new password are required" });
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: "New password does not meet requirements",
          requirements: passwordValidation.errors,
        });
      }

      // Get user
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userResult.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userResult[0];

      // Verify current password
      const passwordMatch = await comparePassword(currentPassword, user.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      await db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, userId));

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      logger.error("Change password error", { error });
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  /**
   * Request password reset (sends reset token via email - implement email service)
   */
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Find user
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (userResult.length === 0) {
        // Don't reveal if email exists (security best practice)
        return res.json({
          message: "If an account with this email exists, a reset link has been sent",
        });
      }

      // TODO: Generate reset token and send email
      // For now, just return success message
      res.json({
        message: "If an account with this email exists, a reset link has been sent",
      });
    } catch (error) {
      logger.error("Password reset request error", { error });
      res.status(500).json({ error: "Failed to process request" });
    }
  });
}
