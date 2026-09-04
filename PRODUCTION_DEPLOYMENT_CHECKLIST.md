# Production Deployment Checklist - ParcelPeer (The GTW)

## ✅ Pre-Deployment: Critical Features Implemented

### Security & Infrastructure ✅
- [x] **Rate Limiting**: Implemented (100 req/15min general, 5 req/15min for auth)
- [x] **Security Headers**: Helmet.js configured
- [x] **CORS**: Production-ready configuration with ALLOWED_ORIGINS
- [x] **Request Size Limits**: 10MB limit on all requests
- [x] **Compression**: Gzip compression enabled
- [x] **Input Validation**: Validation middleware created for all critical endpoints
- [x] **Database Connection Pool**: PostgreSQL pool with SSL support
- [x] **Graceful Shutdown**: SIGTERM and SIGINT handlers
- [x] **Environment Variables**: .env.example templates created

### Logging & Monitoring ✅
- [x] **Structured Logging**: Winston logger with file rotation
- [x] **Error Handler**: Production-safe error responses
- [x] **Health Check**: `/health` endpoint with database verification
- [x] **Metrics Endpoint**: `/metrics` for monitoring
- [x] **Readiness Probe**: `/readiness` for container orchestration
- [x] **Liveness Probe**: `/liveness` for container orchestration
- [x] **Sentry Integration**: Optional error tracking (requires DSN)

### Database ✅
- [x] **Indexes**: Comprehensive index migration file created
- [x] **Connection Pooling**: Configured with timeouts and SSL
- [x] **Schema**: Complete with all necessary tables

### Testing ✅
- [x] **Jest Configuration**: Test framework setup
- [x] **Test Scripts**: npm test, test:watch, test:coverage
- [x] **Sample Tests**: Health check, Parcels API, Subscriptions API
- [x] **Test Setup**: Environment configuration for testing

---

## 📋 Deployment Steps

### 1. Environment Configuration (CRITICAL)

#### Backend Environment Variables
Create `/app/.env` from `/app/.env.example` and configure:

**Required:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/dbname?ssl=true
PAYSTACK_SECRET_KEY=sk_live_your_actual_key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
PORT=5000
LOG_LEVEL=info
```

**Optional but Recommended:**
```bash
SENTRY_DSN=https://xxx@sentry.io/project-id
SESSION_SECRET=generate_random_32_byte_string
JWT_SECRET=generate_random_32_byte_string
```

#### Admin Dashboard Environment
Create `/app/admin/.env`:
```bash
VITE_API_URL=https://api.yourdomain.com/api
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 2. Database Setup

```bash
# Connect to production database
export DATABASE_URL="postgresql://user:pass@host:5432/dbname?ssl=true"

# Push schema
cd /app
yarn db:push

# Run index migrations
yarn db:migrate
# OR manually:
psql $DATABASE_URL < migrations/001_add_indexes.sql

# Verify connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### 3. Dependencies Installation

```bash
cd /app
yarn install --production=false

cd admin
yarn install
```

### 4. Build Applications

```bash
# Backend build
cd /app
yarn server:build

# Admin dashboard build
cd /app/admin
yarn build

# Mobile app (via EAS)
cd /app
eas build --platform ios --profile production
eas build --platform android --profile production
```

### 5. Testing

```bash
# Run tests
cd /app
yarn test

# Check test coverage
yarn test:coverage

# Verify health endpoint
curl https://api.yourdomain.com/health

# Verify metrics endpoint
curl https://api.yourdomain.com/metrics
```

### 6. Paystack Configuration

1. **Login to Paystack Dashboard**: https://dashboard.paystack.com
2. **Create Subscription Plans**:
   - Premium Plan: ₦999/month (Code: `PLN_premium_monthly`)
   - Business Plan: ₦2,999/month (Code: `PLN_business_monthly`)
3. **Configure Webhook**:
   - URL: `https://api.yourdomain.com/api/subscriptions/webhook`
   - Events: `subscription.create`, `charge.success`, `subscription.disable`, `invoice.payment_failed`
