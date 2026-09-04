#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "Pre-Deployment Checklist"
echo "================================"
echo ""

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((CHECKS_WARNING++))
}

# 1. Environment Check
echo "1. Environment Setup"
echo "-------------------"

if [ -f ".env" ]; then
    pass "Production .env file exists"
else
    fail "Production .env file is missing"
fi

if [ -f "admin/.env" ]; then
    pass "Admin .env file exists"
else
    warn "Admin .env file is missing (optional for CLI deployments)"
fi

# 2. Dependencies Check
echo ""
echo "2. Dependencies"
echo "---------------"

if npm list > /dev/null 2>&1; then
    pass "Node dependencies installed"
else
    fail "Node dependencies not installed (run: npm install)"
fi

if [ -d "node_modules" ]; then
    pass "node_modules directory exists"
else
    fail "node_modules directory missing"
fi

# 3. Database Check
echo ""
echo "3. Database"
echo "-----------"

if grep -q "DATABASE_URL" .env; then
    pass "DATABASE_URL configured in .env"
else
    fail "DATABASE_URL not configured in .env"
fi

# 4. API Keys Check
echo ""
echo "4. API Keys & Secrets"
echo "--------------------"

REQUIRED_KEYS=(
    "JWT_SECRET"
    "REFRESH_TOKEN_SECRET"
    "PAYSTACK_SECRET_KEY"
)

for key in "${REQUIRED_KEYS[@]}"; do
    if grep -q "$key" .env; then
        pass "$key configured"
    else
        fail "$key NOT configured in .env"
    fi
done

# 5. Configuration Check
echo ""
echo "5. Configuration"
echo "----------------"

if grep -q "NODE_ENV=production" .env; then
    pass "NODE_ENV set to production"
else
    warn "NODE_ENV not set to production in .env"
fi

if grep -q "ALLOWED_ORIGINS" .env; then
    pass "ALLOWED_ORIGINS configured"
else
    warn "ALLOWED_ORIGINS not configured (may cause CORS issues)"
fi

if grep -q "PORT" .env; then
    pass "PORT configured"
else
    warn "PORT not configured (will default to 5000)"
fi

# 6. Build Check
echo ""
echo "6. Build"
echo "--------"

if [ -f "server_dist/index.js" ]; then
    pass "Server build exists"
else
    warn "Server build not found (run: npm run server:build)"
fi

# 7. Security Check
echo ""
echo "7. Security"
echo "-----------"

if grep -q "helmet" package.json; then
    pass "Helmet security package installed"
else
    warn "Helmet security package not found"
fi

if grep -q "rate-limit" package.json; then
    pass "Rate limiting package installed"
else
    warn "Rate limiting package not installed"
fi

# 8. Logging Check
echo ""
echo "8. Logging"
echo "----------"

if grep -q "LOG_LEVEL" .env; then
    pass "LOG_LEVEL configured"
else
    warn "LOG_LEVEL not configured"
fi

# 9. Git Check
echo ""
echo "9. Version Control"
echo "------------------"

if git rev-parse --git-dir > /dev/null 2>&1; then
    pass "Repository is a git repository"
    if [ -n "$(git status -s)" ]; then
        warn "Uncommitted changes detected (commit before deployment)"
    else
        pass "All changes committed"
    fi
else
    warn "Not a git repository"
fi

# 10. Docker Check
echo ""
echo "10. Containerization"
echo "--------------------"

if [ -f "Dockerfile" ]; then
    pass "Dockerfile exists"
else
    warn "Dockerfile not found"
fi

if [ -f "docker-compose.yml" ]; then
    pass "docker-compose.yml exists"
else
    warn "docker-compose.yml not found"
fi

# Summary
echo ""
echo "================================"
echo "Checklist Summary"
echo "================================"
echo -e "${GREEN}Passed:${NC} $CHECKS_PASSED"
echo -e "${RED}Failed:${NC} $CHECKS_FAILED"
echo -e "${YELLOW}Warnings:${NC} $CHECKS_WARNING"
echo ""

if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${RED}Deployment NOT ready - fix all failures above${NC}"
    exit 1
elif [ $CHECKS_WARNING -gt 0 ]; then
    echo -e "${YELLOW}Deployment ready but review warnings above${NC}"
    exit 0
else
    echo -e "${GREEN}All checks passed - ready for deployment!${NC}"
    exit 0
fi
