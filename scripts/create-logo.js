const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Create logo.png from SVG design
const width = 200;
const height = 200;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, width, height);

// Create gradient background (subtle)
const bgGradient = ctx.createLinearGradient(0, 0, width, height);
bgGradient.addColorStop(0, '#fff9f5');
bgGradient.addColorStop(1, '#fff3e6');
ctx.fillStyle = bgGradient;
ctx.fillRect(0, 0, width, height);

// Create main gradient for icon
const gradient = ctx.createLinearGradient(40, 40, 160, 160);
gradient.addColorStop(0, '#F97316');
gradient.addColorStop(1, '#B45309');

// Draw rounded rectangle background
const radius = 30;
ctx.beginPath();
ctx.moveTo(40 + radius, 40);
ctx.lineTo(160 - radius, 40);
ctx.quadraticCurveTo(160, 40, 160, 40 + radius);
ctx.lineTo(160, 160 - radius);
ctx.quadraticCurveTo(160, 160, 160 - radius, 160);
ctx.lineTo(40 + radius, 160);
ctx.quadraticCurveTo(40, 160, 40, 160 - radius);
ctx.lineTo(40, 40 + radius);
ctx.quadraticCurveTo(40, 40, 40 + radius, 40);
ctx.closePath();
ctx.fillStyle = gradient;
ctx.fill();

// Draw upward arrow (delivery icon) - white color
ctx.strokeStyle = 'white';
ctx.lineWidth = 6;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Arrow shaft
ctx.beginPath();
ctx.moveTo(100, 130);
ctx.lineTo(100, 70);
ctx.stroke();

// Arrow head (top)
ctx.beginPath();
ctx.moveTo(100, 70);
ctx.lineTo(85, 85);
ctx.stroke();

ctx.beginPath();
ctx.moveTo(100, 70);
ctx.lineTo(115, 85);
ctx.stroke();

// Add box shape below arrow
ctx.strokeStyle = 'white';
ctx.lineWidth = 5;
ctx.strokeRect(75, 100, 50, 35);

// Save PNG
const out = fs.createWriteStream(path.join(__dirname, '../assets/images/logo.png'));
const stream = canvas.createPNGStream();
stream.pipe(out);

out.on('finish', () => {
  console.log('logo.png created successfully!');
});

out.on('error', (err) => {
  console.error('Error creating logo:', err);
});