4. **Get API Keys**:
   - Copy Live Secret Key to `PAYSTACK_SECRET_KEY` in .env
   - Copy Live Public Key to `PAYSTACK_PUBLIC_KEY` in .env

### 7. Firebase Configuration

1. **Service Account** (for backend):
   - Go to Firebase Console > Project Settings > Service Accounts
   - Generate new private key
   - Copy values to .env

2. **Web App Config** (for admin dashboard):
   - Go to Firebase Console > Project Settings > General
   - Scroll to "Your apps" section
   - Copy config to admin/.env

### 8. Monitoring Setup (Optional but Recommended)

#### Sentry Error Tracking
```bash
# Sign up at https://sentry.io
# Create new project for Node.js
# Copy DSN to .env
echo "SENTRY_DSN=https://xxx@sentry.io/project-id" >> .env
```

#### Uptime Monitoring
- Set up monitoring for: `https://api.yourdomain.com/health`
- Recommended services: UptimeRobot, Pingdom, Better Uptime

### 9. Server Deployment

#### Option A: Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start server
cd /app
pm2 start yarn --name "parcelpeer-api" -- server:prod

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

#### Option B: Using Systemd
Create `/etc/systemd/system/parcelpeer.service`:
```ini
[Unit]
Description=ParcelPeer API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/app
Environment="NODE_ENV=production"
EnvironmentFile=/app/.env
ExecStart=/usr/bin/node server_dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable parcelpeer
sudo systemctl start parcelpeer
```

#### Option C: Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN yarn install --production
COPY . .
RUN yarn server:build
EXPOSE 5000
CMD ["yarn", "server:prod"]
```

### 10. SSL/HTTPS Setup

Use Nginx as reverse proxy:
```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔒 Security Checklist

- [ ] All secrets in environment variables (not in code)
- [ ] `.env` files in `.gitignore` (already configured)
- [ ] Rate limiting enabled and tested
- [ ] CORS configured for production domains only
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using parameterized queries)
- [ ] HTTPS enforced on all domains
- [ ] Webhook signature verification implemented
- [ ] Admin routes require authentication and role check
- [ ] Database connection uses SSL in production
- [ ] No sensitive data in logs
- [ ] Error messages don't expose system details

---

## 🧪 Post-Deployment Testing

### API Endpoints
```bash
# Health check
curl https://api.yourdomain.com/health
# Expected: {"status":"healthy","checks":{...}}

# Metrics
curl https://api.yourdomain.com/metrics
# Expected: {"timestamp":"...","uptime":123,...}

# Subscription plans (public)
curl https://api.yourdomain.com/api/subscriptions/plans
# Expected: {"plans":[...]}

# Parcels list
curl https://api.yourdomain.com/api/parcels
# Expected: [{...}]
```

### Rate Limiting
```bash
# Test rate limit (should get 429 after 100 requests)
for i in {1..105}; do
  curl https://api.yourdomain.com/api/parcels
done
```

### Database Connection
```bash
# Should return data or empty array
curl https://api.yourdomain.com/api/parcels

# Health check should show database: true
curl https://api.yourdomain.com/health | jq '.checks.database'
```

### Sentry (if configured)
```bash
# Check Sentry dashboard for any errors during testing
# https://sentry.io/organizations/your-org/issues/
```

---

## 📊 Monitoring Dashboard

### Key Metrics to Monitor

1. **Health Metrics**
   - `/health` endpoint status (should be 200)
   - Database connection status
   - Response time

2. **Application Metrics**
   - Request rate (requests per minute)
   - Error rate (4xx, 5xx responses)
   - Response time (p50, p95, p99)
   - Memory usage
   - CPU usage

3. **Business Metrics**
   - New user signups
   - Parcels created
   - Payment success rate
   - Subscription conversions

4. **Database Metrics**
   - Connection pool usage
   - Query response time
   - Active connections
   - Failed queries

---

## 🚨 Alerting Rules

