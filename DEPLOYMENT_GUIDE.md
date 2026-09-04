# Production Deployment Guide - The GTW (ParcelPeer)

## ✅ Pre-Deployment Checklist

### 1. Environment Setup (CRITICAL)

**Create Production .env File:**
```bash
cp /app/.env.example /app/.env
```

**Edit /app/.env with real values:**
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/parcelpeer_production
PAYSTACK_SECRET_KEY=sk_live_your_actual_secret_key
FIREBASE_PROJECT_ID=your-actual-project-id
FIREBASE_PRIVATE_KEY="your actual private key here"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
PORT=5000
LOG_LEVEL=info
```

**Create Admin .env File:**
```bash
cp /app/admin/.env.example /app/admin/.env
```

Edit with production values.

### 2. Database Setup

**Run Indexes Migration:**
```bash
# Connect to production database
psql $DATABASE_URL < /app/migrations/001_add_indexes.sql
```

**Push Schema:**
```bash
cd /app
DATABASE_URL="your_production_url" yarn db:push
```

**Verify Connection:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### 3. Install Production Dependencies

```bash
cd /app
yarn install --production=false
```

### 4. Build Applications

**Backend:**
```bash
cd /app
yarn server:build
```

**Admin Dashboard:**
```bash
cd /app/admin
yarn build
```

**Mobile App (EAS):**
```bash
cd /app
eas build --platform ios --profile production
eas build --platform android --profile production
```

## 🚀 Deployment Methods

### Option A: Cloud Provider (Recommended)

#### AWS Deployment

**1. Set up RDS PostgreSQL:**
- Create PostgreSQL 14+ instance
- Enable SSL connections
- Note connection string

**2. Set up EC2 or ECS:**
```bash
# On EC2
git clone your-repo
cd the-gtw
cp .env.example .env
# Edit .env with production values
yarn install
yarn server:build
yarn server:prod
```

**3. Set up CloudWatch for logs**

**4. Configure ALB for HTTPS**

#### Google Cloud Deployment

**1. Cloud SQL PostgreSQL**
**2. Cloud Run for backend**
**3. Cloud Storage for admin dashboard**
**4. Cloud CDN**

#### DigitalOcean Deployment

**1. Managed Database (PostgreSQL)**
**2. App Platform or Droplet**

### Option B: Platform-as-a-Service

#### Heroku
```bash
# Install Heroku CLI
heroku login
heroku create parcelpeer-api
heroku addons:create heroku-postgresql:standard-0

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set PAYSTACK_SECRET_KEY=sk_live_xxx
# ... set all other env vars

# Deploy
git push heroku main

# Run migrations
heroku run 'psql $DATABASE_URL < migrations/001_add_indexes.sql'
```

#### Railway
```bash
# Install Railway CLI
railway login
railway init
railway add # Add PostgreSQL

# Set environment variables in Railway dashboard
# Deploy
railway up
```

#### Render
- Connect GitHub repository
- Add PostgreSQL database
- Set environment variables
- Deploy

## 📱 Mobile App Deployment

### iOS App Store

**1. Configure app.json:**
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.thegtw.app",
      "buildNumber": "1",
      "supportsTablet": true
    }
  }
}
```

**2. Create Apple Developer Account** ($99/year)

**3. Build with EAS:**
```bash
eas build --platform ios --profile production
```

**4. Submit to App Store:**
```bash
eas submit --platform ios
```

### Google Play Store

**1. Configure app.json:**
```json
{
  "expo": {
    "android": {
      "package": "com.thegtw.app",
      "versionCode": 1
    }
  }
}
```

**2. Create Google Play Developer Account** ($25 one-time)

**3. Build with EAS:**
```bash
eas build --platform android --profile production
```

**4. Submit to Play Store:**
```bash
eas submit --platform android
```

## 🔒 Security Checklist

- [ ] All environment variables set (no hardcoded secrets)
- [ ] DATABASE_URL uses SSL
- [ ] HTTPS enabled on all domains
- [ ] Rate limiting configured
- [ ] CORS set to production domains only
- [ ] Admin routes require authentication
- [ ] Webhook signatures verified
- [ ] Database backups scheduled
- [ ] Firewall rules configured
- [ ] SSH keys only (no password auth)

