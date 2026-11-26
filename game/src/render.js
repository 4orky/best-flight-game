// World rendering: a software 3D projector over a Canvas 2D surface. The
// camera chases the aircraft (or sits in its cockpit); terrain, runway,
// trees, rings and clouds are projected each frame and painted far to near,
// with distance fog melting the far islands into the horizon.
import { WORLD, COLOURS, CAMERA } from './config.js';
import { clamp } from './random.js';
import { groundHeight } from './terrain.js';
import { forwardVector } from './physics.js';

/** Build a camera: position, look target and the orthonormal basis. */
function buildCamera(plane, mode, time, canvasW, canvasH) {
  const fwd = forwardVector(plane.yaw, plane.pitch);
  let pos;
  let target;
  if (mode === 'cockpit') {
    pos = {
      x: plane.x + fwd.x * CAMERA.cockpitForward,
      y: plane.y + 0.6,
      z: plane.z + fwd.z * CAMERA.cockpitForward,
    };
    target = { x: plane.x + fwd.x * 120, y: plane.y + fwd.y * 120, z: plane.z + fwd.z * 120 };
  } else if (mode === 'orbit') {
    // Title screen: a slow cinematic circle around the home island, flown
    // above the cloud layer so the isles stay in view.
    const a = time * 0.05;
    pos = { x: Math.cos(a) * 1000, y: 430, z: Math.sin(a) * 1000 };
    target = { x: 0, y: 110, z: 0 };
  } else {
    // Chase: behind and above the aircraft, looking ahead of it.
    pos = {
      x: plane.x - fwd.x * CAMERA.chaseDistance,
      y: plane.y - fwd.y * CAMERA.chaseDistance + CAMERA.chaseHeight,
      z: plane.z - fwd.z * CAMERA.chaseDistance,
    };
    if (pos.y < groundHeight(pos.x, pos.z) + 3) pos.y = groundHeight(pos.x, pos.z) + 3;
    target = { x: plane.x + fwd.x * 46, y: plane.y + fwd.y * 46, z: plane.z + fwd.z * 46 };
  }
  const f = norm({
    x: target.x - pos.x,
    y: target.y - pos.y,
    z: target.z - pos.z,
  });
  const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
  const u = cross(r, f);
  const focal = canvasH / 2 / Math.tan((CAMERA.fovDegrees * Math.PI) / 360);
  return { pos, fwd: f, right: r, up: u, focal, width: canvasW, height: canvasH };
}

