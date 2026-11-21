// entities.js — vehicles with road-following traffic AI, police pursuit AI and
// pedestrians who stroll the sidewalks and flee from trouble.
import { CONFIG, PALETTE } from './config.js';
import { mulberry32, randRange, pick, clamp, angleLerp, dist } from './random.js';
import { PITCH, WORLD_W, WORLD_H, roadCenterX, roadCenterY, circleHitsBuilding, moveWithCollision } from './city.js';

let CAR_ID = 1;
export function makeCar(x, y, angle, color, kind = 'traffic') {
  return {
    id: CAR_ID++, kind, x, y, angle, speed: 0, steer: 0,
    w: kind === 'sport' ? 46 : 42, h: 21,
    color, health: 100, driver: null, parked: false,
    laneDir: null, targetSpeed: 150, honk: 0, dead: false,
    flash: 0, sirenPhase: Math.random() * 6,
  };
}

export function carCorners(car) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const hw = car.w / 2, hh = car.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([lx, ly]) => ({ x: car.x + lx * c - ly * s, y: car.y + lx * s + ly * c }));
}

export function pointInCar(car, x, y) {
  const c = Math.cos(-car.angle), s = Math.sin(-car.angle);
  const dx = x - car.x, dy = y - car.y;
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) < car.w / 2 && Math.abs(ly) < car.h / 2;
}

// --- traffic -----------------------------------------------------------------
// Cars cruise the road grid: they hold a lane (right-hand traffic), pick a new
// heading at intersections, and brake for the car ahead.
export function spawnTraffic(city, rng) {
  const cars = [];
  for (let i = 0; i < CONFIG.TRAFFIC_COUNT; i++) {
    const vertical = rng() < 0.5;
    const laneOff = 24;
    let x, y, angle;
    if (vertical) {
      const ri = Math.floor(rng() * (CONFIG.COLS + 1));
      const dir = rng() < 0.5 ? 1 : -1;
      x = roadCenterX(ri) + (dir > 0 ? laneOff : -laneOff);
      y = randRange(rng, 60, WORLD_H - CONFIG.BEACH - 60);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const rj = Math.floor(rng() * (CONFIG.ROWS + 1));
      const dir = rng() < 0.5 ? 1 : -1;
      y = roadCenterY(rj) + (dir > 0 ? -laneOff : laneOff);
      x = randRange(rng, 60, WORLD_W - 60);
      angle = dir > 0 ? 0 : Math.PI;
    }
    const kind = rng() < 0.16 ? 'sport' : (rng() < 0.2 ? 'taxi' : 'traffic');
    const car = makeCar(x, y, angle, kind === 'taxi' ? '#ffd166' : pick(rng, PALETTE.carColors), kind);
    car.speed = randRange(rng, 60, 130);
    car.targetSpeed = randRange(rng, 120, 185);
    cars.push(car);
  }
  // Parked cars in lots and along streets
  for (const lot of city.lots) {
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const car = makeCar(lot.x + 34 + (i % 3) * 62, lot.y + 44 + Math.floor(i / 3) * 92, Math.PI / 2, pick(rng, PALETTE.carColors));
      car.parked = true;
      cars.push(car);
    }
  }
  return cars;
}

function nearestIntersection(car) {
  const snap = (v, count) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i <= count; i++) {
      const c = CONFIG.ROAD / 2 + i * PITCH;
      if (Math.abs(v - c) < bd) { bd = Math.abs(v - c); best = c; }
    }
    return best;
  };
  return { x: snap(car.x, CONFIG.COLS), y: snap(car.y, CONFIG.ROWS) };
}

