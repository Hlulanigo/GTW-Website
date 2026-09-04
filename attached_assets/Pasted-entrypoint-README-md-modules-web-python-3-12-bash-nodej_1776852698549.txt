entrypoint = "README.md"
modules = ["web", "python-3.12", "bash", "nodejs-22", "postgresql-16"]

[nix]
channel = "stable-25_05"
packages = ["gh"]

[deployment]
deploymentTarget = "autoscale"
build = ["sh", "-c", "npm run expo:static:build && npm run server:build"]
run = ["npm", "run", "server:prod"]

[env]
PORT = "5000"
[[ports]]
localPort = 5000
externalPort = 80

[[ports]]
localPort = 8081
externalPort = 8081

[agent]
stack = "EXPO"
expertMode = true

[workflows]
runButton = "Project"

[[workflows.workflow]]
name = "Project"
mode = "parallel"
author = "agent"

[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Start dev servers"

[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Expo Dev Server"

[[workflows.workflow]]
name = "Start dev servers"
author = "agent"

[workflows.workflow.metadata]
outputType = "webview"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "PORT=5000 NODE_ENV=production npx tsx server/index.ts"
waitForPort = 5000

[[workflows.workflow]]
name = "Expo Dev Server"
author = "agent"

[workflows.workflow.metadata]
outputType = "console"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "bash start-expo-tunnel.sh"

[userenv]

[userenv.shared]
EXPO_PUBLIC_FIREBASE_API_KEY = "AIzaSyD9pMTWieHyJ9z7qtg_BAKRZ8pqgNDnQiM"
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = "irgadgetsofficialweb.firebaseapp.com"
EXPO_PUBLIC_FIREBASE_PROJECT_ID = "irgadgetsofficialweb"
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = "irgadgetsofficialweb.firebasestorage.app"
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "855107386441"
EXPO_PUBLIC_FIREBASE_APP_ID = "1:855107386441:web:d64c2fb26bd3056b3e5398"
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID = "G-7TXF3ZWZCC"
NODE_ENV = "production"
PORT = "5000"
APP_NAME = "ParcelPeer"
LOG_LEVEL = "info"
ADMIN_EMAIL = "admin@parcelpeer.com"
JWT_EXPIRES_IN = "7d"
REFRESH_TOKEN_EXPIRES_IN = "30d"

[userenv.development]
EXPO_PUBLIC_DOMAIN = "https://4125f705-e2d5-4043-adeb-3f223aee449a-00-2kakxlcqzk6fa.riker.replit.dev"

[postMerge]
path = "scripts/post-merge.sh"
timeoutMs = 120000

