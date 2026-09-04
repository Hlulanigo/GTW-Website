import type { Request, Response, NextFunction, Express } from 'express'
import logger from './logger'

// Standard error response format
export interface ErrorResponse {
  error: string
  code: string
  status: number
  timestamp: string
  requestId?: string
  details?: Record<string, any>
}

// Custom error class
export class AppError extends Error {
  constructor(
    public message: string,
    public code: string = 'INTERNAL_ERROR',
    public status: number = 500,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Validation error
export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', 400, { fields })
  }
}

// Not found error
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
  }
}

// Unauthorized error
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

// Forbidden error
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
  }
}

// Conflict error
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
  }
}

// Rate limit error
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429)
  }
}

/**
 * Error handling middleware
 * Must be registered as the last middleware in Express
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = (req as any).id || 'unknown'
  
  let error: AppError

  if (err instanceof AppError) {
    error = err
  } else if (err instanceof SyntaxError && 'body' in err) {
    error = new ValidationError('Invalid JSON payload')
  } else {
    error = new AppError(
      err.message || 'Internal server error',
      'INTERNAL_ERROR',
      500
    )
  }

  const response: ErrorResponse = {
    error: error.message,
    code: error.code,
    status: error.status,
    timestamp: new Date().toISOString(),
    requestId,
    ...(error.details && { details: error.details }),
  }

  // Log error
  if (error.status >= 500) {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      code: error.code,
      requestId,
    })
  } else if (error.status >= 400) {
    logger.warn('Request error', {
      error: error.message,
      code: error.code,
      status: error.status,
      requestId,
    })
  }

  res.status(error.status).json(response)
}

/**
 * Async error wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Setup error handling for Express
 */
export function setupErrorHandling(app: Express) {
  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not found',
      code: 'NOT_FOUND',
      status: 404,
      timestamp: new Date().toISOString(),
      path: req.path,
    })
  })

  // Error handler (must be last)
  app.use(errorHandler)
}
