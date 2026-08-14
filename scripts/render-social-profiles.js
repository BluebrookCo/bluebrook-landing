#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('/Users/daviswood/Projects/SeenLive/node_modules/canvas');

const APP_ROOT = '/Users/daviswood/Projects/SeenLive';
const SITE_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(SITE_ROOT, 'assets', 'social', 'profile');

const INK = '#111214';
const TRUE_INK = '#111111';
const PAPER = '#F7F5F1';
const GOLD = '#D4A843';

registerFont(path.join(APP_ROOT, 'node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf'), {
  family: 'Anton',
  weight: '400',
});
registerFont(path.join(APP_ROOT, 'node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'), {
  family: 'Inter',
  weight: '500',
});
registerFont(path.join(APP_ROOT, 'node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'), {
  family: 'Inter',
  weight: '700',
});

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawTrackedText(ctx, text, x, y, tracking) {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  }
}

function drawWordmark(ctx, x, y, color = PAPER, size = 28) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `400 ${size}px Anton`;
  ctx.textBaseline = 'alphabetic';
  drawTrackedText(ctx, 'WITNESSED', x, y, size * 0.09);
  ctx.restore();
}

function addFineGrain(ctx, width, height, opacity = 0.035) {
  let seed = 9172026;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.save();
  ctx.globalAlpha = opacity;
  for (let i = 0; i < Math.floor(width * height / 680); i += 1) {
    const shade = random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(Math.floor(random() * width), Math.floor(random() * height), 1, 1);
  }
  ctx.restore();
}

function writePng(canvas, filename) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const destination = path.join(OUT_DIR, filename);
  fs.writeFileSync(destination, canvas.toBuffer('image/png', { compressionLevel: 9 }));
  return destination;
}

