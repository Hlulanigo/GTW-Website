/**
 * Security headers middleware
 * Sets HTTP security headers to protect against common vulnerabilities
 */

import { Request, Response, NextFunction } from 'express'
import { getEnvConfig, isProduction } from './env-config'

/**
 * Apply security headers
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions policy (formerly Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  )

  // Content Security Policy
  const config = getEnvConfig()
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net", // Adjust based on your needs
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'" + (config.ALLOWED_ORIGINS ? ` ${config.ALLOWED_ORIGINS.join(' ')}` : ''),
    "frame-ancestors 'none'",
  ]

  if (isProduction()) {
    cspDirectives.push("upgrade-insecure-requests")
  }

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '))

  // HSTS (HTTP Strict Transport Security) - only for production
  if (isProduction()) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  next()
}

/**
 * Remove sensitive headers
 */
export function removeSensitiveHeaders(req: Request, res: Response, next: NextFunction) {
  res.removeHeader('Server')
  res.removeHeader('X-Powered-By')
  res.removeHeader('X-AspNet-Version')
  res.removeHeader('X-Runtime')
  next()
}

/**
 * Disable caching for sensitive endpoints
 */
export function noCache(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  next()
}

/**
 * Allow caching for static assets
 */
export function cacheStatic(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'public, max-age=31536000') // 1 year
  next()
}

/**
 * CORS configuration
 */
export function getCorsOptions(config: ReturnType<typeof getEnvConfig>) {
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true)
      }

      if (config.ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true)
      }

      if (config.ALLOWED_ORIGINS.includes('*')) {
        return callback(null, true)
      }

      if (!isProduction()) {
        // Allow all origins in development
        return callback(null, true)
      }

      callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  }
}

/**
 * Setup all security middleware
 */
export function setupSecurityMiddleware(app: any) {
  const config = getEnvConfig()

  // Apply security headers
  app.use(securityHeaders)
  app.use(removeSensitiveHeaders)

  // CORS
  const cors = require('cors')
  app.use(cors(getCorsOptions(config)))

  // Request size limits
  app.use(require('express').json({ limit: '10mb' }))
  app.use(require('express').urlencoded({ limit: '10mb', extended: true }))

  // Helmet for additional security
  const helmet = require('helmet')
  app.use(helmet())
}
