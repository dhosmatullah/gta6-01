// hud.js — everything drawn over the world: HUD bars, wanted stars, the mission
// panel, prompts and toasts, the minimap, and the full-screen menus.
import { CONFIG } from './config.js';
import { clamp } from './random.js';
import { WORLD_W, WORLD_H } from './city.js';
import { roundRect } from './render.js';

export function formatMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function formatClock(hour) {
  const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawStars(ctx, x, y, stars, blink) {
  for (let i = 0; i < 5; i++) {
    const cx = x + i * 30, cy = y;
    const active = i < stars;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = active ? (blink && stars >= 4 ? '#ff4455' : '#ffd700') : 'rgba(255,255,255,0.22)';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let p = 0; p < 10; p++) {
      const a = -Math.PI / 2 + p * Math.PI / 5;
      const r = p % 2 === 0 ? 11 : 4.8;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

export function drawMinimap(ctx, game, x, y, size) {
  const s = size / WORLD_W;
  ctx.save();
  ctx.beginPath(); roundRect(ctx, x, y, size, size * (WORLD_H / WORLD_W), 12); ctx.clip();
  ctx.fillStyle = '#2e4a3a'; ctx.fillRect(x, y, size, size * (WORLD_H / WORLD_W));
  // road bands by world coords
  ctx.fillStyle = '#4a4d61';
  for (let i = 0; i <= CONFIG.COLS; i++) ctx.fillRect(x + i * (CONFIG.BLOCK + CONFIG.ROAD) * s, y, CONFIG.ROAD * s, WORLD_H * s);
  for (let j = 0; j <= CONFIG.ROWS; j++) ctx.fillRect(x, y + j * (CONFIG.BLOCK + CONFIG.ROAD) * s, WORLD_W * s, CONFIG.ROAD * s);
  const sandTop = (CONFIG.ROWS * (CONFIG.BLOCK + CONFIG.ROAD) + CONFIG.ROAD) * s;
  ctx.fillStyle = '#e8cf8a'; ctx.fillRect(x, y + sandTop, size, 120 * s);
  ctx.fillStyle = '#14607f'; ctx.fillRect(x, y + sandTop + 120 * s, size, size);
  const dot = (wx, wy, color, r = 3) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + wx * s, y + wy * s, r, 0, Math.PI * 2); ctx.fill(); };
  for (const car of game.cars) if (!car.dead && !car.parked) dot(car.x, car.y, 'rgba(230,230,230,0.7)', 1.8);
  for (const car of game.police) { dot(car.x, car.y, (performance.now() / 300 | 0) % 2 ? '#ff3355' : '#4488ff', 3.2); }
  const obj = game.objective;
  if (obj && obj.x !== null && obj.x !== undefined) {
    const pulse = 3.6 + Math.sin(performance.now() * 0.008) * 1.2;
    dot(obj.x, obj.y, '#ffd700', pulse);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x + obj.x * s, y + obj.y * s, pulse + 3.4, 0, Math.PI * 2); ctx.stroke();
  }
  for (const f of game.flamingos) if (!f.taken) dot(f.x, f.y, '#ff5da2', 2);
  // player arrow
  const p = game.player;
  const px = x + p.x * s, py = y + p.y * s;
  const ang = p.inCar ? p.inCar.angle : p.angle;
  ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.6); ctx.lineTo(-5, 4.6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(10,10,20,0.65)'; ctx.lineWidth = 3;
  roundRect(ctx, x, y, size, size * (WORLD_H / WORLD_W), 12); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('PORT SOLANA', x + 8, y + 14);
}

