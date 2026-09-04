# Quick Setup Guide
## Get Your New Features Running in 5 Minutes

### Step 1: Create .env File

Create `/app/.env` with your credentials:

```bash
# Server
NODE_ENV=development
PORT=5000

# Database (REQUIRED)
DATABASE_URL=postgresql://username:password@host:5432/database_name

# Paystack (REQUIRED for wallet & payments)
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here

# Firebase Admin SDK (REQUIRED for photo uploads)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Optional
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19000
LOG_LEVEL=info
```

### Step 2: Start the Server

```bash
cd /app

# Kill any existing server
pkill -f "tsx server/index.ts"

# Start fresh
yarn server:dev
```

Server will run on `http://localhost:5000`

### Step 3: Verify It's Working

```bash
# Check health
curl http://localhost:5000/health

# Should return:
{
  "status": "healthy",
  "checks": {
    "database": true,
    "timestamp": "2026-01-06T...",
    "version": "1.0.0"
  }
}
```

### Step 4: Test New Features

```bash
# Get insurance tiers
curl http://localhost:5000/api/insurance/tiers

# Should return insurance options (Basic, Standard, Premium)
```

### Step 5: Start Frontend (Optional)

```bash
cd /app
yarn expo:dev
```

---

## 🔥 Quick Test Without Database

If you don't have a database yet, you can test with a temporary PostgreSQL:

```bash
# Install PostgreSQL (if not installed)
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start PostgreSQL
sudo service postgresql start

# Create database
sudo -u postgres psql -c "CREATE DATABASE thegtw;"
sudo -u postgres psql -c "CREATE USER gtwuser WITH PASSWORD 'password123';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE thegtw TO gtwuser;"

# Use in .env
DATABASE_URL=postgresql://gtwuser:password123@localhost:5432/thegtw

# Push schema
yarn db:push
```

---

## 🚨 Common Issues

### Issue: "Port 5000 already in use"
```bash
# Kill the process
pkill -f "tsx server/index.ts"
# Or find and kill
lsof -ti:5000 | xargs kill -9
```

### Issue: "Database connection failed"
- Check DATABASE_URL format: `postgresql://user:pass@host:5432/dbname`
- Ensure PostgreSQL is running
- Verify credentials

### Issue: "Firebase Storage error"
- Check FIREBASE_PRIVATE_KEY has newlines as `\n`
- Ensure Firebase Storage is enabled in console
- Verify service account has Storage Admin role

### Issue: "Paystack verification failed"
- Ensure you're using test keys in development
- Check key starts with `sk_test_` or `sk_live_`
- Verify Paystack account is active

---

## 📱 Frontend Development URLs

Once server is running:

- **API Base URL:** `http://localhost:5000/api`
- **Health Check:** `http://localhost:5000/health`
- **Admin Panel:** `http://localhost:5000/admin` (if exists)

Update your frontend .env:
```
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

---

## 🧪 Test the New Features

### 1. Test Insurance API
```bash
curl -X POST http://localhost:5000/api/insurance/calculate \
  -H "Content-Type: application/json" \
  -d '{"declaredValue": 10000000}'
```

### 2. Test Wallet (requires auth)
```bash
# Get Firebase token from your app
TOKEN="your_firebase_token_here"

curl http://localhost:5000/api/wallet/balance \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test Location Tracking (requires auth & parcel)
```bash
curl -X POST http://localhost:5000/api/parcels/YOUR_PARCEL_ID/location \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 6.5244,
    "longitude": 3.3792
  }'
```

---

## 📚 Full Documentation

See `/app/FEATURES_IMPLEMENTATION_REPORT.md` for complete details on:
- All API endpoints
- Database schema
- Frontend implementation guide
- Business impact analysis
- Testing guide

---

## ✅ Checklist

- [ ] Created .env file with all credentials
- [ ] Database is accessible and schema is pushed
- [ ] Firebase Storage is configured
- [ ] Paystack keys are added
- [ ] Server starts without errors
- [ ] Health check returns "healthy"
- [ ] Can access insurance API
- [ ] Ready to implement frontend

---

## 🆘 Need Help?

Check logs:
```bash
# Server logs
tail -f /tmp/server.log

# Or if running in terminal, check console output
```

Common fixes:
1. Restart server: `pkill -f "tsx server/index.ts" && yarn server:dev`
2. Check .env file exists and has correct format
3. Verify database is running: `pg_isready` (for PostgreSQL)
4. Test API manually with curl before implementing frontend

---

**Quick Start Time:** ~5 minutes  
**Prerequisites:** Node.js, PostgreSQL, Firebase account, Paystack account  
**Difficulty:** Medium

Good luck! 🚀
