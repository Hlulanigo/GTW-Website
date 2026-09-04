/**
 * OpenAPI/Swagger Configuration for the GTW API
 * This file defines the API specification for all endpoints
 */

export const apiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'ParcelPeer API',
    description: 'API for managing parcels, routes, payments, and disputes',
    version: '1.0.0',
    contact: {
      name: 'Support',
      email: 'support@parcelpeer.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Development server',
    },
    {
      url: 'https://api.parcelpeer.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          verified: { type: 'boolean' },
          rating: { type: 'number' },
          role: { type: 'string', enum: ['user', 'carrier', 'admin'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Parcel: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          origin: { type: 'string' },
          destination: { type: 'string' },
          senderName: { type: 'string' },
          senderPhone: { type: 'string' },
          status: { 
            type: 'string',
            enum: ['Pending', 'In Transit', 'Delivered', 'Expired'],
          },
          size: { type: 'string' },
          weight: { type: 'number' },
          compensation: { type: 'number' },
          description: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          parcelId: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'success', 'failed'],
          },
          paystackReference: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Route: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          origin: { type: 'string' },
          destination: { type: 'string' },
          carrierName: { type: 'string' },
          frequency: { type: 'string' },
          status: { type: 'string' },
          departureDate: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          status: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' },
          details: { type: 'object' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check endpoint',
        tags: ['Health'],
        responses: {
          200: {
            description: 'Service is healthy',
          },
          503: {
            description: 'Service is unavailable',
          },
        },
      },
    },
    '/api/auth/signin': {
      post: {
        summary: 'Sign in with email and password',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Successfully signed in',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid request',
          },
          401: {
            description: 'Invalid credentials',
          },
        },
      },
    },
    '/api/auth/signup': {
      post: {
        summary: 'Create a new user account',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  name: { type: 'string' },
                  phone: { type: 'string' },
                },
                required: ['email', 'password', 'name'],
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Account created successfully',
          },
          400: {
            description: 'Invalid input',
          },
          409: {
            description: 'User already exists',
          },
        },
      },
    },
    '/api/parcels': {
      get: {
        summary: 'List all parcels',
        tags: ['Parcels'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'number' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'number' },
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'List of parcels',
          },
          401: {
            description: 'Unauthorized',
          },
        },
      },
      post: {
        summary: 'Create a new parcel',
        tags: ['Parcels'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Parcel' },
            },
          },
        },
        responses: {
          201: {
            description: 'Parcel created',
          },
          400: {
            description: 'Invalid input',
          },
        },
      },
    },
    '/api/admin/stats': {
      get: {
        summary: 'Get admin dashboard statistics',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Dashboard statistics',
          },
          403: {
            description: 'Forbidden - admin access required',
          },
        },
      },
    },
  },
}
