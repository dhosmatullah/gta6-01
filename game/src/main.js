// main.js — Neon Palms: Port Solana. Owns the game state and the loop, and
// wires the city, entities, missions, renderer, HUD and audio together:
// on foot and driving, traffic and police, the wanted system, combat, shops,
// collectibles, the day/night cycle and the save file.
import { CONFIG } from './config.js';
import { mulberry32, clamp, lerp, dist } from './random.js';
import { buildCity, WORLD_W, WORLD_H, roadCenterX, roadCenterY, moveWithCollision, circleHitsBuilding } from './city.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { makeCar, spawnTraffic, updateTrafficCar, spawnPolice, updatePoliceCar, spawnPeds, updatePed, makePlayer, makeFlamingos, pointInCar } from './entities.js';
import { MissionRunner, MISSIONS } from './missions.js';
import { drawWorld, drawNightLights, lightingAt } from './render.js';
import { drawHUD, drawObjectiveArrow, drawTitle, drawCenterPanel, drawBriefing, formatMoney } from './hud.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const input = new Input(canvas);
const audio = new AudioEngine();
const rng = mulberry32(99173);

const game = {
  city: buildCity(),
  player: makePlayer(roadCenterX(1) - 66, roadCenterY(1) - 24),
  cars: [], police: [], peds: [], flamingos: [],
  particles: [], toasts: [], worldMarkers: [], pickups: [],
  runner: new MissionRunner(null),
  hour: CONFIG.START_HOUR,
  heat: 0, stars: 0, sinceCrime: 99, bustMeter: 0,
  cam: { x: roadCenterX(3), y: roadCenterY(2), zoom: 1 },
  state: 'title', prompt: null, objective: null, missionTitle: null, missionTimer: null,
  briefing: null, panelTimer: 0, panelKind: null, district: 'Palms District',
  stealCar: null, time: 0, saveTimer: 0, spawnTimer: 0, shotName: null,
  addHeat(amount, silent = false) {
    const before = this.stars;
    this.heat = Math.min(160, this.heat + amount);
    this.sinceCrime = 0;
    this.updateStars();
    if (this.stars > before && !silent) { this.toast(`WANTED — ${this.stars} star${this.stars > 1 ? 's' : ''}`, '#ffd700'); audio.starUp(); }
  },
  updateStars() {
    let s = 0;
    for (const t of CONFIG.HEAT_THRESHOLDS) if (this.heat >= t) s++;
    this.stars = s;
  },
  toast(text, color = '#fff', life = 3.4) { this.toasts.push({ text, color, life }); if (this.toasts.length > 5) this.toasts.shift(); },
};
game.runner.places = game.city.places;
game.cars = spawnTraffic(game.city, rng);
game.peds = spawnPeds(rng);
game.flamingos = makeFlamingos(game.city, rng);
window.__game = game;

// --- save / load ---------------------------------------------------------------
function saveGame() {
  if (game.shotName) return;
  try {
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify({
      money: game.player.money, hasPistol: game.player.hasPistol, ammo: game.player.ammo,
      runner: game.runner.toSave(), flamingos: game.flamingos.map((f) => f.taken), hour: game.hour,
    }));
  } catch (e) { /* storage unavailable: play on unsaved */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    game.player.money = s.money ?? game.player.money;
    game.player.hasPistol = !!s.hasPistol;
    game.player.ammo = s.ammo || 0;
    game.runner.fromSave(s.runner);
    if (Array.isArray(s.flamingos)) s.flamingos.forEach((t, i) => { if (game.flamingos[i]) game.flamingos[i].taken = !!t; });
    if (typeof s.hour === 'number') game.hour = s.hour;
  } catch (e) { /* fresh start */ }
}
if (!new URLSearchParams(location.search).get('shot')) loadGame();

// --- particles -------------------------------------------------------------------
function burst(x, y, n, color, speed = 130, life = 0.55, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
    game.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.5), maxLife: life, color, size: size * (0.6 + Math.random() * 0.8) });
  }
}

// --- mission step setup ------------------------------------------------------------
function setupStep() {
  const a = game.runner.active;
  if (!a) return;
  const s = game.runner.step;
  if (!s) return;
  if (s.kind === 'checkpoints') {
    const pts = [];
    const spots = [[0, 0], [3, 0], [6, 1], [6, 4], [3, 5], [0, 4]];
    for (const [i, j] of spots) pts.push({ x: roadCenterX(i), y: roadCenterY(j) });
    a.checkpoints = pts; a.cpIdx = 0; a.timer = s.time;
  }
  if (s.kind === 'collect') {
    const drops = [];
    const spots = [[2, 3], [5, 1], [1, 5]];
    for (const [i, j] of spots) drops.push({ x: roadCenterX(i) + 58, y: roadCenterY(j) + 58, taken: false });
    a.drops = drops; a.collected = 0;
  }
  if (s.kind === 'escape') {
    a.escaped = false;
    game.heat = Math.max(game.heat, CONFIG.HEAT_THRESHOLDS[2] + 4);
    game.updateStars();
    game.toast('Detective Farrow\u2019s patrols are hunting you!', '#ff8896');
  }
  if (s.kind === 'steal') {
    const club = game.city.places.club;
    const car = makeCar(club.x + 120, club.y + 66, 0.4, '#ff7b54', 'sport');
    car.parked = true; car.isStealTarget = true;
    game.cars.push(car);
    game.stealCar = car;
  }
}

