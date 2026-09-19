const fs = require('fs');
const path = require('path');
const { createCanvas, registerFont } = require('/Users/daviswood/Projects/SeenLive/node_modules/canvas');

const SITE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = '/Users/daviswood/Projects/SeenLive';
const OUT_DIR = path.join(SITE_ROOT, 'assets', 'social', 'campaigns', 'fan-history-fall-2026');
const W = 1080;
const H = 1350;

const PAPER = '#F7F5F1';
const CARD = '#FFFFFF';
const INK = '#111214';
const GOLD = '#D4A843';
const MUTED = '#696761';
const SOFT = '#E8E3DA';

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

function ticketPath(ctx, x, y, width, height, radius = 28, notchRadius = 14) {
  const notches = [0.22, 0.5, 0.78].map((position) => y + height * position);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  for (const notchY of notches) {
    ctx.lineTo(x + width, notchY - notchRadius);
    ctx.arc(x + width, notchY, notchRadius, -Math.PI / 2, Math.PI / 2, true);
  }
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  for (const notchY of [...notches].reverse()) {
    ctx.lineTo(x, notchY + notchRadius);
    ctx.arc(x, notchY, notchRadius, Math.PI / 2, -Math.PI / 2, true);
  }
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillTicket(ctx, x, y, width, height, fill, stroke = null, shadow = true) {
  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(17,18,20,0.18)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 16;
  }
  ticketPath(ctx, x, y, width, height);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  if (stroke) {
    ctx.save();
    ticketPath(ctx, x, y, width, height);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

function trackedText(ctx, text, x, y, tracking) {
  let cursor = x;
  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + tracking;
  }
}

function label(ctx, text, x, y, color = GOLD, size = 17, tracking = 3) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px Inter`;
  trackedText(ctx, text.toUpperCase(), x, y, tracking);
  ctx.restore();
}

function wordmark(ctx, dark) {
  const x = 78;
  const y = 70;
  const width = 262;
  const height = 64;
  ctx.save();
  ctx.fillStyle = GOLD;
  roundedRect(ctx, x + 9, y + 9, width, height, 17);
  ctx.fill();
  ctx.fillStyle = dark ? INK : CARD;
  ctx.strokeStyle = dark ? PAPER : INK;
  ctx.lineWidth = 3;
  roundedRect(ctx, x, y, width, height, 17);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark ? PAPER : INK;
  ctx.font = '400 34px Anton';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WITNESSED', x + width / 2, y + height / 2 + 1);
  ctx.restore();
}

function fitAnton(ctx, text, maxWidth, startSize) {
  let size = startSize;
  while (size > 28) {
    ctx.font = `400 ${size}px Anton`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

function headline(ctx, lines, x, y, maxWidth, options = {}) {
  const size = options.size || 104;
  const gap = options.gap || Math.round(size * 0.96);
  const colors = options.colors || [INK];
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, index) => {
    const lineSize = fitAnton(ctx, line, maxWidth, size);
    ctx.font = `400 ${lineSize}px Anton`;
    ctx.fillStyle = colors[index] || colors[colors.length - 1];
    ctx.fillText(line, x, y + index * gap);
  });
  ctx.restore();
}

function background(ctx, dark) {
  ctx.fillStyle = dark ? INK : PAPER;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(890, 150, 20, 890, 150, 620);
  glow.addColorStop(0, dark ? 'rgba(212,168,67,0.16)' : 'rgba(212,168,67,0.17)');
  glow.addColorStop(1, 'rgba(212,168,67,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 760);
}

function footer(ctx, dark, left, right) {
  ctx.save();
  ctx.strokeStyle = dark ? 'rgba(247,245,241,0.24)' : 'rgba(17,18,20,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(78, 1245);
  ctx.lineTo(1002, 1245);
  ctx.stroke();
  ctx.fillStyle = dark ? PAPER : INK;
  ctx.font = '700 18px Inter';
  trackedText(ctx, left, 78, 1294, 1.7);
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'right';
  ctx.fillText(right, 1002, 1294);
  ctx.restore();
}

function separator(ctx, x1, y, x2, dark = false) {
  ctx.save();
  ctx.strokeStyle = dark ? 'rgba(247,245,241,0.22)' : 'rgba(17,18,20,0.14)';
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 10]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function write(canvas, filename) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const destination = path.join(OUT_DIR, filename);
  fs.writeFileSync(destination, canvas.toBuffer('image/png', { compressionLevel: 9 }));
  console.log(destination);
}

function createFrame(dark, campaignLabel) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  background(ctx, dark);
  wordmark(ctx, dark);
  label(ctx, campaignLabel, 690, 111, dark ? GOLD : MUTED, 15, 2.2);
  return { canvas, ctx };
}

function renderHistoryAudit() {
  const { canvas, ctx } = createFrame(false, 'Fan history / 01');
  headline(ctx, ['YOUR MEMORY', 'IS NOT A', 'DATABASE.'], 78, 300, 480, {
    size: 104,
    gap: 102,
    colors: [INK, INK, GOLD],
  });
  fillTicket(ctx, 596, 224, 406, 770, CARD, INK, true);
  label(ctx, 'Personal archive', 644, 292, MUTED, 14, 2.1);
  const rows = [
    ['FIRST GAME', '__________'],
    ['BEST GAME', '__________'],
    ['LOST SCORE', '__________'],
  ];
  rows.forEach(([name, value], index) => {
    const y = 380 + index * 152;
    ctx.fillStyle = MUTED;
    ctx.font = '700 17px Inter';
    ctx.fillText(name, 644, y);
    ctx.fillStyle = INK;
    ctx.font = '400 49px Anton';
    ctx.fillText(value, 644, y + 64);
    separator(ctx, 644, y + 92, 952);
  });
  ctx.fillStyle = GOLD;
  roundedRect(ctx, 632, 825, 338, 112, 22);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '400 46px Anton';
  ctx.textAlign = 'center';
  ctx.fillText('BUILD THE ARCHIVE', 801, 895);
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = '500 28px Inter';
  ctx.fillText('The games happened.', 82, 740);
  ctx.fillText('Keep the details.', 82, 782);
  footer(ctx, false, 'EVERY GAME. EVERY MEMORY.', 'START WITH ONE');
  write(canvas, '01-nfl-history-audit.png');
}

function renderDeepCutRollCall() {
  const { canvas, ctx } = createFrame(true, 'Saturday archive / 02');
  headline(ctx, ['NAME THE GAME', 'ONLY YOU', 'REMEMBER.'], 78, 298, 920, {
    size: 108,
    gap: 108,
    colors: [PAPER, PAPER, GOLD],
  });
  fillTicket(ctx, 78, 658, 924, 398, 'rgba(247,245,241,0.06)', GOLD, false);
  label(ctx, 'Deep cut rarity', 130, 724, GOLD, 15, 2.3);
  ctx.fillStyle = PAPER;
  ctx.font = '400 122px Anton';
  ctx.fillText('97', 130, 868);
  ctx.fillStyle = 'rgba(247,245,241,0.66)';
  ctx.font = '700 18px Inter';
  trackedText(ctx, 'SPECIFICITY', 134, 916, 2.8);
  ctx.fillStyle = 'rgba(247,245,241,0.11)';
  roundedRect(ctx, 376, 724, 560, 54, 27);
  ctx.fill();
  ctx.fillStyle = GOLD;
  roundedRect(ctx, 376, 724, 497, 54, 27);
  ctx.fill();
  const digits = ['0', '7', '–', '0', '6'];
  digits.forEach((digit, index) => {
    const x = 390 + index * 102;
    ctx.fillStyle = index === 2 ? GOLD : PAPER;
    ctx.font = '400 72px Anton';
    ctx.fillText(digit, x, 900);
  });
  ctx.fillStyle = 'rgba(247,245,241,0.66)';
  ctx.font = '500 24px Inter';
  ctx.fillText('The weird Saturday you can still call drive by drive.', 382, 980);
  footer(ctx, true, 'NOT THE FAMOUS ONE. YOUR ONE.', 'NAME THE GAME');
  write(canvas, '02-sec-deep-cut-roll-call.png');
}

function renderOneGameTenGames() {
  const { canvas, ctx } = createFrame(false, 'Patterns / 03');
  headline(ctx, ['ONE GAME', 'IS A MEMORY.'], 78, 290, 600, {
    size: 116,
    gap: 112,
    colors: [INK, GOLD],
  });
  headline(ctx, ['TEN GAMES', 'IS A PATTERN.'], 78, 600, 650, {
    size: 112,
    gap: 108,
    colors: [INK, GOLD],
  });
  for (let index = 0; index < 10; index += 1) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 730 + column * 122;
    const y = 240 + row * 135;
    fillTicket(ctx, x, y, 96, 112, index === 9 ? GOLD : INK, null, false);
    ctx.fillStyle = index === 9 ? INK : PAPER;
    ctx.font = '400 33px Anton';
    ctx.textAlign = 'center';
    ctx.fillText(String(index + 1).padStart(2, '0'), x + 48, y + 69);
  }
  ctx.textAlign = 'left';
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(778, 942);
  ctx.lineTo(778, 1032);
  ctx.lineTo(622, 1032);
  ctx.stroke();
  fillTicket(ctx, 78, 852, 544, 232, INK, GOLD, true);
  label(ctx, 'Your pattern', 128, 918, GOLD, 14, 2.2);
  ctx.fillStyle = PAPER;
  ctx.font = '400 55px Anton';
  ctx.fillText('TEAM · PLAYER · VENUE', 128, 1006);
  footer(ctx, false, 'LOG THE GAMES. FIND THE PATTERN.', 'DEEP CUTS');
  write(canvas, '03-nfl-one-game-ten-games.png');
}

function renderImportSaturdays() {
  const { canvas, ctx } = createFrame(false, 'History import / 04');
  headline(ctx, ['YOUR SATURDAYS,', 'BACK IN ORDER.'], 78, 304, 920, {
    size: 112,
    gap: 112,
    colors: [INK, GOLD],
  });
  fillTicket(ctx, 78, 598, 924, 494, CARD, INK, true);
  const stages = [
    ['01', 'SPORT', 'COLLEGE FOOTBALL'],
    ['02', 'TEAM', 'YOUR TEAM'],
    ['03', 'SEASON', 'PICK A YEAR'],
  ];
  stages.forEach(([number, name, value], index) => {
    const y = 662 + index * 130;
    ctx.fillStyle = index === 2 ? GOLD : INK;
    roundedRect(ctx, 124, y - 42, 76, 76, 18);
    ctx.fill();
    ctx.fillStyle = index === 2 ? INK : PAPER;
    ctx.font = '400 36px Anton';
    ctx.textAlign = 'center';
    ctx.fillText(number, 162, y + 11);
    ctx.textAlign = 'left';
    label(ctx, name, 234, y - 12, MUTED, 13, 2.1);
    ctx.fillStyle = INK;
    ctx.font = '400 43px Anton';
    ctx.fillText(value, 234, y + 38);
    if (index < stages.length - 1) separator(ctx, 234, y + 68, 936);
  });
  ctx.fillStyle = GOLD;
  roundedRect(ctx, 704, 1000, 236, 58, 29);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '700 18px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('READY TO REVIEW', 822, 1037);
  ctx.textAlign = 'left';
  footer(ctx, false, 'SPORT. TEAM. SEASON.', 'PUT IT IN ORDER');
  write(canvas, '04-sec-import-your-saturdays.png');
}

function renderDeepCutProof() {
  const { canvas, ctx } = createFrame(true, 'Deep Cuts / 05');
  headline(ctx, ['THE DETAIL', 'IS THE FLEX.'], 78, 308, 780, {
    size: 128,
    gap: 122,
    colors: [PAPER, GOLD],
  });
  fillTicket(ctx, 78, 610, 924, 474, 'rgba(247,245,241,0.035)', GOLD, false);
  const nodes = [
    { x: 212, y: 738, label: 'GAME' },
    { x: 498, y: 700, label: 'PLAYER' },
    { x: 786, y: 738, label: 'VENUE' },
    { x: 498, y: 922, label: 'FINISH' },
  ];
  ctx.strokeStyle = 'rgba(212,168,67,0.55)';
  ctx.lineWidth = 4;
  for (let index = 0; index < nodes.length - 1; index += 1) {
    ctx.beginPath();
    ctx.moveTo(nodes[index].x, nodes[index].y);
    ctx.lineTo(nodes[index + 1].x, nodes[index + 1].y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(nodes[3].x, nodes[3].y);
  ctx.lineTo(nodes[0].x, nodes[0].y);
  ctx.stroke();
  nodes.forEach((node, index) => {
    ctx.fillStyle = index === 3 ? GOLD : PAPER;
    ctx.beginPath();
    ctx.arc(node.x, node.y, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = index === 3 ? INK : INK;
    ctx.font = '400 30px Anton';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, node.x, node.y + 10);
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(247,245,241,0.68)';
  ctx.font = '500 23px Inter';
  ctx.fillText('One history. The connections only you can claim.', 298, 1046);
  footer(ctx, true, 'TOTALS ARE COMMON. DETAILS ARE YOURS.', 'FIND YOURS');
  write(canvas, '05-nfl-deep-cut-proof.png');
}

function renderFanResume() {
  const { canvas, ctx } = createFrame(false, 'Fan resume / 06');
  headline(ctx, ['YOUR FAN', 'RESUME.'], 78, 302, 380, {
    size: 118,
    gap: 116,
    colors: [INK, GOLD],
  });
  fillTicket(ctx, 522, 210, 480, 884, INK, GOLD, true);
  label(ctx, 'Attendance record', 550, 282, GOLD, 14, 2.2);
  ctx.fillStyle = PAPER;
  ctx.font = '400 58px Anton';
  ctx.fillText('WITNESSED', 550, 362);
  const fields = [
    'FIRST GAME',
    'BEST FINISH',
    'MOST-SEEN OPPONENT',
    'ROAD VENUES',
  ];
  fields.forEach((field, index) => {
    const y = 468 + index * 132;
    ctx.fillStyle = 'rgba(247,245,241,0.58)';
    ctx.font = '700 15px Inter';
    trackedText(ctx, field, 550, y, 2);
    ctx.strokeStyle = index === fields.length - 1 ? GOLD : 'rgba(247,245,241,0.32)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(550, y + 48);
    ctx.lineTo(942, y + 48);
    ctx.stroke();
  });
  ctx.fillStyle = GOLD;
  roundedRect(ctx, 548, 1000, 398, 62, 31);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '700 19px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('BUILD · SAVE · SHARE', 747, 1040);
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = '500 28px Inter';
  ctx.fillText('Not a bio.', 82, 736);
  ctx.fillText('Not a follower count.', 82, 780);
  ctx.fillStyle = INK;
  ctx.font = '400 52px Anton';
  ctx.fillText('THE GAMES', 82, 880);
  ctx.fillText('YOU WERE THERE FOR.', 82, 938);
  footer(ctx, false, 'YOUR HISTORY SAYS MORE.', 'FILL YOURS IN');
  write(canvas, '06-sec-fan-resume.png');
}

function main() {
  renderHistoryAudit();
  renderDeepCutRollCall();
  renderOneGameTenGames();
  renderImportSaturdays();
  renderDeepCutProof();
  renderFanResume();
}

main();