Set up alerts for:
- Health check fails (> 2 consecutive failures)
- Error rate > 5% for 5 minutes
- Response time > 500ms (p95) for 10 minutes
- Database connection failures
- Payment webhook failures
- Disk space > 80%
- Memory usage > 85%
- CPU usage > 80% for 15 minutes

---

## 🔄 Rollback Plan

### If deployment fails:

1. **Immediate Rollback**:
   ```bash
   pm2 stop parcelpeer-api
   git checkout previous-stable-tag
   yarn server:build
   pm2 restart parcelpeer-api
   ```

2. **Database Rollback** (if schema changed):
   ```bash
   # Restore from backup
   pg_restore -d parcelpeer_production backup.dump
   ```

3. **Verify Rollback**:
   ```bash
   curl https://api.yourdomain.com/health
   ```

---

## 📱 Mobile App Submission

### iOS App Store
1. Configure bundle ID in `app.json`
2. Build: `eas build --platform ios --profile production`
3. Submit: `eas submit --platform ios`
4. Required assets:
   - App icons (all sizes)
   - Screenshots (all device sizes)
   - Privacy policy URL
   - Support URL

### Google Play Store
1. Configure package name in `app.json`
2. Build: `eas build --platform android --profile production`
3. Submit: `eas submit --platform android`
4. Required assets:
   - App icon
   - Feature graphic
   - Screenshots
   - Privacy policy URL

---

## 📝 Documentation Required

- [x] API Documentation (see PRODUCTION_READINESS_REPORT.md)
- [x] Deployment Guide (this file)
- [x] Environment Configuration (.env.example)
- [x] Database Schema (shared/schema.ts)
- [x] Admin Setup (ADMIN_SETUP.md)
- [x] Subscription Implementation (SUBSCRIPTION_IMPLEMENTATION.md)
- [ ] User Guide (for end users)
- [ ] Troubleshooting Guide

---

## ✅ Final Verification

Before going live, verify:

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Health check returns 200
- [ ] Metrics endpoint accessible
- [ ] Rate limiting working
- [ ] CORS allows only production domains
- [ ] SSL certificates valid
- [ ] DNS configured correctly
- [ ] Monitoring alerts configured
- [ ] Backup strategy in place
- [ ] Rollback procedure tested
- [ ] Team has access to logs and monitoring
- [ ] Emergency contacts documented
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Payment integration tested with real money
- [ ] Mobile apps submitted to stores
- [ ] Admin dashboard accessible
- [ ] Sentry capturing errors (if configured)

---

## 🎉 You're Production Ready!

All critical production-readiness features have been implemented:
- ✅ Security hardening (rate limiting, CORS, validation, headers)
- ✅ Error handling & structured logging
- ✅ Database optimization (connection pooling, indexes ready)
- ✅ Testing infrastructure (Jest setup with sample tests)
- ✅ Monitoring & observability (health checks, metrics, Sentry support)

**Next Steps:**
1. Configure environment variables
2. Deploy to production environment
3. Run database migrations
4. Test all critical flows
5. Monitor metrics and errors
6. Gather user feedback
7. Iterate and improve

---

## 📞 Support & Troubleshooting

### Common Issues

**Database connection fails**
```bash
# Check connection string
echo $DATABASE_URL
# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

**502 Bad Gateway**
```bash
# Check if server is running
pm2 status
# Check logs
pm2 logs parcelpeer-api
# Or
tail -f /app/logs/error.log
```

**Rate limit too aggressive**
```bash
# Adjust in server/index.ts:
# Change max: 100 to higher value
# Or increase windowMs
```

### Emergency Procedures

1. **Service Down**: Restart server, check logs
2. **Database Issues**: Check connection, restore from backup if needed
3. **Payment Issues**: Check Paystack dashboard and webhook logs
4. **High Error Rate**: Check Sentry, rollback if necessary

### Contact Information

- **Server Logs**: `/app/logs/`
- **Health Status**: `https://api.yourdomain.com/health`
- **Metrics**: `https://api.yourdomain.com/metrics`
- **Sentry**: `https://sentry.io` (if configured)

---

**Report Generated**: January 2025
**Last Updated**: January 2025
**Version**: 1.0.0
