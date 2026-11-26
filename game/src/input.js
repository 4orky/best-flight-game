// Keyboard and mouse input. The stick is the arrow keys (or I/J/K/L), the
// throttle is W/S, and the mouse steers gently when dragged: the game is
// fully playable on keyboard alone, and the mouse adds a second hand.
import { KEYS } from './config.js';

function has(keys, code) {
  return keys.indexOf(code) !== -1;
}

/** Fresh input state, with the key handlers attached to `target`. */
export function createInput(target) {
  const input = {
    keys: new Set(),
    // Stick axes in [-1, 1], recomputed each frame from the held keys.
    pitch: 0,
    roll: 0,
    rudder: 0,
    throttle: 0,
    // Mouse steering: drag to bank and pitch a little.
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePitch: 0,
    mouseRoll: 0,
    // Edge-triggered actions, consumed by the game loop each frame.
    pressed: new Set(),
    detach() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(event.code) !== -1) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  }
  function onKeyUp(event) {
    input.keys.delete(event.code);
  }
  function onBlur() {
    input.keys.clear();
    input.mouseDown = false;
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  return input;
}

/** Recompute the stick axes from the keys (and the mouse drag) held now. */
export function pollInput(input) {
  const k = input.keys;
  let pitch = 0;
  let roll = 0;
  let rudder = 0;
  let throttle = 0;
  for (const code of k) {
    if (has(KEYS.pitchUp, code)) pitch += 1;
    if (has(KEYS.pitchDown, code)) pitch -= 1;
    if (has(KEYS.rollLeft, code)) roll -= 1;
    if (has(KEYS.rollRight, code)) roll += 1;
    if (has(KEYS.rudderLeft, code)) rudder -= 1;
    if (has(KEYS.rudderRight, code)) rudder += 1;
    if (has(KEYS.throttleUp, code)) throttle += 1;
    if (has(KEYS.throttleDown, code)) throttle -= 1;
  }
  if (input.mouseDown) {
    roll += input.mouseRoll;
    pitch += input.mousePitch;
  }
  input.pitch = Math.max(-1, Math.min(1, pitch));
  input.roll = Math.max(-1, Math.min(1, roll));
  input.rudder = Math.max(-1, Math.min(1, rudder));
  input.throttle = Math.max(-1, Math.min(1, throttle));
}

/** True once when the key was pressed since the last frame; consumes it. */
export function wasPressed(input, codes) {
  for (const code of codes) {
    if (input.pressed.has(code)) {
      input.pressed.delete(code);
      return true;
    }
  }
  return false;
}

/** Attach mouse drag steering to the canvas. */
export function attachMouse(input, canvas) {
  canvas.addEventListener('mousedown', (event) => {
    input.mouseDown = true;
    input.mouseX = event.clientX;
    input.mouseY = event.clientY;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
    input.mouseRoll = 0;
    input.mousePitch = 0;
  });
  window.addEventListener('mousemove', (event) => {
    if (!input.mouseDown) return;
    const dx = event.clientX - input.mouseX;
    const dy = event.clientY - input.mouseY;
    input.mouseRoll = Math.max(-1, Math.min(1, dx / 160));
    input.mousePitch = Math.max(-1, Math.min(1, -dy / 160));
  });
}
