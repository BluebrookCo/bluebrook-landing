const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('/Users/daviswood/Projects/SeenLive/node_modules/canvas');

const SITE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = '/Users/daviswood/Projects/SeenLive';
const OUT_DIR = path.join(SITE_ROOT, 'assets', 'social', 'campaigns', 'nfl-2026-kickoff');
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

function ticketPath(ctx, x, y, width, height, radius = 28, notchRadius = 13) {
  const notches = [0.24, 0.5, 0.76].map((p) => y + height * p);
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
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 16;
  }
  ticketPath(ctx, x, y, width, height);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  if (stroke) {
    ticketPath(ctx, x, y, width, height);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function trackedText(ctx, text, x, y, tracking) {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  }
}

function wordmark(ctx, x, y, dark = false) {
  const width = 256;
  const height = 62;
  ctx.save();
  ctx.fillStyle = GOLD;
  roundedRect(ctx, x + 8, y + 8, width, height, 16);
  ctx.fill();
  ctx.fillStyle = dark ? INK : CARD;
  ctx.strokeStyle = dark ? PAPER : INK;
  ctx.lineWidth = 3;
  roundedRect(ctx, x, y, width, height, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark ? PAPER : INK;
  ctx.font = '400 33px Anton';
  ctx.textBaseline = 'middle';
  const label = 'WITNESSED';
  ctx.fillText(label, x + (width - ctx.measureText(label).width) / 2, y + height / 2 + 1);
  ctx.restore();
}

function smallLabel(ctx, text, x, y, color = GOLD, size = 18, tracking = 3.4) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px Inter`;
  ctx.textBaseline = 'alphabetic';
  trackedText(ctx, text.toUpperCase(), x, y, tracking);
  ctx.restore();
}

function fitAnton(ctx, text, maxWidth, startSize) {
  let size = startSize;
  do {
    ctx.font = `400 ${size}px Anton`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > 28);
  return size;
}

function headline(ctx, lines, x, y, maxWidth, options = {}) {
  const size = options.size || 112;
  const gap = options.gap || Math.round(size * 0.94);
  const colors = options.colors || [INK];
  lines.forEach((line, index) => {
    const lineSize = fitAnton(ctx, line, maxWidth, size);
    ctx.font = `400 ${lineSize}px Anton`;
    ctx.fillStyle = colors[index] || colors[colors.length - 1];
    ctx.fillText(line, x, y + index * gap);
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function footer(ctx, dark = false, left = 'EVERY GAME. EVERY MEMORY.', right = '@GETWITNESSED') {
  ctx.save();
  ctx.strokeStyle = dark ? 'rgba(247,245,241,0.26)' : 'rgba(17,18,20,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(78, 1246);
  ctx.lineTo(1002, 1246);
  ctx.stroke();
  ctx.fillStyle = dark ? PAPER : INK;
  ctx.font = '700 18px Inter';
  trackedText(ctx, left, 78, 1294, 2.1);
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'right';
  ctx.fillText(right, 1002, 1294);
  ctx.restore();
}

function background(ctx, dark = false) {
  ctx.fillStyle = dark ? INK : PAPER;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(900, 160, 30, 900, 160, 600);
  glow.addColorStop(0, dark ? 'rgba(212,168,67,0.16)' : 'rgba(212,168,67,0.15)');
  glow.addColorStop(1, 'rgba(212,168,67,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 760);
}

function drawMatchRow(ctx, x, y, width, label, dark = true, ordinal = null) {
  ctx.save();
  ctx.fillStyle = dark ? INK : CARD;
  roundedRect(ctx, x, y, width, 100, 22);
  ctx.fill();
  if (ordinal) {
    ctx.fillStyle = GOLD;
    ctx.font = '400 44px Anton';
    ctx.fillText(ordinal, x + 26, y + 66);
  }
  ctx.fillStyle = dark ? PAPER : INK;
  ctx.font = '700 27px Inter';
  ctx.fillText(label, x + (ordinal ? 92 : 30), y + 61);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(x + width - 36, y + 50, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGlobe(ctx, cx, cy, radius) {
  ctx.save();
  ctx.strokeStyle = 'rgba(247,245,241,0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  for (const scale of [0.46, 0.78]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * scale, radius, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const offset of [-0.5, 0, 0.5]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius * offset, radius, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 7;
  ctx.setLineDash([14, 15]);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.83, -2.75, -0.16);
  ctx.stroke();
  ctx.restore();
}

function circularImage(ctx, image, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, x, y, size, size);
  ctx.restore();
}

function write(canvas, filename) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const output = path.join(OUT_DIR, filename);
  fs.writeFileSync(output, canvas.toBuffer('image/png', { compressionLevel: 9 }));
  console.log(output);
}

async function main() {
  const [stadiumTicket, icon] = await Promise.all([
    loadImage(path.join(APP_ROOT, 'assets/brand/ui-logo-style/memory-williams-brice.png')),
    loadImage(path.join(SITE_ROOT, 'assets/witnessed-icon.png')),
  ]);

  // 01 — SEC Sunday Roll Call
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, false);
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, 0, 20, H);
    wordmark(ctx, 80, 78, false);
    smallLabel(ctx, 'Campaign 01 / SEC Sunday', 680, 116, MUTED, 16, 2.4);
    headline(ctx, ['SEC SUNDAY', 'ROLL CALL.'], 80, 286, 860, { size: 132, gap: 128, colors: [INK, GOLD] });
    ctx.fillStyle = MUTED;
    ctx.font = '500 29px Inter';
    ctx.fillText('The NFL roster changes. The college bias never does.', 85, 496);

    fillTicket(ctx, 78, 584, 620, 498, INK, null, true);
    smallLabel(ctx, 'State your affiliations', 128, 650, GOLD, 15, 2.5);
    ctx.fillStyle = PAPER;
    ctx.font = '400 63px Anton';
    ctx.fillText('SCHOOL', 128, 752);
    ctx.strokeStyle = 'rgba(247,245,241,0.42)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(128, 790); ctx.lineTo(638, 790); ctx.stroke();
    ctx.fillText('NFL TEAM', 128, 902);
    ctx.beginPath(); ctx.moveTo(128, 940); ctx.lineTo(638, 940); ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = '700 20px Inter';
    ctx.fillText('REPLY. BE UNREASONABLE.', 128, 1018);

    ctx.drawImage(stadiumTicket, 608, 520, 430, 430);
    footer(ctx, false, 'SATURDAYS BUILT SUNDAYS.', 'REPLY BELOW');
    write(canvas, '01-sec-sunday-roll-call.png');
  }

  // 02 — Bring the Receipts
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, true);
    wordmark(ctx, 80, 78, true);
    smallLabel(ctx, 'Preseason / Week 2', 730, 116, GOLD, 16, 2.4);

    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = PAPER;
    ctx.font = '400 420px Anton';
    ctx.fillText('02', 540, 470);
    ctx.restore();

    fillTicket(ctx, 78, 252, 924, 774, PAPER, GOLD, true);
    smallLabel(ctx, 'Your fan history', 132, 330, MUTED, 16, 2.6);
    headline(ctx, ['BRING THE', 'RECEIPTS.'], 132, 488, 660, { size: 140, gap: 132, colors: [INK, GOLD] });
    ctx.fillStyle = INK;
    ctx.font = '500 31px Inter';
    wrapText(ctx, 'The best game you ever saw should not live as a blurry screenshot in a group chat.', 136, 720, 660, 46, 3);

    ctx.strokeStyle = 'rgba(17,18,20,0.18)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(136, 858); ctx.lineTo(914, 858); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = INK;
    ctx.font = '700 24px Inter';
    ctx.fillText('LOG IT. RELIVE IT. KEEP IT.', 136, 925);
    circularImage(ctx, icon, 816, 708, 128);
    footer(ctx, true, 'EVERY GAME. EVERY MEMORY.', 'LINK IN BIO');
    write(canvas, '02-bring-the-receipts.png');
  }

  // 03 — Big Screen Draft
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, false);
    wordmark(ctx, 80, 78, false);
    smallLabel(ctx, 'Week 1 / 1 PM ET', 730, 116, MUTED, 16, 2.4);
    headline(ctx, ['ONE TV.', 'FOUR GAMES.'], 80, 280, 900, { size: 130, gap: 124, colors: [INK, GOLD] });
    ctx.fillStyle = MUTED;
    ctx.font = '500 29px Inter';
    ctx.fillText('Who gets the big screen in SEC country?', 85, 492);
    const matchups = ['CHI  @  CAR', 'TB  @  CIN', 'ATL  @  PIT', 'NYJ  @  TEN'];
    matchups.forEach((matchup, index) => drawMatchRow(ctx, 80, 568 + index * 124, 920, matchup, index !== 1, `${index + 1}`));
    ctx.fillStyle = GOLD;
    ctx.font = '400 50px Anton';
    ctx.fillText('DRAFT YOUR SCREEN ORDER.', 80, 1132);
    footer(ctx, false, 'SUNDAY · SEPTEMBER 13', 'DROP 1–4');
    write(canvas, '03-big-screen-draft.png');
  }

  // 04 — One Week Before Kickoff
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, true);
    wordmark(ctx, 80, 78, true);
    smallLabel(ctx, 'Kickoff countdown', 742, 116, GOLD, 16, 2.4);
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = PAPER;
    ctx.font = '400 720px Anton';
    ctx.fillText('7', 620, 790);
    ctx.restore();
    headline(ctx, ['ONE WEEK.', 'BUILD YOUR', 'HISTORY.'], 80, 336, 770, { size: 126, gap: 120, colors: [PAPER, PAPER, GOLD] });
    ctx.fillStyle = 'rgba(247,245,241,0.74)';
    ctx.font = '500 30px Inter';
    wrapText(ctx, 'Import the games you remember before the new season starts making more.', 86, 760, 600, 46, 3);
    ctx.drawImage(stadiumTicket, 570, 660, 500, 500);
    footer(ctx, true, 'KICKOFF · SEPTEMBER 9', 'START YOUR ARCHIVE');
    write(canvas, '04-one-week-build-history.png');
  }

  // 05 — Opening Night
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, false);
    wordmark(ctx, 80, 78, false);
    smallLabel(ctx, 'Opening night', 790, 116, MUTED, 16, 2.4);
    headline(ctx, ['COLLEGE BIAS', 'DOES NOT TAKE', 'WEDNESDAYS OFF.'], 80, 262, 920, { size: 103, gap: 102, colors: [INK, INK, GOLD] });

    fillTicket(ctx, 78, 624, 924, 430, INK, GOLD, true);
    smallLabel(ctx, '2026 NFL Kickoff', 132, 700, GOLD, 16, 2.8);
    ctx.fillStyle = PAPER;
    ctx.font = '400 105px Anton';
    ctx.fillText('NE  @  SEA', 132, 850);
    ctx.fillStyle = 'rgba(247,245,241,0.7)';
    ctx.font = '700 25px Inter';
    ctx.fillText('WED · SEP 9 · 8:20 PM ET', 136, 932);
    ctx.fillStyle = GOLD;
    ctx.font = '700 21px Inter';
    ctx.fillText('WHICH SEC FANBASE CLAIMS THE FIRST WIN?', 136, 1002);
    footer(ctx, false, 'THE SEASON STARTS TONIGHT.', 'REPLY WITH YOUR SCHOOL');
    write(canvas, '05-opening-night-college-bias.png');
  }

  // 06 — Down Under
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, true);
    wordmark(ctx, 80, 78, true);
    smallLabel(ctx, 'Melbourne / Week 1', 705, 116, GOLD, 16, 2.4);
    drawGlobe(ctx, 790, 720, 330);
    headline(ctx, ['FOOTBALL WENT', 'DOWN UNDER.'], 80, 310, 920, { size: 116, gap: 116, colors: [PAPER, GOLD] });
    ctx.fillStyle = 'rgba(247,245,241,0.76)';
    ctx.font = '500 30px Inter';
    wrapText(ctx, 'The game crossed an ocean. The college arguments made the trip. Who are you claiming?', 86, 582, 600, 47, 4);
    fillTicket(ctx, 120, 840, 840, 220, PAPER, GOLD, true);
    ctx.fillStyle = INK;
    ctx.font = '400 64px Anton';
    ctx.fillText('SF  @  LA', 176, 952);
    ctx.fillStyle = MUTED;
    ctx.font = '700 21px Inter';
    ctx.fillText('THU · SEP 10 · 8:35 PM ET · MELBOURNE', 180, 1014);
    footer(ctx, true, 'FOOTBALL HAS A PASSPORT.', 'PICK A SIDE');
    write(canvas, '06-sec-after-dark-down-under.png');
  }

  // 07 — Southern Six-Pack
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, false);
    wordmark(ctx, 80, 78, false);
    smallLabel(ctx, 'Sunday / 1 PM ET', 750, 116, MUTED, 16, 2.4);
    headline(ctx, ['THE SOUTHERN', 'SIX-PACK.'], 80, 286, 900, { size: 130, gap: 126, colors: [INK, GOLD] });
    const games = ['CHI @ CAR', 'TB @ CIN', 'ATL @ PIT', 'NYJ @ TEN', 'NO @ DET', 'BUF @ HOU'];
    games.forEach((game, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      drawMatchRow(ctx, 80 + col * 470, 520 + row * 126, 440, game, (index + row) % 2 === 0, null);
    });
    ctx.fillStyle = INK;
    ctx.font = '400 55px Anton';
    ctx.fillText('ONE BIG SCREEN. PICK IT.', 80, 1004);
    ctx.fillStyle = MUTED;
    ctx.font = '500 27px Inter';
    ctx.fillText('Your answer will be judged by the group chat.', 84, 1060);
    footer(ctx, false, 'SUNDAY · SEPTEMBER 13', 'NAME THE GAME');
    write(canvas, '07-southern-six-pack.png');
  }

  // 08 — School First / NFL Second
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, true);
    wordmark(ctx, 80, 78, true);
    smallLabel(ctx, 'Sunday Night roll call', 670, 116, GOLD, 16, 2.4);
    headline(ctx, ['SCHOOL FIRST.', 'NFL TEAM SECOND.'], 80, 296, 910, { size: 122, gap: 124, colors: [PAPER, GOLD] });
    fillTicket(ctx, 78, 610, 924, 460, PAPER, GOLD, true);
    ctx.fillStyle = INK;
    ctx.font = '400 54px Anton';
    ctx.fillText('SATURDAYS:', 136, 736);
    ctx.strokeStyle = 'rgba(17,18,20,0.32)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(430, 726); ctx.lineTo(914, 726); ctx.stroke();
    ctx.fillText('SUNDAYS:', 136, 860);
    ctx.beginPath(); ctx.moveTo(430, 850); ctx.lineTo(914, 850); ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = '700 22px Inter';
    ctx.fillText('DROP BOTH. LET THE TIMELINE JUDGE.', 136, 970);
    footer(ctx, true, 'DAL @ NYG · 8:20 PM ET', 'ROLL CALL');
    write(canvas, '08-school-first-nfl-second.png');
  }

  // 09 — Monday Night Receipts
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, false);
    wordmark(ctx, 80, 78, false);
    smallLabel(ctx, 'Monday night', 805, 116, MUTED, 16, 2.4);
    headline(ctx, ['THE GAME ENDS.', 'THE RECEIPT', 'DOES NOT.'], 80, 270, 900, { size: 112, gap: 110, colors: [INK, INK, GOLD] });
    fillTicket(ctx, 78, 650, 924, 406, INK, GOLD, true);
    smallLabel(ctx, 'Week 1 / Monday night', 136, 724, GOLD, 15, 2.4);
    ctx.fillStyle = PAPER;
    ctx.font = '400 100px Anton';
    ctx.fillText('DEN  @  KC', 136, 870);
    ctx.fillStyle = 'rgba(247,245,241,0.72)';
    ctx.font = '700 24px Inter';
    ctx.fillText('MON · SEP 14 · 8:15 PM ET', 140, 944);
    ctx.fillStyle = GOLD;
    ctx.font = '700 20px Inter';
    ctx.fillText('HAVE YOU SEEN EITHER ONE LIVE?', 140, 1008);
    footer(ctx, false, 'LOG IT IN WITNESSED.', 'LINK IN BIO');
    write(canvas, '09-monday-night-receipts.png');
  }

  // 10 — I-85 Group Chat Civil War
  {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    background(ctx, true);
    wordmark(ctx, 80, 78, true);
    smallLabel(ctx, 'Week 2 / Regional office', 650, 116, GOLD, 16, 2.4);
    headline(ctx, ['I-85 GROUP CHAT', 'CIVIL WAR.'], 80, 302, 900, { size: 120, gap: 122, colors: [PAPER, GOLD] });
    ctx.fillStyle = 'rgba(247,245,241,0.75)';
    ctx.font = '500 30px Inter';
    wrapText(ctx, 'Charlotte versus Atlanta. Which side becomes unbearable first?', 84, 548, 820, 46, 3);
    fillTicket(ctx, 140, 724, 800, 330, PAPER, GOLD, true);
    ctx.fillStyle = INK;
    ctx.font = '400 104px Anton';
    ctx.fillText('CAR  @  ATL', 196, 884);
    ctx.fillStyle = MUTED;
    ctx.font = '700 23px Inter';
    ctx.fillText('SUN · SEP 20 · 1:00 PM ET', 200, 962);
    footer(ctx, true, 'THE ARGUMENT STARTS NOW.', 'PICK A SIDE');
    write(canvas, '10-i85-group-chat-civil-war.png');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
