// config.js — every tuning number for Neon Palms: Port Solana in one place.
export const CONFIG = {
  // City grid: blocks of BLOCK px separated by roads of ROAD px.
  BLOCK: 200,
  ROAD: 96,
  COLS: 7,
  ROWS: 6,
  BEACH: 340, // sand + water strip along the south edge

  // Player on foot
  WALK_SPEED: 118,
  RUN_SPEED: 205,
  PLAYER_RADIUS: 11,
  PLAYER_MAX_HEALTH: 100,

  // Driving
  CAR_ACCEL: 340,
  CAR_MAX_SPEED: 430,
  CAR_MAX_REVERSE: 130,
  CAR_TURN: 2.35,
  CAR_GRIP: 7.5,

  // World population
  TRAFFIC_COUNT: 26,
  PED_COUNT: 42,
  MAX_POLICE: 6,

  // Wanted system: heat points map to stars at these thresholds.
  HEAT_THRESHOLDS: [1, 14, 34, 64, 104],
  HEAT_DECAY_DELAY: 11, // seconds without a crime before heat cools
  HEAT_DECAY_RATE: 2.6, // heat points per second while cooling unseen
  BUST_TIME: 2.6, // seconds pinned by police at low speed before busted

  // Economy
  START_MONEY: 120,
  FLAMINGO_REWARD: 150,
  FLAMINGO_COUNT: 18,
  PISTOL_PRICE: 300,
  REPAIR_PRICE_PER_POINT: 3,

  // Clock: one game hour lasts this many real seconds; start at golden hour.
  SECONDS_PER_HOUR: 26,
  START_HOUR: 17.35,

  SAVE_KEY: 'neon-palms-port-solana-save-v1',
};

export const PALETTE = {
  asphalt: '#3d3f4d',
  asphaltDark: '#343644',
  laneMark: '#e8d44d',
  sidewalk: '#9a8f83',
  sidewalkEdge: '#7d7468',
  sand: '#f0d48a',
  water: '#1b6f8f',
  waterDeep: '#0d4a68',
  grass: '#3f9e63',
  grassDark: '#358754',
  plaza: '#c9b8a3',
  roofPastels: ['#f6c177', '#f28ba8', '#7bd0c3', '#f2e3c6', '#a8c3f0', '#e88ca0', '#ffd9a0', '#9fd8a8', '#d9b8f0', '#f0a868'],
  neon: ['#ff2e88', '#00e5ff', '#ffe600', '#7cff00', '#ff7b00', '#b967ff'],
  carColors: ['#e63946', '#f4f1de', '#3d8bfd', '#ffd166', '#06d6a0', '#ef8354', '#8ecae6', '#e0aaff', '#f8f9fa', '#22223b', '#fb6f92', '#90be6d'],
  skinTones: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'],
  shirtColors: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#c77dff', '#f1fa8c', '#ff9770', '#70d6ff'],
};
