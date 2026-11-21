# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dhosmatullah/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dhosmatullah/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Palms: Port Solana** — an original open-world crime caper in vanilla
JS/canvas 2D with a 2.5D extruded skyline. You are Rio Vega, a broke courier in
the sun-soaked neon city of Port Solana. Walk it, steal its cars, run six story
jobs for Rosa of Hotel Brisa, Chico the mechanic and La Sirena of Club Sirena —
and shake the Solana PD's wanted stars when the jobs go loud.

- **A complete open world:** a 7×6-block procedural city (hotels, a bank, a
  casino strip, parks, parking lots, a marina pier and a beach on the bay) with
  a full day cycle — golden afternoons, neon sunsets, lit windows and glowing
  signs at night.
- **On foot and by car:** 26+ traffic cars following lanes and turning at
  intersections, parked cars to steal, 42 pedestrians who stroll, panic and
  flee, working car damage, repairs at Chico's Garage.
- **Wanted system & police:** crimes (theft, assault, shots fired, hit-and-run,
  ramming) raise heat across 5 stars; cruisers spawn, chase, ram and shoot,
  pin you for a BUSTED, and give up when you break their line of sight and let
  the heat cool. WASTED sends you to Solana General; both cost you money.
- **Story & side money:** six chained jobs (a suitcase run, a car to steal
  back, a sunset time trial, cash-drop collections, losing a 3-star heat, and
  the Solana Bank score), plus 18 hidden neon flamingos at $150 each, a pistol
  to buy at Defensa Sporting, ammo drops from wrecked cruisers, and automatic
  browser saves.
- **HUD & polish:** minimap with police blips, objective and collectible dots,
  wanted stars, health/car bars, speedometer, mission panel with timers,
  objective edge-arrow, briefings, toasts — and a fully synthesized WebAudio
  soundscape (synthwave loop, engine, sirens, impacts). No audio files, no
  images, no libraries, no network: everything is drawn and sounded by code.

## Controls

- **WASD / arrows** — walk & drive · **Shift** — sprint · **Space** — handbrake
- **F** — enter / exit / steal car · **E** — talk, buy, repair, start & accept jobs (hold E to crack the vault)
- **Mouse** — aim · **Click** — punch, or shoot with the pistol
- **P** — pause · **M** — mute

## Run it

```sh
node serve.ts          # serves game/ at http://localhost:8080
# …or open game/index.html in any desktop browser — it plays fully offline.

mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the entry's /output + dossier.json
```

The source is split by job under `game/src/`: `city.js` (the procedural city
and its collision/road queries), `entities.js` (traffic, police and pedestrian
AI), `missions.js` (the six-job story as data plus its runner), `render.js`
(the 2.5D world and night lights), `hud.js` (HUD, minimap and menus),
`audio.js` (the synth), `input.js`, `shots.js` (the deterministic screenshot
scenes in `shots.json`), `config.js` (every tuning number) and `main.js` (the
loop that wires it all together). Screenshots in `screenshots/` are real
frames of the game itself, staged from the `shots.json` scenes.

Every name, street, character and song in Port Solana is original to this
game.

---

<sub>Entered on [make.fun](https://make.fun/?ref=0trcj9y5&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
