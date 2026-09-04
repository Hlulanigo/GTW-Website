/**
 * Environment variable validation
 * Ensures all required environment variables are set and valid
 */

export interface EnvConfig {
  // Node
  NODE_ENV: 'development' | 'production' | 'test'
  PORT: number

  // Database
  DATABASE_URL: string

  // JWT
  JWT_SECRET?: string
  JWT_EXPIRES_IN: string | number
  REFRESH_TOKEN_SECRET?: string
  REFRESH_TOKEN_EXPIRES_IN: string | number

  // Paystack
  PAYSTACK_PUBLIC_KEY: string
  PAYSTACK_SECRET_KEY?: string

  // App
  ALLOWED_ORIGINS: string[]
  ADMIN_EMAIL?: string
  APP_NAME: string

  // Logging
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'

  // Optional
  SENTRY_DSN?: string
  REPLIT_DEV_DOMAIN?: string
  REPLIT_DOMAINS?: string[]
}

/**
 * Validate required environment variables
 */
export function validateEnv(): EnvConfig {
  const requiredVars = [
    'NODE_ENV',
    'DATABASE_URL',
  ]

  const optionalWarnVars = [
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
    'PAYSTACK_SECRET_KEY',
    'ADMIN_EMAIL',
  ]

  const missing = requiredVars.filter(varName => !process.env[varName])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env file and ensure all required variables are set.`
    )
  }

  const missingOptional = optionalWarnVars.filter(varName => !process.env[varName])
  if (missingOptional.length > 0) {
    console.warn(
      `WARNING: Optional environment variables not set: ${missingOptional.join(', ')}\n` +
      `Some features (payments, auth tokens) may not work correctly.`
    )
  }

  // Validate values
  if (!['development', 'production', 'test'].includes(process.env.NODE_ENV!)) {
    throw new Error(
      `Invalid NODE_ENV value: ${process.env.NODE_ENV}. ` +
      `Must be one of: development, production, test`
    )
  }

  if (!process.env.PORT) {
    process.env.PORT = '5000'
  }

  const port = parseInt(process.env.PORT, 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}. Must be a valid port number.`)
  }

  if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL = 'info'
  }

  if (!['debug', 'info', 'warn', 'error'].includes(process.env.LOG_LEVEL)) {
    throw new Error(
      `Invalid LOG_LEVEL value: ${process.env.LOG_LEVEL}. ` +
      `Must be one of: debug, info, warn, error`
    )
  }

  const origins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0)

  if (origins.length === 0 && process.env.NODE_ENV === 'production') {
    console.warn('WARNING: ALLOWED_ORIGINS is empty in production!')
  }

  const config: EnvConfig = {
    NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test',
    PORT: port,
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
    PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || '',
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    ALLOWED_ORIGINS: origins,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    APP_NAME: process.env.APP_NAME || 'ParcelPeer',
    LOG_LEVEL: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
    SENTRY_DSN: process.env.SENTRY_DSN,
    REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
    REPLIT_DOMAINS: process.env.REPLIT_DOMAINS
      ? process.env.REPLIT_DOMAINS.split(',').map(d => d.trim())
      : undefined,
  }

  return config
}

/**
 * Get validated environment configuration
 */
let cachedConfig: EnvConfig | null = null

export function getEnvConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnv()
  }
  return cachedConfig
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test'
}
