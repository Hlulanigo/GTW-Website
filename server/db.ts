/**
 * Database connection management and pool configuration
 */

import { Pool, PoolClient } from 'pg'
import { getEnvConfig } from './env-config'

interface PoolConfig {
  max: number
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
}

const poolConfig: PoolConfig = {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

let pool: Pool | null = null

/**
 * Initialize database connection pool
 */
export function initializePool(): Pool {
  if (pool) {
    return pool
  }

  const config = getEnvConfig()

  pool = new Pool({
    connectionString: config.DATABASE_URL,
    ...poolConfig,
  })

  pool.on('error', (error) => {
    console.error('Unexpected error on idle client', error)
  })

  pool.on('connect', () => {
    console.log('[DB] New connection established')
  })

  pool.on('remove', () => {
    console.log('[DB] Connection removed from pool')
  })

  return pool
}

/**
 * Get database pool instance
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool() first.')
  }
  return pool
}

/**
 * Get a connection from the pool
 */
export async function getConnection(): Promise<PoolClient> {
  const dbPool = getPool()
  const client = await dbPool.connect()
  return client
}

/**
 * Execute a query with the pool
 */
export async function query<T = any>(
  text: string,
  values?: any[]
): Promise<T[]> {
  const dbPool = getPool()
  const result = await dbPool.query(text, values)
  return result.rows
}

/**
 * Execute query with single result
 */
export async function queryOne<T = any>(
  text: string,
  values?: any[]
): Promise<T | null> {
  const dbPool = getPool()
  const result = await dbPool.query(text, values)
  return result.rows[0] || null
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getConnection()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Check database connectivity
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const dbPool = getPool()
    const result = await dbPool.query('SELECT NOW()')
    return result.rows.length > 0
  } catch (error) {
    console.error('[DB] Connection check failed:', error)
    return false
  }
}

/**
 * Get pool statistics
 */
export interface PoolStats {
  total: number
  idle: number
  waiting: number
}

export function getPoolStats(): PoolStats {
  const dbPool = getPool()
  return {
    total: dbPool.totalCount,
    idle: dbPool.idleCount,
    waiting: dbPool.waitingCount,
  }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    console.log('[DB] Connection pool closed')
  }
}
