#!/bin/bash

# The GTW (ParcelPeer) - Production Setup Script
# This script helps set up the production environment

set -e

echo "🚀 The GTW - Production Setup Script"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from /app directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Checking environment files...${NC}"

# Check .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env from template...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo -e "${RED}⚠️  IMPORTANT: Edit .env with your production values!${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Check admin .env file
if [ ! -f "admin/.env" ]; then
    echo -e "${YELLOW}Creating admin/.env from template...${NC}"
    cp admin/.env.example admin/.env
    echo -e "${GREEN}✓ Created admin/.env file${NC}"
    echo -e "${RED}⚠️  IMPORTANT: Edit admin/.env with your production values!${NC}"
else
    echo -e "${GREEN}✓ admin/.env file exists${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Checking dependencies...${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    yarn install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Checking logs directory...${NC}"

# Create logs directory
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo -e "${GREEN}✓ Created logs directory${NC}"
else
    echo -e "${GREEN}✓ Logs directory exists${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Database setup...${NC}"

# Check if DATABASE_URL is set
if grep -q "DATABASE_URL=postgresql://user:password@host" .env; then
    echo -e "${RED}⚠️  DATABASE_URL not configured in .env${NC}"
    echo "Please update DATABASE_URL with your production database URL"
else
    echo -e "${GREEN}✓ DATABASE_URL appears to be configured${NC}"
    
    # Ask if user wants to run migrations
    read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Running migrations..."
        if [ -f "migrations/001_add_indexes.sql" ]; then
            # Check if psql is available
            if command -v psql &> /dev/null; then
                source .env
                psql $DATABASE_URL < migrations/001_add_indexes.sql
                echo -e "${GREEN}✓ Migrations completed${NC}"
            else
                echo -e "${RED}psql not found. Please run migrations manually:${NC}"
                echo "psql \$DATABASE_URL < migrations/001_add_indexes.sql"
            fi
        else
            echo -e "${YELLOW}No migration files found${NC}"
        fi
    fi
fi

echo ""
echo -e "${YELLOW}Step 5: Security checks...${NC}"

# Check if sensitive values are still default
ISSUES=0

if grep -q "PAYSTACK_SECRET_KEY=sk_live_your_secret_key" .env; then
    echo -e "${RED}✗ PAYSTACK_SECRET_KEY not set${NC}"
    ISSUES=$((ISSUES+1))
else
    echo -e "${GREEN}✓ PAYSTACK_SECRET_KEY configured${NC}"
fi

if grep -q "FIREBASE_PROJECT_ID=your-project-id" .env; then
    echo -e "${RED}✗ FIREBASE_PROJECT_ID not set${NC}"
    ISSUES=$((ISSUES+1))
else
    echo -e "${GREEN}✓ FIREBASE_PROJECT_ID configured${NC}"
fi

if grep -q "ALLOWED_ORIGINS=https://yourdomain.com" .env; then
    echo -e "${RED}✗ ALLOWED_ORIGINS not set${NC}"
    ISSUES=$((ISSUES+1))
else
    echo -e "${GREEN}✓ ALLOWED_ORIGINS configured${NC}"
fi

echo ""
echo -e "${YELLOW}Step 6: Building application...${NC}"

read -p "Do you want to build the backend now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Building backend..."
    yarn server:build
    echo -e "${GREEN}✓ Backend built successfully${NC}"
fi

echo ""
echo "=================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=================================="
echo ""

if [ $ISSUES -gt 0 ]; then
    echo -e "${RED}⚠️  Found $ISSUES configuration issues${NC}"
    echo "Please review and fix the issues above before deploying"
    echo ""
fi

echo "Next steps:"
echo "1. Review and update .env with production values"
echo "2. Review and update admin/.env with production values"
echo "3. Run database migrations if not done"
echo "4. Test the application locally"
echo "5. Deploy to production"
echo ""
echo "Documentation:"
echo "- Production Readiness: PRODUCTION_READINESS_REPORT.md"
echo "- Deployment Guide: DEPLOYMENT_GUIDE.md"
echo "- Quick Start: QUICK_START_PRODUCTION.md"
echo ""
echo "To start the server:"
echo "  NODE_ENV=production yarn server:prod"
echo ""
echo "To check health:"
echo "  curl http://localhost:5000/health"
echo ""
