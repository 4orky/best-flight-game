// HUD, cockpit instruments and the title / pause / game-over screens. The
// HUD is drawn on the same canvas as the world, so a screenshot always
// shows altitude, speed and heading exactly as the pilot sees them.
import { COLOURS, MISSIONS } from './config.js';
import { clamp } from './random.js';
import { clockText, objectiveLine } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function panel(ctx, x, y, w, h, alpha = 0.62) {
  ctx.save();
  ctx.fillStyle = `rgba(8,18,28,${alpha})`;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, colour, align = 'left', bold = false) {
  ctx.fillStyle = colour;
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

/** Heading in degrees, 0 = east, increasing counter-clockwise on the tape. */
function headingDegrees(plane) {
  let deg = (-plane.yaw * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

function knots(speed) {
  return Math.round(speed * 1.94384);
}

function feet(altitude) {
  return Math.round(altitude * 3.28084);
}

/** The compass tape across the top centre of the screen. */
function drawCompass(ctx, width, plane) {
  const heading = headingDegrees(plane);
  const cx = width / 2;
  const y = 34;
  panel(ctx, cx - 190, 12, 380, 44, 0.55);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 190, 12, 380, 44);
  ctx.clip();
  const labels = [
    [0, 'E'],
    [45, 'NE'],
    [90, 'N'],
    [135, 'NW'],
    [180, 'W'],
    [225, 'SW'],
    [270, 'S'],
    [315, 'SE'],
  ];
  for (let d = -180; d <= 180; d += 15) {
    const h = ((heading + d) % 360 + 360) % 360;
    const x = cx + d * 2.1;
    const major = h % 45 === 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x, y + (major ? 22 : 15));
    ctx.stroke();
    if (major) {
      const label = labels.find(([deg]) => deg === h);
      if (label) text(ctx, label[1], x, y + 36, 12, '#ffffff', 'center', true);
      else text(ctx, String(h), x, y + 36, 10, 'rgba(255,255,255,0.8)', 'center');
    }
  }
  ctx.restore();
  // Centre caret and the numeric heading.
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx - 7, 12);
  ctx.lineTo(cx + 7, 12);
  ctx.lineTo(cx, 22);
  ctx.closePath();
  ctx.fill();
  text(ctx, `${String(Math.round(heading)).padStart(3, '0')}°`, cx, 74, 13, COLOURS.hudAmber, 'center', true);
}

/** Left flight-data block: speed, altitude, vertical speed, heading. */
function drawFlightData(ctx, plane) {
  panel(ctx, 14, 12, 208, 108, 0.62);
  text(ctx, 'AIRSPEED', 28, 36, 11, 'rgba(255,255,255,0.65)', 'left', true);
  text(ctx, `${knots(plane.speed)} kt`, 28, 60, 22, '#ffffff', 'left', true);
  text(ctx, 'ALTITUDE', 28, 84, 11, 'rgba(255,255,255,0.65)', 'left', true);
  text(ctx, `${feet(plane.y)} ft`, 28, 106, 22, '#ffffff', 'left', true);
  text(ctx, `V/S ${plane.verticalSpeed >= 0 ? '+' : ''}${Math.round(plane.verticalSpeed * 196.85)} fpm`, 150, 36, 11, 'rgba(255,255,255,0.65)', 'left', true);
  text(ctx, `HDG ${String(Math.round(headingDegrees(plane))).padStart(3, '0')}°`, 150, 60, 11, 'rgba(255,255,255,0.65)', 'left', true);
  const fuelColour = plane.fuel < 20 ? COLOURS.hudRed : plane.fuel < 40 ? COLOURS.hudAmber : COLOURS.hudGreen;
  text(ctx, `FUEL ${Math.round(plane.fuel)}%`, 150, 84, 11, fuelColour, 'left', true);
  text(ctx, `THR ${Math.round(plane.throttle * 100)}%`, 150, 106, 11, '#ffffff', 'left', true);
}

/** Right mission block: objective, score, timer, throttle and fuel bars. */
function drawMissionBlock(ctx, width, mission, plane) {
  panel(ctx, width - 222, 12, 208, 108, 0.62);
  text(ctx, mission.def.name.toUpperCase(), width - 208, 36, 11, COLOURS.hudAmber, 'left', true);
  text(ctx, objectiveLine(mission), width - 208, 58, 15, '#ffffff', 'left', true);
  text(ctx, `SCORE ${mission.score}`, width - 208, 80, 13, '#ffffff', 'left', true);
  text(ctx, clockText(mission.time), width - 28, 36, 16, '#ffffff', 'right', true);
  // Throttle bar.
  bar(ctx, width - 208, 92, 92, 10, plane.throttle, '#7db3dd');
  text(ctx, 'THR', width - 208, 88, 9, 'rgba(255,255,255,0.6)', 'left');
  // Fuel bar.
  const fuelColour = plane.fuel < 20 ? COLOURS.hudRed : COLOURS.hudGreen;
  bar(ctx, width - 104, 92, 92, 10, plane.fuel / 100, fuelColour);
  text(ctx, 'FUEL', width - 104, 88, 9, 'rgba(255,255,255,0.6)', 'left');
}

