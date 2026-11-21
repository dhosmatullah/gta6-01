// render.js — all drawing: the 2.5D city (extruded pastel towers, neon signs,
// palms, beach and bay), vehicles, people, effects and the night-light pass.
import { CONFIG, PALETTE } from './config.js';
import { clamp, lerp } from './random.js';
import { PITCH, WORLD_W, WORLD_H } from './city.js';

// Lighting state for an hour of day: 0 = full day, 1 = full night, plus a warm
// sunset glow factor around 17.5–19.5h.
export function lightingAt(hour) {
  let darkness = 0;
  if (hour >= 19.5 || hour < 5) darkness = 0.62;
  else if (hour >= 17.5) darkness = lerp(0.08, 0.62, (hour - 17.5) / 2);
  else if (hour >= 5 && hour < 7.5) darkness = lerp(0.62, 0, (hour - 5) / 2.5);
  else darkness = 0.05;
  const sunset = hour >= 16.5 && hour <= 20 ? Math.sin(((hour - 16.5) / 3.5) * Math.PI) : 0;
  return { darkness, sunset };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function drawGround(ctx, city, view, time) {
  const { x0, y0, x1, y1 } = view;
  // beyond the city is open bay water; inside it, sidewalk / ground tone
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = PALETTE.sidewalk;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // block interiors
  for (let cx = 0; cx < CONFIG.COLS; cx++) {
    for (let cy = 0; cy < CONFIG.ROWS; cy++) {
      const bx = CONFIG.ROAD + cx * PITCH, by = CONFIG.ROAD + cy * PITCH;
      if (bx > x1 || by > y1 || bx + CONFIG.BLOCK < x0 || by + CONFIG.BLOCK < y0) continue;
      ctx.fillStyle = PALETTE.plaza;
      ctx.fillRect(bx, by, CONFIG.BLOCK, CONFIG.BLOCK);
    }
  }
  for (const p of city.parks) { ctx.fillStyle = PALETTE.grass; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.fillStyle = PALETTE.grassDark; ctx.fillRect(p.x + 14, p.y + 14, p.w - 28, 10); ctx.fillRect(p.x + 14, p.y + p.h - 24, p.w - 28, 10); }
  for (const l of city.lots) {
    ctx.fillStyle = PALETTE.asphaltDark; ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.strokeRect(l.x + 22 + i * 62, l.y + 30 + j * 92, 52, 80);
  }
  // roads
  ctx.fillStyle = PALETTE.asphalt;
  for (let i = 0; i <= CONFIG.COLS; i++) ctx.fillRect(i * PITCH, 0, CONFIG.ROAD, CONFIG.ROWS * PITCH + CONFIG.ROAD);
  for (let j = 0; j <= CONFIG.ROWS; j++) ctx.fillRect(0, j * PITCH, WORLD_W, CONFIG.ROAD);
  // lane dashes
  ctx.strokeStyle = PALETTE.laneMark; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  ctx.beginPath();
  for (let i = 0; i <= CONFIG.COLS; i++) { ctx.moveTo(i * PITCH + CONFIG.ROAD / 2, 0); ctx.lineTo(i * PITCH + CONFIG.ROAD / 2, CONFIG.ROWS * PITCH + CONFIG.ROAD); }
  for (let j = 0; j <= CONFIG.ROWS; j++) { ctx.moveTo(0, j * PITCH + CONFIG.ROAD / 2); ctx.lineTo(WORLD_W, j * PITCH + CONFIG.ROAD / 2); }
  ctx.stroke(); ctx.setLineDash([]);
  // crosswalks
  ctx.fillStyle = 'rgba(240,240,240,0.5)';
  for (let i = 0; i <= CONFIG.COLS; i++) for (let j = 0; j <= CONFIG.ROWS; j++) {
    const ix = i * PITCH, iy = j * PITCH;
    for (let s = 0; s < 4; s++) { ctx.fillRect(ix + 8 + s * 22, iy - 12, 12, 10); ctx.fillRect(ix + 8 + s * 22, iy + CONFIG.ROAD + 2, 12, 10); }
  }
  // beach + bay
  const sandTop = CONFIG.ROWS * PITCH + CONFIG.ROAD;
  ctx.fillStyle = PALETTE.sand; ctx.fillRect(0, sandTop, WORLD_W, 120);
  ctx.fillStyle = '#e6c878'; ctx.fillRect(0, sandTop, WORLD_W, 8);
  const waterTop = sandTop + 120;
  const grad = ctx.createLinearGradient(0, waterTop, 0, WORLD_H);
  grad.addColorStop(0, PALETTE.water); grad.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = grad; ctx.fillRect(0, waterTop, WORLD_W, WORLD_H - waterTop);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x < WORLD_W; x += 90) {
    const wy = waterTop + 16 + ((x * 7) % 50);
    ctx.moveTo(x, wy + Math.sin(time * 1.4 + x * 0.05) * 3);
    ctx.quadraticCurveTo(x + 22, wy - 5 + Math.sin(time * 1.4 + x * 0.05) * 3, x + 44, wy + Math.sin(time * 1.4 + x * 0.05) * 3);
  }
  ctx.stroke();
  // pier
  ctx.fillStyle = '#8a6b48'; ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  ctx.fillStyle = '#77572f'; for (let x = city.pier.x + 8; x < city.pier.x + city.pier.w; x += 24) ctx.fillRect(x, city.pier.y, 4, city.pier.h);
}

