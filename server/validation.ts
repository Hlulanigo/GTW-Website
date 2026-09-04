// Validation middleware for API endpoints
import { body, param, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import logger from './logger';

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      path: req.path,
      errors: errors.array(),
      body: req.body,
    });
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  next();
};

/**
 * Parcel creation validation
 */
export const validateParcelCreation = [
  body('origin').trim().notEmpty().withMessage('Origin is required'),
  body('destination').trim().notEmpty().withMessage('Destination is required'),
  body('size').isIn(['small', 'medium', 'large']).withMessage('Size must be small, medium, or large'),
  body('compensation').isInt({ min: 0 }).withMessage('Compensation must be a positive number'),
  body('pickupDate').isISO8601().withMessage('Valid pickup date is required'),
  body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long'),
  body('isFragile').optional().isBoolean(),
  body('insuranceNeeded').optional().isBoolean(),
  handleValidationErrors,
];

/**
 * Route creation validation
 */
export const validateRouteCreation = [
  body('origin').trim().notEmpty().withMessage('Origin is required'),
  body('destination').trim().notEmpty().withMessage('Destination is required'),
  body('departureDate').isISO8601().withMessage('Valid departure date is required'),
  body('frequency').optional().isIn(['one_time', 'daily', 'weekly', 'monthly']),
  body('maxParcelSize').optional().isIn(['small', 'medium', 'large']),
  body('maxWeight').optional().isFloat({ min: 0 }).withMessage('Max weight must be positive'),
  body('availableCapacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('pricePerKg').optional().isInt({ min: 0 }),
  handleValidationErrors,
];

/**
 * Location update validation
 */
export const validateLocationUpdate = [
  param('id').isUUID().withMessage('Invalid parcel ID'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  handleValidationErrors,
];

/**
 * Payment initialization validation
 */
export const validatePaymentInit = [
  body('parcelId').notEmpty().withMessage('Parcel ID is required'),
  body('carrierId').notEmpty().withMessage('Carrier ID is required'),
  handleValidationErrors,
];

/**
 * Review creation validation
 */
export const validateReviewCreation = [
  body('parcelId').notEmpty().withMessage('Parcel ID is required'),
  body('revieweeId').notEmpty().withMessage('Reviewee ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment too long'),
  body('reviewType').isIn(['sender_review', 'carrier_review']).withMessage('Invalid review type'),
  handleValidationErrors,
];

/**
 * Message creation validation
 */
export const validateMessageCreation = [
  param('id').notEmpty().withMessage('Conversation ID is required'),
  body('senderId').notEmpty().withMessage('Sender ID is required'),
  body('text').trim().notEmpty().withMessage('Message text is required'),
  body('text').isLength({ max: 2000 }).withMessage('Message too long'),
  handleValidationErrors,
];

/**
 * Subscription validation
 */
export const validateSubscription = [
  body('tier').isIn(['premium', 'business']).withMessage('Invalid subscription tier'),
  handleValidationErrors,
];

/**
 * Generic ID parameter validation
 */
export const validateIdParam = [
  param('id').notEmpty().withMessage('ID parameter is required'),
  handleValidationErrors,
];

/**
 * User ID parameter validation
 */
export const validateUserIdParam = [
  param('userId').notEmpty().withMessage('User ID parameter is required'),
  handleValidationErrors,
];
