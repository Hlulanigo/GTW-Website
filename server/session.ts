/**
 * Session and token management utilities
 */

import jwt, { SignOptions } from 'jsonwebtoken'
import { getEnvConfig } from './env-config'

export interface TokenPayload {
  userId: string
  email: string
  role: 'user' | 'carrier' | 'admin'
  iat?: number
  exp?: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  const config = getEnvConfig()
  const options: SignOptions = {
    expiresIn: config.JWT_EXPIRES_IN as string | number,
  }
  return jwt.sign(payload, config.JWT_SECRET, options)
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(userId: string): string {
  const config = getEnvConfig()
  const options: SignOptions = {
    expiresIn: config.REFRESH_TOKEN_EXPIRES_IN as string | number,
  }
  return jwt.sign({ userId }, config.REFRESH_TOKEN_SECRET, options)
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(payload: Omit<TokenPayload, 'iat' | 'exp'>): AuthTokens {
  const config = getEnvConfig()
  const accessToken = generateAccessToken(payload)

  // Calculate expiry time in seconds
  const expiresInStr = String(config.JWT_EXPIRES_IN)
  const expiresMatch = expiresInStr.match(/(\d+)([dhms])/)
  let expiresIn = 3600 // Default 1 hour
  if (expiresMatch) {
    const [, value, unit] = expiresMatch
    const multipliers: Record<string, number> = {
      d: 86400,
      h: 3600,
      m: 60,
      s: 1,
    }
    expiresIn = parseInt(value) * multipliers[unit]
  }

  const refreshToken = generateRefreshToken(payload.userId)

  return {
    accessToken,
    refreshToken,
    expiresIn,
  }
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string, isRefresh: boolean = false): TokenPayload {
  const config = getEnvConfig()
  const secret = isRefresh ? config.REFRESH_TOKEN_SECRET : config.JWT_SECRET

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload
    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token')
    }
    throw error
  }
}

/**
 * Decode token without verification (use with caution)
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload | null
  } catch {
    return null
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as TokenPayload | null
    if (!decoded || !decoded.exp) {
      return false
    }
    return decoded.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

/**
 * Refresh access token using refresh token
 */
export function refreshAccessToken(refreshToken: string): string {
  try {
    const payload = verifyToken(refreshToken, true) as { userId: string }
    // Note: In production, you should fetch user data from database
    // For now, we'll create a new token with the same userId
    const config = getEnvConfig()
    const options: SignOptions = {
      expiresIn: config.JWT_EXPIRES_IN as string | number,
    }
    const accessToken = jwt.sign(
      { userId: payload.userId },
      config.JWT_SECRET,
      options
    )
    return accessToken
  } catch (error) {
    throw new Error('Invalid refresh token')
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(header: string | undefined): string | null {
  if (!header) {
    return null
  }

  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }

  return parts[1]
}

/**
 * Session storage (in-memory for single server, use Redis for distributed)
 */
class SessionStore {
  private sessions: Map<string, { userId: string; createdAt: number; lastActivity: number }> =
    new Map()
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24 hours

  createSession(sessionId: string, userId: string): void {
    const now = Date.now()
    this.sessions.set(sessionId, {
      userId,
      createdAt: now,
      lastActivity: now,
    })
  }

  getSession(sessionId: string): { userId: string } | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
    }

    // Check if session has expired
    if (Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      this.sessions.delete(sessionId)
      return null
    }

    // Update last activity
    session.lastActivity = Date.now()
    return { userId: session.userId }
  }

  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  getAllUserSessions(userId: string): string[] {
    const sessionIds: string[] = []
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        sessionIds.push(sessionId)
      }
    }
    return sessionIds
  }

  destroyAllUserSessions(userId: string): number {
    const sessionIds = this.getAllUserSessions(userId)
    sessionIds.forEach(id => this.sessions.delete(id))
    return sessionIds.length
  }
}

export const sessionStore = new SessionStore()