export function drawHUD(ctx, game, W, H) {
  const p = game.player;
  // top-left: money + clock + district
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,12,24,0.55)';
  roundRect(ctx, 14, 12, 218, 64, 10); ctx.fill();
  ctx.fillStyle = '#7dff9a'; ctx.font = 'bold 24px system-ui';
  ctx.fillText(formatMoney(p.money), 26, 40);
  ctx.fillStyle = '#e8ecf4'; ctx.font = '13px system-ui';
  ctx.fillText(`${formatClock(game.hour)}  ·  ${game.district}`, 26, 62);
  if (p.hasPistol) { ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px system-ui'; ctx.fillText(`PISTOL · ${p.ammo}`, 150, 40); }
  // top-right: wanted stars
  if (game.stars > 0 || game.heat > 0) drawStars(ctx, W - 178, 34, game.stars, (performance.now() / 400 | 0) % 2 === 0);
  // health bar bottom-left above minimap area
  const hx = 14, hy = H - 30;
  ctx.fillStyle = 'rgba(10,12,24,0.55)'; roundRect(ctx, hx, hy - 14, 190, 22, 7); ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#3ddc74' : '#ff4455';
  roundRect(ctx, hx + 4, hy - 10, 182 * clamp(p.health / 100, 0, 1), 14, 5); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.fillText('RIO', hx + 8, hy + 1);
  if (p.inCar) {
    ctx.fillStyle = 'rgba(10,12,24,0.55)'; roundRect(ctx, hx + 200, hy - 14, 170, 22, 7); ctx.fill();
    ctx.fillStyle = p.inCar.health > 30 ? '#57b6ff' : '#ff4455';
    roundRect(ctx, hx + 204, hy - 10, 128 * clamp(p.inCar.health / 100, 0, 1), 14, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText('CAR', hx + 208, hy + 1);
    ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.36)} km/h`, hx + 362, hy + 1);
    ctx.textAlign = 'left';
  }
  // minimap bottom-right
  drawMinimap(ctx, game, W - 214, H - 214 * (WORLD_H / WORLD_W) - 14, 200);
  // mission panel top-center
  const obj = game.objective;
  if (obj) {
    ctx.font = 'bold 15px system-ui';
    const title = game.missionTitle ? `${game.missionTitle}` : 'PORT SOLANA';
    const tw = Math.max(ctx.measureText(title).width, ctx.measureText(obj.text).width) + 36;
    ctx.fillStyle = 'rgba(10,12,24,0.6)';
    roundRect(ctx, (W - tw) / 2, 12, tw, game.missionTitle ? 52 : 34, 10); ctx.fill();
    ctx.textAlign = 'center';
    if (game.missionTitle) { ctx.fillStyle = '#ffd700'; ctx.fillText(title, W / 2, 32); }
    ctx.fillStyle = '#fff'; ctx.font = '13.5px system-ui';
    ctx.fillText(obj.text, W / 2, game.missionTitle ? 54 : 34);
    if (game.missionTimer !== null && game.missionTimer !== undefined) {
      ctx.fillStyle = game.missionTimer < 15 ? '#ff5566' : '#ffd166';
      ctx.font = 'bold 17px system-ui';
      ctx.fillText(`${Math.ceil(game.missionTimer)}s`, W / 2, game.missionTitle ? 78 : 60);
    }
    ctx.textAlign = 'left';
  }
  // center prompt
  if (game.prompt) {
    ctx.font = 'bold 16px system-ui';
    const tw = ctx.measureText(game.prompt).width + 34;
    ctx.fillStyle = 'rgba(10,12,24,0.72)';
    roundRect(ctx, (W - tw) / 2, H - 92, tw, 34, 9); ctx.fill();
    ctx.fillStyle = '#ffe27a'; ctx.textAlign = 'center';
    ctx.fillText(game.prompt, W / 2, H - 70);
    ctx.textAlign = 'left';
  }
  // toasts
  let ty = 96;
  for (const t of game.toasts) {
    ctx.globalAlpha = clamp(t.life, 0, 1);
    ctx.font = 'bold 15px system-ui';
    const tw = ctx.measureText(t.text).width + 28;
    ctx.fillStyle = 'rgba(10,12,24,0.66)';
    roundRect(ctx, 14, ty, tw, 30, 8); ctx.fill();
    ctx.fillStyle = t.color || '#fff';
    ctx.fillText(t.text, 28, ty + 20);
    ctx.globalAlpha = 1;
    ty += 38;
  }
  // radio / now-playing style ticker bottom center when driving
  if (p.inCar && game.stars === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('♪  SOLANA FM 101.3 — "Neon Tide" by The Coral Club  ♪', W / 2, H - 12);
    ctx.textAlign = 'left';
  }
}

export function drawObjectiveArrow(ctx, game, cam, W, H) {
  const obj = game.objective;
  if (!obj || obj.x === null || obj.x === undefined) return;
  const sx = (obj.x - cam.x) * cam.zoom + W / 2;
  const sy = (obj.y - cam.y) * cam.zoom + H / 2;
  if (sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30) return; // on screen already
  const cx = W / 2, cy = H / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = clamp(sx, 44, W - 44), ey = clamp(sy, 44, H - 44);
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
  ctx.fillStyle = '#ffd700'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  const d = Math.round(Math.hypot(obj.x - game.player.x, obj.y - game.player.y) / 10);
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(`${d}m`, ex, ey + 26);
  ctx.textAlign = 'left';
}

// --- menus -------------------------------------------------------------------
export function drawTitle(ctx, W, H, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(38,10,54,0.25)');
  grad.addColorStop(0.55, 'rgba(120,20,70,0.18)');
  grad.addColorStop(1, 'rgba(10,8,26,0.62)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = 34;
  ctx.fillStyle = '#ff5da2';
  ctx.font = '900 84px system-ui';
  ctx.fillText('NEON PALMS', W / 2, H * 0.3);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 26;
  ctx.fillStyle = '#aef4ff';
  ctx.font = '900 40px system-ui';
  ctx.fillText('P O R T   S O L A N A', W / 2, H * 0.3 + 56);
  ctx.restore();
  ctx.fillStyle = '#ffe9f4'; ctx.font = '17px system-ui';
  ctx.fillText('An original open-world crime caper — steal cars, run jobs, outrun the Solana PD.', W / 2, H * 0.3 + 96);
  const pulse = 0.75 + Math.sin(time * 3) * 0.25;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 22px system-ui';
  ctx.fillText('CLICK or press ENTER to play', W / 2, H * 0.62);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(240,244,255,0.92)'; ctx.font = '14.5px system-ui';
  const lines = [
    'WASD / Arrows — walk & drive      F — enter / steal car      E — talk / interact / start job',
    'Mouse — aim · Click — punch / shoot      Shift — sprint      Space — handbrake',
    'M — mute      P — pause      Progress saves automatically in your browser',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.7 + i * 24));
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '12px system-ui';
  ctx.fillText('Every name, street and song in Port Solana is original. No relation to any other city, real or fictional.', W / 2, H - 22);
  ctx.textAlign = 'left';
}

export function drawCenterPanel(ctx, W, H, title, titleColor, lines, hint) {
  ctx.fillStyle = 'rgba(8,8,20,0.62)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.save(); ctx.shadowColor = titleColor; ctx.shadowBlur = 24;
  ctx.fillStyle = titleColor; ctx.font = '900 54px system-ui';
  ctx.fillText(title, W / 2, H * 0.36);
  ctx.restore();
  ctx.fillStyle = '#eef2ff'; ctx.font = '16.5px system-ui';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.46 + i * 27));
  if (hint) { ctx.fillStyle = '#ffd700'; ctx.font = 'bold 17px system-ui'; ctx.fillText(hint, W / 2, H * 0.46 + lines.length * 27 + 22); }
  ctx.textAlign = 'left';
}

export function drawBriefing(ctx, game, W, H) {
  const b = game.briefing;
  if (!b) return;
  ctx.fillStyle = 'rgba(8,8,20,0.55)'; ctx.fillRect(0, 0, W, H);
  const bw = Math.min(620, W - 60), bh = 208;
  const x = (W - bw) / 2, y = H * 0.3;
  ctx.fillStyle = 'rgba(14,16,32,0.94)';
  roundRect(ctx, x, y, bw, bh, 14); ctx.fill();
  ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 2; roundRect(ctx, x, y, bw, bh, 14); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd700'; ctx.font = 'bold 21px system-ui';
  ctx.fillText(b.title, x + 26, y + 40);
  ctx.fillStyle = '#ff8fb8'; ctx.font = 'bold 13px system-ui';
  ctx.fillText(b.giver.toUpperCase(), x + 26, y + 64);
  ctx.fillStyle = '#eef2ff'; ctx.font = '15.5px system-ui';
  wrapText(ctx, b.brief, x + 26, y + 94, bw - 52, 22);
  ctx.fillStyle = '#7dff9a'; ctx.font = 'bold 15px system-ui';
  ctx.fillText(`Reward: ${formatMoney(b.reward)}`, x + 26, y + bh - 42);
  ctx.fillStyle = '#ffe27a'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'right';
  ctx.fillText('Press E to accept · Q to walk away', x + bw - 26, y + bh - 42);
  ctx.textAlign = 'left';
}

export function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lineH; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}
