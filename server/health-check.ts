import { db } from './storage'
import { sql } from 'drizzle-orm'
import logger from './logger'

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, CheckResult>
  timestamp: string
  uptime: number
}

export interface CheckResult {
  status: 'pass' | 'warn' | 'fail'
  message: string
  responseTime?: number
  error?: string
}

/**
 * Database health check
 */
export async function checkDatabase(): Promise<CheckResult> {
  const startTime = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    return {
      status: 'pass',
      message: 'Database connection successful',
      responseTime: Date.now() - startTime,
    }
  } catch (error) {
    logger.error('Database health check failed', { error })
    return {
      status: 'fail',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Memory health check
 */
export function checkMemory(): CheckResult {
  const memUsage = process.memoryUsage()
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100

  if (heapUsedPercent > 90) {
    return {
      status: 'fail',
      message: `High memory usage: ${heapUsedPercent.toFixed(2)}%`,
    }
  } else if (heapUsedPercent > 75) {
    return {
      status: 'warn',
      message: `Moderate memory usage: ${heapUsedPercent.toFixed(2)}%`,
    }
  }

  return {
    status: 'pass',
    message: `Memory usage: ${heapUsedPercent.toFixed(2)}%`,
  }
}

/**
 * Disk space check (if available)
 */
export function checkDiskSpace(): CheckResult {
  try {
    // This would require additional dependencies like 'diskusage'
    // For now, return a warning that it's not implemented
    return {
      status: 'warn',
      message: 'Disk space check not implemented',
    }
  } catch (error) {
    return {
      status: 'warn',
      message: 'Could not check disk space',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process health check
 */
export function checkProcess(): CheckResult {
  const uptime = process.uptime()
  const cpuUsage = process.cpuUsage()

  if (uptime < 30) {
    return {
      status: 'warn',
      message: `Process recently started (${uptime.toFixed(0)}s uptime)`,
    }
  }

  return {
    status: 'pass',
    message: `Process healthy (uptime: ${Math.floor(uptime / 60)}m)`,
  }
}

/**
 * Environment check
 */
export function checkEnvironment(): CheckResult {
  const requiredEnvVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'JWT_SECRET',
  ]

  const missing = requiredEnvVars.filter(varName => !process.env[varName])

  if (missing.length > 0) {
    return {
      status: 'fail',
      message: `Missing environment variables: ${missing.join(', ')}`,
    }
  }

  return {
    status: 'pass',
    message: 'All required environment variables set',
  }
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthCheck> {
  const startTime = Date.now()

  const [
    databaseCheck,
    memoryCheck,
    diskCheck,
    processCheck,
    envCheck,
  ] = await Promise.all([
    checkDatabase(),
    checkMemory(),
    checkDiskSpace(),
    checkProcess(),
    checkEnvironment(),
  ])

  const checks = {
    database: databaseCheck,
    memory: memoryCheck,
    disk: diskCheck,
    process: processCheck,
    environment: envCheck,
  }

  // Determine overall status
  const failCount = Object.values(checks).filter(c => c.status === 'fail').length
  const warnCount = Object.values(checks).filter(c => c.status === 'warn').length

  let status: 'healthy' | 'degraded' | 'unhealthy'
  if (failCount > 0) {
    status = 'unhealthy'
  } else if (warnCount > 0) {
    status = 'degraded'
  } else {
    status = 'healthy'
  }

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }
}

/**
 * Get a quick health status
 */
export async function getQuickHealth(): Promise<{ status: string; healthy: boolean }> {
  try {
    const result = await checkDatabase()
    return {
      status: result.status,
      healthy: result.status === 'pass',
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      healthy: false,
    }
  }
}
