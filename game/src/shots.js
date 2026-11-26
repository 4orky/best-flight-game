// Staged screenshot scenes behind ?shot=cover|cockpit|rings|landing. Each one
// plays the real rules forward from a fixed pose for a fixed number of steps,
// steered by a small autopilot that flies toward the next ring or the runway,
// so the frame is what a short flight really looks like and the same seed
// always gives the same frame. No pixels are faked: the screenshots are the
// game rendering itself.
import { WORLD } from './config.js';
import { angleDelta, clamp } from './random.js';

const STEP = 1 / 60;

/**
 * Steer toward a point: bank to turn onto the bearing, pitch to meet the
 * altitude, hold a cruise throttle. Returns a stick input for one step.
 */
function autopilot(plane, target, throttle = 0.75) {
  const dx = target.x - plane.x;
  const dy = target.y - plane.y;
  const dz = target.z - plane.z;
  const bearing = Math.atan2(-dz, dx);
  const headingError = angleDelta(plane.yaw, bearing);
  // Yaw rate is -sin(roll) * k, so a negative roll raises the yaw.
  // Gentle banks: the shots should show the aircraft flying, not wrestling.
  const roll = clamp(-headingError * 1.4, -0.75, 0.75);
  const horizontal = Math.sqrt(dx * dx + dz * dz);
  const desiredPitch = clamp(Math.atan2(dy, Math.max(30, horizontal)), -0.32, 0.32);
  const pitch = clamp((desiredPitch - plane.pitch) * 3, -1, 1);
  return { pitch, roll, rudder: 0, throttle: throttle - plane.throttle };
}

/** Place the aircraft at a pose, airborne, engine running. */
function placePlane(plane, x, y, z, yaw, speed = 48, throttle = 0.7) {
  plane.x = x;
  plane.y = y;
  plane.z = z;
  plane.yaw = yaw;
  plane.pitch = 0;
  plane.roll = 0;
  plane.speed = speed;
  plane.throttle = throttle;
  plane.fuel = 100;
  plane.damage = 0;
  plane.onGround = false;
  plane.verticalSpeed = 0;
}

/**
 * Set `world` to the named scene and return the screen and camera to draw.
 * `world` is {plane, mission, ...} and `advance` is (dt, input) => event.
 */
export function stageShot(name, world, advance) {
  const { plane, mission } = world;
  if (name === 'cockpit') {
    // Cockpit view, instruments lit, ring 2 dead ahead through the glass.
    placePlane(plane, 880, 168, -380, 0.28);
    for (let i = 0; i < 60 * 4; i += 1) {
      const ring = mission.rings[mission.nextRing];
      advance(STEP, autopilot(plane, ring || { x: 1560, y: 140, z: -820 }));
    }
    return { screen: 'play', cameraMode: 'cockpit' };
  }
  if (name === 'rings') {
    // Chase view, ring 1 big and centred ahead with the bay below. The
    // aircraft starts already on the bearing to the ring, so the frame
    // shows steady flight, not a hard turn onto the course.
    placePlane(plane, 700, 150, -300, -2.36);
    for (let i = 0; i < 60 * 3; i += 1) {
      const ring = mission.rings[mission.nextRing];
      advance(STEP, autopilot(plane, ring || { x: 520, y: 150, z: -120 }));
      if (mission.ringsDone >= 1) break;
    }
    return { screen: 'play', cameraMode: 'chase' };
  }
  if (name === 'landing') {
    // Final approach: runway 09/27 ahead, low over the bay, gear down in spirit.
    world.mission = world.startMission(1);
    placePlane(plane, -980, 185, 120, 0.12, 44, 0.45);
    for (let i = 0; i < 60 * 18; i += 1) {
      const target = { x: -WORLD.runway.length / 2 + 60, y: WORLD.runway.height + 4, z: 0 };
      advance(STEP, autopilot(plane, target, 0.4));
      if (plane.x > -380) break;
    }
    return { screen: 'play', cameraMode: 'chase' };
  }
  // Cover (default): chase view on the ring course, ring 1 ahead, the home
  // island and its runway in the frame below.
  placePlane(plane, 260, 158, -40, 0.22);
  for (let i = 0; i < 60 * 5; i += 1) {
    const ring = mission.rings[mission.nextRing];
    advance(STEP, autopilot(plane, ring || { x: 520, y: 150, z: -120 }));
  }
  return { screen: 'play', cameraMode: 'chase' };
}
