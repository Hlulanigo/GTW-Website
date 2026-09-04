// Metrics collection endpoint for monitoring
import type { Request, Response } from 'express';
import { db } from './storage';
import { sql } from 'drizzle-orm';
import logger from './logger';

/**
 * Collect and expose application metrics
 * Use this for monitoring dashboards and alerting
 */
export async function getMetrics(req: Request, res: Response) {
  try {
    const metrics: Record<string, any> = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      
      // Database metrics
      database: {
        connected: false,
        responseTime: 0,
      },
      
      // Application metrics
      app: {
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
      },
    };

    // Test database connection and measure response time
    const dbStart = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      metrics.database.connected = true;
      metrics.database.responseTime = Date.now() - dbStart;
    } catch (error) {
      logger.error('Database health check failed in metrics', { error });
      metrics.database.connected = false;
      metrics.database.error = 'Connection failed';
    }

    // Get table counts (optional, can be slow on large datasets)
    if (req.query.detailed === 'true') {
      try {
        const counts = await Promise.all([
          db.execute(sql`SELECT COUNT(*) as count FROM users`),
          db.execute(sql`SELECT COUNT(*) as count FROM parcels`),
          db.execute(sql`SELECT COUNT(*) as count FROM routes`),
          db.execute(sql`SELECT COUNT(*) as count FROM payments WHERE status = 'success'`),
        ]);

        metrics.counts = {
          users: counts[0].rows[0]?.count || 0,
          parcels: counts[1].rows[0]?.count || 0,
          routes: counts[2].rows[0]?.count || 0,
          successfulPayments: counts[3].rows[0]?.count || 0,
        };
      } catch (error) {
        logger.warn('Failed to fetch detailed metrics', { error });
      }
    }

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to collect metrics', { error });
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
}

/**
 * Simple readiness probe for Kubernetes/container orchestration
 */
export async function getReadiness(req: Request, res: Response) {
  try {
    // Check database connectivity
    await db.execute(sql`SELECT 1`);
    res.status(200).json({ ready: true });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({ ready: false, error: 'Database not ready' });
  }
}

/**
 * Liveness probe - always returns 200 if server is running
 */
export function getLiveness(req: Request, res: Response) {
  res.status(200).json({ alive: true });
}
