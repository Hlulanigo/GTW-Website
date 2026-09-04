import type { Request, Response, NextFunction } from 'express'
import { v4 as uuid } from 'uuid'
import logger from './logger'

export interface RequestMetrics {
  duration: number
  statusCode: number
  method: string
  path: string
  ip: string
  userAgent?: string
}

/**
 * Add request ID and timing information to all requests
 */
export function requestLogging(req: Request, res: Response, next: NextFunction) {
  // Generate unique request ID
  const requestId = req.get('x-request-id') || uuid()
  ;(req as any).id = requestId

  // Capture request metadata
  const startTime = Date.now()
  const method = req.method
  const path = req.path
  const ip = req.ip || 'unknown'
  const userAgent = req.get('user-agent')

  // Track response
  const originalSend = res.send
  res.send = function (data) {
    const duration = Date.now() - startTime
    const statusCode = res.statusCode

    const metrics: RequestMetrics = {
      duration,
      statusCode,
      method,
      path,
      ip,
      userAgent,
    }

    // Log based on status code
    if (statusCode >= 500) {
      logger.error(`${method} ${path}`, {
        ...metrics,
        requestId,
      })
    } else if (statusCode >= 400) {
      logger.warn(`${method} ${path}`, {
        ...metrics,
        requestId,
      })
    } else {
      logger.info(`${method} ${path}`, {
        ...metrics,
        requestId,
      })
    }

    return originalSend.call(this, data)
  }

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId)

  next()
}

/**
 * Log sensitive operations (create, update, delete)
 */
export function auditLog(req: Request, res: Response, next: NextFunction) {
  const method = req.method
  const path = req.path
  const requestId = (req as any).id
  const userId = (req as any).user?.userId

  // Only log write operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    logger.info(`Audit: ${method} ${path}`, {
      requestId,
      userId,
      method,
      path,
      body: sanitizeBody(req.body),
    })
  }

  next()
}

/**
 * Remove sensitive data from logged body
 */
function sanitizeBody(body: any): any {
  if (!body) return body

  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'creditCard',
    'cvv',
  ]

  const sanitized = { ...body }

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***'
    }
  })

  return sanitized
}
