// missions.js — the story of Rio Vega in Port Solana: six missions for Rosa of
// Hotel Brisa, Chico the mechanic and La Sirena of Club Sirena, told as data.
// main.js interprets the step kinds; this file owns the chain and its state.
export const STORY_INTRO = [
  'Rio Vega was a bike courier with a clean record and an empty wallet.',
  'Then Rosa at Hotel Brisa offered cash for one small favour…',
];

export const MISSIONS = [
  {
    id: 'welcome', title: 'Welcome to Port Solana', giver: 'Rosa — Hotel Brisa', start: 'hotel', reward: 250,
    brief: 'Rosa: A guest left a suitcase at my hotel. Take it to the docks, rápido, and do not open it.',
    steps: [
      { kind: 'goto', place: 'hotel', r: 46, text: 'Pick up the suitcase at Hotel Brisa' },
      { kind: 'goto', place: 'docks', r: 60, text: 'Deliver the suitcase to the docks', crime: 1 },
    ],
    done: 'The dockhand nods and slips you an envelope. Rosa pays well for silence.',
  },
  {
    id: 'chicos-favourite', title: 'Chico\u2019s Favourite', giver: 'Chico — the Garage', start: 'garage', reward: 400,
    brief: 'Chico: See that coral sports car by Club Sirena? It was mine before it was "repossessed". Bring her home.',
    steps: [
      { kind: 'steal', place: 'club', r: 90, text: 'Steal the coral sports car near Club Sirena' },
      { kind: 'goto', place: 'garage', r: 58, text: 'Deliver the car to Chico\u2019s Garage', needsStolenCar: true },
    ],
    done: 'Chico hugs the bonnet like a long-lost dog. "You are family now, Rio."',
  },
  {
    id: 'sunset-trial', title: 'Sunset Time Trial', giver: 'La Sirena — Club Sirena', start: 'club', reward: 500,
    brief: 'La Sirena: My drivers say the Sunset Strip cannot be run in ninety seconds. Prove them slow, mi amor.',
    steps: [
      { kind: 'checkpoints', count: 6, time: 95, text: 'Blast through every checkpoint before the clock dies' },
    ],
    done: 'La Sirena laughs into her drink. "Slow? You were a rumour with headlights."',
  },
  {
    id: 'sirenas-errand', title: 'La Sirena\u2019s Errand', giver: 'La Sirena — Club Sirena', start: 'club', reward: 650,
    brief: 'La Sirena: Three of my people owe me cash drops tonight. Collect them all. Smile if the police ask questions.',
    steps: [
      { kind: 'collect', count: 3, text: 'Collect La Sirena\u2019s cash drops', heatAtSecond: 10 },
    ],
    done: 'Every drop counted, every favour owed doubled. The club lights feel warmer already.',
  },
  {
    id: 'lose-the-heat', title: 'Lose the Heat', giver: 'Rosa — Hotel Brisa', start: 'hotel', reward: 800,
    brief: 'Rosa: Detective Farrow has your face on his wall now, Rio. Shake his patrols and lie low at the marina hideout.',
    steps: [
      { kind: 'escape', stars: 3, text: 'Lose the police, then reach the Marina Hideout' },
    ],
    done: 'From the hideout roof you watch the patrols drift home. Port Solana forgets — for tonight.',
  },
  {
    id: 'the-score', title: 'The Solana Score', giver: 'La Sirena — Club Sirena', start: 'club', reward: 2500,
    brief: 'La Sirena: One last job. The Solana Bank vault cart, Friday money, no heroes. Then the boat at the docks, and freedom.',
    steps: [
      { kind: 'rob', place: 'bank', r: 42, holdTime: 5, text: 'Hold E inside Solana Bank to crack the vault cart' },
      { kind: 'goto', place: 'docks', r: 64, text: 'Escape to the boat at the docks', crime: 40 },
    ],
    done: 'The boat cuts the bay as the city turns to neon confetti behind you. Rio Vega is a legend of Port Solana.',
  },
];

export class MissionRunner {
  constructor(places) {
    this.places = places;
    this.index = 0; // next mission to offer
    this.active = null; // {def, stepIdx, checkpoints, cpIdx, collected, drops, timer, holdT, escaped}
    this.completedCount = 0;
    this.storyComplete = false;
  }

  get currentDef() { return this.active ? this.active.def : null; }
  get nextDef() { return this.index < MISSIONS.length ? MISSIONS[this.index] : null; }

  startNext() {
    const def = this.nextDef;
    if (!def) return null;
    this.active = { def, stepIdx: 0, cpIdx: 0, checkpoints: null, collected: 0, drops: null, timer: null, holdT: 0, escaped: false, heatGiven: false };
    return def;
  }

  get step() { return this.active ? this.active.def.steps[this.active.stepIdx] : null; }

  objective() {
    if (this.active) {
      const s = this.step;
      if (!s) return null;
      if (s.kind === 'checkpoints' && this.active.checkpoints) {
        const cp = this.active.checkpoints[this.active.cpIdx];
        return cp ? { x: cp.x, y: cp.y, text: s.text + ` (${this.active.cpIdx + 1}/${this.active.checkpoints.length})` } : null;
      }
      if (s.kind === 'collect' && this.active.drops) {
        const drop = this.active.drops.find((d) => !d.taken);
        return drop ? { x: drop.x, y: drop.y, text: s.text + ` (${this.active.collected}/${s.count})` } : null;
      }
      if (s.kind === 'escape') {
        if (!this.active.escaped) return { x: null, y: null, text: 'Lose the police! (break their line of sight)' };
        const p = this.places.hideout;
        return { x: p.x, y: p.y, text: 'Reach the Marina Hideout' };
      }
      const p = s.place ? this.places[s.place] : null;
      return p ? { x: p.x, y: p.y, text: s.text } : { x: null, y: null, text: s.text };
    }
    const next = this.nextDef;
    if (next) {
      const p = this.places[next.start];
      return { x: p.x, y: p.y, text: `New job: ${next.title} — go to the ! marker`, idle: true };
    }
    return { x: null, y: null, text: 'Free roam — Port Solana is yours. Find flamingos, fares and trouble.' };
  }

  advanceStep() {
    if (!this.active) return false;
    this.active.stepIdx++;
    this.active.cpIdx = 0; this.active.checkpoints = null; this.active.drops = null; this.active.timer = null; this.active.holdT = 0; this.active.heatGiven = false;
    if (this.active.stepIdx >= this.active.def.steps.length) {
      const reward = this.active.def.reward;
      this.completedCount++;
      this.index++;
      this.active = null;
      if (this.index >= MISSIONS.length) this.storyComplete = true;
      return reward;
    }
    return 0;
  }

  fail() { this.active = null; }

  toSave() { return { index: this.index, completedCount: this.completedCount, storyComplete: this.storyComplete }; }
  fromSave(s) { if (!s) return; this.index = s.index || 0; this.completedCount = s.completedCount || 0; this.storyComplete = !!s.storyComplete; }
}