export function updateTrafficCar(car, dt, allCars, rng) {
  if (car.parked || car.dead || car.driver === 'player') return;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  // brake for a vehicle ahead in the same lane
  let want = car.targetSpeed;
  for (const other of allCars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (ahead > 0 && ahead < 78 && side < 20) { want = Math.min(want, Math.max(0, (ahead - 52) * 3)); if (ahead < 56 && car.honk <= 0) car.honk = 1.6; }
  }
  car.honk -= dt;
  car.speed += clamp(want - car.speed, -260 * dt, 120 * dt);
  // at an intersection, sometimes turn (staying in the right-hand lane)
  const inter = nearestIntersection(car);
  const dInter = Math.hypot(inter.x - car.x, inter.y - car.y);
  if (dInter < 14 && !car.turnCooldown) {
    car.turnCooldown = 2.5;
    if (rng() < 0.42) {
      const turns = [car.angle + Math.PI / 2, car.angle - Math.PI / 2];
      car.targetAngle = turns[Math.floor(rng() * 2)];
    }
  }
  car.turnCooldown = Math.max(0, (car.turnCooldown || 0) - dt);
  if (car.targetAngle !== undefined && car.targetAngle !== null) {
    car.angle = angleLerp(car.angle, car.targetAngle, Math.min(1, dt * 3.2));
    if (Math.abs(((car.targetAngle - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.05) car.targetAngle = null;
  }
  // lane discipline: ease toward the correct lane offset of the road we are on
  const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
  const laneOff = 24;
  if (vertical) {
    const cx = roadCenterX(Math.round((car.x - CONFIG.ROAD / 2) / PITCH));
    const wantX = cx + (Math.sin(car.angle) > 0 ? laneOff : -laneOff);
    car.x += clamp(wantX - car.x, -60 * dt, 60 * dt);
  } else {
    const cy = roadCenterY(Math.round((car.y - CONFIG.ROAD / 2) / PITCH));
    const wantY = cy + (Math.cos(car.angle) > 0 ? -laneOff : laneOff);
    car.y += clamp(wantY - car.y, -60 * dt, 60 * dt);
  }
  car.x += fx * car.speed * dt;
  car.y += fy * car.speed * dt;
  // wrap around the world edges on roads
  if (car.x < -30) car.x = WORLD_W + 20; if (car.x > WORLD_W + 30) car.x = -20;
  if (car.y < -30) car.y = CONFIG.ROWS * PITCH + CONFIG.ROAD - 40;
  if (car.y > CONFIG.ROWS * PITCH + CONFIG.ROAD - 20) car.y = 10;
}

// --- police ------------------------------------------------------------------
export function spawnPolice(city, player, rng) {
  // arrive from a road edge a few hundred px from the player
  const a = rng() * Math.PI * 2;
  let x = clamp(player.x + Math.cos(a) * 520, 40, WORLD_W - 40);
  let y = clamp(player.y + Math.sin(a) * 520, 40, CONFIG.ROWS * PITCH + 40);
  const car = makeCar(x, y, a + Math.PI, '#f8f9fa', 'police');
  car.targetSpeed = 999;
  return car;
}

export function updatePoliceCar(car, dt, city, target) {
  const dx = target.x - car.x, dy = target.y - car.y;
  const d = Math.hypot(dx, dy) || 1;
  let wantAngle = Math.atan2(dy, dx);
  // obstacle feeler: if a building blocks the nose, steer around it
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  if (circleHitsBuilding(city, car.x + fx * 58, car.y + fy * 58, 16)) {
    wantAngle = car.angle + (car.id % 2 === 0 ? 1 : -1) * 1.15;
  }
  const diff = ((wantAngle - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  car.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
  const topSpeed = target.inCar ? 452 : 300;
  const want = d > 46 ? topSpeed : topSpeed * 0.4;
  car.speed += clamp(want - car.speed, -320 * dt, 190 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!circleHitsBuilding(city, nx, ny, 15)) { car.x = nx; car.y = ny; }
  else { car.speed *= 0.35; car.angle += 0.9 * dt * (car.id % 2 === 0 ? 1 : -1); }
  car.x = clamp(car.x, 16, WORLD_W - 16);
  car.y = clamp(car.y, 16, WORLD_H - 16);
  car.sirenPhase += dt * 9;
}

// --- pedestrians ---------------------------------------------------------------
export function spawnPeds(rng) {
  const peds = [];
  for (let i = 0; i < CONFIG.PED_COUNT; i++) {
    peds.push({
      x: randRange(rng, 40, WORLD_W - 40), y: randRange(rng, 40, CONFIG.ROWS * PITCH),
      tx: 0, ty: 0, hasTarget: false, speed: randRange(rng, 34, 62),
      shirt: pick(rng, PALETTE.shirtColors), skin: pick(rng, PALETTE.skinTones),
      pants: pick(rng, ['#2b2d42', '#5a4a3a', '#3a506b', '#6c757d', '#f1fa8c']),
      state: 'walk', panic: 0, down: 0, phase: rng() * 6, id: i,
    });
  }
  return peds;
}

function sidewalkTarget(rng) {
  // a point on a sidewalk: just inside a block edge or along a road edge
  const vertical = rng() < 0.5;
  if (vertical) {
    const ri = Math.floor(rng() * (CONFIG.COLS + 1));
    return { x: roadCenterX(ri) + (rng() < 0.5 ? -CONFIG.ROAD / 2 - 9 : CONFIG.ROAD / 2 + 9), y: randRange(rng, 30, CONFIG.ROWS * PITCH + 40) };
  }
  const rj = Math.floor(rng() * (CONFIG.ROWS + 1));
  return { x: randRange(rng, 30, WORLD_W - 30), y: roadCenterY(rj) + (rng() < 0.5 ? -CONFIG.ROAD / 2 - 9 : CONFIG.ROAD / 2 + 9) };
}

export function updatePed(ped, dt, city, danger, rng) {
  if (ped.down > 0) { ped.down -= dt; return; }
  ped.phase += dt * (ped.state === 'flee' ? 13 : 7);
  let tx = ped.tx, ty = ped.ty, speed = ped.speed;
  if (danger && dist(ped.x, ped.y, danger.x, danger.y) < 120) {
    ped.state = 'flee'; ped.panic = 1.6;
    const a = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    tx = ped.x + Math.cos(a) * 130; ty = ped.y + Math.sin(a) * 130; speed = 168;
  } else if (ped.panic > 0) { ped.panic -= dt; speed = 150; }
  else {
    ped.state = 'walk';
    if (!ped.hasTarget || dist(ped.x, ped.y, tx, ty) < 12) { const t = sidewalkTarget(rng); ped.tx = t.x; ped.ty = t.y; ped.hasTarget = true; }
    tx = ped.tx; ty = ped.ty;
  }
  const d = dist(ped.x, ped.y, tx, ty) || 1;
  const step = Math.min(d, speed * dt);
  const moved = moveWithCollision(city, ped.x, ped.y, ((tx - ped.x) / d) * step, ((ty - ped.y) / d) * step, 8);
  ped.angle = Math.atan2(ty - ped.y, tx - ped.x);
  ped.x = moved.x; ped.y = moved.y;
}

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, health: CONFIG.PLAYER_MAX_HEALTH, inCar: null,
    money: CONFIG.START_MONEY, hasPistol: false, ammo: 0, punchCd: 0, fireCd: 0,
    walkPhase: 0, dead: false, name: 'Rio Vega',
  };
}

export function makeFlamingos(city, rng) {
  const spots = [];
  const all = [...city.parks.map((p) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 })), ...city.lots.map((l) => ({ x: l.x + l.w / 2, y: l.y + l.h / 2 }))];
  for (let i = 0; i < CONFIG.FLAMINGO_COUNT; i++) {
    if (i < all.length) spots.push({ x: all[i].x + randRange(rng, -50, 50), y: all[i].y + randRange(rng, -50, 50), taken: false });
    else spots.push({ x: randRange(rng, 80, WORLD_W - 80), y: randRange(rng, 80, CONFIG.ROWS * PITCH), taken: false });
  }
  return spots;
}
