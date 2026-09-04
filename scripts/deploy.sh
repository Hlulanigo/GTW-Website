#!/bin/bash

# The GTW Deployment Script
# This script deploys the latest code to the VM

set -e

echo "Starting deployment of The GTW..."

# Navigate to project directory
cd /home/ubuntu/the-gtw

# Pull latest code from GitHub
echo "Pulling latest code from GitHub..."
git pull origin main

# Install/update dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

# Build frontend
echo "Building frontend..."
npm run build --workspace=frontend

# Build server
echo "Building server..."
npm run server:build

# Stop existing server process
echo "Stopping existing server..."
pm2 delete the-gtw-server 2>/dev/null || true

# Start new server with PM2
echo "Starting server with PM2..."
pm2 start server_dist/index.js --name "the-gtw-server" --instances 1 --watch false

# Save PM2 process list
pm2 save

# Display service status
echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"
pm2 status
echo ""
echo "Server is running on http://localhost:5000"
echo "Public domain: https://irgadgetsgtw.shop"
echo ""