function norm(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Project a world point to screen space; null when behind the camera. */
function project(cam, p) {
  const dx = p.x - cam.pos.x;
  const dy = p.y - cam.pos.y;
  const dz = p.z - cam.pos.z;
  const cz = dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z;
  if (cz < 0.8) return null;
  const cx = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
  const cy = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
  return {
    x: cam.width / 2 + (cx * cam.focal) / cz,
    y: cam.height / 2 - (cy * cam.focal) / cz,
    depth: cz,
    scale: cam.focal / cz,
  };
}

/** Mix two hex colours by t (0 = a, 1 = b). */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Terrain colour from height and slope, before fog. */
function terrainColour(h, slope) {
  if (h < 2.5) return COLOURS.sand;
  if (h < 55) return slope > 0.55 ? COLOURS.grassDark : COLOURS.grass;
  if (h < 95) return slope > 0.5 ? COLOURS.rock : COLOURS.grassDark;
  if (h < 118) return COLOURS.rock;
  return COLOURS.snow;
}

/**
 * Collect the frame's paint list: terrain triangles, runway strips, trees.
 * Each entry is {depth, points: [p0, p1, p2] (world), colour, alpha}.
 */
function collectTriangles(cam, trees, plane) {
  const tris = [];
  const cell = WORLD.terrainCell;
  const radius = WORLD.terrainRadius;
  const cx = Math.floor(cam.pos.x / cell) * cell;
  const cz = Math.floor(cam.pos.z / cell) * cell;
  const steps = Math.ceil(radius / cell);
  for (let i = -steps; i < steps; i += 1) {
    for (let j = -steps; j < steps; j += 1) {
      const x0 = cx + i * cell;
      const z0 = cz + j * cell;
      const x1 = x0 + cell;
      const z1 = z0 + cell;
      const h00 = groundHeight(x0, z0);
      const h10 = groundHeight(x1, z0);
      const h01 = groundHeight(x0, z1);
      const h11 = groundHeight(x1, z1);
      const centre = { x: x0 + cell / 2, y: (h00 + h10 + h01 + h11) / 4, z: z0 + cell / 2 };
      const depth = dot({ x: centre.x - cam.pos.x, y: centre.y - cam.pos.y, z: centre.z - cam.pos.z }, cam.fwd);
      if (depth < 2 || depth > radius * 1.5) continue;
      // Skip ocean cells far below the water line: the sea quad covers them.
      if (Math.max(h00, h10, h01, h11) < 0.5) continue;
      const slope = Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00)) / cell;
      const colour = terrainColour(centre.y, slope);
      tris.push({
        depth,
        points: [
          { x: x0, y: h00, z: z0 },
          { x: x1, y: h10, z: z0 },
          { x: x0, y: h01, z: z1 },
        ],
        colour,
      });
      tris.push({
        depth,
        points: [
          { x: x1, y: h10, z: z0 },
          { x: x1, y: h11, z: z1 },
          { x: x0, y: h01, z: z1 },
        ],
        colour,
      });
    }
  }

  // Runway: dark strips laid a hand's breadth above the flattened ground.
  const rw = WORLD.runway;
  const segLen = 30;
  const segs = Math.ceil(rw.length / segLen);
  for (let s = 0; s < segs; s += 1) {
    const a0 = rw.x - rw.length / 2 + s * segLen;
    const a1 = Math.min(rw.x + rw.length / 2, a0 + segLen);
    const midX = (a0 + a1) / 2;
    const depth = dot({ x: midX - cam.pos.x, y: rw.height - cam.pos.y, z: rw.z - cam.pos.z }, cam.fwd);
    if (depth < 2) continue;
    const y = rw.height + 0.35;
    tris.push({
      depth,
      points: [
        { x: a0, y, z: rw.z - rw.width / 2 },
        { x: a1, y, z: rw.z - rw.width / 2 },
        { x: a0, y, z: rw.z + rw.width / 2 },
      ],
      colour: COLOURS.runway,
    });
    tris.push({
      depth,
      points: [
        { x: a1, y, z: rw.z - rw.width / 2 },
        { x: a1, y, z: rw.z + rw.width / 2 },
        { x: a0, y, z: rw.z + rw.width / 2 },
      ],
      colour: COLOURS.runway,
    });
  }
  // Centreline dashes, a touch higher so they never z-fight the strip.
  for (let d = -180; d <= 180; d += 40) {
    const depth = dot({ x: d - cam.pos.x, y: rw.height - cam.pos.y, z: rw.z - cam.pos.z }, cam.fwd);
    if (depth < 2) continue;
    const y = rw.height + 0.55;
    tris.push({
      depth: depth - 0.1,
      points: [
        { x: d - 9, y, z: rw.z - 1 },
        { x: d + 9, y, z: rw.z - 1 },
        { x: d - 9, y, z: rw.z + 1 },
      ],
      colour: COLOURS.runwayLine,
    });
    tris.push({
      depth: depth - 0.1,
      points: [
        { x: d + 9, y, z: rw.z - 1 },
        { x: d + 9, y, z: rw.z + 1 },
        { x: d - 9, y, z: rw.z + 1 },
      ],
      colour: COLOURS.runwayLine,
    });
  }

  // Trees: camera-facing cones, only the ones near the camera.
  const px = plane.x;
  const pz = plane.z;
  for (const tree of trees) {
    const dx = tree.x - px;
    const dz = tree.z - pz;
    if (dx * dx + dz * dz > 1100 * 1100) continue;
    const depth = dot({ x: tree.x - cam.pos.x, y: tree.y - cam.pos.y, z: tree.z - cam.pos.z }, cam.fwd);
    if (depth < 2) continue;
    const s = tree.size * 0.42;
    const rx = cam.right.x * s;
    const rz = cam.right.z * s;
    tris.push({
      depth,
      points: [
        { x: tree.x - rx, y: tree.y, z: tree.z - rz },
        { x: tree.x + rx, y: tree.y, z: tree.z + rz },
        { x: tree.x, y: tree.y + tree.size, z: tree.z },
      ],
      colour: '#2f6b2a',
    });
  }
  return tris;
}

