import { ValidationError } from './error-handler'

export interface ValidationRule {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'phone' | 'date'
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  enum?: any[]
  custom?: (value: any) => boolean | string
  trim?: boolean
}

export class Validator {
  private errors: Record<string, string[]> = {}

  /**
   * Validate an object against rules
   */
  validate(data: Record<string, any>, rules: Record<string, ValidationRule>): void {
    this.errors = {}

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field]
      this.validateField(field, value, rule)
    }

    if (Object.keys(this.errors).length > 0) {
      throw new ValidationError('Validation failed', this.errors)
    }
  }

  /**
   * Validate a single field
   */
  private validateField(field: string, value: any, rule: ValidationRule): void {
    const fieldErrors: string[] = []

    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      fieldErrors.push(`${field} is required`)
      this.errors[field] = fieldErrors
      return
    }

    // Skip validation if not required and empty
    if (!rule.required && (value === undefined || value === null || value === '')) {
      return
    }

    // Trim if specified
    if (rule.trim && typeof value === 'string') {
      value = value.trim()
    }

    // Type validation
    if (rule.type) {
      const typeError = this.validateType(value, rule.type, field)
      if (typeError) {
        fieldErrors.push(typeError)
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        fieldErrors.push(
          `${field} must be at least ${rule.minLength} characters long`
        )
      }

      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        fieldErrors.push(
          `${field} must not exceed ${rule.maxLength} characters`
        )
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        fieldErrors.push(`${field} format is invalid`)
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        fieldErrors.push(`${field} must be at least ${rule.min}`)
      }

      if (rule.max !== undefined && value > rule.max) {
        fieldErrors.push(`${field} must not exceed ${rule.max}`)
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      fieldErrors.push(
        `${field} must be one of: ${rule.enum.join(', ')}`
      )
    }

    // Custom validation
    if (rule.custom) {
      const result = rule.custom(value)
      if (result !== true) {
        fieldErrors.push(typeof result === 'string' ? result : `${field} validation failed`)
      }
    }

    if (fieldErrors.length > 0) {
      this.errors[field] = fieldErrors
    }
  }

  /**
   * Validate value type
   */
  private validateType(value: any, type: string, field: string): string | null {
    const actualType = Array.isArray(value) ? 'array' : typeof value

    switch (type) {
      case 'string':
        return actualType !== 'string' ? `${field} must be a string` : null

      case 'number':
        return actualType !== 'number' ? `${field} must be a number` : null

      case 'boolean':
        return actualType !== 'boolean' ? `${field} must be a boolean` : null

      case 'email':
        return !this.isValidEmail(value)
          ? `${field} must be a valid email`
          : null

      case 'url':
        return !this.isValidUrl(value) ? `${field} must be a valid URL` : null

      case 'phone':
        return !this.isValidPhone(value)
          ? `${field} must be a valid phone number`
          : null

      case 'date':
        return !this.isValidDate(value)
          ? `${field} must be a valid date`
          : null

      default:
        return null
    }
  }

  /**
   * Check if email is valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if phone is valid
   */
  private isValidPhone(phone: string): boolean {
    // Basic international phone format
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  /**
   * Check if date is valid
   */
  private isValidDate(date: any): boolean {
    if (typeof date === 'string') {
      return !isNaN(Date.parse(date))
    }
    return date instanceof Date && !isNaN(date.getTime())
  }

  /**
   * Get validation errors
   */
  getErrors(): Record<string, string[]> {
    return this.errors
  }

  /**
   * Check if validation passed
   */
  isValid(): boolean {
    return Object.keys(this.errors).length === 0
  }
}

/**
 * Sanitize input string
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .slice(0, 10000) // Limit length
}

/**
 * Sanitize object
 */
export function sanitizeObject(
  obj: Record<string, any>,
  allowedFields: string[]
): Record<string, any> {
  const sanitized: Record<string, any> = {}

  for (const field of allowedFields) {
    if (field in obj) {
      const value = obj[field]
      if (typeof value === 'string') {
        sanitized[field] = sanitizeString(value)
      } else {
        sanitized[field] = value
      }
    }
  }

  return sanitized
}
