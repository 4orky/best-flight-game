# Sky Courier: Ember Isles

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/4orky/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/4orky/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete, original flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly a bush plane over a chain of volcanic isles: thread glowing rings, mind the fuel, and bring her home to runway 09/27.

## How to play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit http://localhost:8080). No build step, no network requests — every script, image and sound is a file under `game/` or synthesised in code.

- **Take off** — hold `W` to spool the engine, then pull `↑` past rotation speed and she lifts off the strip.
- **Fly** — `↑`/`↓` pitch, `←`/`→` bank into turns, `W`/`S` throttle, `A`/`D` rudder. Drag the mouse to steer. Watch the stall: below 22 m/s the wing stops flying and she sinks.
- **Three missions** — pick one on the title screen (`1`/`2`/`3`, Enter, or click a card):
  - **Ring Run** — fly all 8 glowing rings in order, against the clock. Each ring is +150, and a fast line pays a time bonus.
  - **Island Hop** — take off, circle the bay and land on runway 09/27. The score is all in the landing: gentle, slow, on the centreline. A good landing refuels and repairs the plane.
  - **Storm Courier** — the same rings in a gusting squall with a thirsty engine. The fuel gauge is part of the route.
- **Landings and crashes read as what happened** — a gentle touchdown on the strip rolls out; a hard, fast or crooked one ends the sortie. A runway landing mid-mission is a pit stop: refuel and repair.
- **Views** — `C` switches between the chase camera and the cockpit, where six lit gauges, an attitude ball and a throttle lever fly the plane. `P` pauses, `R` restarts, `M` mutes.

The HUD always shows airspeed (kt), altitude (ft), vertical speed, heading on a compass tape, throttle and fuel, the mission objective, score and clock — and the screenshots show the game itself: chase view over recognisable terrain, the aircraft in frame with instruments lit, a ring or the runway ahead.

## Layout

- `game/` — the playable game as static files (`index.html` plus `src/`: `config.js` rules and missions, `terrain.js` the islands, runway, rings, trees and clouds, `physics.js` the flight model, `missions.js` sortie state and scoring, `render.js` the software 3D world, `hud.js` HUD, cockpit instruments and screens, `input.js` keyboard and mouse, `audio.js` synthesised engine and wind, `random.js` seeded noise, `shots.js` staged screenshot scenes, `main.js` boot and loop)
- `screenshots/` — 4 real renders of the game's own code: the cover (ring 2 ahead over the home island), the cockpit with its instruments lit, the aircraft flying through ring 1, and the final approach to runway 09/27
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library
- `serve.ts` — a tiny static server for local play-testing
- `shots.json` — the four screenshot scenes and their URLs
- `vendor/makefun-game.ts` — the kit's library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=farrisblake-55155&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
