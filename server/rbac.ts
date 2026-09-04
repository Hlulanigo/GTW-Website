import type { Request, Response, NextFunction } from 'express'
import { eq } from 'drizzle-orm'
import { users } from '@shared/schema'
import { db } from './storage'
import { ForbiddenError, UnauthorizedError } from './error-handler'
import { AuthenticatedRequest } from './jwt-middleware'

export type UserRole = 'user' | 'carrier' | 'support' | 'admin'
export type Permission = 
  | 'view_dashboard'
  | 'manage_users'
  | 'view_users'
  | 'verify_users'
  | 'delete_users'
  | 'manage_parcels'
  | 'view_parcels'
  | 'update_parcel_status'
  | 'delete_parcels'
  | 'manage_routes'
  | 'view_routes'
  | 'update_routes'
  | 'delete_routes'
  | 'manage_payments'
  | 'view_payments'
  | 'process_refunds'
  | 'manage_disputes'
  | 'view_disputes'
  | 'comment_disputes'
  | 'resolve_disputes'
  | 'manage_subscriptions'
  | 'view_subscriptions'
  | 'cancel_subscriptions'
  | 'view_reviews'
  | 'moderate_reviews'
  | 'delete_reviews'
  | 'view_wallet'
  | 'adjust_wallets'
  | 'view_analytics'
  | 'view_reports'
  | 'access_settings'

// Role-based permissions mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  user: [
    'view_dashboard',
  ],
  carrier: [
    'view_dashboard',
    'manage_routes',
  ],
  support: [
    'view_dashboard',
    'view_users',
    'verify_users',
    'view_parcels',
    'update_parcel_status',
    'view_routes',
    'view_payments',
    'view_disputes',
    'comment_disputes',
    'view_subscriptions',
    'view_reviews',
    'moderate_reviews',
    'delete_reviews',
    'view_wallet',
    'view_analytics',
    'view_reports',
  ],
  admin: [
    'view_dashboard',
    'manage_users',
    'view_users',
    'verify_users',
    'delete_users',
    'manage_parcels',
    'view_parcels',
    'update_parcel_status',
    'delete_parcels',
    'manage_routes',
    'view_routes',
    'update_routes',
    'delete_routes',
    'manage_payments',
    'view_payments',
    'process_refunds',
    'manage_disputes',
    'view_disputes',
    'comment_disputes',
    'resolve_disputes',
    'manage_subscriptions',
    'view_subscriptions',
    'cancel_subscriptions',
    'view_reviews',
    'moderate_reviews',
    'delete_reviews',
    'view_wallet',
    'adjust_wallets',
    'view_analytics',
    'view_reports',
    'access_settings',
  ],
}

/**
 * Get permissions for a role
 */
export function getPermissions(role: UserRole): Permission[] {
  return rolePermissions[role] || []
}

/**
 * Check if user has permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissions(role).includes(permission)
}

/**
 * Require specific permission middleware
 */
export function requirePermission(...permissions: Permission[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required')
    }

    try {
      // Fetch user with role
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1)

      if (userResult.length === 0) {
        throw new UnauthorizedError('User not found')
      }

      const user = userResult[0]
      const userRole = (user.role as UserRole) || 'user'

      // Check if user has any of the required permissions
      const hasRequiredPermission = permissions.some(permission =>
        hasPermission(userRole, permission)
      )

      if (!hasRequiredPermission) {
        throw new ForbiddenError(
          `You don't have permission to access this resource. Required permissions: ${permissions.join(', ')}`
        )
      }

      // Attach user role to request for later use
      ;(req as any).userRole = userRole

      next()
    } catch (error) {
      next(error)
    }
  }

/**
 * Require support or admin role
 * Support staff can access but with limited permissions
 */
export function requireSupport() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required')
    }

    try {
      // Fetch user with role
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1)

      if (userResult.length === 0) {
        throw new UnauthorizedError('User not found')
      }

      const user = userResult[0]
      const userRole = (user.role as UserRole) || 'user'

      if (userRole !== 'support' && userRole !== 'admin') {
        throw new ForbiddenError(
          'This endpoint requires Support or Admin access'
        )
      }

      ;(req as any).userRole = userRole

      next()
    } catch (error) {
      next(error)
    }
  }
}



/**
 * Check if user is support staff
 */
export function isSupport(req: AuthenticatedRequest): boolean {
  return getUserRole(req) === 'support'
}

/**
 * Require admin role only
 */
export function requireAdmin() {
  return requireRole('admin')
}

}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: UserRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required')
    }

    try {
      // Fetch user with role
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1)

      if (userResult.length === 0) {
        throw new UnauthorizedError('User not found')
      }

      const user = userResult[0]
      const userRole = (user.role as UserRole) || 'user'

      if (!roles.includes(userRole)) {
        throw new ForbiddenError(
          `This endpoint requires one of these roles: ${roles.join(', ')}`
        )
      }

      ;(req as any).userRole = userRole

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Get user role from request
 */
export function getUserRole(req: AuthenticatedRequest): UserRole {
  return (req as any).userRole || 'user'
}

/**
 * Check if user is admin
 */
export function isAdmin(req: AuthenticatedRequest): boolean {
  return getUserRole(req) === 'admin'
}

/**
 * Check if user is carrier
 */
export function isCarrier(req: AuthenticatedRequest): boolean {
  return getUserRole(req) === 'carrier'
}
