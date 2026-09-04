#!/bin/bash
set -e

echo "=== The GTW Deployment Script ==="
echo "Starting deployment on Oracle VM..."

# Update system
echo "Updating system packages..."
sudo yum update -y || sudo apt-get update -y

# Install Node.js (check which version is available)
echo "Installing Node.js..."
if command -v yum &> /dev/null; then
    # Oracle Linux / RHEL
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo yum install -y nodejs
else
    # Ubuntu/Debian
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
    sudo apt-get install -y nodejs
fi

# Verify installations
node --version
npm --version

# Create app directory
echo "Creating app directory..."
sudo mkdir -p /home/app/the-gtw
sudo chown $USER:$USER /home/app/the-gtw
cd /home/app/the-gtw

# Clone repository
echo "Cloning repository..."
git clone https://github.com/hlulanigoi/the-gtw.git . || git pull origin main

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Build server
echo "Building server..."
npm run server:build

# Create systemd service for auto-start
echo "Creating systemd service..."
sudo tee /etc/systemd/system/the-gtw.service > /dev/null <<EOF
[Unit]
Description=The GTW Backend Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/app/the-gtw
Environment="NODE_ENV=production"
Environment="PORT=5000"
ExecStart=/usr/bin/node /home/app/the-gtw/server_dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "Enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable the-gtw
sudo systemctl start the-gtw

# Check service status
echo "Service status:"
sudo systemctl status the-gtw

echo "=== Deployment Complete! ==="
echo "Your app is running on http://129.151.178.153:5000"
echo "View logs: sudo journalctl -u the-gtw -f"
