# 🚀 Production Deployment - Quick Reference

## ⚡ Fast Track to Production (30 minutes)

### 1. Run Setup Script (2 minutes)
```bash
cd /app
chmod +x scripts/setup-production.sh
./scripts/setup-production.sh
```

### 2. Configure Environment (5 minutes)

**Edit `/app/.env`:**
```bash
nano .env
```

Required values:
- `DATABASE_URL` - Your PostgreSQL connection string
- `PAYSTACK_SECRET_KEY` - From Paystack dashboard
- `JWT_SECRET` - A secure random string for JWT tokens
- `REFRESH_TOKEN_SECRET` - A secure random string for refresh tokens
- `ALLOWED_ORIGINS` - Your production domains

**Edit `/app/admin/.env`:**
```bash
nano admin/.env
```

### 3. Database Setup (5 minutes)
```bash
# Run migrations
source .env
psql $DATABASE_URL < migrations/001_add_indexes.sql

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### 4. Build & Test (10 minutes)
```bash
# Build backend
yarn server:build

# Start server
NODE_ENV=production yarn server:prod &

# Test health check
curl http://localhost:5000/health

# Test API
curl http://localhost:5000/api/parcels
```

### 5. Deploy (8 minutes)

Choose your platform:

**Heroku:**
```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:standard-0
heroku config:set NODE_ENV=production
heroku config:set PAYSTACK_SECRET_KEY=sk_live_xxx
# ... set all env vars
git push heroku main
```

**Railway:**
```bash
railway init
railway add # Add PostgreSQL
# Set env vars in dashboard
railway up
```

**AWS/GCP/DigitalOcean:**
- See full deployment guide: `/app/DEPLOYMENT_GUIDE.md`

---

## 🔥 Critical Security Fixes Applied

✅ **Rate Limiting** - Prevents API abuse and DDoS  
✅ **Security Headers** - Helmet.js protection  
✅ **CORS Lockdown** - Only allowed origins  
✅ **Input Validation** - Protection against injection  
✅ **Structured Logging** - Winston for production logs  
✅ **Error Handling** - No stack traces in production  
✅ **Database Pooling** - Connection management  
✅ **Database Indexes** - Performance optimization  
✅ **Health Checks** - Monitoring endpoint  
✅ **Webhook Security** - Signature verification  

---

## 📊 What Changed

### New Files Created:
- `/app/.env.example` - Environment template
- `/app/admin/.env.example` - Admin environment template
- `/app/server/logger.ts` - Structured logging
- `/app/migrations/001_add_indexes.sql` - Database indexes
- `/app/scripts/setup-production.sh` - Setup automation
- `/app/DEPLOYMENT_GUIDE.md` - Full deployment docs
- `/app/PRODUCTION_READINESS_REPORT.md` - Detailed analysis
- `/app/QUICK_START_PRODUCTION.md` - Step-by-step guide

### Files Modified:
- `server/index.ts` - Added security middleware, rate limiting, better error handling
- `server/storage.ts` - Added connection pooling
- `server/routes.ts` - Added health check, fixed webhook security, added logger

### Dependencies Added:
- `express-rate-limit` - API rate limiting
- `helmet` - Security headers
- `compression` - Response compression
- `winston` - Structured logging
- `express-validator` - Input validation
- `ioredis` - Redis client (optional caching)

---

## 🎯 Environment Variables Reference

### Required (Backend)
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-jwt-key
REFRESH_TOKEN_SECRET=your-refresh-token-secret
PAYSTACK_SECRET_KEY=sk_live_xxx
ALLOWED_ORIGINS=https://yourdomain.com
PORT=5000
```

### Optional (Backend)
```env
SENTRY_DSN=https://xxx@sentry.io/project
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

### Required (Admin Dashboard)
```env
VITE_API_URL=https://api.yourdomain.com/api
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-id
VITE_FIREBASE_STORAGE_BUCKET=project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
```

---

## 🧪 Testing Production Build Locally

```bash
# 1. Set environment to production
export NODE_ENV=production

# 2. Start the server
yarn server:prod

# 3. Test endpoints
curl http://localhost:5000/health
curl http://localhost:5000/api/parcels

# 4. Check logs
tail -f logs/combined.log
tail -f logs/error.log

# 5. Monitor resources
htop  # or top
```

---

## 📱 Mobile App Production Build

### iOS
```bash
# Configure EAS
eas build:configure

# Build for production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

### Android
```bash
# Build for production
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

---

## 🚨 Emergency Procedures

### Server Won't Start
```bash
# Check logs
tail -n 100 logs/error.log

# Check environment
node -e "console.log(process.env.DATABASE_URL)"

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check port availability
lsof -i :5000
```

### Database Issues
```bash
# Check connection
psql $DATABASE_URL -c "\dt"

# Check indexes
psql $DATABASE_URL -c "\di"

# Analyze tables
psql $DATABASE_URL -c "ANALYZE;"
```

### High Error Rate
```bash
# Check error logs
tail -f logs/error.log | grep ERROR

# Check health
curl http://localhost:5000/health

# Restart server
pm2 restart all
# or
supervisorctl restart all
```

---

## 📈 Monitoring Checklist

- [ ] Health check endpoint responding
- [ ] Error rate < 1%
- [ ] Response time < 500ms
- [ ] Database connections available
- [ ] Disk space > 20% free
- [ ] Memory usage < 80%
- [ ] CPU usage < 70%

---

## 🔗 Quick Links

- **Full Production Report:** [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md)
- **Deployment Guide:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Quick Start Guide:** [QUICK_START_PRODUCTION.md](./QUICK_START_PRODUCTION.md)
- **Admin Setup:** [ADMIN_SETUP.md](./ADMIN_SETUP.md)
- **Subscription Docs:** [SUBSCRIPTION_IMPLEMENTATION.md](./SUBSCRIPTION_IMPLEMENTATION.md)

---

## ✅ Pre-Launch Checklist

**Security:**
- [ ] All secrets in environment variables
- [ ] `.env` files not in git
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Rate limiting active
- [ ] Input validation enabled

**Database:**
- [ ] Production database created
- [ ] Indexes created
- [ ] Backups scheduled
- [ ] Connection pool configured

**Monitoring:**
- [ ] Health check working
- [ ] Error tracking setup (Sentry)
- [ ] Uptime monitoring configured
- [ ] Logs being collected

**Testing:**
- [ ] All API endpoints tested
- [ ] Payment flow tested
- [ ] Admin dashboard accessible
- [ ] Mobile app connects successfully

**Legal:**
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Cookie policy (if needed)

---

## 💰 Expected Costs

**Minimum (< 100 users):**
- Heroku Hobby: $7/month
- PostgreSQL: $9/month
- **Total: ~$20/month**

**Small Scale (< 1000 users):**
- Server: $25/month
- Database: $25/month
- Monitoring: $0 (free tiers)
- **Total: ~$50/month**

**Medium Scale (1000-10000 users):**
- Server: $100/month
- Database: $100/month
- Redis: $20/month
- Monitoring: $25/month
- **Total: ~$250/month**

---

## 🎉 You're Ready!

All critical security issues have been fixed. The application is now production-ready.

**To deploy:**
1. Run setup script
2. Configure environment variables
3. Run database migrations
4. Test locally
5. Deploy to your platform
6. Monitor and iterate

**Need help?** Check the full documentation in:
- PRODUCTION_READINESS_REPORT.md
- DEPLOYMENT_GUIDE.md
