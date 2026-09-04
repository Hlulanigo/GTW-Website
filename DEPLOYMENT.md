# GTW Deployment Instructions

## Public IP Address
**129.151.178.153**

Add this IP to your DNS records for `irgadgetsgtw.shop`

## DNS Configuration
Point your domain `irgadgetsgtw.shop` to:
- **A Record**: 129.151.178.153
- **CNAME** (optional): www.irgadgetsgtw.shop → irgadgetsgtw.shop

## VM Setup (One-time)

SSH into the VM:
```bash
ssh -i your_private_key ubuntu@129.151.178.153
```

### 1. Install Node.js and npm (if not already installed)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
```

### 2. Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
pm2 startup
pm2 save
```

### 3. Setup Nginx
```bash
cd /home/ubuntu/the-gtw
chmod +x scripts/setup-nginx.sh
sudo ./scripts/setup-nginx.sh
```

### 4. Install SSL Certificate (Certbot)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot certonly --nginx -d irgadgetsgtw.shop -d www.irgadgetsgtw.shop
```

## Deployment

SSH into the VM and run:
```bash
cd /home/ubuntu/the-gtw
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Or manually:
```bash
cd /home/ubuntu/the-gtw
git pull origin main
npm install --legacy-peer-deps
npm run build --workspace=frontend
npm run server:build
pm2 restart the-gtw-server
```

## Verification

Check if services are running:
```bash
pm2 status
sudo systemctl status nginx
```

Test the domain:
```bash
curl https://irgadgetsgtw.shop
```

## Environment Variables

Make sure `.env` is set up on the VM with:
```
NODE_ENV=production
PORT=5000
EXPO_PUBLIC_DOMAIN=https://irgadgetsgtw.shop
REACT_APP_BACKEND_URL=https://irgadgetsgtw.shop/api
```

## Monitoring

View logs:
```bash
pm2 logs the-gtw-server
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Updates

For future deployments, just run:
```bash
./scripts/deploy.sh
```

This will pull the latest code, rebuild, and restart the server automatically.
