// The Ember Isles: a seeded heightfield, a flattened runway strip, the ring
// course, scattered trees and drifting clouds. All placement is derived
// from the world's seed, so the islands never move between runs.
import { WORLD, RING_COURSE } from './config.js';
import { fbm2, mulberry32, clamp } from './random.js';

const NOISE_SEED = WORLD.seed;
const RUNWAY = WORLD.runway;

/** Smooth falloff: 1 at the centre, 0 at and beyond `radius`. */
function islandFalloff(distance, radius) {
  const t = clamp(1 - distance / radius, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Raw island height before the runway is flattened in. */
export function islandHeight(x, z) {
  let h = -6; // ocean floor
  for (const island of WORLD.islands) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    h += island.height * islandFalloff(d, island.radius);
  }
  return h;
}

/** How much of the runway flattening applies at (x, z): 1 on the strip, 0 far away. */
function runwayMask(x, z) {
  const along = Math.abs(x - RUNWAY.x);
  const across = Math.abs(z - RUNWAY.z);
  const a = clamp((RUNWAY.length / 2 + 90 - along) / 90, 0, 1);
  const b = clamp((RUNWAY.width / 2 + 70 - across) / 70, 0, 1);
  return a * b;
}

/** Ground height in metres: islands plus noise detail, flattened under the runway. */
export function groundHeight(x, z) {
  const base = islandHeight(x, z);
  // Detail only where there is land; the ocean floor stays flat.
  const land = clamp((base + 6) / 30, 0, 1);
  const detail = fbm2(x / 170, z / 170, NOISE_SEED) * 7 * land;
  const mask = runwayMask(x, z);
  return base * (1 - mask) + RUNWAY.height * mask + detail * (1 - mask);
}

/** True when (x, z) is on the paved runway strip (with a small margin). */
export function onRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.length / 2 + 4 &&
    Math.abs(z - RUNWAY.z) <= RUNWAY.width / 2 + 4
  );
}

/** The ring course, each ring facing the next waypoint so the pilot flies through it. */
export function buildRings() {
  return RING_COURSE.map((point, index) => {
    const next = RING_COURSE[(index + 1) % RING_COURSE.length];
    const dx = next.x - point.x;
    const dz = next.z - point.z;
    const heading = Math.atan2(-dz, dx); // yaw of the course direction
    return {
      index,
      x: point.x,
      y: point.y,
      z: point.z,
      radius: WORLD.ringRadius,
      heading,
      passed: false,
    };
  });
}

/**
 * Trees: seeded positions on grassy slopes, kept off the runway and out of
 * the sea. Each entry is {x, z, y, size} with y already on the ground.
 */
export function buildTrees() {
  const rand = mulberry32(NOISE_SEED + 101);
  const trees = [];
  for (let i = 0; i < 900; i += 1) {
    const x = (rand() * 2 - 1) * 2600;
    const z = (rand() * 2 - 1) * 2600;
    const h = groundHeight(x, z);
    if (h < 6 || h > 105) continue; // beach, rock and snow stay bare
    if (onRunway(x, z)) continue;
    if (rand() < 0.35) continue; // clumps, not a carpet
    trees.push({ x, z, y: h, size: 7 + rand() * 9 });
  }
  return trees;
}

/**
 * Clouds: soft billboards drifting slowly with the wind. Each entry is
 * {x, y, z, size, speed} and the renderer puffs it as overlapping ellipses.
 */
export function buildClouds() {
  const rand = mulberry32(NOISE_SEED + 202);
  const clouds = [];
  for (let i = 0; i < 46; i += 1) {
    clouds.push({
      x: (rand() * 2 - 1) * 2800,
      y: 230 + rand() * 170,
      z: (rand() * 2 - 1) * 2800,
      size: 90 + rand() * 160,
      speed: 1.5 + rand() * 2.5,
    });
  }
  return clouds;
}