function drawBuilding(ctx, b, light) {
  const h = b.height;
  // shadow to the south-east
  ctx.fillStyle = 'rgba(30,20,40,0.25)';
  ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
  // extruded south + east faces
  ctx.fillStyle = shade(b.color, 0.62);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h - h); ctx.lineTo(b.x, b.y + b.h - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(b.color, 0.78);
  ctx.beginPath();
  ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h - h); ctx.lineTo(b.x + b.w, b.y - h); ctx.closePath(); ctx.fill();
  // windows on the south face
  const cols = Math.max(2, Math.floor(b.w / 22)), rows = Math.max(1, Math.floor(h / 15));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const lit = ((i * 31 + j * 57 + Math.floor(b.seed)) % 5) < (light.darkness > 0.3 ? 3 : 1);
    ctx.fillStyle = lit && light.darkness > 0.3 ? '#ffd76a' : 'rgba(40,50,70,0.55)';
    ctx.fillRect(b.x + 7 + i * 22, b.y + b.h - h + 6 + j * 15, 10, 8);
  }
  // roof (top face, shifted up by height)
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y - h, b.w, b.h);
  ctx.fillStyle = shade(b.color, 0.88);
  ctx.fillRect(b.x + 6, b.y - h + 6, b.w - 12, b.h - 12);
  ctx.fillStyle = 'rgba(90,70,60,0.5)';
  const acx = b.x + 14 + (b.seed % (Math.max(20, b.w - 50)));
  ctx.fillRect(acx, b.y - h + 14, 20, 14);
  ctx.fillRect(b.x + b.w - 34, b.y - h + b.h - 30, 16, 12);
  // neon sign strip along the roof's south edge
  ctx.fillStyle = b.neon;
  ctx.fillRect(b.x, b.y - h + b.h - 4, b.w, 4);
  if (light.darkness > 0.25) {
    ctx.save();
    ctx.globalAlpha = (light.darkness - 0.2) * 0.5;
    ctx.shadowColor = b.neon; ctx.shadowBlur = 18;
    ctx.fillRect(b.x, b.y - h + b.h - 4, b.w, 4);
    ctx.restore();
  }
}

function drawProp(ctx, p, light, time) {
  if (p.kind === 'palm') {
    ctx.strokeStyle = '#7a5a38'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + 4, p.y - 14, p.x + 8, p.y - 24 * p.s); ctx.stroke();
    ctx.strokeStyle = '#2e9e5b'; ctx.lineWidth = 3.4;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + p.x * 0.01 + Math.sin(time * 0.8 + p.x) * 0.05;
      ctx.beginPath(); ctx.moveTo(p.x + 8, p.y - 24 * p.s);
      ctx.quadraticCurveTo(p.x + 8 + Math.cos(a) * 13 * p.s, p.y - 24 * p.s + Math.sin(a) * 6 - 4, p.x + 8 + Math.cos(a) * 21 * p.s, p.y - 24 * p.s + Math.sin(a) * 11 + 3);
      ctx.stroke();
    }
  } else if (p.kind === 'lamp') {
    ctx.fillStyle = '#444'; ctx.fillRect(p.x - 2, p.y - 16, 4, 16);
    ctx.fillStyle = light.darkness > 0.3 ? '#ffe9a0' : '#ddd';
    ctx.beginPath(); ctx.arc(p.x, p.y - 18, 4, 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'bench') {
    ctx.fillStyle = '#8a6b48'; ctx.fillRect(p.x - 11, p.y - 4, 22, 8);
    ctx.fillStyle = '#77572f'; ctx.fillRect(p.x - 11, p.y - 8, 22, 3);
  } else if (p.kind === 'umbrella') {
    ctx.fillStyle = 'rgba(30,20,40,0.18)'; ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 6, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.hue || '#ff2e88';
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 14); ctx.lineTo(p.x - 15, p.y + 2); ctx.lineTo(p.x + 15, p.y + 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y - 14); ctx.lineTo(p.x, p.y + 8); ctx.stroke();
  }
}

