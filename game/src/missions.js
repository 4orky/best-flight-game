// Missions: the sortie state machine. A mission tracks its rings, its clock,
// its score and its ending, and turns raw flight events (a ring flown, a
// landing, a crash, an empty tank) into points and messages.
import { MISSIONS, WORLD } from './config.js';
import { buildRings } from './terrain.js';
import { landingScore } from './physics.js';
import { clamp } from './random.js';

/** A fresh mission run: the aircraft starts on the runway, cold clock. */
export function startMission(missionIndex) {
  const def = MISSIONS[missionIndex];
  return {
    def,
    index: missionIndex,
    rings: def.rings ? buildRings() : [],
    nextRing: 0,
    ringsDone: 0,
    time: 0,
    score: 0,
    status: 'flying', // flying | landed | crashed | ditched | outoffuel | done
    message: '',
    messageUntil: 0,
    landings: 0,
    bestLanding: 0,
    lastEvent: '',
  };
}

/** Wind at time `t`: a slow base breeze plus gusts that grow with the mission. */
export function windAt(mission, t) {
  const strength = mission.def.wind;
  const gust = 1 + 0.5 * Math.sin(t * 0.31) + 0.35 * Math.sin(t * 0.83 + 1.7);
  const dir = 0.6 + 0.4 * Math.sin(t * 0.11);
  return {
    x: Math.cos(dir) * strength * gust * 0.6,
    z: Math.sin(dir) * strength * gust * 0.6,
  };
}

/** Show a transient message above the HUD for `seconds`. */
function say(mission, text, seconds = 3) {
  mission.message = text;
  mission.messageUntil = mission.time + seconds;
}

/**
 * Advance the mission one step after the aircraft has moved. `plane` is the
 * aircraft state; `event` is the flight event from stepAircraft ('', 'landed',
 * 'takeoff', 'crashed', 'ditched'). Returns nothing; the mission mutates.
 */
export function stepMission(mission, plane, event, dt) {
  mission.time += dt;
  if (mission.message && mission.time > mission.messageUntil) mission.message = '';

  if (mission.status !== 'flying') return;

  // Rings: the next ring in the course, flown in order.
  if (mission.def.rings && mission.nextRing < mission.rings.length) {
    const ring = mission.rings[mission.nextRing];
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    const dz = plane.z - ring.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < WORLD.ringPass) {
      ring.passed = true;
      mission.ringsDone += 1;
      mission.nextRing += 1;
      mission.score += 150;
      mission.lastEvent = 'ring';
      if (mission.nextRing >= mission.rings.length) {
        mission.status = 'done';
        const timeBonus = Math.max(0, Math.round((mission.def.parSeconds - mission.time) * 5));
        mission.score += timeBonus;
        say(mission, `Course complete! Time bonus +${timeBonus}`, 5);
      } else {
        say(mission, `Ring ${mission.ringsDone} of ${mission.rings.length} — +150`, 2.5);
      }
    }
  }

  if (event === 'takeoff') {
    say(mission, 'Airborne — gear up, flaps up', 2.5);
  }

  if (event === 'landed') {
    mission.landings += 1;
    if (mission.def.landing) {
      const points = landingScore(plane);
      mission.bestLanding = Math.max(mission.bestLanding, points);
      mission.score += points;
      mission.status = 'done';
      say(mission, `Touchdown! Landing score +${points}`, 5);
    } else {
      // A runway landing mid-mission refuels and repairs: a pit stop.
      plane.fuel = clamp(plane.fuel + 100, 0, 100);
      plane.damage = 0;
      mission.score += 25;
      say(mission, 'Pit stop: refuelled and repaired (+25)', 3);
    }
  }

  if (event === 'crashed' || event === 'ditched') {
    mission.status = event;
    say(mission, event === 'ditched' ? 'Ditched in the bay!' : 'Crashed!', 6);
  }

  if (plane.fuel <= 0 && mission.status === 'flying') {
    mission.status = 'outoffuel';
    say(mission, 'Out of fuel — glide her down!', 5);
  }
}

/** One-line objective for the HUD, e.g. "Ring 3/8 · 01:12". */
export function objectiveLine(mission) {
  if (mission.def.rings) {
    return `Ring ${Math.min(mission.nextRing + 1, mission.rings.length)}/${mission.rings.length}`;
  }
  return mission.landings === 0 ? 'Land on runway 09/27' : 'Landed';
}

/** Format seconds as MM:SS. */
export function clockText(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
