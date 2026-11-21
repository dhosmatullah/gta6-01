// city.js — generates Port Solana: a grid of sun-bleached blocks, neon hotels,
// parks, a marina and a beach, all procedural and original. Also answers the
// collision and road-network questions every other system asks.
import { CONFIG, PALETTE } from './config.js';
import { mulberry32, randRange, randInt, pick } from './random.js';

export const PITCH = CONFIG.BLOCK + CONFIG.ROAD;
export const WORLD_W = CONFIG.COLS * PITCH + CONFIG.ROAD;
export const WORLD_H = CONFIG.ROWS * PITCH + CONFIG.ROAD + CONFIG.BEACH;

const DISTRICTS = ['Palms District', 'Solana Row', 'Marina Mile', 'Old Port', 'Coral Heights', 'Sunset Strip', 'Flamingo Quarter'];
const BUILDING_NAMES = ['Hotel Brisa', 'Solana Suites', 'Palms Casino', 'Cafe Ola', 'Banco Solana', 'Neon Gym', 'Taller Chico', 'Marina Mall', 'Hotel Flamingo', 'Solana Bank', 'Club Sirena', 'Pizzeria Nonna', 'Hotel Ola Azul', 'Solana Motors', 'Farmacia Sol', 'Club Coral', 'Hotel Palma Real', 'Mercado Central'];

export function roadCenterX(i) { return CONFIG.ROAD / 2 + i * PITCH; } // i in 0..COLS
export function roadCenterY(j) { return CONFIG.ROAD / 2 + j * PITCH; } // j in 0..ROWS
export function isBeachY(y) { return y > CONFIG.ROWS * PITCH + CONFIG.ROAD - 6; }

