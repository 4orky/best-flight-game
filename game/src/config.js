// Sky Courier: Ember Isles — shared constants, mission definitions and colours.
// Units inside the simulation are metres, metres per second and radians;
// the HUD converts to knots and feet for the pilot.
export const WORLD = {
  seed: 20261126,
  // Home island (the runway island) sits at the origin; the other islands
  // are placed around it so every mission stays inside a 5 km square.
  islands: [
    { x: 0, z: 0, radius: 950, height: 118 },
    { x: 1500, z: -750, radius: 620, height: 96 },
    { x: -1250, z: 950, radius: 720, height: 152 },
    { x: 950, z: 1350, radius: 520, height: 74 },
    { x: -1650, z: -1250, radius: 560, height: 86 },
    { x: 2100, z: 900, radius: 380, height: 58 },
  ],
  // Runway 09/27 on the home island: flat, heading east along +x.
  runway: { x: 0, z: 0, heading: 0, length: 420, width: 26, height: 118 },
  oceanLevel: 0,
  // Terrain is drawn in 60 m cells out to this radius around the camera.
  terrainCell: 60,
  terrainRadius: 1260,
  // A ring counts as flown when the aircraft passes within this distance
  // of its centre plane.
  ringRadius: 20,
  ringPass: 14,
};

export const PLANE = {
  cruiseSpeed: 52,
  maxSpeed: 78,
  minSpeed: 16,
  stallSpeed: 22,
  // Throttle 0..1 maps to a target speed between these two.
  idleSpeed: 18,
  fullSpeed: 74,
  pitchRate: 0.55,
  rollRate: 1.9,
  yawFromBank: 0.62,
  maxPitch: 0.62,
  maxRoll: 1.15,
  fuelBurn: 0.16, // percent per second at full throttle
  fuelCapacity: 100,
};

export const CAMERA = {
  chaseDistance: 26,
  chaseHeight: 8,
  cockpitForward: 1.2,
  fovDegrees: 68,
};

// The three missions. Each has its own goal, wind and fuel pressure, so the
// same island chain plays three different sorties.
export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    short: 'Fly all 8 rings in order',
    detail:
      'Thread the glowing rings over the Ember Isles. Clean flying is fast flying: ' +
      'every ring is worth 150 points and the clock bonus pays for smooth lines, not heroics.',
    rings: true,
    landing: false,
    wind: 2.5,
    fuel: 100,
    parSeconds: 150,
  },
  {
    id: 'landing',
    name: 'Island Hop',
    short: 'Land on runway 09/27',
    detail:
      'Take off from the home strip, circle the bay and put her down on runway 09/27. ' +
      'Touch down gentle, slow and on the centreline: the score is all in the landing.',
    rings: false,
    landing: true,
    wind: 4,
    fuel: 100,
    parSeconds: 240,
  },
  {
    id: 'storm',
    name: 'Storm Courier',
    short: 'Deliver through the storm',
    detail:
      'A squall is crossing the isles and the mail still has to fly. Eight rings, ' +
      'gusting wind and a thirsty engine: watch the fuel gauge, it is part of the route.',
    rings: true,
    landing: false,
    wind: 9,
    fuel: 70,
    parSeconds: 170,
  },
];

// The ring course: a loop out over the bay, around the north island and home.
export const RING_COURSE = [
  { x: 520, y: 150, z: -120 },
  { x: 1080, y: 175, z: -520 },
  { x: 1560, y: 140, z: -820 },
  { x: 1180, y: 190, z: -1320 },
  { x: 320, y: 165, z: -1180 },
  { x: -620, y: 200, z: -900 },
  { x: -1180, y: 175, z: -260 },
  { x: -560, y: 150, z: 260 },
];

export const COLOURS = {
  skyTop: '#2f6fb4',
  skyMid: '#7db3dd',
  skyHorizon: '#cfe6f2',
  sun: '#fff3c4',
  waterDeep: '#14557e',
  waterShallow: '#2e86ab',
  sand: '#d9c48f',
  grass: '#5d8f4a',
  grassDark: '#4a7a3c',
  rock: '#8a7d6b',
  snow: '#eef2f5',
  runway: '#3a3f45',
  runwayLine: '#f5f5e8',
  ringNext: '#ffb020',
  ringDone: '#3ddc84',
  ringFar: '#e8eef2',
  hudAmber: '#ffb020',
  hudGreen: '#7dff9e',
  hudRed: '#ff5a4e',
  panel: '#1c222b',
};

export const KEYS = {
  pitchUp: ['ArrowUp', 'KeyI'],
  pitchDown: ['ArrowDown', 'KeyK'],
  rollLeft: ['ArrowLeft', 'KeyJ'],
  rollRight: ['ArrowRight', 'KeyL'],
  rudderLeft: ['KeyA'],
  rudderRight: ['KeyD'],
  throttleUp: ['KeyW', 'ShiftLeft', 'ShiftRight'],
  throttleDown: ['KeyS', 'ControlLeft', 'ControlRight'],
  camera: ['KeyC'],
  pause: ['KeyP'],
  restart: ['KeyR'],
  mute: ['KeyM'],
  mission1: ['Digit1'],
  mission2: ['Digit2'],
  mission3: ['Digit3'],
  confirm: ['Enter', 'Space'],
};
