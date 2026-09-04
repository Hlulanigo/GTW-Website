#!/bin/bash
# Quick deployment script for The GTW on VM

set -e

echo "🚀 Starting deployment on VM..."

cd /home/ubuntu/the-gtw

# Pull latest code
echo "📦 Pulling latest code from GitHub..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps 2>&1 | tail -5

# Build frontend
echo "🏗️ Building frontend..."
npm run build --workspace=frontend 2>&1 | tail -5

# Build server
echo "🏗️ Building server..."
npm run server:build

# Stop existing PM2 process if running
echo "⏹️ Stopping existing server..."
pm2 stop the-gtw-server 2>/dev/null || true

# Start server with PM2
echo "▶️ Starting server with PM2..."
pm2 start server_dist/index.js --name "the-gtw-server" || pm2 restart the-gtw-server

# Save PM2 config
pm2 save

# Setup/restart nginx
echo "🔧 Configuring nginx..."
sudo bash << 'NGINX_SCRIPT'
# Create nginx config
tee /etc/nginx/sites-available/irgadgetsgtw.shop > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name irgadgetsgtw.shop www.irgadgetsgtw.shop;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name irgadgetsgtw.shop www.irgadgetsgtw.shop;

    ssl_certificate /etc/letsencrypt/live/irgadgetsgtw.shop/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/irgadgetsgtw.shop/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;
    gzip_min_length 1000;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

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

    location /api/ {
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

    location /app/ {
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

    location /assets/ {
        proxy_pass http://localhost:5000;
        proxy_cache_valid 200 1d;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/irgadgetsgtw.shop /etc/nginx/sites-enabled/irgadgetsgtw.shop
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t && systemctl reload nginx
systemctl enable nginx

echo "✅ Nginx configured and restarted"
NGINX_SCRIPT

echo ""
echo "================================"
echo "✅ Deployment Complete!"
echo "================================"
echo ""
pm2 status
echo ""
echo "🌐 Domain: https://irgadgetsgtw.shop"
echo "📊 Server: http://localhost:5000"
echo ""
echo "📝 Recent logs:"
pm2 logs the-gtw-server --lines 10