function drawSky(ctx, cam, width, height) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, COLOURS.skyTop);
  grad.addColorStop(0.55, COLOURS.skyMid);
  grad.addColorStop(1, COLOURS.skyHorizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  // Sun: a fixed direction, drawn as a soft disc.
  const sunDir = norm({ x: 0.55, y: 0.42, z: -0.72 });
  const sunPoint = {
    x: cam.pos.x + sunDir.x * 4000,
    y: cam.pos.y + sunDir.y * 4000,
    z: cam.pos.z + sunDir.z * 4000,
  };
  const s = project(cam, sunPoint);
  if (s) {
    const glow = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 90);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(0.25, 'rgba(255,236,170,0.55)');
    glow.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 90, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWater(ctx, cam, width, height) {
  const r = 3200;
  const corners = [
    { x: cam.pos.x - r, y: WORLD.oceanLevel + 0.2, z: cam.pos.z - r },
    { x: cam.pos.x + r, y: WORLD.oceanLevel + 0.2, z: cam.pos.z - r },
    { x: cam.pos.x + r, y: WORLD.oceanLevel + 0.2, z: cam.pos.z + r },
    { x: cam.pos.x - r, y: WORLD.oceanLevel + 0.2, z: cam.pos.z + r },
  ];
  const pts = corners.map((p) => project(cam, p)).filter(Boolean);
  if (pts.length < 3) return;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, COLOURS.waterDeep);
  grad.addColorStop(1, COLOURS.waterShallow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function drawTriangles(ctx, cam, tris) {
  tris.sort((a, b) => b.depth - a.depth);
  const fogMax = WORLD.terrainRadius * 1.35;
  ctx.lineWidth = 0.5;
  for (const tri of tris) {
    const p0 = project(cam, tri.points[0]);
    const p1 = project(cam, tri.points[1]);
    const p2 = project(cam, tri.points[2]);
    if (!p0 || !p1 || !p2) continue;
    // Rough screen cull.
    const minX = Math.min(p0.x, p1.x, p2.x);
    const maxX = Math.max(p0.x, p1.x, p2.x);
    const minY = Math.min(p0.y, p1.y, p2.y);
    const maxY = Math.max(p0.y, p1.y, p2.y);
    if (maxX < -40 || minX > cam.width + 40 || maxY < -40 || minY > cam.height + 40) continue;
    const fog = clamp((tri.depth - 500) / fogMax, 0, 0.85);
    ctx.fillStyle = fog > 0 ? mixHex(tri.colour, COLOURS.skyHorizon, fog) : tri.colour;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds(ctx, cam, clouds, time) {
  const items = [];
  for (const cloud of clouds) {
    const p = project(cam, { x: cloud.x, y: cloud.y, z: cloud.z });
    if (!p) continue;
    items.push({ p, cloud });
  }
  items.sort((a, b) => b.p.depth - a.p.depth);
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  for (const { p, cloud } of items) {
    const size = cloud.size * p.scale * 0.55;
    if (size < 4) continue;
    const fog = clamp((p.depth - 900) / 2600, 0, 0.6);
    ctx.globalAlpha = 0.82 - fog;
    for (let i = 0; i < 4; i += 1) {
      const off = (i - 1.5) * size * 0.42;
      ctx.beginPath();
      ctx.ellipse(p.x + off, p.y + Math.sin(i * 2.1 + cloud.x) * size * 0.08, size * 0.62, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawRings(ctx, cam, mission, time) {
  if (!mission.def.rings) return;
  const rings = mission.rings;
  for (let ri = 0; ri < rings.length; ri += 1) {
    const ring = rings[ri];
    if (ring.passed) continue;
    const isNext = ri === mission.nextRing;
    const centre = project(cam, { x: ring.x, y: ring.y, z: ring.z });
    if (!centre || centre.depth < 15) continue;
    // The ring lies in the vertical plane facing the course direction.
    const nx = Math.cos(ring.heading);
    const nz = -Math.sin(ring.heading);
    const sideX = -nz;
    const sideZ = nx;
    const pts = [];
    const N = 18;
    for (let i = 0; i < N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      const px = ring.x + sideX * Math.cos(a) * ring.radius;
      const py = ring.y + Math.sin(a) * ring.radius;
      const pz = ring.z + sideZ * Math.cos(a) * ring.radius;
      const sp = project(cam, { x: px, y: py, z: pz });
      if (sp) pts.push(sp);
    }
    if (pts.length < 6) continue;
    const fog = clamp((centre.depth - 600) / 2400, 0, 0.7);
    ctx.globalAlpha = 1 - fog;
    ctx.lineWidth = isNext ? 5 + Math.sin(time * 5) * 1.5 : 3;
    ctx.strokeStyle = isNext ? COLOURS.ringNext : COLOURS.ringFar;
    ctx.shadowColor = isNext ? COLOURS.ringNext : 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = isNext ? 18 : 6;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (isNext) {
      ctx.fillStyle = COLOURS.ringNext;
      ctx.font = `bold ${Math.max(13, centre.scale * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${ring.index + 1}`, centre.x, centre.y - ring.radius * centre.scale - 12);
    }
    ctx.globalAlpha = 1;
  }
  // Passed rings: a small green tick where they were, so the pilot sees
  // progress — only while the ring is still sensibly in front of the camera.
  for (const ring of rings) {
    if (!ring.passed) continue;
    const centre = project(cam, { x: ring.x, y: ring.y, z: ring.z });
    if (!centre || centre.depth < 30) continue;
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = COLOURS.ringDone;
    ctx.lineWidth = 3;
    const r = Math.min(26, ring.radius * centre.scale * 0.5);
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, Math.max(3, r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** The aircraft's shadow on the ground below, for depth cueing. */
function drawPlaneShadow(ctx, cam, plane) {
  const ground = groundHeight(plane.x, plane.z);
  const p = project(cam, { x: plane.x, y: ground + 0.8, z: plane.z });
  if (!p) return;
  const h = Math.max(0, plane.y - ground);
  const size = clamp(90 - h * 0.12, 12, 90) * p.scale * 0.12;
  ctx.globalAlpha = clamp(0.35 - h * 0.0006, 0.06, 0.35);
  ctx.fillStyle = '#06283a';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, size, size * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * The bush plane itself, drawn in screen space at the chase camera's centre:
 * a cream-and-ember high-wing with a spinning prop, banked by the roll and
 * nosed by the pitch. Its size is a fixed share of the frame, so it reads
 * at any window size.
 */
function drawPlaneSprite(ctx, cam, plane, time) {
  const width = cam.width;
  const height = cam.height;
  const size = Math.min(width, height) * 0.34;
  const cx = width / 2;
  const cy = height * 0.60 - plane.pitch * height * 0.12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll * 0.9);
  const s = size / 200;
  ctx.scale(s, s);

  // Prop disc, spinning.
  const propSpin = (time * 22) % Math.PI;
  ctx.save();
  ctx.translate(0, -58);
  ctx.rotate(propSpin * 0.4);
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#dfe6ea';
  ctx.beginPath();
  ctx.ellipse(0, 0, 52, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2b2f33';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Wings (high wing, slightly swept back).
  ctx.fillStyle = '#e8542f';
  ctx.beginPath();
  ctx.moveTo(-14, -52);
  ctx.lineTo(-118, -34);
  ctx.lineTo(-118, -22);
  ctx.lineTo(-14, -36);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, -52);
  ctx.lineTo(118, -34);
  ctx.lineTo(118, -22);
  ctx.lineTo(14, -36);
  ctx.closePath();
  ctx.fill();
  // Wing struts.
  ctx.strokeStyle = '#7a3a1e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-10, -30);
  ctx.lineTo(-72, -18);
  ctx.moveTo(10, -30);
  ctx.lineTo(72, -18);
  ctx.stroke();

  // Tail: stabiliser and fin.
  ctx.fillStyle = '#c7431f';
  ctx.beginPath();
  ctx.moveTo(-8, 62);
  ctx.lineTo(-52, 78);
  ctx.lineTo(-52, 86);
  ctx.lineTo(-8, 72);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, 62);
  ctx.lineTo(52, 78);
  ctx.lineTo(52, 86);
  ctx.lineTo(8, 72);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, 58);
  ctx.lineTo(-2, 26);
  ctx.lineTo(8, 30);
  ctx.lineTo(10, 62);
  ctx.closePath();
  ctx.fill();

  // Fuselage: cream body with an ember stripe.
  ctx.fillStyle = '#f7ead2';
  ctx.beginPath();
  ctx.moveTo(0, -62);
  ctx.quadraticCurveTo(13, -40, 12, 0);
  ctx.quadraticCurveTo(11, 48, 0, 66);
  ctx.quadraticCurveTo(-11, 48, -12, 0);
  ctx.quadraticCurveTo(-13, -40, 0, -62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8542f';
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.quadraticCurveTo(0, -2, 12, -8);
  ctx.lineTo(12, 6);
  ctx.quadraticCurveTo(0, 12, -12, 6);
  ctx.closePath();
  ctx.fill();

  // Cockpit windows, lit amber from inside.
  ctx.fillStyle = '#12303f';
  ctx.beginPath();
  ctx.moveTo(-8, -46);
  ctx.quadraticCurveTo(0, -52, 8, -46);
  ctx.lineTo(7, -28);
  ctx.quadraticCurveTo(0, -24, -7, -28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,176,32,0.85)';
  ctx.fillRect(-5, -42, 10, 3);

  // Registration on the tail.
  ctx.fillStyle = '#f7ead2';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N-EMBER', 0, 52);

  // Nav lights: red port, green starboard, white strobe blinking.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-118, -28, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2fd96a';
  ctx.beginPath();
  ctx.arc(118, -28, 3.5, 0, Math.PI * 2);
  ctx.fill();
  if (Math.sin(time * 6) > 0.4) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 86, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Render one frame of the world (no HUD, no screens). `state` carries the
 * plane, mission, trees, clouds, camera mode and clock.
 */
export function renderWorld(ctx, state) {
  const { width, height } = state.canvas;
  const cam = buildCamera(state.plane, state.cameraMode, state.time, width, height);
  state.camera = cam;
  drawSky(ctx, cam, width, height);
  drawWater(ctx, cam, width, height);
  const tris = collectTriangles(cam, state.trees, state.plane);
  drawTriangles(ctx, cam, tris);
  drawClouds(ctx, cam, state.clouds, state.time);
  drawRings(ctx, cam, state.mission, state.time);
  if (state.cameraMode === 'chase') {
    drawPlaneShadow(ctx, cam, state.plane);
    drawPlaneSprite(ctx, cam, state.plane, state.time);
  }
  return cam;
}

export { project };
