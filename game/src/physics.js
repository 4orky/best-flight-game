// The flight model: a light bush plane with throttle, pitch, banked turns,
// stall, wind drift, fuel and ground handling. Arcade-friendly on purpose —
// the stick always answers — but speed, bank and height still trade off
// against each other, so flying well is a skill, not a button hold.
import { PLANE, WORLD } from './config.js';
import { clamp, angleDelta } from './random.js';
import { groundHeight, onRunway } from './terrain.js';

/** Forward direction from yaw (heading) and pitch. */
export function forwardVector(yaw, pitch) {
  return {
    x: Math.cos(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.sin(yaw) * Math.cos(pitch),
  };
}

/** A fresh aircraft on the runway threshold, engine idling, facing east. */
export function freshAircraft() {
  return {
    x: -WORLD.runway.length / 2 + 30,
    y: WORLD.runway.height + 1.6,
    z: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: 100,
    damage: 0,
    onGround: true,
    verticalSpeed: 0,
    // Wind this frame, filled in by step().
    windX: 0,
    windZ: 0,
  };
}

/**
 * Advance the aircraft one step. `input` is {pitch, roll, rudder, throttle}
 * with each axis in [-1, 1] (throttle is a delta: +1 more power, -1 less).
 * Returns an event string: 'takeoff' | 'landed' | 'crashed' | 'ditched' | ''.
 */
export function stepAircraft(plane, input, dt, wind) {
  // Throttle: the lever moves, the engine answers, the speed follows.
  plane.throttle = clamp(plane.throttle + input.throttle * dt * 0.7, 0, 1);
  if (plane.fuel <= 0) plane.throttle = 0;

  const targetSpeed = PLANE.idleSpeed + (PLANE.fullSpeed - PLANE.idleSpeed) * plane.throttle;
  // Climbing trades speed for height; diving buys it back.
  const energy = -Math.sin(plane.pitch) * 9;
  const approach = plane.speed < targetSpeed ? 7 : 5;
  plane.speed += clamp(targetSpeed + energy - plane.speed, -approach * dt, approach * dt);
  plane.speed = clamp(plane.speed, 0, PLANE.maxSpeed);

  // Controls bite harder with airflow and fade near the stall.
  const authority = clamp((plane.speed - 8) / 30, 0.15, 1);

  // Pitch and roll ease toward the stick, then relax hands-off.
  plane.pitch += input.pitch * PLANE.pitchRate * authority * dt;
  plane.pitch = clamp(plane.pitch, -PLANE.maxPitch, PLANE.maxPitch);
  plane.roll += input.roll * PLANE.rollRate * authority * dt;
  plane.roll = clamp(plane.roll, -PLANE.maxRoll, PLANE.maxRoll);
  if (input.roll === 0) plane.roll *= Math.max(0, 1 - 0.9 * dt);
  if (input.pitch === 0) plane.pitch *= Math.max(0, 1 - 0.6 * dt);

  // A banked turn: the nose follows the bank. Rudder nudges the heading.
  const turnRate = -Math.sin(plane.roll) * PLANE.yawFromBank * clamp(plane.speed / 40, 0.3, 1.4);
  plane.yaw += (turnRate + input.rudder * 0.12 * authority) * dt;

  // Wind pushes the whole aircraft sideways; gusts are handled by the caller.
  plane.windX = wind.x;
  plane.windZ = wind.z;

  const fwd = forwardVector(plane.yaw, plane.pitch);
  // Below stall speed the wing stops flying and the aircraft sinks.
  let sink = 0;
  if (plane.speed < PLANE.stallSpeed && !plane.onGround) {
    sink = (PLANE.stallSpeed - plane.speed) * 0.55;
  }
  const vy = fwd.y * plane.speed - sink;
  plane.verticalSpeed = vy;

  plane.x += (fwd.x * plane.speed + plane.windX) * dt;
  plane.y += vy * dt;
  plane.z += (fwd.z * plane.speed + plane.windZ) * dt;

  // Fuel: thirsty at full throttle, sipping at idle.
  if (plane.speed > 1) {
    plane.fuel = Math.max(0, plane.fuel - PLANE.fuelBurn * (0.25 + plane.throttle) * dt);
  }

  // Ground contact.
  const ground = groundHeight(plane.x, plane.z);
  const clearance = plane.y - ground;
  if (plane.onGround) {
    // Rolling on the ground: stay planted on the strip (or the grass) until
    // the pilot rotates for takeoff above stall speed. Brakes bite only at
    // idle throttle; with power on, the engine wins and the roll accelerates.
    plane.y = ground + 1.6;
    plane.verticalSpeed = 0;
    if (ground < 0.5) {
      // Rolled into the sea.
      plane.damage = 100;
      return 'ditched';
    }
    if (plane.throttle < 0.2) {
      plane.speed = Math.max(0, plane.speed - (onRunway(plane.x, plane.z) ? 9 : 14) * dt);
    }
    plane.pitch = 0;
    if (plane.speed > PLANE.stallSpeed + 6 && input.pitch > 0.3) {
      plane.onGround = false;
      plane.pitch = Math.max(plane.pitch, 0.08);
      return 'takeoff';
    }
    return '';
  }
  if (clearance <= 1.6) {
    plane.y = ground + 1.6;
    const rough = !onRunway(plane.x, plane.z);
    // A touchdown is a landing when it is on the strip, gentle, slow and
    // roughly lined up; anything wilder is a crash.
    const hard = vy < -7 || Math.abs(plane.roll) > 0.6 || plane.speed > 55;
    const aligned = Math.abs(angleDelta(plane.yaw, 0)) < 0.6 || Math.abs(angleDelta(plane.yaw, Math.PI)) < 0.6;
    if (!rough && !hard && aligned && plane.speed < 55) {
      // A landing: bleed speed on the strip.
      plane.onGround = true;
      plane.pitch = 0;
      plane.roll *= 0.5;
      plane.speed = Math.max(0, plane.speed - 26 * dt);
      if (plane.speed < 2) plane.speed = 0;
      return 'landed';
    }
    // Hit the ground (or the sea) while flying: that is a crash.
    plane.onGround = true;
    plane.damage = 100;
    return ground < 1 ? 'ditched' : 'crashed';
  }
  return '';
}

/** Score a landing: 0..500 from vertical speed, centreline and alignment. */
export function landingScore(plane) {
  const soft = clamp(1 - Math.max(0, -plane.verticalSpeed - 1.5) / 5, 0, 1);
  const centre = clamp(1 - Math.abs(plane.z) / (WORLD.runway.width / 2), 0, 1);
  const aligned =
    Math.max(0, 1 - Math.abs(angleDelta(plane.yaw, 0)) / 0.35) ||
    Math.max(0, 1 - Math.abs(angleDelta(plane.yaw, Math.PI)) / 0.35);
  const speedOk = clamp(1 - Math.max(0, plane.speed - 34) / 12, 0, 1);
  return Math.round(500 * (soft * 0.4 + centre * 0.25 + aligned * 0.2 + speedOk * 0.15));
}