function bar(ctx, x, y, w, h, frac, colour) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.fillStyle = colour;
  if (frac > 0.01) {
    roundRect(ctx, x, y, Math.max(4, w * clamp(frac, 0, 1)), h, 3);
    ctx.fill();
  }
}

/** Small attitude indicator (artificial horizon) bottom-left. */
function drawAttitude(ctx, width, height, plane) {
  const cx = 62;
  const cy = height - 62;
  const r = 40;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const pitchPx = clamp(plane.pitch, -0.6, 0.6) * r * 1.1;
  ctx.fillStyle = '#5fa8d8';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + 1);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings marker.
  ctx.strokeStyle = COLOURS.hudAmber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx - 6, cy);
  ctx.moveTo(cx + 6, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.stroke();
  text(ctx, 'ATTITUDE', cx, cy + r + 16, 10, 'rgba(255,255,255,0.65)', 'center', true);
}

/** One round gauge with a needle: value in [min, max] maps to a sweep. */
function drawGauge(ctx, cx, cy, r, label, value, min, max, unit, lit) {
  ctx.save();
  // Face.
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  glow.addColorStop(0, '#2a3542');
  glow.addColorStop(1, '#10161d');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lit ? 'rgba(255,176,32,0.8)' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Ticks.
  for (let i = 0; i <= 10; i += 1) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const major = i % 5 === 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * (major ? 0.78 : 0.85), cy + Math.sin(a) * r * (major ? 0.78 : 0.85));
    ctx.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94);
    ctx.stroke();
  }
  // Needle.
  const frac = clamp((value - min) / (max - min), 0, 1);
  const na = Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = COLOURS.hudAmber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(na) * r * 0.72, cy + Math.sin(na) * r * 0.72);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, label, cx, cy + r + 15, 10, 'rgba(255,255,255,0.75)', 'center', true);
  text(ctx, unit, cx, cy + r * 0.52, 11, '#ffffff', 'center', true);
  ctx.restore();
}

/**
 * Cockpit view: the instrument panel across the bottom of the screen, with
 * six lit gauges, a centre attitude ball, the throttle lever and the nose
 * cone — the world stays visible through the windshield above it.
 */
