// Seeded random numbers and smooth value noise. Everything in the world —
// terrain bumps, tree placement, cloud drift — comes from one seed, so the
// same seed always builds the same Ember Isles and the screenshot scenes
// are reproducible frame for frame.

/** Mulberry32: a small, fast seeded PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 2D hash in [0, 1) for integer lattice points. */
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634781) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0, 1), continuous across the plane. */
export function valueNoise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx);
  const v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Two octaves of value noise, roughly in [-1, 1]. */
export function fbm2(x, z, seed) {
  const n1 = valueNoise2(x, z, seed) * 2 - 1;
  const n2 = valueNoise2(x * 2.13 + 7.7, z * 2.13 - 3.1, seed + 5) * 2 - 1;
  return n1 * 0.65 + n2 * 0.35;
}

/** Clamp helper used across the simulation. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Shortest signed angle from `a` to `b`, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