function completeMission() {
  const def = game.runner.currentDef;
  const reward = game.runner.advanceStep();
  if (reward > 0) {
    game.player.money += reward;
    audio.missionDone(); audio.cash();
    game.toast(`JOB DONE: ${def.title}  +${formatMoney(reward)}`, '#7dff9a', 5);
    burst(game.player.x, game.player.y - 10, 26, '#ffd700', 160, 0.9, 3.4);
    if (game.runner.storyComplete) {
      game.state = 'storydone'; game.panelTimer = 7;
      burst(game.player.x, game.player.y, 60, '#ff2e88', 240, 1.2, 4);
    }
    saveGame();
  } else {
    setupStep();
  }
}

function failMission(reason) {
  const def = game.runner.currentDef;
  game.runner.fail();
  audio.missionFail();
  game.toast(`JOB FAILED${def ? ': ' + def.title : ''} — ${reason}`, '#ff8896', 5);
}

// --- crime & consequences -----------------------------------------------------------
function crime(amount, label) {
  game.addHeat(amount);
  if (label) game.toast(label, '#ffb3c0', 2.2);
}

function damagePlayer(amount) {
  const p = game.player;
  if (game.state !== 'play') return;
  p.health -= amount;
  audio.hurt();
  burst(p.x, p.y, 6, '#ff4455', 90, 0.4, 2.6);
  if (p.health <= 0 && !p.inCar) wasted();
  if (p.inCar && p.health <= 0) { p.health = 1; }
}

function wasted() {
  game.state = 'wasted'; game.panelTimer = 3.6;
  audio.missionFail();
}
function busted() {
  game.state = 'busted'; game.panelTimer = 3.6;
  audio.missionFail();
}
function respawn(atHospital) {
  const p = game.player;
  const place = atHospital ? game.city.places.hospital : game.city.places.police;
  if (p.inCar) { p.inCar.driver = null; p.inCar.parked = true; p.inCar.speed = 0; p.inCar = null; }
  const fine = Math.floor(p.money * (atHospital ? 0.1 : 0.15));
  p.money -= fine;
  if (fine > 0) game.toast(`-${formatMoney(fine)} ${atHospital ? 'hospital bill' : 'bail & fines'}`, '#ffb3c0');
  p.x = place.x; p.y = place.y + 26; p.health = 100;
  game.heat = 0; game.updateStars(); game.bustMeter = 0;
  for (const cop of game.police) { cop.kind = 'police'; game.cars.push(cop); }
  game.police = [];
  game.state = 'play';
  saveGame();
}

