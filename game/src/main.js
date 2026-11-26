// Sky Courier: Ember Isles — boot, game loop and screens. The game runs on
// one canvas: title (with a cinematic orbit over the islands), flight,
// pause and the end-of-sortie panel. ?shot=<name> stages a deterministic
// screenshot scene instead of the title screen.
import { WORLD, MISSIONS, KEYS } from './config.js';
import { freshAircraft, stepAircraft, forwardVector } from './physics.js';
import { startMission, stepMission, windAt } from './missions.js';
import { buildTrees, buildClouds } from './terrain.js';
import { createInput, pollInput, wasPressed, attachMouse } from './input.js';
import { createAudio } from './audio.js';
import { renderWorld } from './render.js';
import { drawHud, drawCockpitPanel, drawTitle, drawPaused, drawGameOver } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const input = createInput(window);
attachMouse(input, canvas);
const audio = createAudio();

const world = {
  canvas,
  plane: freshAircraft(),
  mission: startMission(0),
  trees: buildTrees(),
  clouds: buildClouds(),
  time: 0,
  screen: 'title',
  cameraMode: 'orbit',
  selectedMission: 0,
  bestScores: [undefined, undefined, undefined],
  startMission(index) {
    return startMission(index);
  },
};

function flyMission(index) {
  world.selectedMission = index;
  world.mission = startMission(index);
  world.plane = freshAircraft();
  world.plane.fuel = world.mission.def.fuel;
  world.screen = 'play';
  world.cameraMode = 'chase';
  world.time = 0;
  audio.ensure();
  audio.click();
}

/** One simulation step: wind, aircraft, mission, sounds. */
function advance(dt, stick) {
  const wind = windAt(world.mission, world.time);
  const event = stepAircraft(world.plane, stick, dt, wind);
  stepMission(world.mission, world.plane, event, dt);
  if (world.mission.lastEvent === 'ring') {
    world.mission.lastEvent = '';
    audio.ring();
  }
  if (event === 'landed') audio.touchdown();
  if (event === 'crashed' || event === 'ditched') audio.crash();
  if (world.mission.status !== 'flying' && world.screen === 'play') {
    world.screen = 'over';
    if (world.mission.status === 'done' || world.mission.score > 0) {
      const i = world.mission.index;
      if (world.bestScores[i] === undefined || world.mission.score > world.bestScores[i]) {
        world.bestScores[i] = world.mission.score;
      }
    }
  }
  return event;
}

/** Per-frame input handling for menus and the cockpit. */
function handleKeys() {
  if (wasPressed(input, KEYS.mute)) {
    const muted = audio.toggleMute();
    world.mutedNote = muted ? 'Muted' : 'Sound on';
  }
  if (world.screen === 'title') {
    if (wasPressed(input, KEYS.mission1)) world.selectedMission = 0;
    if (wasPressed(input, KEYS.mission2)) world.selectedMission = 1;
    if (wasPressed(input, KEYS.mission3)) world.selectedMission = 2;
    if (wasPressed(input, KEYS.confirm)) flyMission(world.selectedMission);
    return;
  }
  if (world.screen === 'over') {
    if (wasPressed(input, KEYS.restart)) flyMission(world.mission.index);
    if (wasPressed(input, KEYS.confirm)) {
      world.screen = 'title';
      world.cameraMode = 'orbit';
      world.plane = freshAircraft();
      world.mission = startMission(world.selectedMission);
    }
    return;
  }
  if (world.screen === 'paused') {
    if (wasPressed(input, KEYS.pause) || wasPressed(input, KEYS.confirm)) world.screen = 'play';
    if (wasPressed(input, KEYS.restart)) flyMission(world.mission.index);
    return;
  }
  // In flight.
  if (wasPressed(input, KEYS.pause)) {
    world.screen = 'paused';
    return;
  }
  if (wasPressed(input, KEYS.restart)) {
    flyMission(world.mission.index);
    return;
  }
  if (wasPressed(input, KEYS.camera)) {
    world.cameraMode = world.cameraMode === 'chase' ? 'cockpit' : 'chase';
    audio.click();
  }
}

/** Title-screen mission cards are clickable. */
canvas.addEventListener('click', (event) => {
  audio.ensure();
  if (world.screen !== 'title') return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const cardW = 250;
  const cardH = 158;
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (canvas.width - totalW) / 2;
  const y0 = 258;
  for (let i = 0; i < 3; i += 1) {
    const cx = x0 + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= y0 && y <= y0 + cardH) {
      flyMission(i);
      return;
    }
  }
});

let last = performance.now();
let shotStaged = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.time += dt;

  // Clouds drift with the breeze.
  for (const cloud of world.clouds) {
    cloud.x += cloud.speed * dt;
    if (cloud.x > 3000) cloud.x = -3000;
  }

  if (shotName && !shotStaged) {
    // Stage the screenshot scene once, then hold it still for the capture.
    const staged = stageShot(shotName, world, advance);
    world.screen = staged.screen;
    world.cameraMode = staged.cameraMode;
    shotStaged = true;
    window.__shotReady = true;
  } else if (!shotName) {
    handleKeys();
    pollInput(input);
    input.pressed.clear();
    if (world.screen === 'play') {
      advance(dt, { pitch: input.pitch, roll: input.roll, rudder: input.rudder, throttle: input.throttle });
      audio.update(world.plane.throttle, world.plane.speed, !world.plane.onGround);
    } else if (world.screen === 'title') {
      // The orbit camera flies itself; keep the parked aircraft on the strip.
      world.plane = freshAircraft();
    }
  }

  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderWorld(ctx, world);
  if (world.screen === 'title') {
    drawTitle(ctx, world, world.bestScores);
  } else if (world.screen === 'paused') {
    drawHud(ctx, world);
    drawPaused(ctx, world);
  } else if (world.screen === 'over') {
    drawGameOver(ctx, world);
  } else if (world.cameraMode === 'cockpit') {
    drawCockpitPanel(ctx, canvas.width, canvas.height, world.plane, world.time);
    drawHud(ctx, world);
  } else {
    drawHud(ctx, world);
  }

  // Debug handle for play-testing: the page's own state, mirrored into the
  // DOM (a plain element's text is readable from any automation world,
  // unlike window properties in some headless browsers).
  window.__game = {
    screen: world.screen,
    camera: world.cameraMode,
    speed: world.plane.speed,
    altitude: world.plane.y,
    heading: world.plane.yaw,
    fuel: world.plane.fuel,
    score: world.mission.score,
    rings: world.mission.ringsDone,
    status: world.mission.status,
    shotReady: !!window.__shotReady,
  };
  const stateEl = document.getElementById('state');
  if (stateEl) {
    stateEl.textContent = JSON.stringify(window.__game);
    if (window.__shotReady) stateEl.dataset.ready = '1';
  }
  requestAnimationFrame(frame);
}

// Expose the world for the screenshot stager and for tests.
window.__world = world;
requestAnimationFrame(frame);