export function drawCar(ctx, car, light) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // shadow
  ctx.fillStyle = 'rgba(20,15,30,0.3)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  // body
  const dmg = car.health < 55;
  ctx.fillStyle = car.kind === 'police' ? '#f4f6f8' : car.color;
  roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 6); ctx.fill();
  if (car.kind === 'police') { ctx.fillStyle = '#1d3557'; ctx.fillRect(-car.w / 2, -car.h / 2, 12, car.h); ctx.fillRect(6, -car.h / 2, 8, car.h); }
  if (car.kind === 'taxi') { ctx.fillStyle = '#222'; ctx.fillRect(-4, -5, 9, 10); ctx.fillStyle = '#ffd166'; ctx.fillRect(-3, -4, 7, 8); }
  // cabin + glass
  ctx.fillStyle = '#22314a';
  roundRect(ctx, -car.w * 0.18, -car.h / 2 + 3, car.w * 0.36, car.h - 6, 4); ctx.fill();
  ctx.fillStyle = 'rgba(160,220,255,0.5)';
  ctx.fillRect(car.w * 0.1, -car.h / 2 + 4, 4, car.h - 8);
  // wheels
  ctx.fillStyle = '#14141c';
  for (const [wx, wy] of [[-car.w / 2 + 7, -car.h / 2 - 2], [car.w / 2 - 7, -car.h / 2 - 2], [-car.w / 2 + 7, car.h / 2 - 2], [car.w / 2 - 7, car.h / 2 - 2]]) ctx.fillRect(wx - 4, wy, 8, 4);
  // lights
  ctx.fillStyle = '#fff6c9'; ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 2, 3, 5); ctx.fillRect(car.w / 2 - 2, car.h / 2 - 7, 3, 5);
  ctx.fillStyle = '#ff3355'; ctx.fillRect(-car.w / 2 - 1, -car.h / 2 + 2, 3, 5); ctx.fillRect(-car.w / 2 - 1, car.h / 2 - 7, 3, 5);
  if (car.kind === 'police') {
    const phase = (car.sirenPhase % 1) < 0.5;
    ctx.fillStyle = phase ? '#ff2244' : '#2266ff';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = phase ? '#ff2244' : '#2266ff';
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  if (dmg) { ctx.fillStyle = 'rgba(40,40,40,0.5)'; ctx.beginPath(); ctx.arc(car.w / 4, 0, 6 + (100 - car.health) * 0.08, 0, Math.PI * 2); ctx.fill(); }
  if (car.flash > 0) { ctx.globalAlpha = Math.min(1, car.flash * 2); ctx.fillStyle = '#fff'; roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 6); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}