function drawHistoryIcon(ctx, cx, cy, scale) {
  ctx.lineWidth = 18 * scale;
  ctx.strokeStyle = TRUE_INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  roundedRect(ctx, cx - 155 * scale, cy - 105 * scale, 310 * scale, 210 * scale, 34 * scale);
  ctx.stroke();
  ctx.setLineDash([12 * scale, 18 * scale]);
  ctx.beginPath();
  ctx.moveTo(cx + 82 * scale, cy - 86 * scale);
  ctx.lineTo(cx + 82 * scale, cy + 86 * scale);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawStatsIcon(ctx, cx, cy, scale) {
  ctx.fillStyle = TRUE_INK;
  const bars = [110, 180, 260];
  bars.forEach((height, index) => {
    roundedRect(
      ctx,
      cx - 152 * scale + index * 110 * scale,
      cy + 130 * scale - height * scale,
      68 * scale,
      height * scale,
      25 * scale,
    );
    ctx.fill();
  });
}

function drawDeepCutsIcon(ctx, cx, cy, scale) {
  ctx.strokeStyle = TRUE_INK;
  ctx.lineWidth = 18 * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 170 * scale, cy + 60 * scale);
  ctx.bezierCurveTo(cx - 120 * scale, cy + 60 * scale, cx - 112 * scale, cy - 90 * scale, cx - 62 * scale, cy - 90 * scale);
  ctx.bezierCurveTo(cx - 12 * scale, cy - 90 * scale, cx - 8 * scale, cy + 110 * scale, cx + 48 * scale, cy + 110 * scale);
  ctx.bezierCurveTo(cx + 102 * scale, cy + 110 * scale, cx + 110 * scale, cy - 35 * scale, cx + 170 * scale, cy - 35 * scale);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(cx + 170 * scale, cy - 35 * scale, 22 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawShareIcon(ctx, cx, cy, scale) {
  ctx.strokeStyle = TRUE_INK;
  ctx.lineWidth = 18 * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 155 * scale, cy + 72 * scale);
  ctx.lineTo(cx + 72 * scale, cy - 155 * scale);
  ctx.lineTo(cx + 155 * scale, cy - 118 * scale);
  ctx.lineTo(cx + 118 * scale, cy - 35 * scale);
  ctx.lineTo(cx - 155 * scale, cy + 72 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 155 * scale, cy + 72 * scale);
  ctx.lineTo(cx - 18 * scale, cy + 30 * scale);
  ctx.lineTo(cx + 28 * scale, cy + 168 * scale);
  ctx.stroke();
}

function renderHighlight(filename, iconRenderer) {
  const size = 1080;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(540, 430, 10, 540, 430, 520);
  glow.addColorStop(0, 'rgba(212,168,67,0.13)');
  glow.addColorStop(1, 'rgba(212,168,67,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(540, 540, 356, 0, Math.PI * 2);
  ctx.stroke();

  iconRenderer(ctx, 540, 520, 1);
  addFineGrain(ctx, size, size, 0.025);
  writePng(canvas, filename);
}

async function main() {
  const canonicalAvatarPath = path.join(APP_ROOT, 'assets', 'icon.png');
  const [avatar, stadiumMemory] = await Promise.all([
    loadImage(canonicalAvatarPath),
    loadImage(path.join(APP_ROOT, 'assets', 'brand', 'ui-logo-style', 'memory-williams-brice.png')),
  ]);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Keep the landing favicon/wordmark icon aligned with the repaired production icon.
  fs.copyFileSync(canonicalAvatarPath, path.join(SITE_ROOT, 'assets', 'witnessed-icon.png'));
  fs.copyFileSync(canonicalAvatarPath, path.join(OUT_DIR, 'witnessed-profile-avatar-1024.png'));

  const xAvatar = createCanvas(800, 800);
  xAvatar.getContext('2d').drawImage(avatar, 0, 0, 800, 800);
  writePng(xAvatar, 'witnessed-profile-avatar-x-800.png');

  // X header: exact 3:1 export with all critical content inside the crop-safe band.
  {
    const canvas = createCanvas(1500, 500);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, 1500, 500);

    const light = ctx.createRadialGradient(1240, 170, 20, 1240, 170, 560);
    light.addColorStop(0, 'rgba(212,168,67,0.16)');
    light.addColorStop(1, 'rgba(212,168,67,0)');
    ctx.fillStyle = light;
    ctx.fillRect(800, 0, 700, 500);

    // Purposefully leave the lower-left clear for X's responsive avatar overlap.
    drawWordmark(ctx, 470, 125, TRUE_INK, 30);
    ctx.fillStyle = GOLD;
    ctx.font = '700 16px Inter';
    drawTrackedText(ctx, 'A PERSONAL ARCHIVE FOR LIVE SPORTS', 472, 166, 2.2);
    ctx.fillStyle = TRUE_INK;
    ctx.font = '400 92px Anton';
    ctx.fillText('YOU WERE THERE.', 470, 292);

    ctx.fillStyle = '#55524C';
    ctx.font = '700 19px Inter';
    drawTrackedText(ctx, 'EVERY GAME. EVERY MEMORY.', 474, 353, 2.1);
    ctx.fillStyle = GOLD;
    ctx.fillRect(470, 401, 516, 6);

    ctx.drawImage(stadiumMemory, 1030, 10, 470, 470);
    addFineGrain(ctx, 1500, 500, 0.025);
    writePng(canvas, 'witnessed-x-header-1500x500.png');
  }

  // Instagram has no profile header; this is the coordinated reusable Story background.
  {
    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, 0, 20, 1920);

    const glow = ctx.createRadialGradient(750, 820, 20, 750, 820, 820);
    glow.addColorStop(0, 'rgba(212,168,67,0.13)');
    glow.addColorStop(1, 'rgba(212,168,67,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1920);

    drawWordmark(ctx, 104, 160, TRUE_INK, 38);
    ctx.fillStyle = GOLD;
    ctx.fillRect(104, 196, 212, 5);
    ctx.fillStyle = GOLD;
    ctx.font = '700 18px Inter';
    drawTrackedText(ctx, 'A PERSONAL ARCHIVE FOR LIVE SPORTS', 104, 254, 2.0);

    ctx.fillStyle = TRUE_INK;
    ctx.font = '400 132px Anton';
    ctx.fillText('YOU WERE', 104, 430);
    ctx.fillText('THERE.', 104, 566);

    ctx.drawImage(stadiumMemory, 170, 610, 740, 740);

    ctx.fillStyle = '#55524C';
    ctx.font = '700 25px Inter';
    drawTrackedText(ctx, 'EVERY GAME. EVERY MEMORY.', 104, 1516, 2.2);
    ctx.fillStyle = GOLD;
    ctx.fillRect(104, 1560, 640, 7);

    ctx.fillStyle = TRUE_INK;
    ctx.font = '700 19px Inter';
    drawTrackedText(ctx, '@GETWITNESSED', 104, 1804, 2.5);
    addFineGrain(ctx, 1080, 1920, 0.022);
    writePng(canvas, 'witnessed-instagram-story-background-1080x1920.png');
  }

  renderHighlight('witnessed-instagram-highlight-history.png', drawHistoryIcon);
  renderHighlight('witnessed-instagram-highlight-stats.png', drawStatsIcon);
  renderHighlight('witnessed-instagram-highlight-deep-cuts.png', drawDeepCutsIcon);
  renderHighlight('witnessed-instagram-highlight-share.png', drawShareIcon);

  const manifest = {
    sourceAvatar: 'SeenLive/assets/icon.png',
    files: fs.readdirSync(OUT_DIR).filter((name) => name.endsWith('.png')).sort(),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