// --- interactions ---------------------------------------------------------------------
function nearestCar(x, y, maxD) {
  let best = null, bd = maxD;
  for (const car of [...game.cars, ...game.police]) {
    if (car.dead) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const p = game.player;
  const wasParked = car.parked;
  car.parked = false; car.driver = 'player';
  if (car.kind === 'police') { game.police = game.police.filter((c) => c !== car); game.cars.push(car); crime(14, 'You stole a police cruiser!'); }
  else if (!car.stolenOnce) {
    car.stolenOnce = true;
    const witnessed = game.peds.some((pd) => dist(pd.x, pd.y, p.x, p.y) < 230) || game.police.length > 0;
    if (witnessed) crime(6, 'Grand theft auto — witnesses saw that');
    else game.addHeat(2);
    if (car.isStealTarget) game.toast('Got it! Get the car to Chico\u2019s', '#ffd700');
  }
  p.inCar = car;
  p.x = car.x; p.y = car.y;
  audio.blip();
}

function exitCar() {
  const p = game.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = null;
  if (Math.abs(car.speed) < 18) { car.speed = 0; car.parked = true; }
  p.inCar = null;
  const side = car.angle + Math.PI / 2;
  const moved = moveWithCollision(game.city, car.x + Math.cos(side) * 30, car.y + Math.sin(side) * 30, 0, 0, 11);
  p.x = moved.x; p.y = moved.y;
  audio.blip();
}

// --- combat -----------------------------------------------------------------------------
function playerAttack(mouseWorld) {
  const p = game.player;
  p.angle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
  if (p.hasPistol && p.ammo > 0) {
    if (p.fireCd > 0) return;
    p.fireCd = 0.21; p.ammo--;
    audio.shot();
    burst(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16, 3, '#ffd76a', 60, 0.12, 2.4);
    // hitscan: nearest ped / car / cruiser within range and a tight cone
    let target = null, td = 280;
    const consider = (x, y, obj, kind) => {
      const d = dist(p.x, p.y, x, y);
      if (d > td) return;
      const a = Math.atan2(y - p.y, x - p.x);
      let da = Math.abs(((a - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da < 0.16) { td = d; target = { obj, kind, x, y }; }
    };
    for (const ped of game.peds) if (ped.down <= 0) consider(ped.x, ped.y, ped, 'ped');
    for (const car of game.cars) consider(car.x, car.y, car, 'car');
    for (const car of game.police) consider(car.x, car.y, car, 'police');
    if (target) {
      burst(target.x, target.y, 7, '#ffe27a', 120, 0.3, 2.4);
      if (target.kind === 'ped') { target.obj.down = 4; crime(15, 'Shots fired!'); }
      if (target.kind === 'car') { target.obj.health -= 22; target.obj.flash = 0.4; game.addHeat(7); }
      if (target.kind === 'police') { target.obj.health -= 18; target.obj.flash = 0.4; crime(12, 'You shot at the police!'); }
    } else if (game.police.length) game.addHeat(4);
  } else {
    if (p.punchCd > 0) return;
    p.punchCd = 0.3;
    audio.punch();
    for (const ped of game.peds) {
      if (ped.down <= 0 && dist(p.x, p.y, ped.x, ped.y) < 34) {
        ped.down = 3.2; ped.angle = p.angle;
        burst(ped.x, ped.y, 6, '#ffffff', 80, 0.3, 2.4);
        crime(6, 'Assault — somebody called it in');
      }
    }
  }
}

// --- per-frame updates ---------------------------------------------------------------------
function updatePlayer(dt) {
  const p = game.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  if (p.inCar) {
    const car = p.inCar;
    const fwd = input.down('KeyW', 'ArrowUp') || !!game.shotName, back = input.down('KeyS', 'ArrowDown');
    const left = input.down('KeyA', 'ArrowLeft'), right = input.down('KeyD', 'ArrowRight');
    if (fwd) car.speed += CONFIG.CAR_ACCEL * dt * (car.speed < 0 ? 2.2 : 1);
    if (back) car.speed -= CONFIG.CAR_ACCEL * dt * (car.speed > 0 ? 2.4 : 0.75);
    if (!fwd && !back) car.speed -= car.speed * Math.min(1, dt * 0.7);
    if (input.down('Space')) car.speed -= car.speed * Math.min(1, dt * 3.4);
    car.speed = clamp(car.speed, -CONFIG.CAR_MAX_REVERSE, CONFIG.CAR_MAX_SPEED * (car.kind === 'sport' ? 1.12 : 1));
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (steer !== 0 && Math.abs(car.speed) > 4) {
      car.angle += steer * CONFIG.CAR_TURN * dt * clamp(Math.abs(car.speed) / 190, 0.25, 1) * Math.sign(car.speed);
      if (Math.abs(car.speed) > 240 && Math.random() < 0.5) burst(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 1, 'rgba(200,200,210,0.6)', 26, 0.5, 3);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hitB = circleHitsBuilding(game.city, nx, ny, 15);
    if (hitB) {
      if (Math.abs(car.speed) > 130) { car.health -= Math.abs(car.speed) * 0.045; damagePlayer(Math.abs(car.speed) * 0.012); audio.crash(Math.min(1, Math.abs(car.speed) / 300)); burst(car.x, car.y, 10, '#ffd76a', 150, 0.4, 3); if (game.stars > 0 || game.police.length) game.addHeat(1); }
      car.speed *= -0.24;
    } else { car.x = clamp(nx, 16, WORLD_W - 16); car.y = clamp(ny, 16, WORLD_H - 16); }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    audio.setEngine(true, car.speed / CONFIG.CAR_MAX_SPEED);
    if (input.hit('KeyF')) exitCar();
  } else {
    audio.setEngine(false, 0);
    let mx = 0, my = 0;
    if (input.down('KeyW', 'ArrowUp')) my -= 1;
    if (input.down('KeyS', 'ArrowDown')) my += 1;
    if (input.down('KeyA', 'ArrowLeft')) mx -= 1;
    if (input.down('KeyD', 'ArrowRight')) mx += 1;
    const run = input.down('ShiftLeft', 'ShiftRight');
    const sp = run ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      const moved = moveWithCollision(game.city, p.x, p.y, (mx / len) * sp * dt, (my / len) * sp * dt, CONFIG.PLAYER_RADIUS);
      p.x = moved.x; p.y = moved.y;
      p.walkPhase += dt * (run ? 13 : 9);
    }
    // face the mouse when the mouse has moved, else face travel direction
    const mw = mouseWorld();
    if (input.mouse.down || dist(mw.x, mw.y, p.x, p.y) > 26) p.angle = Math.atan2(mw.y - p.y, mw.x - p.x);
    if (input.mouse.down) playerAttack(mw);
    else if (input.mouse.clicked) playerAttack(mw);
    if (input.hit('KeyF')) {
      const car = nearestCar(p.x, p.y, 64);
      if (car) enterCar(car);
    }
  }
  // car-car and car-ped collisions for the player's car
  if (p.inCar) {
    const car = p.inCar;
    for (const other of [...game.cars, ...game.police]) {
      if (other === car || other.dead) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 36 && d > 0) {
        const push = (36 - d) / 2, a = Math.atan2(other.y - car.y, other.x - car.x);
        other.x += Math.cos(a) * push; other.y += Math.sin(a) * push;
        const impact = Math.abs(car.speed - other.speed);
        if (impact > 90) {
          other.health -= impact * 0.12; other.flash = 0.4;
          car.health -= impact * 0.07;
          audio.crash(Math.min(1, impact / 260));
          burst(other.x, other.y, 8, '#ffd76a', 130, 0.35, 3);
          if (other.kind === 'police') crime(10, 'You rammed a police cruiser!');
          else if (impact > 170) crime(4, 'Hit and run!');
          car.speed *= 0.55; other.speed = car.speed * 0.4;
        }
      }
    }
    for (const ped of game.peds) {
      if (ped.down <= 0 && Math.abs(car.speed) > 60 && pointInCar(car, ped.x, ped.y)) {
        ped.down = 5; ped.angle = car.angle;
        audio.crash(0.5);
        crime(11, 'You ran someone down!');
        car.speed *= 0.8;
      }
    }
  }
  // traffic running down peds (rare, chaotic, and not Rio's fault)
  for (const ped of game.peds) {
    if (ped.down > 0) continue;
    for (const car of game.cars) {
      if (!car.parked && car.driver !== 'player' && Math.abs(car.speed) > 120 && pointInCar(car, ped.x, ped.y)) { ped.down = 4; break; }
    }
  }
}

function updateCarsAndPeds(dt) {
  for (const car of game.cars) {
    car.flash = Math.max(0, car.flash - dt);
    if (car.health <= 0 && !car.dead) {
      car.dead = true; car.speed = 0;
      burst(car.x, car.y, 22, '#ff7b00', 150, 0.7, 4);
      if (car === game.player.inCar) { game.toast('Your ride is wrecked!', '#ff8896'); exitCar(); }
    }
    if (car.driver !== 'player') updateTrafficCar(car, dt, game.cars, rng);
  }
  game.cars = game.cars.filter((c) => !(c.dead && Math.random() < dt * 0.02));
  const danger = game.player.inCar && Math.abs(game.player.inCar.speed) > 200 ? game.player : (game.stars >= 3 ? game.player : null);
  for (const ped of game.peds) updatePed(ped, dt, game.city, danger, rng);
  // smoke from wrecked / hurt cars
  for (const car of [...game.cars, ...game.police]) {
    if ((car.dead || car.health < 35) && Math.random() < dt * 6) {
      game.particles.push({ x: car.x + (Math.random() - 0.5) * 14, y: car.y - 8, vx: (Math.random() - 0.5) * 12, vy: -34 - Math.random() * 22, life: 0.9, maxLife: 0.9, color: car.dead ? 'rgba(255,110,30,0.8)' : 'rgba(120,120,130,0.55)', size: 4.4 });
    }
  }
}

function updatePolice(dt) {
  const p = game.player;
  game.sinceCrime += dt;
  if (game.heat > 0 && game.sinceCrime > CONFIG.HEAT_DECAY_DELAY) {
    const seen = game.police.some((c) => dist(c.x, c.y, p.x, p.y) < 330);
    if (!seen) { game.heat = Math.max(0, game.heat - CONFIG.HEAT_DECAY_RATE * dt); game.updateStars(); }
  }
  const desired = game.stars === 0 ? 0 : Math.min(game.stars + 1, CONFIG.MAX_POLICE);
  game.spawnTimer -= dt;
  if (game.police.length < desired && game.spawnTimer <= 0) {
    game.spawnTimer = 2.2;
    game.police.push(spawnPolice(game.city, p, rng));
  }
  if (game.stars === 0 && game.police.length) {
    // heat's off: cruisers give up and merge back into traffic
    for (const cop of game.police) { cop.targetSpeed = 130; cop.speed = Math.min(cop.speed, 120); game.cars.push(cop); }
    game.police = [];
    game.bustMeter = 0;
  }
  const speedNow = p.inCar ? Math.abs(p.inCar.speed) : (input.down('ShiftLeft') ? 60 : 12);
  let pinned = false;
  for (const cop of game.police) {
    cop.flash = Math.max(0, cop.flash - dt);
    if (cop.health <= 0 && !cop.dead) {
      cop.dead = true; cop.speed = 0;
      burst(cop.x, cop.y, 24, '#ff7b00', 160, 0.7, 4);
      crime(12, 'A cruiser is down!');
      game.pickups.push({ x: cop.x + 26, y: cop.y, kind: 'ammo', label: 'AMMO', color: '#ffb347' });
    }
    if (!cop.dead) updatePoliceCar(cop, dt, game.city, { x: p.x, y: p.y, inCar: !!p.inCar });
    if (dist(cop.x, cop.y, p.x, p.y) < 60 && speedNow < 30) pinned = true;
    // officers shoot at a 3+ star Rio who is on foot and close
    if (game.stars >= 3 && !p.inCar && !cop.dead && dist(cop.x, cop.y, p.x, p.y) < 200 && Math.random() < dt * 0.55) {
      audio.shot();
      if (Math.random() < 0.62) damagePlayer(3 + Math.random() * 5);
    }
    // cruisers ram Rio's car
    if (p.inCar && !cop.dead) {
      const d = dist(cop.x, cop.y, p.inCar.x, p.inCar.y);
      if (d < 34 && Math.abs(cop.speed) > 120) {
        p.inCar.health -= 3.2; cop.speed *= 0.6; p.inCar.speed *= 0.82;
        audio.crash(0.4);
        burst(p.inCar.x, p.inCar.y, 6, '#ffd76a', 110, 0.3, 2.6);
      }
    }
  }
  game.police = game.police.filter((c) => !c.dead || Math.random() > dt * 0.05);
  if (pinned && game.stars > 0) {
    game.bustMeter += dt;
    if (game.bustMeter > CONFIG.BUST_TIME) { busted(); return; }
  } else game.bustMeter = Math.max(0, game.bustMeter - dt * 1.6);
  audio.setSiren(game.police.length > 0 && game.stars > 0, dt);
}

function updateMissions(dt) {
  const r = game.runner;
  const p = game.player;
  game.missionTitle = null; game.missionTimer = null;
  if (!r.active) {
    game.objective = r.objective();
    return;
  }
  const def = r.currentDef, s = r.step;
  game.missionTitle = `${def.title} — ${def.giver}`;
  if (s.kind === 'steal' && game.stealCar) {
    game.objective = { x: game.stealCar.x, y: game.stealCar.y, text: s.text };
    if (p.inCar === game.stealCar) completeMission();
  } else if (s.kind === 'checkpoints') {
    a_timer(dt);
    const cp = r.active.checkpoints[r.active.cpIdx];
    game.objective = { x: cp.x, y: cp.y, text: `${s.text} (${r.active.cpIdx + 1}/${r.active.checkpoints.length})` };
    game.missionTimer = r.active.timer;
    if (dist(p.x, p.y, cp.x, cp.y) < 52) {
      audio.pickup(); burst(cp.x, cp.y, 12, '#00e5ff', 120, 0.4, 3);
      r.active.cpIdx++;
      if (r.active.cpIdx >= r.active.checkpoints.length) completeMission();
    }
  } else if (s.kind === 'collect') {
    game.objective = r.objective();
    for (const drop of r.active.drops) {
      if (!drop.taken && dist(p.x, p.y, drop.x, drop.y) < 36) {
        drop.taken = true; r.active.collected++;
        audio.cash(); burst(drop.x, drop.y, 10, '#7dff9a', 110, 0.4, 3);
        game.toast(`Cash drop collected (${r.active.collected}/${s.count})`, '#7dff9a', 2);
        if (r.active.collected === 1 && !r.active.heatGiven) { r.active.heatGiven = true; crime(10, 'A patrol spotted the pickup!'); }
        if (r.active.collected >= s.count) completeMission();
      }
    }
  } else if (s.kind === 'escape') {
    if (game.stars === 0) r.active.escaped = true;
    game.objective = r.objective();
    if (r.active.escaped) {
      const h = game.city.places.hideout;
      if (dist(p.x, p.y, h.x, h.y) < 58) completeMission();
    }
  } else if (s.kind === 'rob') {
    const b = game.city.places.bank;
    game.objective = { x: b.x, y: b.y, text: s.text };
    if (!p.inCar && dist(p.x, p.y, b.x, b.y) < s.r) {
      game.prompt = `Hold E — cracking the vault cart… ${Math.floor((r.active.holdT / s.holdTime) * 100)}%`;
      if (input.down('KeyE')) {
        r.active.holdT += dt;
        if (Math.random() < dt * 8) burst(b.x, b.y, 2, '#ffd700', 70, 0.3, 2.4);
        if (r.active.holdT >= s.holdTime) {
          p.money += 1800;
          game.toast('Vault cart cracked: +$1,800 — RUN!', '#7dff9a', 4);
          game.heat = Math.max(game.heat, CONFIG.HEAT_THRESHOLDS[3] + 6);
          game.updateStars(); audio.starUp();
          completeMission();
        }
      } else r.active.holdT = Math.max(0, r.active.holdT - dt * 0.7);
    }
  } else { // goto
    const place = game.city.places[s.place];
    game.objective = { x: place.x, y: place.y, text: s.text };
    if (dist(p.x, p.y, place.x, place.y) < s.r) {
      if (s.needsStolenCar && p.inCar !== game.stealCar && game.stealCar) { /* must arrive in the stolen car */ }
      else {
        if (s.crime) game.addHeat(s.crime);
        audio.pickup();
        completeMission();
      }
    }
  }
  function a_timer(dt2) {
    r.active.timer -= dt2;
    if (r.active.timer <= 0) failMission('the clock beat you');
  }
}

function updateInteractions() {
  const p = game.player;
  game.prompt = null;
  const places = game.city.places;
  // mission start
  const next = game.runner.nextDef;
  if (!game.runner.active && next) {
    const sp = places[next.start];
    if (dist(p.x, p.y, sp.x, sp.y) < 52) {
      game.prompt = `E — New job: ${next.title}`;
      if (input.hit('KeyE')) { game.briefing = next; game.state = 'briefing'; audio.blip(); }
    }
  }
  // shops
  if (!p.inCar && dist(p.x, p.y, places.gunshop.x, places.gunshop.y) < 46) {
    game.prompt = p.hasPistol ? `E — Buy 24 pistol rounds (${formatMoney(60)})` : `E — Buy a pistol (${formatMoney(CONFIG.PISTOL_PRICE)})`;
    if (input.hit('KeyE')) {
      if (!p.hasPistol && p.money >= CONFIG.PISTOL_PRICE) { p.money -= CONFIG.PISTOL_PRICE; p.hasPistol = true; p.ammo += 24; audio.cash(); game.toast('Pistol acquired. Stay safe out there.', '#ffd166'); saveGame(); }
      else if (p.hasPistol && p.money >= 60) { p.money -= 60; p.ammo += 24; audio.cash(); game.toast('+24 rounds', '#ffd166'); }
      else game.toast('Not enough cash', '#ff8896');
    }
  }
  if (!p.inCar && dist(p.x, p.y, places.hospital.x, places.hospital.y) < 46 && p.health < 100) {
    game.prompt = 'E — Patch up ($50)';
    if (input.hit('KeyE')) { if (p.money >= 50) { p.money -= 50; p.health = 100; audio.pickup(); game.toast('Patched up — good as new', '#7dff9a'); } else game.toast('Not enough cash', '#ff8896'); }
  }
  if (p.inCar && dist(p.x, p.y, places.garage.x, places.garage.y) < 62 && p.inCar.health < 100) {
    const cost = Math.ceil((100 - p.inCar.health) * CONFIG.REPAIR_PRICE_PER_POINT);
    game.prompt = `E — Repair car (${formatMoney(cost)})`;
    if (input.hit('KeyE')) { if (p.money >= cost) { p.money -= cost; p.inCar.health = 100; audio.cash(); game.toast('Chico\u2019s crew made her shine again', '#7dff9a'); } else game.toast('Not enough cash', '#ff8896'); }
  }
  if (!p.inCar) {
    const car = nearestCar(p.x, p.y, 64);
    if (car && !game.prompt) game.prompt = car.parked ? 'F — Get in car' : 'F — Steal car';
  }
  // pickups
  for (const pk of game.pickups) {
    if (dist(p.x, p.y, pk.x, pk.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'ammo') { p.ammo += 8; game.toast('+8 pistol rounds', '#ffb347'); }
      audio.pickup();
    }
  }
  game.pickups = game.pickups.filter((pk) => !pk.taken);
  // flamingos
  for (const f of game.flamingos) {
    if (!f.taken && dist(p.x, p.y, f.x, f.y) < 26) {
      f.taken = true;
      p.money += CONFIG.FLAMINGO_REWARD;
      audio.cash();
      const left = game.flamingos.filter((x) => !x.taken).length;
      game.toast(`Neon flamingo found! +${formatMoney(CONFIG.FLAMINGO_REWARD)} (${CONFIG.FLAMINGO_COUNT - left}/${CONFIG.FLAMINGO_COUNT})`, '#ff8fb8');
      burst(f.x, f.y, 14, '#ff5da2', 120, 0.5, 3);
      saveGame();
    }
  }
}

function buildWorldMarkers(time) {
  const markers = [];
  const r = game.runner;
  if (!r.active && r.nextDef) {
    const sp = game.city.places[r.nextDef.start];
    markers.push({ x: sp.x, y: sp.y, color: '#ffd700', label: '!' });
  }
  if (r.active) {
    const s = r.step;
    if (s.kind === 'checkpoints' && r.active.checkpoints) {
      const cp = r.active.checkpoints[r.active.cpIdx];
      if (cp) markers.push({ x: cp.x, y: cp.y, color: '#00e5ff', label: 'GO' });
    }
    if (s.kind === 'collect' && r.active.drops) for (const d of r.active.drops) if (!d.taken) markers.push({ x: d.x, y: d.y, color: '#7dff9a', label: '$' });
    if (s.kind === 'steal' && game.stealCar && !game.stealCar.dead) markers.push({ x: game.stealCar.x, y: game.stealCar.y, color: '#ff7b54', label: 'STEAL' });
    if (s.kind === 'goto' || s.kind === 'rob') { const pl = game.city.places[s.place]; markers.push({ x: pl.x, y: pl.y, color: '#ffd700', label: '' }); }
    if (s.kind === 'escape' && r.active.escaped) { const h = game.city.places.hideout; markers.push({ x: h.x, y: h.y, color: '#7dff9a', label: 'HIDE' }); }
  }
  for (const pk of game.pickups) markers.push({ x: pk.x, y: pk.y, color: pk.color, label: pk.label });
  game.worldMarkers = markers;
}

function mouseWorld() {
  return {
    x: game.cam.x + (input.mouse.x - W / 2) / game.cam.zoom,
    y: game.cam.y + (input.mouse.y - H / 2) / game.cam.zoom,
  };
}

// --- main loop ----------------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (game.state === 'paused' || game.state === 'briefing') dt = 0;
  game.time += dt;

  if (game.state === 'title') {
    game.cam.x = roadCenterX(3) + Math.sin(game.time * 0.07) * 320;
    game.cam.y = roadCenterY(2) + Math.cos(game.time * 0.05) * 200;
    game.cam.zoom = lerp(game.cam.zoom, 0.8, 0.02);
    if (dt > 0) { for (const car of game.cars) updateTrafficCar(car, dt, game.cars, rng); for (const ped of game.peds) updatePed(ped, dt, game.city, null, rng); }
    if (input.hit('Enter') || input.mouse.clicked) { audio.ensure(); game.state = 'play'; game.toast('Welcome to Port Solana, Rio', '#ffd700', 4); }
  } else if (game.state === 'play' || game.state === 'storydone') {
    if (game.state === 'storydone') { game.panelTimer -= dt; if (game.panelTimer <= 0) game.state = 'play'; }
    game.hour = (game.hour + dt / CONFIG.SECONDS_PER_HOUR) % 24;
    updatePlayer(dt);
    updateCarsAndPeds(dt);
    updatePolice(dt);
    if (game.state === 'play' || game.state === 'storydone') { updateInteractions(); updateMissions(dt); }
    // camera
    const target = game.player;
    const wantZoom = target.inCar ? clamp(1.02 - Math.abs(target.inCar.speed) / 2600, 0.78, 1.02) : 1.14;
    game.cam.x = lerp(game.cam.x, target.x, Math.min(1, dt * 5));
    game.cam.y = lerp(game.cam.y, target.y, Math.min(1, dt * 5));
    game.cam.zoom = lerp(game.cam.zoom, wantZoom, Math.min(1, dt * 2.4));
    // district label from the block under Rio
    const cx = clamp(Math.floor((target.x - CONFIG.ROAD) / (CONFIG.BLOCK + CONFIG.ROAD)), 0, CONFIG.COLS - 1);
    const cy = clamp(Math.floor((target.y - CONFIG.ROAD) / (CONFIG.BLOCK + CONFIG.ROAD)), 0, CONFIG.ROWS - 1);
    const names = ['Palms District', 'Solana Row', 'Marina Mile', 'Old Port', 'Coral Heights', 'Sunset Strip', 'Flamingo Quarter'];
    game.district = target.y > CONFIG.ROWS * (CONFIG.BLOCK + CONFIG.ROAD) ? 'Solana Beach' : names[(cx + cy * 2) % names.length];
    game.saveTimer -= dt;
    if (game.saveTimer <= 0) { game.saveTimer = 12; saveGame(); }
    if (input.hit('KeyP')) game.state = 'paused';
  } else if (game.state === 'briefing') {
    if (input.hit('KeyE')) {
      const def = game.runner.startNext();
      game.briefing = null; game.state = 'play';
      if (def) { setupStep(); game.toast(`JOB STARTED: ${def.title}`, '#ffd700', 4); audio.blip(); }
    }
    if (input.hit('KeyQ')) { game.briefing = null; game.state = 'play'; }
  } else if (game.state === 'paused') {
    if (input.hit('KeyP') || input.hit('Escape')) game.state = 'play';
  } else if (game.state === 'busted' || game.state === 'wasted') {
    game.panelTimer -= dt;
    audio.setEngine(false, 0); audio.setSiren(false, dt);
    if (game.panelTimer <= 0) respawn(game.state === 'wasted');
  }
  if (input.hit('KeyM')) { audio.ensure(); game.toast(audio.toggleMute() ? 'Sound off' : 'Sound on', '#fff', 1.6); }

  // toasts + particles always tick
  for (const t of game.toasts) t.life -= Math.max(dt, 0.016);
  game.toasts = game.toasts.filter((t) => t.life > 0);
  for (const pt of game.particles) { pt.life -= Math.max(dt, 0.016); pt.x += pt.vx * Math.max(dt, 0.016); pt.y += pt.vy * Math.max(dt, 0.016); pt.vx *= 0.96; pt.vy *= 0.96; }
  game.particles = game.particles.filter((pt) => pt.life > 0);
  audio.updateMusic(game.state === 'play' ? Math.max(dt, 0) : 0, game.stars / 5);

  buildWorldMarkers(game.time);
  render();
  input.endFrame();
}

function render() {
  const cam = game.cam;
  // keep the view inside the world where the world is bigger than the view
  const halfW = W / 2 / cam.zoom, halfH = H / 2 / cam.zoom;
  if (WORLD_W > halfW * 2) cam.x = clamp(cam.x, halfW - 60, WORLD_W - halfW + 60);
  if (WORLD_H > halfH * 2) cam.y = clamp(cam.y, halfH - 60, WORLD_H - halfH + 60);
  const view = {
    x0: cam.x - W / 2 / cam.zoom - 70, y0: cam.y - H / 2 / cam.zoom - 90,
    x1: cam.x + W / 2 / cam.zoom + 70, y1: cam.y + H / 2 / cam.zoom + 70,
  };
  ctx.fillStyle = '#10131f';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, game, view, game.time);
  // particles
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // bust meter ring
  if (game.bustMeter > 0.2 && game.state === 'play') {
    ctx.strokeStyle = '#ff4455'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(game.player.x, game.player.y - 26, 15, -Math.PI / 2, -Math.PI / 2 + (game.bustMeter / CONFIG.BUST_TIME) * Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // lighting: sunset warmth, then night darkness, then additive lights
  const light = lightingAt(game.hour);
  if (light.sunset > 0.05) { ctx.fillStyle = `rgba(255,110,60,${0.10 * light.sunset})`; ctx.fillRect(0, 0, W, H); }
  if (light.darkness > 0.03) { ctx.fillStyle = `rgba(8,10,38,${light.darkness * 0.55})`; ctx.fillRect(0, 0, W, H); }
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
  drawNightLights(ctx, game, light);
  ctx.restore();

  if (game.state === 'title') { drawTitle(ctx, W, H, game.time); return; }
  drawHUD(ctx, game, W, H);
  drawObjectiveArrow(ctx, game, cam, W, H);
  if (game.state === 'briefing') drawBriefing(ctx, game, W, H);
  if (game.state === 'paused') drawCenterPanel(ctx, W, H, 'PAUSED', '#aef4ff', ['Port Solana holds its breath…', 'WASD drive · F car · E interact · mouse aim'], 'Press P to keep rolling');
  if (game.state === 'busted') drawCenterPanel(ctx, W, H, 'BUSTED', '#ff5566', ['Solana PD got their cuffs on Rio.', 'Bail and fines come out of your pocket.'], '');
  if (game.state === 'wasted') drawCenterPanel(ctx, W, H, 'WASTED', '#ff5566', ['Rio wakes up at Solana General,', 'a little poorer and a lot sorer.'], '');
  if (game.state === 'storydone') drawCenterPanel(ctx, W, H, 'LEGEND OF PORT SOLANA', '#ffd700', ['Every job done. Every favour repaid.', 'The city is yours now — free roam, flamingos and fast cars.'], 'Story complete — keep playing!');
}

// screenshot staging (?shot=chase etc.), used for the entry's screenshots
const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  game.shotName = params.get('shot');
  const st = applyShot(game, game.shotName);
  if (st) game.state = st;
  if (game.runner.active) setupStep();
  // let the staged scene settle for a few simulated seconds when asked
  const settle = parseFloat(params.get('settle') || '0');
  if (settle > 0) {
    const step = 1 / 30;
    for (let t = 0; t < settle; t += step) {
      updatePlayer(step);
      updateCarsAndPeds(step);
      updatePolice(step);
      updateMissions(step);
    }
    game.cam.x = game.player.x; game.cam.y = game.player.y;
  }
}

requestAnimationFrame(frame);
export { game };
