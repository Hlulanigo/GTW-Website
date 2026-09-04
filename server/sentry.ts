// Sentry error tracking integration
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import logger from './logger';

/**
 * Initialize Sentry for error tracking and performance monitoring
 * Only initializes if SENTRY_DSN is provided
 */
export function initializeSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.info('Sentry DSN not configured, skipping Sentry initialization');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      
      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Profiling
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        new ProfilingIntegration(),
      ],
      
      // Release tracking
      release: process.env.npm_package_version,
      
      // Don't send sensitive data
      beforeSend(event, hint) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        
        // Remove sensitive data from context
        if (event.contexts?.user) {
          delete event.contexts.user.email;
        }
        
        return event;
      },
    });
    
    logger.info('Sentry initialized successfully', {
      environment: process.env.NODE_ENV,
      dsn: dsn.substring(0, 20) + '...',
    });
  } catch (error) {
    logger.error('Failed to initialize Sentry', { error });
  }
}

/**
 * Export Sentry for use in other modules
 */
export { Sentry };

/**
 * Capture exception with additional context
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
  logger.error('Exception captured', { error: error.message, stack: error.stack, ...context });
}

/**
 * Capture message with severity
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level: level === 'warning' ? 'warning' : level === 'error' ? 'error' : 'info',
      extra: context,
    });
  }
  logger[level](message, context);
}
