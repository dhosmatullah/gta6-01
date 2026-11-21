// shots.js — deterministic scenes for the entry's screenshots, selected with
// ?shot=<name>. Each scene stages real game state (never a mock-up): the same
// simulation and renderer draw it, just posed.
import { roadCenterX, roadCenterY } from './city.js';
import { makeCar } from './entities.js';

function putPlayerInCar(game, car) {
  game.player.inCar = car;
  car.driver = 'player';
  car.parked = false;
  game.player.x = car.x; game.player.y = car.y;
}

export function applyShot(game, name) {
  const P = game.player;
  if (name === 'title') {
    game.hour = 18.7;
    game.cam.x = roadCenterX(3); game.cam.y = roadCenterY(2);
    game.cam.zoom = 0.82;
    return 'title';
  }
  if (name === 'chase') {
    game.hour = 18.55;
    game.runner.index = 3; // La Sirena's Errand
    game.runner.startNext();
    const car = makeCar(roadCenterX(2) + 40, roadCenterY(2) - 24, 0, '#e63946', 'sport');
    car.speed = 330;
    game.cars.push(car);
    putPlayerInCar(game, car);
    game.addHeat(40, true); // three stars
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(car.x - 210 - i * 105, car.y + (i % 2 ? 27 : -23), 0.05 * (i - 1), '#f8f9fa', 'police');
      cop.speed = 335; cop.sirenPhase = i * 0.37;
      game.police.push(cop);
    }
    game.cam.x = car.x; game.cam.y = car.y;
    return 'play';
  }
  if (name === 'onfoot') {
    game.hour = 10.4;
    const hotel = game.city.places.hotel;
    P.x = hotel.x - 34; P.y = hotel.y + 30;
    P.angle = 0.7; P.hasPistol = true; P.ammo = 24;
    game.cam.x = P.x; game.cam.y = P.y;
    return 'play';
  }
  if (name === 'drive') {
    game.hour = 17.9;
    game.runner.index = 2; // Sunset Time Trial
    game.runner.startNext();
    const car = makeCar(roadCenterX(2) + 10, roadCenterY(5) - 24, 0, '#3d8bfd', 'sport');
    car.speed = 260;
    game.cars.push(car);
    putPlayerInCar(game, car);
    game.cam.x = car.x + 60; game.cam.y = car.y;
    return 'play';
  }
  if (name === 'robbery') {
    game.hour = 21.3;
    game.runner.index = 5; // The Solana Score
    game.runner.startNext();
    game.runner.active.stepIdx = 1; // escaping with the take
    P.x = roadCenterX(3) - 30; P.y = roadCenterY(2) + 66;
    P.angle = 2.4; P.money = 4860;
    const car = makeCar(P.x - 90, P.y + 18, Math.PI, '#ffd166', 'sport');
    car.speed = 120;
    game.cars.push(car);
    game.addHeat(70, true); // four stars
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(P.x + 170 + i * 70, P.y - 60 + i * 44, Math.PI + 0.2, '#f8f9fa', 'police');
      cop.speed = 200; cop.sirenPhase = i * 0.5;
      game.police.push(cop);
    }
    game.cam.x = P.x; game.cam.y = P.y;
    return 'play';
  }
  return null;
}
