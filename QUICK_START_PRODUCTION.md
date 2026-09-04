# Quick Start: Production Readiness Implementation

This is a condensed action plan to make The GTW production-ready. Follow these steps in order.

---

## ⚡ IMMEDIATE ACTIONS (Do First - 1-2 Days)

### 1. Create Environment Files

```bash
# Create .env files
touch /app/.env
touch /app/admin/.env
```

**Backend .env** (`/app/.env`):
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/dbname
PAYSTACK_SECRET_KEY=sk_live_xxx
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
PORT=5000
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

**Admin .env** (`/app/admin/.env`):
```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Update app.json** for mobile:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.yourdomain.com",
      "eas": {
        "projectId": "your-expo-project-id"
      }
    }
  }
}
```

### 2. Add Security Packages

```bash
cd /app
yarn add express-rate-limit helmet express-validator compression
yarn add -D @types/compression
```

### 3. Update Server Security (server/index.ts)

Add these imports at the top:
```typescript
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { body, param, validationResult } from 'express-validator';
```

Add after `setupBodyParsing`:
```typescript
// Security headers
app.use(helmet());

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
});
app.use('/api/auth/', authLimiter);
```

### 4. Fix CORS for Production

Update `setupCors` function in `server/index.ts`:
```typescript
function setupCors(app: express.Application) {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
    : [
        'http://localhost:3000',
        'http://localhost:5000',
        ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : [])
      ];

  app.use((req, res, next) => {
    const origin = req.header("origin");

    if (origin && allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}
```

### 5. Add Request Size Limits

Update `setupBodyParsing` in `server/index.ts`:
```typescript
function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ 
    extended: false,
    limit: '10mb'
  }));
}
```

---

## 🔍 CRITICAL FIXES (Week 1)

### 6. Add Structured Logging

```bash
yarn add winston
```

Create `server/logger.ts`:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'parcelpeer-api' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export default logger;
```

Replace all `console.log` with `logger.info`, `console.error` with `logger.error`.

### 7. Improve Error Handler

Update `setupErrorHandler` in `server/index.ts`:
```typescript
import logger from './logger';

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
      stack?: string;
    };

    const status = error.status || error.statusCode || 500;
    
    logger.error('Request error', {
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    const message = process.env.NODE_ENV === 'production' 
      ? (status === 500 ? 'Internal server error' : error.message)
      : error.message;

    res.status(status).json({ 
      error: message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
  });
}
```

### 8. Add Health Check Endpoint

Add to `server/routes.ts`:
```typescript
import { sql } from 'drizzle-orm';

app.get("/health", async (req, res) => {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  };

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch (error) {
    console.error('Database health check failed', error);
  }

  const isHealthy = checks.database;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
  });
});
```

### 9. Database Connection Pool

Update `server/storage.ts`:
```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

export const db = drizzle(pool, { schema });

// Graceful shutdown
process.on('SIGTERM', () => {
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});
```

### 10. Add Database Indexes

Create `migrations/add_indexes.sql`:
```sql
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_sender_id ON parcels(sender_id);
CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_departure_date ON routes(departure_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant1_id, participant2_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id, created_at DESC);
```

Run with:
```bash
psql $DATABASE_URL < migrations/add_indexes.sql
```

---

## 🧪 TESTING SETUP (Week 2)

### 11. Install Test Dependencies

```bash
yarn add -D jest @types/jest ts-jest supertest @types/supertest
```

### 12. Configure Jest

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.test.ts',
    '!server/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### 13. Create Basic Test

Create `server/__tests__/health.test.ts`:
```typescript
import request from 'supertest';

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const res = await request('http://localhost:5000')
      .get('/health')
      .expect(200);
    
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks.database).toBe(true);
  });
});
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## 📊 MONITORING (Week 2)

### 14. Add Error Tracking

```bash
yarn add @sentry/node @sentry/profiling-node
```

Update `server/index.ts`:
```typescript
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

// Initialize Sentry before other imports
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: [
      new ProfilingIntegration(),
    ],
  });
}

// After app initialization, before routes
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// After routes, before error handler
app.use(Sentry.Handlers.errorHandler());
```

---

## 📱 MOBILE APP PRODUCTION BUILD

### 15. Configure EAS Build

```bash
cd /app
npm install -g eas-cli
eas login
eas build:configure
```

### 16. Update app.json

```json
{
  "expo": {
    "name": "The GTW",
    "slug": "the-gtw",
    "version": "1.0.0",
    "runtimeVersion": "1.0.0",
    "updates": {
      "url": "https://u.expo.dev/[your-project-id]"
    },
    "ios": {
      "bundleIdentifier": "com.thegtw.app",
      "buildNumber": "1"
    },
    "android": {
      "package": "com.thegtw.app",
      "versionCode": 1
    }
  }
}
```

### 17. Build for Production

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Environment variables set in production
- [ ] Database migrations run
- [ ] Database indexes created
- [ ] SSL certificates configured
- [ ] Domain DNS configured
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Error tracking (Sentry) configured
- [ ] Health check endpoint working
- [ ] Database backups scheduled

### Mobile App
- [ ] EAS project configured
- [ ] Production builds tested
- [ ] App Store/Play Store listings created
- [ ] Privacy policy published
- [ ] App icons and screenshots uploaded

### Testing
- [ ] API endpoints tested with Postman
- [ ] Payment flow tested with real Paystack
- [ ] Admin dashboard accessible
- [ ] Mobile app connects to production API
- [ ] User registration/login works
- [ ] Push notifications tested

### Post-Deployment
- [ ] Monitor error rates in Sentry
- [ ] Check health endpoint
- [ ] Verify database connections
- [ ] Test critical user flows
- [ ] Monitor API response times
- [ ] Check logs for errors

---

## 🔐 SECURITY CHECKLIST

- [ ] All secrets in environment variables (not code)
- [ ] `.env` files in `.gitignore`
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize inputs)
- [ ] HTTPS enforced
- [ ] Webhook signature verification
- [ ] Admin routes require authentication
- [ ] Database connection uses SSL

---

## 📞 EMERGENCY CONTACTS

**Critical Issues:**
1. Check `/health` endpoint
2. Check Sentry for errors
3. Check database connectivity
4. Check server logs: `tail -f logs/error.log`
5. Restart server if needed

**Common Issues:**
- **502 Bad Gateway:** Server not running or crashed
- **Database connection failed:** Check DATABASE_URL and network
- **Payment failures:** Check Paystack API key and webhook URL
- **Push notifications not working:** Check Firebase credentials

---

## 📚 RESOURCES

- Production Readiness Full Report: `/app/PRODUCTION_READINESS_REPORT.md`
- Database Schema: `/app/shared/schema.ts`
- API Routes: `/app/server/routes.ts`
- Admin Setup: `/app/ADMIN_SETUP.md`
- Subscription Docs: `/app/SUBSCRIPTION_IMPLEMENTATION.md`

---

## ⏱️ TIMELINE

**Day 1-2:** Environment setup, security basics
**Week 1:** Security hardening, logging, monitoring
**Week 2:** Testing, database optimization, documentation
**Week 3:** Performance tuning, final testing
**Week 4:** Staging deployment, load testing, production deployment

---

**Status Tracking:**

```
[ ] Phase 1: Critical Security (Days 1-7)
[ ] Phase 2: Reliability (Days 8-14)
[ ] Phase 3: Testing (Days 15-21)
[ ] Phase 4: Production Deploy (Days 22-28)
```

Update this checklist as you complete each phase!