export function drawCockpitPanel(ctx, width, height, plane, time) {
  const panelTop = height * 0.66;
  // Panel body.
  const grad = ctx.createLinearGradient(0, panelTop, 0, height);
  grad.addColorStop(0, '#232c38');
  grad.addColorStop(1, '#12181f');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, panelTop + 26);
  ctx.quadraticCurveTo(width / 2, panelTop - 26, width, panelTop + 26);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Nose cone peeking over the panel.
  ctx.fillStyle = '#e8542f';
  ctx.beginPath();
  ctx.moveTo(width / 2 - 34, panelTop + 4);
  ctx.quadraticCurveTo(width / 2, panelTop - 34, width / 2 + 34, panelTop + 4);
  ctx.closePath();
  ctx.fill();
  // Windshield struts.
  ctx.strokeStyle = '#141a20';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(width * 0.28, 0);
  ctx.lineTo(width * 0.34, panelTop);
  ctx.moveTo(width * 0.72, 0);
  ctx.lineTo(width * 0.66, panelTop);
  ctx.stroke();

  const gy = panelTop + (height - panelTop) * 0.52;
  const r = Math.min(34, (height - panelTop) * 0.34);
  const gap = Math.min(108, width / 9);
  const cx0 = width / 2 - gap * 2.5;
  drawGauge(ctx, cx0, gy, r, 'AIRSPEED', knots(plane.speed), 0, 160, `${knots(plane.speed)} kt`, true);
  drawGauge(ctx, cx0 + gap, gy, r, 'ALTITUDE', feet(plane.y), 0, 3000, `${feet(plane.y)} ft`, true);
  // Attitude ball in the centre.
  const ax = cx0 + gap * 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, gy, r + 4, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(ax, gy);
  ctx.rotate(-plane.roll);
  const pitchPx = clamp(plane.pitch, -0.6, 0.6) * r * 1.4;
  ctx.fillStyle = '#5fa8d8';
  ctx.fillRect(-r - 4, -r - 4 - pitchPx, (r + 4) * 2, r + 4 + pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r - 4, pitchPx, (r + 4) * 2, r + 4 - pitchPx + 1);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r - 4, pitchPx);
  ctx.lineTo(r + 4, pitchPx);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,176,32,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, gy, r + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = COLOURS.hudAmber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ax - 20, gy);
  ctx.lineTo(ax - 6, gy);
  ctx.moveTo(ax + 6, gy);
  ctx.lineTo(ax + 20, gy);
  ctx.stroke();
  text(ctx, 'ATTITUDE', ax, gy + r + 22, 10, 'rgba(255,255,255,0.75)', 'center', true);
  drawGauge(ctx, cx0 + gap * 3, gy, r, 'HEADING', headingDegrees(plane), 0, 360, `${String(Math.round(headingDegrees(plane))).padStart(3, '0')}°`, true);
  drawGauge(ctx, cx0 + gap * 4, gy, r, 'VERT SPEED', plane.verticalSpeed * 196.85, -2000, 2000, `${plane.verticalSpeed >= 0 ? '+' : ''}${Math.round(plane.verticalSpeed * 196.85)}`, true);
  drawGauge(ctx, cx0 + gap * 5, gy, r, 'FUEL', plane.fuel, 0, 100, `${Math.round(plane.fuel)}%`, plane.fuel > 15);
  // Throttle lever on the right.
  const tx = width - 52;
  const ty0 = gy - r;
  const ty1 = gy + r;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tx, ty0);
  ctx.lineTo(tx, ty1);
  ctx.stroke();
  const leverY = ty1 - plane.throttle * (ty1 - ty0);
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.beginPath();
  ctx.arc(tx, leverY, 7, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'THR', tx, ty1 + 20, 10, 'rgba(255,255,255,0.75)', 'center', true);
  // Panel lamp glow: a warm wash that sells "instruments lit".
  const lamp = ctx.createRadialGradient(width / 2, gy, 10, width / 2, gy, width * 0.45);
  lamp.addColorStop(0, 'rgba(255,176,32,0.05)');
  lamp.addColorStop(1, 'rgba(255,176,32,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, panelTop, width, height - panelTop);
  // Blinking beacon reflection on the panel edge.
  if (Math.sin(time * 6) > 0.4) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(width / 2, panelTop + 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Full HUD for the chase view (flight data, compass, mission, attitude). */
export function drawHud(ctx, state) {
  const { width, height } = state.canvas;
  const { plane, mission } = state;
  drawFlightData(ctx, plane);
  drawCompass(ctx, width, plane);
  drawMissionBlock(ctx, width, mission, plane);
  if (state.cameraMode !== 'cockpit') drawAttitude(ctx, width, height, plane);
  // Centre flight-path marker.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  const cx = width / 2;
  const cy = height * 0.48;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 16);
  ctx.lineTo(cx, cy - 6);
  ctx.moveTo(cx, cy + 6);
  ctx.lineTo(cx, cy + 16);
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx - 6, cy);
  ctx.moveTo(cx + 6, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.stroke();
  // Transient mission message.
  if (mission.message) {
    const mw = ctx.measureText(mission.message).width + 28;
    panel(ctx, cx - mw / 2, 92, mw, 30, 0.6);
    text(ctx, mission.message, cx, 112, 15, COLOURS.hudAmber, 'center', true);
  }
  // Warnings.
  if (plane.fuel < 20 && mission.status === 'flying' && Math.sin(state.time * 8) > 0) {
    text(ctx, 'LOW FUEL', cx, 150, 20, COLOURS.hudRed, 'center', true);
  }
  if (plane.speed < 22 && !plane.onGround && mission.status === 'flying') {
    text(ctx, 'STALL — NOSE DOWN, POWER UP', cx, 176, 18, COLOURS.hudRed, 'center', true);
  }
  // Controls hint, early in the flight only.
  if (mission.time < 25 && mission.status === 'flying') {
    text(ctx, '↑↓ pitch · ←→ bank · W/S throttle · A/D rudder · C cockpit · P pause', width - 16, height - 16, 12, 'rgba(255,255,255,0.75)', 'right');
  }
}

/** Title screen over the orbiting island view. */
export function drawTitle(ctx, state, bestScores) {
  const { width, height } = state.canvas;
  ctx.fillStyle = 'rgba(6,16,26,0.42)';
  ctx.fillRect(0, 0, width, height);
  text(ctx, 'SKY COURIER', width / 2, 118, 64, '#ffffff', 'center', true);
  text(ctx, 'E M B E R   I S L E S', width / 2, 152, 20, COLOURS.hudAmber, 'center', true);
  text(ctx, 'A bush-plane courier over a chain of volcanic isles. Fly the rings, mind the fuel,', width / 2, 192, 16, 'rgba(255,255,255,0.9)', 'center');
  text(ctx, 'and bring her home to runway 09/27.', width / 2, 214, 16, 'rgba(255,255,255,0.9)', 'center');
  const cardW = 250;
  const cardH = 158;
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (width - totalW) / 2;
  const y0 = 258;
  MISSIONS.forEach((def, i) => {
    const x = x0 + i * (cardW + gap);
    const selected = state.selectedMission === i;
    panel(ctx, x, y0, cardW, cardH, selected ? 0.85 : 0.55);
    if (selected) {
      ctx.strokeStyle = COLOURS.hudAmber;
      ctx.lineWidth = 2.5;
      roundRect(ctx, x, y0, cardW, cardH, 8);
      ctx.stroke();
    }
    text(ctx, `${i + 1} · ${def.name.toUpperCase()}`, x + 16, y0 + 30, 16, selected ? COLOURS.hudAmber : '#ffffff', 'left', true);
    text(ctx, def.short, x + 16, y0 + 54, 13, 'rgba(255,255,255,0.85)', 'left');
    wrapText(ctx, def.detail, x + 16, y0 + 76, cardW - 32, 15, 12, 'rgba(255,255,255,0.75)');
    const best = bestScores[i];
    if (best !== undefined) text(ctx, `Best: ${best} pts`, x + 16, y0 + cardH - 14, 12, COLOURS.hudGreen, 'left', true);
  });
  text(ctx, 'Press 1 / 2 / 3 to choose a mission, Enter to fly — or click a card.', width / 2, y0 + cardH + 34, 15, '#ffffff', 'center', true);
  text(ctx, '↑↓ pitch · ←→ bank · W/S throttle · A/D rudder · C camera · M mute · R restart · P pause', width / 2, y0 + cardH + 60, 13, 'rgba(255,255,255,0.75)', 'center');
  text(ctx, 'Mouse: drag to steer. No network, no downloads — the whole game is in these files.', width / 2, height - 22, 12, 'rgba(255,255,255,0.55)', 'center');
}

function wrapText(ctx, str, x, y, maxW, lineH, size, colour) {
  ctx.fillStyle = colour;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = 'left';
  const words = str.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

/** Pause overlay. */
export function drawPaused(ctx, state) {
  const { width, height } = state.canvas;
  ctx.fillStyle = 'rgba(6,16,26,0.55)';
  ctx.fillRect(0, 0, width, height);
  text(ctx, 'PAUSED', width / 2, height / 2 - 10, 44, '#ffffff', 'center', true);
  text(ctx, 'P to resume · R to restart · Enter for the menu', width / 2, height / 2 + 28, 15, 'rgba(255,255,255,0.85)', 'center');
}

/** End-of-sortie panel: crash, ditch, fuel-out, course done or landed. */
export function drawGameOver(ctx, state) {
  const { width, height } = state.canvas;
  const mission = state.mission;
  const titles = {
    done: mission.def.landing ? 'LANDED — WELCOME HOME' : 'COURSE COMPLETE',
    crashed: 'CRASHED',
    ditched: 'DITCHED IN THE BAY',
    outoffuel: 'OUT OF FUEL',
  };
  ctx.fillStyle = 'rgba(6,16,26,0.55)';
  ctx.fillRect(0, 0, width, height);
  const pw = 460;
  const ph = 250;
  const px = (width - pw) / 2;
  const py = (height - ph) / 2;
  panel(ctx, px, py, pw, ph, 0.88);
  text(ctx, titles[mission.status] || 'SORTIE OVER', width / 2, py + 48, 30, mission.status === 'done' ? COLOURS.hudGreen : COLOURS.hudRed, 'center', true);
  text(ctx, `${mission.def.name} · ${clockText(mission.time)}`, width / 2, py + 80, 15, 'rgba(255,255,255,0.85)', 'center');
  if (mission.def.rings) text(ctx, `Rings flown: ${mission.ringsDone} / ${mission.rings.length}`, width / 2, py + 108, 15, '#ffffff', 'center');
  if (mission.def.landing) text(ctx, `Best landing: ${mission.bestLanding} pts`, width / 2, py + 108, 15, '#ffffff', 'center');
  text(ctx, `Score: ${mission.score} pts`, width / 2, py + 140, 22, COLOURS.hudAmber, 'center', true);
  const best = state.bestScores[mission.index];
  if (best !== undefined && mission.score >= best && mission.score > 0) {
    text(ctx, 'New best for this mission!', width / 2, py + 168, 14, COLOURS.hudGreen, 'center', true);
  }
  text(ctx, 'R fly again · Enter for the menu', width / 2, py + 208, 14, 'rgba(255,255,255,0.85)', 'center');
}