export function drawPed(ctx, ped, time) {
  if (ped.down > 0) {
    ctx.save(); ctx.translate(ped.x, ped.y); ctx.rotate(ped.angle || 0);
    ctx.fillStyle = ped.shirt; ctx.fillRect(-10, -4, 20, 8);
    ctx.fillStyle = ped.skin; ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); return;
  }
  const bob = Math.sin(ped.phase) * 2;
  ctx.fillStyle = 'rgba(20,15,30,0.25)'; ctx.beginPath(); ctx.ellipse(ped.x, ped.y + 6, 8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ped.pants; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(ped.x, ped.y + 2); ctx.lineTo(ped.x - bob, ped.y + 8); ctx.moveTo(ped.x, ped.y + 2); ctx.lineTo(ped.x + bob, ped.y + 8); ctx.stroke();
  ctx.fillStyle = ped.shirt; ctx.beginPath(); ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin; ctx.beginPath(); ctx.arc(ped.x, ped.y - 2, 4.6, 0, Math.PI * 2); ctx.fill();
  if (ped.state === 'flee') { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', ped.x, ped.y - 14); }
}

export function drawPlayer(ctx, player, time) {
  const bob = Math.sin(player.walkPhase) * 2.2;
  ctx.fillStyle = 'rgba(20,15,30,0.3)'; ctx.beginPath(); ctx.ellipse(player.x, player.y + 7, 9, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle + Math.PI / 2);
  ctx.strokeStyle = '#26355e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-bob, 10); ctx.moveTo(0, 2); ctx.lineTo(bob, 10); ctx.stroke();
  // floral shirt — Rio's signature look
  ctx.fillStyle = '#ff5d8f'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd166';
  for (const [fx, fy] of [[-3, -3], [3, 1], [-1, 4], [4, -4]]) { ctx.beginPath(); ctx.arc(fx, fy, 1.7, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#f1c27d'; ctx.lineWidth = 3.6;
  const aimArm = player.hasPistol ? 12 : 8;
  ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(4, -aimArm); ctx.stroke();
  if (player.hasPistol) { ctx.fillStyle = '#22242c'; ctx.fillRect(2.6, -aimArm - 6, 3, 7); }
  ctx.fillStyle = '#8d5524'; ctx.beginPath(); ctx.arc(0, -1, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d1d26'; ctx.beginPath(); ctx.arc(0, -3.4, 5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Painter-sorted world pass: buildings, props, cars, peds and the player share
// one y-sorted list so tall towers occlude what walks behind them.
export function drawWorld(ctx, game, view, time) {
  const city = game.city;
  const light = lightingAt(game.hour);
  drawGround(ctx, city, view, time);
  const items = [];
  for (const b of city.buildings) if (b.x + b.w > view.x0 && b.x < view.x1 && b.y + b.h > view.y0 && b.y - b.height < view.y1) items.push({ y: b.y + b.h, draw: () => drawBuilding(ctx, b, light) });
  for (const p of city.props) if (p.x > view.x0 - 40 && p.x < view.x1 + 40 && p.y > view.y0 - 40 && p.y < view.y1 + 40) items.push({ y: p.y, draw: () => drawProp(ctx, p, light, time) });
  for (const f of game.flamingos) if (!f.taken) items.push({ y: f.y, draw: () => drawFlamingo(ctx, f, time) });
  for (const car of game.cars) if (!car.dead) items.push({ y: car.y + 10, draw: () => drawCar(ctx, car, light) });
  for (const car of game.police) items.push({ y: car.y + 10, draw: () => drawCar(ctx, car, light) });
  for (const ped of game.peds) items.push({ y: ped.y + 6, draw: () => drawPed(ctx, ped, time) });
  if (!game.player.inCar) items.push({ y: game.player.y + 6, draw: () => drawPlayer(ctx, game.player, time) });
  // mission drops / markers that sit in the world
  for (const m of game.worldMarkers) items.push({ y: m.y, draw: () => drawWorldMarker(ctx, m, time) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
}

export function drawFlamingo(ctx, f, time) {
  const bob = Math.sin(time * 2.4 + f.x) * 2.4;
  ctx.save(); ctx.translate(f.x, f.y + bob);
  ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 12); ctx.moveTo(0, 4); ctx.lineTo(5, 12); ctx.stroke();
  ctx.fillStyle = '#ff5da2'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.6, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -5, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd166'; ctx.fillRect(11, -5.6, 4, 2);
  ctx.restore();
}

export function drawWorldMarker(ctx, m, time) {
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  ctx.save(); ctx.translate(m.x, m.y);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = m.color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.22; ctx.fillStyle = m.color;
  ctx.beginPath(); ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = m.color;
  ctx.beginPath(); ctx.moveTo(0, -44 - Math.sin(time * 3) * 4); ctx.lineTo(-9, -30 - Math.sin(time * 3) * 4); ctx.lineTo(9, -30 - Math.sin(time * 3) * 4); ctx.closePath(); ctx.fill();
  if (m.label) { ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.strokeText(m.label, 0, -52 - Math.sin(time * 3) * 4); ctx.fillText(m.label, 0, -52 - Math.sin(time * 3) * 4); }
  ctx.restore();
}

// Night light pass, drawn additively over the darkness overlay.
export function drawNightLights(ctx, game, light) {
  if (light.darkness < 0.22) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const p of game.city.props) if (p.kind === 'lamp') glow(p.x, p.y - 18, 52, 'rgba(255,200,90,0.55)', 0.5);
  const headlight = (car) => {
    if (car.dead) return;
    glow(car.x + Math.cos(car.angle) * 30, car.y + Math.sin(car.angle) * 30, 66, 'rgba(255,240,190,0.5)', 0.42);
    if (car.kind === 'police') glow(car.x, car.y, 60, (car.sirenPhase % 1) < 0.5 ? 'rgba(255,40,70,0.5)' : 'rgba(50,110,255,0.5)', 0.4);
  };
  for (const car of game.cars) headlight(car);
  for (const car of game.police) headlight(car);
  if (!game.player.inCar) glow(game.player.x, game.player.y, 44, 'rgba(255,220,170,0.35)', 0.3);
  ctx.restore();
}