export function buildCity(seed = 20261121) {
  const rng = mulberry32(seed);
  const buildings = []; // solid rects: {x,y,w,h,height,color,name,neon,district}
  const parks = [];
  const props = []; // {kind:'palm'|'lamp'|'bench'|'umbrella', x,y, hue}
  const lots = []; // parking lots with parked cars: {x,y}
  let nameIdx = 0;

  for (let cx = 0; cx < CONFIG.COLS; cx++) {
    for (let cy = 0; cy < CONFIG.ROWS; cy++) {
      const bx = CONFIG.ROAD + cx * PITCH;
      const by = CONFIG.ROAD + cy * PITCH;
      const district = DISTRICTS[(cx + cy * 2) % DISTRICTS.length];
      const roll = rng();
      if (roll < 0.13) { // a park block: grass, palms, benches, no building
        parks.push({ x: bx, y: by, w: CONFIG.BLOCK, h: CONFIG.BLOCK, district });
        for (let p = 0; p < 7; p++) props.push({ kind: 'palm', x: bx + randRange(rng, 22, CONFIG.BLOCK - 22), y: by + randRange(rng, 22, CONFIG.BLOCK - 22), s: randRange(rng, 0.8, 1.3) });
        for (let p = 0; p < 3; p++) props.push({ kind: 'bench', x: bx + randRange(rng, 30, CONFIG.BLOCK - 30), y: by + randRange(rng, 30, CONFIG.BLOCK - 30), s: 1 });
        continue;
      }
      if (roll < 0.2) { // a parking lot block
        lots.push({ x: bx, y: by, w: CONFIG.BLOCK, h: CONFIG.BLOCK, district });
        continue;
      }
      // 1-4 buildings per block with alleys between them
      const n = randInt(rng, 1, 3);
      for (let b = 0; b < n; b++) {
        const bw = n === 1 ? randRange(rng, 130, 178) : randRange(rng, 74, 96);
        const bh = n === 1 ? randRange(rng, 130, 178) : randRange(rng, 74, 96);
        const gx = n === 1 ? bx + (CONFIG.BLOCK - bw) / 2 : bx + 8 + (b % 2) * (CONFIG.BLOCK / 2) + randRange(rng, 0, 8);
        const gy = n === 1 ? by + (CONFIG.BLOCK - bh) / 2 : by + 8 + Math.floor(b / 2) * (CONFIG.BLOCK / 2) + randRange(rng, 0, 8);
        const tall = rng() < 0.3;
        buildings.push({
          x: gx, y: gy, w: bw, h: bh,
          height: tall ? randRange(rng, 34, 58) : randRange(rng, 12, 30),
          color: pick(rng, PALETTE.roofPastels),
          neon: pick(rng, PALETTE.neon),
          name: BUILDING_NAMES[nameIdx++ % BUILDING_NAMES.length],
          district,
          seed: rng() * 1000,
        });
      }
      // sidewalk palms and lamps around the block
      for (let s = 0; s < 3; s++) {
        props.push({ kind: 'palm', x: bx - 14, y: by + 20 + s * 80, s: randRange(rng, 0.85, 1.2) });
        props.push({ kind: 'lamp', x: bx + CONFIG.BLOCK + 14, y: by + 40 + s * 80, s: 1 });
      }
    }
  }

  // Beach dressing: umbrellas and palms along the sand
  const sandY = CONFIG.ROWS * PITCH + CONFIG.ROAD + 30;
  for (let x = 60; x < WORLD_W - 40; x += randRange(rng, 90, 170)) {
    props.push({ kind: 'umbrella', x, y: sandY + randRange(rng, 0, 90), s: 1, hue: pick(rng, PALETTE.neon) });
    if (rng() < 0.6) props.push({ kind: 'palm', x: x + 26, y: sandY - 14, s: randRange(rng, 0.9, 1.3) });
  }
  // Marina pier on the south-east water
  const pier = { x: WORLD_W - 520, y: WORLD_H - CONFIG.BEACH + 120, w: 300, h: 26 };

  // Named places missions and shops hang off
  const places = {
    hotel: { x: roadCenterX(1), y: roadCenterY(1) - 70, label: 'Hotel Brisa', icon: 'H' },
    garage: { x: roadCenterX(5) + 60, y: roadCenterY(2), label: 'Chico\u2019s Garage', icon: 'G' },
    docks: { x: WORLD_W - 370, y: WORLD_H - CONFIG.BEACH + 60, label: 'Port Solana Docks', icon: 'D' },
    bank: { x: roadCenterX(3), y: roadCenterY(2) + 78, label: 'Solana Bank', icon: 'B' },
    gunshop: { x: roadCenterX(2) - 62, y: roadCenterY(4), label: 'Defensa Sporting', icon: 'A' },
    hospital: { x: roadCenterX(0) + 66, y: roadCenterY(5), label: 'Solana General', icon: '+' },
    police: { x: roadCenterX(6) - 66, y: roadCenterY(0) + 40, label: 'Solana PD', icon: 'P' },
    hideout: { x: roadCenterX(0) + 60, y: roadCenterY(0) + 60, label: 'Marina Hideout', icon: 'S' },
    club: { x: roadCenterX(4) + 62, y: roadCenterY(4), label: 'Club Sirena', icon: 'C' },
  };
  return { buildings, parks, props, lots, places, pier, seed };
}

// --- collision helpers -------------------------------------------------------
export function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function moveWithCollision(city, x, y, dx, dy, r) {
  let nx = x + dx;
  if (circleHitsBuilding(city, nx, y, r)) nx = x;
  let ny = y + dy;
  if (circleHitsBuilding(city, nx, ny, r)) ny = y;
  nx = Math.max(r, Math.min(WORLD_W - r, nx));
  ny = Math.max(r, Math.min(WORLD_H - r, ny));
  return { x: nx, y: ny };
}

export function isOnRoad(x, y) {
  const inRoadBand = (v) => {
    const m = v % PITCH;
    return m < CONFIG.ROAD;
  };
  if (y > CONFIG.ROWS * PITCH + CONFIG.ROAD) return false; // beach is not road
  return inRoadBand(x) || inRoadBand(y);
}

export function nearestRoadPoint(x, y) {
  const snap = (v, count) => {
    let best = roadCenterX(0), bd = Infinity;
    for (let i = 0; i <= count; i++) {
      const c = CONFIG.ROAD / 2 + i * PITCH;
      const d = Math.abs(v - c);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  const rx = snap(x, CONFIG.COLS), ry = snap(y, CONFIG.ROWS);
  return Math.abs(x - rx) < Math.abs(y - ry) ? { x: rx, y } : { x, y: ry };
}