## 📊 Monitoring Setup

### 1. Error Tracking (Sentry)

**Install:**
```bash
yarn add @sentry/node
```

**Configure in server/index.ts:**
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 1.0,
});
```

**Set environment variable:**
```env
SENTRY_DSN=https://xxx@sentry.io/project-id
```

### 2. Uptime Monitoring

Use one of:
- UptimeRobot (free)
- Pingdom
- DataDog
- Better Uptime

Monitor: `https://api.yourdomain.com/health`

### 3. Log Management

Options:
- CloudWatch (AWS)
- Cloud Logging (GCP)
- Papertrail
- Logtail

## 🧪 Post-Deployment Testing

### 1. Health Check
```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "timestamp": "2025-01-XX...",
    "version": "1.0.0"
  }
}
```

### 2. API Endpoint Test
```bash
# Get parcels
curl https://api.yourdomain.com/api/parcels

# Auth test
curl -X POST https://api.yourdomain.com/api/auth/sync \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json"
```

### 3. Payment Flow Test
- Create test parcel
- Initialize payment
- Verify webhook reception
- Check payment status

### 4. Mobile App Test
- Install production build
- Register new user
- Create parcel
- Search routes
- Send message
- Test notifications

## 🔄 CI/CD Setup (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Install dependencies
      run: yarn install
    
    - name: Run tests
      run: yarn test
    
    - name: Build
      run: yarn server:build
    
    - name: Deploy to Server
      run: |
        # Your deployment commands
```

## 📞 Support & Troubleshooting

### Common Issues

**1. Database Connection Failed**
- Check DATABASE_URL is correct
- Verify SSL is enabled
- Check firewall rules
- Test with: `psql $DATABASE_URL -c "SELECT 1;"`

**2. 502 Bad Gateway**
- Server not running: `pm2 status`
- Check logs: `tail -f /app/logs/error.log`
- Restart: `pm2 restart all`

**3. Payment Webhook Not Received**
- Verify webhook URL in Paystack dashboard
- Check signature verification
- Review webhook logs

**4. CORS Errors**
- Verify ALLOWED_ORIGINS includes all domains
- Check protocol (http vs https)
- Clear browser cache

### Emergency Contacts

**Rollback Procedure:**
```bash
# Revert to previous deploy
git revert HEAD
git push origin main

# Or rollback on platform
heroku rollback
# or
railway rollback
```

## 📈 Scaling Considerations

### When to Scale:

**Horizontal Scaling (More Servers):**
- Response time > 500ms
- CPU usage > 70%
- More than 1000 concurrent users

**Database Scaling:**
- Connection pool exhausted
- Query time > 200ms
- Database CPU > 80%

**Caching Layer:**
- Add Redis when:
  - Same queries repeated frequently
  - Database becomes bottleneck
  - Need session storage

### Cost Estimates

**Small Scale (< 1000 users):**
- Database: $25-50/month
- Server: $10-30/month
- Total: ~$50-100/month

**Medium Scale (1000-10000 users):**
- Database: $100-200/month
- Server: $100-300/month
- Redis: $20-50/month
- Total: ~$250-600/month

**Large Scale (> 10000 users):**
- Database: $300-1000/month
- Servers: $500-2000/month
- Redis: $100-300/month
- CDN: $50-200/month
- Total: ~$1000-3500/month

## ✅ Launch Day Checklist

- [ ] Database backups verified
- [ ] All environment variables set
- [ ] Health check returning 200
- [ ] SSL certificates valid
- [ ] DNS configured correctly
- [ ] Monitoring alerts configured
- [ ] Team has access to logs
- [ ] Emergency rollback plan ready
- [ ] User support channels ready
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] App store listings approved
- [ ] Payment gateway tested
- [ ] Push notifications working
- [ ] Admin dashboard accessible

## 🎉 You're Ready to Launch!

After completing this checklist, your application is production-ready.

**Next Steps:**
1. Soft launch to beta users
2. Monitor errors in Sentry
3. Track metrics in analytics
4. Gather user feedback
5. Iterate and improve

---

**Need Help?**
- Check logs: `/app/logs/`
- Health check: `/health`
- Documentation: `/app/PRODUCTION_READINESS_REPORT.md`
