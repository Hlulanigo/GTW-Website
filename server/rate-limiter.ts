/**
 * Rate limiting middleware for protecting API endpoints
 */

import { Request, Response, NextFunction } from 'express'
import { RateLimitError } from './error-handler'

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  max: number // Max requests per window
  message?: string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RequestRecord {
  count: number
  resetTime: number
}

/**
 * Simple in-memory rate limiter (suitable for single-server deployments)
 * For distributed systems, use redis-based rate limiting
 */
class MemoryStore {
  private records: Map<string, RequestRecord> = new Map()
  private windowMs: number

  constructor(windowMs: number) {
    this.windowMs = windowMs
    // Cleanup old records every minute
    setInterval(() => this.cleanup(), 60000)
  }

  increment(key: string): number {
    const now = Date.now()
    const record = this.records.get(key)

    if (!record || now > record.resetTime) {
      this.records.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      })
      return 1
    }

    record.count++
    return record.count
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.records.entries()) {
      if (now > record.resetTime) {
        this.records.delete(key)
      }
    }
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  )
}

/**
 * Create rate limiter middleware
 */
export function rateLimiter(config: RateLimitConfig) {
  const store = new MemoryStore(config.windowMs)
  const message = config.message || 'Too many requests, please try again later.'

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting for certain routes if needed
    const key = getClientIp(req)
    const count = store.increment(key)

    res.setHeader('X-RateLimit-Limit', config.max)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - count))

    if (count > config.max) {
      throw new RateLimitError(message)
    }

    next()
  }
}

/**
 * Create route-specific rate limiter
 */
export function createRouteRateLimiter(
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  max: number = 100
) {
  return rateLimiter({
    windowMs,
    max,
    message: `You have exceeded the ${max} requests in ${windowMs / 1000 / 60} minute limit!`,
  })
}

/**
 * Create auth route rate limiter (stricter)
 */
export function createAuthRateLimiter() {
  return rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts, please try again after 15 minutes.',
  })
}

/**
 * Create API endpoint rate limiter
 */
export function createApiRateLimiter(
  maxRequests: number = 100,
  windowMinutes: number = 15
) {
  return rateLimiter({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: `API rate limit exceeded: ${maxRequests} requests per ${windowMinutes} minutes`,
  })
}

/**
 * Create payment endpoint rate limiter (very strict)
 */
export function createPaymentRateLimiter() {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Payment endpoint rate limit exceeded. Maximum 10 requests per minute.',
  })
}

/**
 * Create public endpoint rate limiter (relaxed)
 */
export function createPublicRateLimiter() {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: 'Public endpoint rate limit exceeded. Maximum 30 requests per minute.',
  })
}
