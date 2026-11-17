import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTerrain, terrainHeight, terrainNormal, RANGE_LIMIT } from './terrain.js';
import { createPost } from './post.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createRange } from './range.js';
import { createEnvironment, createBallistics, GRAVITY } from './sim.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const AUTO_LOW_POWER = window.matchMedia?.('(pointer: coarse)').matches
  || Math.min(window.innerWidth, window.innerHeight) < 760;
let lowPower = AUTO_LOW_POWER;
const ui = {
  loader: $('loader'),
  loaderBar: $('loader-bar'),
  loaderStatus: $('loader-status'),
  loaderPercent: $('loader-percent'),
  error: $('error'),
  errorText: $('error-text'),
  fps: $('fps'),
  grid: $('grid'),
  speed: $('speed'),
  gear: $('gear'),
  driveState: $('drive-state'),
  throttle: $('throttle'),
  turret: $('turret'),
  elevation: $('elevation'),
  grade: $('grade'),
  reticle: $('reticle'),
  rangeReadout: $('range-readout'),
  reticleAmmo: $('reticle-ammo'),
  impactReticle: $('impact-reticle'),
  impactReadout: $('impact-readout'),
  score: $('score'),
  best: $('best'),
  combo: $('combo'),
  reloadBar: $('reload-bar'),
  reloadLabel: $('reload-label'),
  feed: $('feed'),
  hitmarker: $('hitmarker'),
  popups: $('popups'),
  flash: $('flash'),
  notice: $('notice'),
  ammoChips: [...document.querySelectorAll('[data-shell]')],
  sight: $('sight-mode'),
  role: $('crew-role'),
  weather: $('weather'),
  wind: $('wind'),
  temp: $('temp'),
  fuse: $('fuse'),
  compass: $('compass'),
  objective: $('objective'),
  systems: $('systems'),
  systemBars: [...document.querySelectorAll('[data-system]')],
  damageArcs: $('damage-arcs'),
  laserWarning: $('laser-warning'),
  projectileMarker: $('projectile-marker'),
  projectileReadout: $('projectile-readout'),
  perf: $('perf'),
  reloadRing: $('reload-ring'),
  shotFlag: $('shot-flag'),
  backend: $('backend'),
  damageFlash: $('damage-flash'),
  repair: $('repair'),
  repairBar: $('repair-bar'),
  repairLabel: $('repair-label'),
  tracker: $('tracker'),
  escape: $('escape-menu'),
  escapeResume: $('escape-resume'),
  escapeReset: $('escape-reset'),
  escapeAudio: $('escape-audio'),
  escapeGearbox: $('escape-gearbox'),
  escapeQuality: $('escape-quality'),
  menuEngine: $('menu-engine'),
  menuBrake: $('menu-brake'),
  menuGear: $('menu-gear'),
  menuRpm: $('menu-rpm'),
  menuSpeed: $('menu-speed'),
  menuSmoke: $('menu-smoke'),
  menuShell: $('menu-shell'),
  menuRole: $('menu-role'),
  menuSight: $('menu-sight'),
  menuWeather: $('menu-weather'),
  menuGearbox: $('menu-gearbox'),
  menuQuality: $('menu-quality'),
  miniGear: $('mini-gear'),
  miniRpm: $('mini-rpm'),
  miniSpeed: $('mini-speed'),
};

const DEG = Math.PI / 180;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const damp = (value, target, lambda, dt) =>
  THREE.MathUtils.lerp(value, target, 1 - Math.exp(-lambda * dt));
const moveToward = (value, target, maxDelta) => {
  if (Math.abs(target - value) <= maxDelta) return target;
  return value + Math.sign(target - value) * maxDelta;
};
const wrapAngle = (angle) => {
  let wrapped = (angle + Math.PI) % (Math.PI * 2);
  if (wrapped < 0) wrapped += Math.PI * 2;
  return wrapped - Math.PI;
};
const approachAngle = (current, target, maxStep) => {
  const delta = wrapAngle(target - current);
  return current + clamp(delta, -maxStep, maxStep);
};
const loadBest = () => {
  try {
    return Number(window.localStorage.getItem('ironstorm.tankLab.best')) || 0;
  } catch {
    return 0;
  }
};
const saveBest = (value) => {
  try {
    window.localStorage.setItem('ironstorm.tankLab.best', String(value));
  } catch {
    // The range still works when storage is blocked.
  }
};

const SHELLS = [
  {
    id: 'APFSDS', label: 'APFSDS', velocity: 850, drag: 0.000035, reload: 6.4,
    damage: 125, penetration: 560, blast: 1.5, recoil: 0.95, heat: 0.09, wear: 0.022,
    tracer: 0xffe7b0, color: 0xe6cf92, hint: 'SABOT · FLAT TRAJECTORY', caliber: 125,
  },
  {
    id: 'HEAT', label: 'HEAT-FS', velocity: 620, drag: 0.00005, reload: 7.8,
    damage: 115, penetration: 480, blast: 5.5, recoil: 1.15, heat: 0.12, wear: 0.02,
    tracer: 0xffb05e, color: 0xd88946, hint: 'CHEMICAL · BLAST', caliber: 125,
  },
  {
    id: 'HE', label: 'HE-FRAG', velocity: 680, drag: 0.00006, reload: 8.6,
    damage: 70, penetration: 80, blast: 9, recoil: 1.3, heat: 0.16, wear: 0.018,
    tracer: 0xff8a4a, color: 0xc76b42, hint: 'AREA · ANTI-MATERIEL', caliber: 125,
  },
  {
    id: 'HESH', label: 'HESH', velocity: 600, drag: 0.00006, reload: 8.2,
    damage: 88, penetration: 160, blast: 7.5, recoil: 1.22, heat: 0.14, wear: 0.02,
    tracer: 0xffcf86, color: 0xd6b274, hint: 'SPALL · ANTI-STRUCTURE', caliber: 125,
  },
  {
    id: 'SMOKE', label: 'SMOKE', velocity: 420, drag: 0.00008, reload: 5.2,
    damage: 1, penetration: 0, blast: 0, recoil: 0.72, heat: 0.07, wear: 0.012,
    tracer: 0xc6d6b2, color: 0x7f8d78, hint: 'SCREEN · CONCEALMENT', caliber: 125, smoke: true,
  },
  {
    id: 'CAN', label: 'CANISTER', velocity: 760, drag: 0.00012, reload: 5.6,
    damage: 22, penetration: 24, blast: 1, recoil: 0.82, heat: 0.08, wear: 0.015,
    tracer: 0xffe0a0, color: 0xd7a15b, hint: 'CLOSE · 12 PELLETS', caliber: 125, pellets: 8,
  },
  {
    id: 'ATGM', label: 'ATGM', velocity: 300, drag: 0.000015, reload: 11.5,
    damage: 180, penetration: 700, blast: 6, recoil: 0.8, heat: 0.06, wear: 0.01,
    tracer: 0xff8750, color: 0xbd5a38, hint: 'GUIDED · LONG RANGE', caliber: 125, guided: true,
  },
];

const FUSES = ['IMPACT', 'DELAY', 'PROXIMITY', 'AIRBURST'];
const CREW_ROLES = ['EXTERNAL', 'GUNNER', 'COMMANDER', 'DRIVER'];
// The T-72M uses a manual seven-speed gearbox. Speeds are the practical
// limiter for each gear in m/s; N is a true neutral for pivot steering.
const GEARS = [
  { label: 'R', max: 5.2, accel: 2.7 },
  { label: 'N', max: 0, accel: 0 },
  { label: '1', max: 6.4, accel: 5.2 },
  { label: '2', max: 8.8, accel: 4.6 },
  { label: '3', max: 11.2, accel: 4.0 },
  { label: '4', max: 13.6, accel: 3.4 },
  { label: '5', max: 16.0, accel: 2.8 },
  { label: '6', max: 18.0, accel: 2.2 },
  { label: '7', max: 20.0, accel: 1.7 },
];
const FIRST_GEAR_INDEX = 2;
const SIGHTS = ['DAY', 'THERMAL', 'NIGHT'];
const INITIAL_OBJECTIVE = 'QUALIFY · DESTROY THE FUEL BATTERY';
const SYSTEMS = {
  engine: 100,
  tracks: 100,
  stabilizer: 100,
  optics: 100,
  turret: 100,
  gun: 100,
  fuel: 100,
  crew: 100,
};
const systems = { ...SYSTEMS };
const crewState = {
  role: 'EXTERNAL',
  sight: 'DAY',
  thermalPolarity: 1,
  zoom: 1,
  buttoned: false,
  photoMode: false,
};
let fuseIndex = 0;
let engineOn = true;
let parkingBrake = false;
let autoGear = true;
let smokeCharges = 3;
let smokeCooldown = 0;
let paused = false;
let environment = null;
let ballistics = null;
let shotCamera = null;
let shotCameraActive = false;
let repair = { module: null, timer: 0, total: 0 };
let damageFlash = 0;
let damageAngle = 0;
let warningTimer = 0;
let warningAngle = 0;
let incomingTimer = 0;
let incomingAngle = 0;
let damageLevel = 0;
const warningSource = new THREE.Vector3();
const incomingSource = new THREE.Vector3();
let mgCooldown = 0;
let mgShots = 0;
let enemyShots = 0;
let artilleryShots = 0;
let missionWave = 1;
let missionKills = 0;
let objective = INITIAL_OBJECTIVE;
let fpsAverage = 60;
let renderScale = 1;
let lastPlayerPosition = new THREE.Vector3();
let lastFrameTime = 0;
const playerVelocity = new THREE.Vector3();
const enemyProjectiles = [];
const artilleryQueue = [];
const tmpVector = new THREE.Vector3();
const tmpVector2 = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();

const tank = {
  x: 0,
  z: 0,
  y: 0.04,
  vy: 0,
  heading: 0,
  speed: 0,
  turretYaw: 0,
  gunPitch: 0.03,
  grade: 0,
  rpm: 0.18,
  gear: '1',
  gearIndex: FIRST_GEAR_INDEX,
  impactCooldown: 0,
};

const cameraRig = {
  yawOffset: 0,
  pitch: 0.34,
  distance: 11.5,
  look: new THREE.Vector3(0, 1.5, -7),
};

const pointer = {
  ndc: new THREE.Vector2(0, 0.05),
  inside: false,
  dragging: false,
  dirty: true,
  lastX: 0,
  lastY: 0,
};
const keys = new Set();

let renderer;
let scene;
let camera;
let terrain;
let post;
let fx;
let audio;
let range;
let tankRoot;
let turretPivot;
let barrelPivot;
let barrelRestPosition = null;
let trackMaterial;
let trackOffset = 0;
let triangles = 0;
let vertices = 0;
let meshes = 0;
let modelSize = new THREE.Vector3();
let noticeTimeout = 0;
let hudElapsed = 0;
let fpsElapsed = 0;
let fpsFrames = 0;
let trackDistance = 0;
let dustTimer = 0;
let exhaustTimer = 0;
let contactShadow;
let muzzleFlashTimeout = 0;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();
let aimSolveCooldown = 0;
let aimHasSolution = false;
let lastImpactX = Infinity;
let lastImpactY = Infinity;
let lastImpactLabel = '';
let lastImpactOffscreen = null;
let lastSunX = Infinity;
let lastSunY = Infinity;
let lastSunZ = Infinity;
const reticleMuzzle = new THREE.Vector3();
const reticleDirection = new THREE.Vector3();
const reticleVelocity = new THREE.Vector3();
const reticleImpact = new THREE.Vector3();
const reticleProjection = new THREE.Vector3();
const reticleQuaternion = new THREE.Quaternion();
const stableTankQuaternion = new THREE.Quaternion();
const turretAimQuaternion = new THREE.Quaternion();
const barrelAimQuaternion = new THREE.Quaternion();
const xAxis = new THREE.Vector3(1, 0, 0);
const sunDirection = new THREE.Vector3();
const sunLight = new THREE.DirectionalLight();
const fillLight = new THREE.DirectionalLight();
const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3();
const back = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const cameraLook = new THREE.Vector3();
const stableCameraPosition = new THREE.Vector3();
const aimCamera = new THREE.PerspectiveCamera(56, 1, 0.1, 1500);
const targetQuaternion = new THREE.Quaternion();
const basis = new THREE.Matrix4();
const smoothedForward = new THREE.Vector3();
const smoothedRight = new THREE.Vector3();
const recoilQuaternion = new THREE.Quaternion();
const recoilEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const muzzleBase = new THREE.Vector3();
const muzzlePosition = new THREE.Vector3();
const gunDirection = new THREE.Vector3();
const shotDirection = new THREE.Vector3();
const shotVelocity = new THREE.Vector3();
const previousPosition = new THREE.Vector3();
const segmentDirection = new THREE.Vector3();
const hitPoint = new THREE.Vector3();
const hitNormal = new THREE.Vector3();
const localPoint = new THREE.Vector3();
const screenPoint = new THREE.Vector3();
const targetPoint = new THREE.Vector3();
const barrelWorldPosition = new THREE.Vector3();
const aimDirection = new THREE.Vector3();
const turretWorldQuaternion = new THREE.Quaternion();
const forwardFromGun = new THREE.Vector3(0, 0, -1);
const worldUp = new THREE.Vector3(0, 1, 0);
const projectileLightPosition = new THREE.Vector3();

const recoil = {
  pitch: 0,
  roll: 0,
  heave: 0,
  barrel: 0,
  pitchVelocity: 0,
  rollVelocity: 0,
  heaveVelocity: 0,
  barrelVelocity: 0,
};

const shake = {
  amount: 0,
  timer: 0,
  kick: 0,
  fov: 0,
};

const gun = {
  selected: 0,
  reload: 0,
  reloadTotal: 0,
  cooldown: 0,
  shots: 0,
  hits: 0,
  kills: 0,
  score: 0,
  combo: 0,
  comboTimer: 0,
  best: loadBest(),
  lasedRange: 0,
  lasedTimer: 0,
  lasedTarget: null,
  trackedTarget: null,
  solution: 0,
  solutionTimer: 0,
  armed: false,
  lastShot: null,
  barrelHeat: 0,
  barrelWear: 0,
  zeroError: 0,
  lastHit: null,
  lastResult: null,
  reloadStage: 0,
};

const projectiles = [];
const tracerAssets = new Map();
const projectileRaycaster = new THREE.Raycaster();

const app = {
  ready: false,
  error: null,
  mode: 'gunnery-lab',
  getState: () => {
    const targetStates = range
      ? range.getState().map((target) => {
          const aim = new THREE.Vector3().fromArray(target.aimPoint);
          const distance = aim.distanceTo(tankRoot?.position || new THREE.Vector3());
          const projected = aim.clone();
          if (camera) projected.project(camera);
          return {
            ...target,
            distance,
            screenX: camera ? (projected.x * 0.5 + 0.5) * window.innerWidth : 0,
            screenY: camera ? (-projected.y * 0.5 + 0.5) * window.innerHeight : 0,
            visible: camera ? projected.z < 1 : false,
          };
        })
      : [];
    const spec = SHELLS[gun.selected];
    return {
      ready: app.ready,
      error: app.error,
      x: tank.x,
      z: tank.z,
      y: tank.y,
      heading: tank.heading,
      speed: tank.speed,
      turretYaw: tank.turretYaw,
      gunPitch: tank.gunPitch,
      triangles,
      vertices,
      meshes,
      drawCalls: renderer?.info.render.calls || 0,
      modelSize,
      score: gun.score,
      best: gun.best,
      combo: gun.combo,
      comboMultiplier: 1 + Math.max(0, gun.combo - 1) * 0.25,
      shots: gun.shots,
      hits: gun.hits,
      kills: gun.kills,
      ammo: spec.id,
      reload: Math.max(0, gun.reload),
      reloadProgress: gun.reloadTotal > 0 ? 1 - clamp(gun.reload / gun.reloadTotal, 0, 1) : 1,
      lasedRange: gun.lasedRange,
      armed: gun.armed,
      solution: gun.solution,
      barrelHeat: gun.barrelHeat,
      barrelWear: gun.barrelWear,
      fuse: FUSES[fuseIndex],
      sight: crewState.sight,
      thermalPolarity: crewState.thermalPolarity,
      role: crewState.role,
      buttoned: crewState.buttoned,
      photoMode: crewState.photoMode,
      weather: environment?.getState?.() || null,
      systems: { ...systems },
      shotCamera: shotCameraActive,
      mgShots,
      enemyShots,
      artilleryShots,
      enemyProjectiles: enemyProjectiles.length,
      artillery: artilleryQueue.length,
      repairing: repair.module,
      repairProgress: repair.total ? 1 - repair.timer / repair.total : 0,
      engineOn,
      parkingBrake,
      autoGear,
      quality: lowPower ? 'PHONE' : 'HIGH',
      gear: tank.gear,
      rpm: tank.rpm,
      smokeCharges,
      smokeCooldown,
      paused,
      damageWarning: warningTimer,
      incomingWarning: incomingTimer,
      damageAngle,
      incomingAngle,
      wave: missionWave,
      objective,
      projectiles: projectiles.length,
      targets: targetStates,
    };
  },
};
window.__tankLab = app;

function setLoad(progress, label) {
  const value = clamp(progress, 0, 1);
  if (ui.loaderBar) ui.loaderBar.style.transform = `scaleX(${value})`;
  if (ui.loaderPercent) ui.loaderPercent.textContent = `${Math.round(value * 100)}%`;
  if (ui.loaderStatus) ui.loaderStatus.textContent = label;
}

function showNotice(text, duration = 1800) {
  if (!ui.notice) return;
  ui.notice.textContent = text;
  ui.notice.classList.add('is-visible');
  clearTimeout(noticeTimeout);
  noticeTimeout = window.setTimeout(() => ui.notice.classList.remove('is-visible'), duration);
}

function showError(error) {
  console.error(error);
  app.error = String(error?.stack || error?.message || error);
  if (ui.error) ui.error.hidden = false;
  if (ui.errorText) ui.errorText.textContent = app.error;
  document.body.classList.remove('is-loading');
}

function flashScreen() {
  if (!ui.flash) return;
  ui.flash.classList.remove('is-on');
  void ui.flash.offsetWidth;
  ui.flash.classList.add('is-on');
  clearTimeout(muzzleFlashTimeout);
  muzzleFlashTimeout = window.setTimeout(() => ui.flash.classList.remove('is-on'), 160);
}

function makeContactShadow() {
  const size = 256;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = size;
  textureCanvas.height = size;
  const context = textureCanvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.66)');
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.36)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  shadow.scale.set(8.2, 1, 12);
  shadow.renderOrder = 1;
  return shadow;
}

function buildScene() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    // The composer owns 2x MSAA render targets; a multisampled default
    // framebuffer is redundant for this full-screen post pipeline.
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.84;
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x9aa38c, 0.00082);

  camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.15, 8000);
  camera.position.set(0, 6.5, 17);

  terrain = createTerrain({ lowPower });
  scene.add(terrain.group);

  const sky = new Sky();
  sky.scale.setScalar(5000);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 3.0;
  skyUniforms.rayleigh.value = 2.0;
  skyUniforms.mieCoefficient.value = 0.0032;
  skyUniforms.mieDirectionalG.value = 0.78;
  skyUniforms.cloudCoverage.value = 0.14;
  skyUniforms.cloudDensity.value = 0.26;
  skyUniforms.cloudElevation.value = 0.58;
  skyUniforms.cloudScale.value = 0.00016;
  skyUniforms.showSunDisc.value = 0.28;
  skyUniforms.sunPosition.value.setFromSphericalCoords(
    1,
    (90 - 28) * DEG,
    118 * DEG,
  );
  sunDirection.copy(skyUniforms.sunPosition.value).normalize();
  scene.add(sky);

  const envScene = new THREE.Scene();
  const envSky = sky.clone();
  envSky.scale.setScalar(2000);
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(envScene, 0.04, 0.1, 4000);
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = 0.54;
  pmrem.dispose();

  sunLight.color.set(0xffd8ad);
  sunLight.intensity = 2.9;
  sunLight.castShadow = !lowPower;
  sunLight.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 280;
  sunLight.shadow.camera.left = -68;
  sunLight.shadow.camera.right = 68;
  sunLight.shadow.camera.top = 68;
  sunLight.shadow.camera.bottom = -68;
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.028;
  scene.add(sunLight);
  scene.add(sunLight.target);

  fillLight.color.set(0xaebdcc);
  fillLight.intensity = 0.16;
  fillLight.position.set(-28, 20, 34);
  scene.add(fillLight);

  const hemisphere = new THREE.HemisphereLight(0xb6c4cf, 0x3e392d, 0.26);
  scene.add(hemisphere);

  environment = createEnvironment(scene, {
    sky,
    sunLight,
    terrainMaterial: terrain.material,
    hemisphere,
    renderer,
  });
  ballistics = createBallistics();

  tankRoot = new THREE.Group();
  tankRoot.name = 'tank_root';
  scene.add(tankRoot);

  contactShadow = makeContactShadow();
  scene.add(contactShadow);

  post = createPost(renderer, scene, camera);
  shotCamera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 2500);
  post.setShotCamera(shotCamera, false);
  post.setRenderScale(renderScale);
  fx = createFx(scene, renderer, { lowPower });
  audio = createAudio();
  applyQualityMode();
  // Pay the AudioContext setup cost behind the loader instead of on the first
  // trigger pull. It stays suspended until the user's click resumes it.
  audio.unlock();

  resetTank(true);
  updateCamera(1, true);
}

async function loadVehicle() {
  setLoad(0.015, 'STREAMING T-72M GEOMETRY');
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => {
    loader.load(
      './assets/t72m/t72m-lod.glb',
      resolve,
      (event) => {
        const fraction = event.total ? event.loaded / event.total : 0;
        setLoad(0.015 + fraction * 0.52, fraction >= 1 ? 'GEOMETRY READY' : 'STREAMING T-72M GEOMETRY');
      },
      reject,
    );
  });

  setLoad(0.55, 'LOADING PBR MATERIALS');
  const manifestUrl = './assets/t72m/materials.json';
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) throw new Error(`Could not load ${manifestUrl} (${manifestResponse.status})`);
  const manifest = await manifestResponse.json();
  const materialEntries = Object.entries(manifest.materials);
  const textureLoader = new THREE.TextureLoader();
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let loadedMaterials = 0;

  const loadTexture = async (relativeUrl, colorSpace) => {
    const texture = await textureLoader.loadAsync(`./assets/t72m/${relativeUrl}`);
    texture.colorSpace = colorSpace;
    texture.anisotropy = maxAnisotropy;
    return texture;
  };

  const materials = new Map();
  for (const [name, definition] of materialEntries) {
    const [albedo, normal, orm] = await Promise.all([
      loadTexture(definition.albedo, THREE.SRGBColorSpace),
      loadTexture(definition.normal, THREE.NoColorSpace),
      loadTexture(definition.orm, THREE.NoColorSpace),
    ]);
    const material = new THREE.MeshStandardMaterial({
      name,
      map: albedo,
      normalMap: normal,
      roughnessMap: orm,
      metalnessMap: orm,
      roughness: 1,
      metalness: 1,
      envMapIntensity: 0.62,
      dithering: true,
    });
    materials.set(name, material);
    loadedMaterials++;
    setLoad(
      0.55 + (loadedMaterials / materialEntries.length) * 0.36,
      `COATING MATERIALS ${loadedMaterials}/${materialEntries.length}`,
    );
  }

  setLoad(0.92, 'WELDING TRIANGLE STREAMS');
  const missing = new Set();
  gltf.scene.traverse((child) => {
    if (!child.isMesh) return;
    const sourceMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
    const name = sourceMaterial?.name || '';
    const material = materials.get(name);
    if (material) child.material = material;
    else missing.add(name || 'unassigned');
    child.castShadow = true;
    child.receiveShadow = true;

    // The source is built triangle-by-triangle. Indexing shared vertices cuts
    // GPU vertex work substantially without touching the visual surface.
    const sourceGeometry = child.geometry;
    if (!sourceGeometry.index) {
      const indexed = mergeVertices(sourceGeometry, 1e-4);
      indexed.computeBoundingSphere();
      sourceGeometry.dispose();
      child.geometry = indexed;
    } else {
      sourceGeometry.computeBoundingSphere();
    }

    const count = child.geometry.index
      ? child.geometry.index.count
      : child.geometry.attributes.position.count;
    triangles += count / 3;
    vertices += child.geometry.attributes.position.count;
    meshes++;
  });

  if (missing.size) console.warn('Unmatched T-72M materials:', [...missing]);

  turretPivot = gltf.scene.getObjectByName('turret_pivot');
  barrelPivot = gltf.scene.getObjectByName('barrel_pivot');
  if (!turretPivot) throw new Error('GLB is missing the turret_pivot node');
  if (!barrelPivot) throw new Error('GLB is missing the barrel_pivot node');
  barrelRestPosition = barrelPivot.position.clone();

  trackMaterial = materials.get('履带');
  if (trackMaterial) {
    for (const map of [trackMaterial.map, trackMaterial.normalMap, trackMaterial.roughnessMap]) {
      if (!map) continue;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.offset.set(0, 0);
    }
  }

  tankRoot.add(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  modelSize = bounds.getSize(new THREE.Vector3());
  const bottom = bounds.min.y;

  app.model = {
    width: modelSize.x,
    height: modelSize.y,
    length: modelSize.z,
    bottom,
    source: manifest.source,
    triangles,
    meshes,
  };
  app.backend = navigator.gpu ? 'WEBGPU-CAPABLE / WEBGL' : 'WEBGL';
  app.webgpu = Boolean(navigator.gpu);

  setLoad(0.93, 'DEPLOYING TARGET BATTERY');
  range = createRange({
    scene,
    vehicleScene: gltf.scene,
    terrainHeight,
    environment,
    onEnemyFire: handleEnemyFire,
    onArtillery: handleArtillery,
    onSmoke: handleSmokeEvent,
    onEvent: handleRangeEvent,
  });

  setLoad(0.99, 'ALIGNING FIRE CONTROL');
  tank.y = terrainHeight(tank.x, tank.z) + 0.04;
  tank.vy = 0;
  applyVisuals();
  updateCamera(1, true);
  prewarmShotAssets();
  updateAmmoUi();
  setLoad(1, 'GUNNERY RANGE READY');
  app.ready = true;
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
  showNotice('GUNNERY RANGE LIVE · LMB FIRE · F LASE', 4200);
}

function clearProjectiles() {
  for (const projectile of projectiles) {
    scene.remove(projectile.tracer.group);
  }
  projectiles.length = 0;
}

function resetTank(snapCamera = false) {
  tank.x = 0;
  tank.z = 0;
  tank.heading = 0;
  tank.speed = 0;
  tank.vy = 0;
  tank.turretYaw = 0;
  tank.gunPitch = 0.03;
  tank.gearIndex = FIRST_GEAR_INDEX;
  tank.gear = GEARS[FIRST_GEAR_INDEX].label;
  tank.rpm = 0.18;
  engineOn = true;
  parkingBrake = false;
  autoGear = true;
  smokeCharges = 3;
  smokeCooldown = 0;
  warningTimer = 0;
  incomingTimer = 0;
  damageLevel = 0;
  tank.y = terrainHeight(0, 0) + 0.04;
  cameraRig.yawOffset = 0;
  cameraRig.pitch = 0.34;
  cameraRig.distance = 11.5;
  recoil.pitch = 0;
  recoil.roll = 0;
  recoil.heave = 0;
  recoil.barrel = 0;
  recoil.pitchVelocity = 0;
  recoil.rollVelocity = 0;
  recoil.heaveVelocity = 0;
  recoil.barrelVelocity = 0;
  shake.amount = 0;
  shake.timer = 0;
  shake.kick = 0;
  shake.fov = 0;
  gun.lasedRange = 0;
  gun.lasedTimer = 0;
  gun.lasedTarget = null;
  gun.trackedTarget = null;
  gun.solution = 0;
  gun.solutionTimer = 0;
  gun.armed = false;
  gun.barrelHeat = 0;
  gun.barrelWear = 0;
  gun.zeroError = 0;
  gun.reloadStage = 0;
  crewState.role = 'EXTERNAL';
  crewState.sight = 'DAY';
  crewState.thermalPolarity = 1;
  crewState.zoom = 1;
  crewState.buttoned = false;
  crewState.photoMode = false;
  for (const key of Object.keys(systems)) systems[key] = 100;
  repair = { module: null, timer: 0, total: 0 };
  damageFlash = 0;
  warningTimer = 0;
  mgCooldown = 0;
  mgShots = 0;
  enemyShots = 0;
  artilleryShots = 0;
  missionWave = 1;
  missionKills = 0;
  objective = INITIAL_OBJECTIVE;
  range?.reset();
  clearEnemyProjectiles();
  artilleryQueue.length = 0;
  post?.setDamage(0);
  post?.setSight(0, 1);
  document.body.classList.remove('photo-mode', 'is-buttoned', 'sight-thermal', 'sight-night');
  aimHasSolution = false;
  pointer.dirty = true;
  lastSunX = Infinity;
  lastSunY = Infinity;
  lastSunZ = Infinity;
  trackDistance = 0;
  clearProjectiles();
  if (tankRoot) {
    tankRoot.position.set(tank.x, tank.y, tank.z);
    tankRoot.quaternion.identity();
  }
  if (turretPivot) turretPivot.rotation.set(0, 0, 0);
  if (barrelPivot) {
    barrelPivot.rotation.set(0, 0, 0);
    if (barrelRestPosition) barrelPivot.position.copy(barrelRestPosition);
  }
  if (contactShadow) {
    contactShadow.position.set(tank.x, terrainHeight(tank.x, tank.z) + 0.06, tank.z);
    contactShadow.rotation.y = tank.heading;
  }
  if (snapCamera) updateCamera(1, true);
}

function updateRecoil(dt) {
  // The gun is a sprung mass inside the tank: it snaps back quickly, stops hard,
  // and returns to battery while the heavier hull is still settling.
  recoil.pitchVelocity += (-recoil.pitch * 78 - recoil.pitchVelocity * 7.6) * dt;
  recoil.pitch += recoil.pitchVelocity * dt;
  recoil.rollVelocity += (-recoil.roll * 70 - recoil.rollVelocity * 7.2) * dt;
  recoil.roll += recoil.rollVelocity * dt;
  recoil.heaveVelocity += (-recoil.heave * 96 - recoil.heaveVelocity * 9.4) * dt;
  recoil.heave += recoil.heaveVelocity * dt;
  recoil.barrelVelocity += (-recoil.barrel * 210 - recoil.barrelVelocity * 17) * dt;
  recoil.barrel += recoil.barrelVelocity * dt;
}

function applyRecoil() {
  recoilEuler.set(recoil.pitch, 0, recoil.roll);
  recoilQuaternion.setFromEuler(recoilEuler);
  tankRoot.quaternion.multiply(recoilQuaternion);
}

function applyQualityMode() {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = !lowPower;
  if (sunLight) sunLight.castShadow = !lowPower;
  renderScale = 1;
  post?.setRenderScale(renderScale);
  document.body.classList.toggle('low-power', lowPower);
  if (ui.menuQuality) ui.menuQuality.textContent = lowPower ? 'PHONE' : 'HIGH';
  if (ui.escapeQuality) ui.escapeQuality.textContent = lowPower ? 'QUALITY PHONE' : 'QUALITY HIGH';
}

function updateMotion(dt) {
  const throttle = keys.has('KeyW') ? 1 : 0;
  const serviceBrake = keys.has('Space');
  const steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const engineFactor = clamp(systems.engine / 100, 0.08, 1);
  const trackFactor = clamp(systems.tracks / 100, 0.2, 1);
  const traction = clamp(1 - environment.state.wet * 0.14 - environment.state.snow * 0.24 - environment.state.dust * 0.08, 0.55, 1);
  const gear = GEARS[tank.gearIndex] || GEARS[FIRST_GEAR_INDEX];
  const neutral = gear.label === 'N';
  const reversing = gear.label === 'R';
  const canDrive = engineOn && !parkingBrake && !repair.module && !neutral;

  if (!engineOn || parkingBrake || repair.module) {
    tank.speed = moveToward(tank.speed, 0, (parkingBrake ? 18 : repair.module ? 8 : 4.2) * dt);
  } else if (serviceBrake) {
    tank.speed = moveToward(tank.speed, 0, 13 * dt);
  } else if (canDrive && throttle) {
    const target = reversing ? -gear.max : gear.max;
    tank.speed = moveToward(tank.speed, target, gear.accel * engineFactor * traction * dt);
  } else {
    // Neutral, or off the throttle: tracks freewheel to a stop. The service
    // brake is the only strong deceleration; real tanks do not stop on a dime.
    tank.speed = moveToward(tank.speed, 0, 1.25 * dt);
  }
  const gearRatio = gear.max > 0 ? Math.abs(tank.speed) / gear.max : 0;
  tank.rpm = damp(
    tank.rpm,
    engineOn ? clamp(0.18 + gearRatio * 0.58 + (throttle && canDrive ? 0.12 : 0), 0, 1) : 0,
    4.5,
    dt,
  );
  tank.gear = gear.label;

  if (autoGear && canDrive && throttle && !serviceBrake && !reversing) {
    const speed = Math.abs(tank.speed);
    if (tank.gearIndex < GEARS.length - 1 && speed >= GEARS[tank.gearIndex].max * 0.94) {
      tank.gearIndex += 1;
      tank.gear = GEARS[tank.gearIndex].label;
      audio.gearShift?.();
    } else if (tank.gearIndex > FIRST_GEAR_INDEX && speed < GEARS[tank.gearIndex - 1].max * 0.52) {
      tank.gearIndex -= 1;
      tank.gear = GEARS[tank.gearIndex].label;
    }
  }

  forward.set(-Math.sin(tank.heading), 0, -Math.cos(tank.heading));
  const ahead = terrainHeight(tank.x + forward.x * 2.9, tank.z + forward.z * 2.9);
  const behind = terrainHeight(tank.x - forward.x * 2.9, tank.z - forward.z * 2.9);
  tank.grade = (ahead - behind) / 5.8;
  tank.speed -= tank.grade * 9.81 * 0.32 * dt * (1 - systems.stabilizer / 220);
  tank.speed = clamp(tank.speed, -6.5, 21);

  const speedFactor = Math.min(Math.abs(tank.speed) / 9, 1);
  if (neutral && engineOn && !parkingBrake && !repair.module) {
    // A true neutral steer pivots on the spot by driving the tracks in
    // opposite directions. It is deliberately slower than a moving turn.
    tank.heading += steer * 0.46 * trackFactor * dt;
  } else {
    tank.heading += steer * (0.62 + 0.44 * speedFactor) * trackFactor * dt;
  }
  forward.set(-Math.sin(tank.heading), 0, -Math.cos(tank.heading));

  tank.x += forward.x * tank.speed * dt;
  tank.z += forward.z * tank.speed * dt;

  tank.impactCooldown = Math.max(0, tank.impactCooldown - dt);
  if (tank.impactCooldown <= 0 && Math.abs(tank.speed) > 3.2 && range) {
    for (const structure of range.destructibles) {
      if (!structure.alive) continue;
      const distance = Math.hypot(tank.x - structure.position.x, tank.z - structure.position.z);
      if (distance < 3.1) {
        tank.impactCooldown = 1.2;
        tank.speed *= -0.18;
        applyPlayerDamage({ damage: 12, kind: 'COLLISION', module: 'tracks' });
        showNotice('COLLISION · HULL DAMAGE', 900);
        break;
      }
    }
  }

  let atLimit = false;
  if (tank.x < -RANGE_LIMIT) { tank.x = -RANGE_LIMIT; atLimit = true; }
  if (tank.x > RANGE_LIMIT) { tank.x = RANGE_LIMIT; atLimit = true; }
  if (tank.z < -RANGE_LIMIT) { tank.z = -RANGE_LIMIT; atLimit = true; }
  if (tank.z > RANGE_LIMIT) { tank.z = RANGE_LIMIT; atLimit = true; }
  if (atLimit) {
    tank.speed *= -0.12;
    showNotice('RANGE LIMIT', 900);
  }

  const ground = terrainHeight(tank.x, tank.z);
  tank.vy += (ground + 0.04 - tank.y) * 88 * dt;
  tank.vy *= Math.exp(-14.5 * dt);
  tank.y += tank.vy * dt;
  tank.y = Math.max(tank.y, ground + 0.015);

  const normal = terrainNormal(tank.x, tank.z);
  smoothedForward.copy(forward).addScaledVector(normal, -forward.dot(normal)).normalize();
  smoothedRight.crossVectors(smoothedForward, normal).normalize();
  basis.makeBasis(smoothedRight, normal, smoothedForward.clone().negate());
  targetQuaternion.setFromRotationMatrix(basis);
  const blend = 1 - Math.exp(-8.5 * dt);
  tankRoot.quaternion.slerp(targetQuaternion, blend);
  stableTankQuaternion.copy(tankRoot.quaternion);
  applyRecoil();
  tankRoot.position.set(tank.x, tank.y, tank.z);
  tankRoot.position.y += recoil.heave;
  tankRoot.updateMatrixWorld(true);

  if (contactShadow) {
    contactShadow.position.set(tank.x, terrainHeight(tank.x, tank.z) + 0.055, tank.z);
    contactShadow.rotation.y = tank.heading;
    contactShadow.visible = tank.y < ground + 1.4;
  }

  if (Math.abs(tank.speed) > 1.8) {
    trackDistance += Math.abs(tank.speed) * dt;
    dustTimer += dt;
    if (trackDistance > 0.68) {
      trackDistance = 0;
      const yaw = tank.heading;
      for (const side of [-1.22, 1.22]) {
        localPoint.set(side, 0.34, 2.6);
        tankRoot.localToWorld(localPoint);
        const y = terrainHeight(localPoint.x, localPoint.z) + 0.045;
        const markNormal = terrainNormal(localPoint.x, localPoint.z);
        fx.trackMark(new THREE.Vector3(localPoint.x, y, localPoint.z), markNormal, yaw);
      }
    }
    if (dustTimer > 0.09) {
      dustTimer = 0;
      for (const side of [-1.22, 1.22]) {
        localPoint.set(side, 0.3, 3.2);
        tankRoot.localToWorld(localPoint);
        fx.trackDust(localPoint, forward, clamp(Math.abs(tank.speed) / 14, 0.2, 1));
      }
    }
  }

  exhaustTimer += dt;
  if (exhaustTimer > 0.16) {
    exhaustTimer = 0;
    localPoint.set(0, 1.55, 4.15);
    tankRoot.localToWorld(localPoint);
    fx.exhaust(localPoint, tank.speed);
  }

  playerVelocity.copy(tankRoot.position).sub(lastPlayerPosition).divideScalar(Math.max(dt, 0.0001));
  lastPlayerPosition.copy(tankRoot.position);
}

function solveElevation(distance, velocity) {
  const ratio = clamp((9.81 * distance) / (velocity * velocity), 0, 0.95);
  return 0.5 * Math.asin(ratio);
}

function intersectHeightfield(origin, direction, out) {
  const maxDistance = 800;
  const step = 5;
  let previous = 0;
  for (let distance = step; distance <= maxDistance; distance += step) {
    const x = origin.x + direction.x * distance;
    const y = origin.y + direction.y * distance;
    const z = origin.z + direction.z * distance;
    if (y <= terrainHeight(x, z)) {
      let low = previous;
      let high = distance;
      for (let i = 0; i < 6; i++) {
        const middle = (low + high) * 0.5;
        const mx = origin.x + direction.x * middle;
        const my = origin.y + direction.y * middle;
        const mz = origin.z + direction.z * middle;
        if (my <= terrainHeight(mx, mz)) high = middle;
        else low = middle;
      }
      out.copy(origin).addScaledVector(direction, high);
      return true;
    }
    previous = distance;
  }
  return false;
}

function updateAim(dt) {
  if (!turretPivot || !barrelPivot) return;
  aimSolveCooldown -= dt;
  if (!aimHasSolution || pointer.dirty || aimSolveCooldown <= 0) {
    raycaster.setFromCamera(pointer.ndc, aimCamera);

    // Resolve the point under the mouse against targets, rocks and the actual
    // heightfield. The old horizontal-plane fallback made ground shots aim at
    // empty air whenever the cursor was over a slope.
    let hasAimPoint = false;
    let nearest = Infinity;
    if (range) {
      const targetHits = raycaster.intersectObjects(range.colliders, false);
      for (const hit of targetHits) {
        const target = hit.object.userData.target;
        if (!target || !target.alive || hit.distance >= nearest) continue;
        aimPoint.copy(hit.point);
        nearest = hit.distance;
        hasAimPoint = true;
      }
    }
    if (terrain?.rocks) {
      const rockHits = raycaster.intersectObject(terrain.rocks, false);
      if (rockHits.length && rockHits[0].distance < nearest) {
        aimPoint.copy(rockHits[0].point);
        nearest = rockHits[0].distance;
        hasAimPoint = true;
      }
    }
    if (!hasAimPoint && intersectHeightfield(raycaster.ray.origin, raycaster.ray.direction, aimPoint)) {
      hasAimPoint = true;
    }
    if (!hasAimPoint) {
      aimPlane.constant = -(tank.y + 1.45);
      hasAimPoint = Boolean(raycaster.ray.intersectPlane(aimPlane, aimPoint));
    }
    if (!hasAimPoint) {
      aimPoint.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, 600);
    }

    aimHasSolution = true;
    pointer.dirty = false;
    aimSolveCooldown = 1 / 30;
  }

  if (gun.trackedTarget?.alive) {
    gun.trackedTarget.getAimPoint(aimPoint);
    const range = aimPoint.distanceTo(tankRoot.position);
    aimPoint.addScaledVector(gun.trackedTarget.velocity, Math.min(2.4, range / Math.max(180, SHELLS[gun.selected].velocity)));
  }

  let dx = aimPoint.x - tank.x;
  let dz = aimPoint.z - tank.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 8) {
    dx = forward.x;
    dz = forward.z;
  }
  const desiredWorld = Math.atan2(-dx, -dz);
  const desiredLocal = wrapAngle(desiredWorld - tank.heading);
  const slew = (1.35 + 1.05 * (systems.turret / 100) + 0.22 * (systems.stabilizer / 100)) * dt;
  tank.turretYaw = approachAngle(tank.turretYaw, desiredLocal, slew);

  turretPivot.rotation.y = tank.turretYaw;
  turretPivot.updateMatrixWorld(true);
  barrelPivot.getWorldPosition(barrelWorldPosition);
  turretPivot.getWorldQuaternion(turretWorldQuaternion).invert();
  aimDirection.copy(aimPoint).sub(barrelWorldPosition).normalize().applyQuaternion(turretWorldQuaternion);
  const spec = SHELLS[gun.selected];
  // The FCS solution comes from the worker after a lase. If it has expired,
  // fall back to the fast local solver rather than silently aiming flat.
  const ballistic = gun.solutionTimer > 0 && gun.lasedRange > 20
    ? gun.solution
    : gun.lasedRange > 20 ? solveElevation(gun.lasedRange, spec.velocity) : 0;
  const movingDrift = (1 - systems.stabilizer / 100) * Math.sin(performance.now() * 0.0007) * 0.0022
    + Math.abs(tank.speed) * (1 - systems.stabilizer / 100) * 0.0014;
  const cant = tank.grade * 0.022 + terrainHeight(tank.x, tank.z) * 0.00004;
  const desiredPitch = clamp(Math.atan2(aimDirection.y, -aimDirection.z) + ballistic + gun.zeroError + movingDrift + cant, -0.12, 0.27);
  const pitchRate = 6 + 7 * (systems.gun / 100);
  tank.gunPitch = damp(tank.gunPitch, desiredPitch, pitchRate, dt);
}

function applyVisuals() {
  if (turretPivot) turretPivot.rotation.y = tank.turretYaw;
  if (barrelPivot) {
    barrelPivot.rotation.x = tank.gunPitch;
    if (barrelRestPosition) {
      barrelPivot.position.copy(barrelRestPosition);
      barrelPivot.position.z += recoil.barrel;
    }
  }
  if (environment) {
    fx?.setWind(environment.wind);
    post?.setEnvironment({
      mirage: crewState.sight === 'THERMAL' ? 0 : clamp(gun.barrelHeat * 0.35 + environment.state.tempC / 50, 0, 0.8),
      rain: environment.state.rain,
      snow: environment.state.snow,
      dust: environment.state.dust,
      wet: environment.state.wet,
      glare: clamp(environment.state.sunDirection.y * 0.28, 0, 0.25),
    });
  }
}

function updateTracks(dt) {
  if (!trackMaterial || !trackMaterial.map) return;
  trackOffset = (trackOffset + tank.speed * dt * 0.16) % 1;
  for (const map of [trackMaterial.map, trackMaterial.normalMap, trackMaterial.roughnessMap]) {
    if (map) map.offset.y = trackOffset;
  }
}

function updateReticles() {
  if (!ui.impactReticle || !barrelPivot || !camera) return;
  barrelPivot.updateMatrixWorld(true);
  barrelPivot.getWorldPosition(reticleMuzzle);
  reticleQuaternion.copy(stableTankQuaternion);
  turretAimQuaternion.setFromAxisAngle(up, tank.turretYaw);
  reticleQuaternion.multiply(turretAimQuaternion);
  barrelAimQuaternion.setFromAxisAngle(xAxis, tank.gunPitch);
  reticleQuaternion.multiply(barrelAimQuaternion);
  reticleDirection.copy(forwardFromGun).applyQuaternion(reticleQuaternion).normalize();
  reticleMuzzle.addScaledVector(reticleDirection, 5.9);

  const distance = Math.max(8, reticleMuzzle.distanceTo(aimPoint));
  const spec = SHELLS[gun.selected];
  const flightTime = Math.min(4, distance / spec.velocity);
  reticleImpact.copy(reticleMuzzle);
  reticleVelocity.copy(reticleDirection).multiplyScalar(spec.velocity).addScaledVector(forward, tank.speed * 0.25);
  const step = flightTime / 20;
  for (let i = 0; i < 20; i++) {
    reticleVelocity.y -= 9.81 * step;
    reticleVelocity.multiplyScalar(Math.exp(-spec.drag * step));
    reticleImpact.addScaledVector(reticleVelocity, step);
  }

  reticleProjection.copy(reticleImpact).project(aimCamera);
  const x = (reticleProjection.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-reticleProjection.y * 0.5 + 0.5) * window.innerHeight;
  const onScreen = reticleProjection.z > -1 && reticleProjection.z < 1
    && x > -40 && x < window.innerWidth + 40
    && y > -40 && y < window.innerHeight + 40;
  if (lastImpactOffscreen !== !onScreen) {
    lastImpactOffscreen = !onScreen;
    ui.impactReticle.classList.toggle('is-offscreen', !onScreen);
  }
  if (onScreen && (lastImpactOffscreen || Math.abs(x - lastImpactX) > 0.25 || Math.abs(y - lastImpactY) > 0.25)) {
    lastImpactX = x;
    lastImpactY = y;
    ui.impactReticle.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
  if (ui.impactReadout) {
    const label = `${Math.round(distance)} M`;
    if (lastImpactLabel !== label) {
      lastImpactLabel = label;
      ui.impactReadout.textContent = label;
    }
  }
}

function updateCamera(dt, snap = false) {
  if (!camera) return;
  if (crewState.photoMode) {
    cameraRig.yawOffset += dt * 0.035;
    back.set(Math.sin(tank.heading + cameraRig.yawOffset), 0, Math.cos(tank.heading + cameraRig.yawOffset));
    desiredCamera.set(tank.x, tank.y + 2.4, tank.z).addScaledVector(back, 13).addScaledVector(up, 4.2);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-2.4 * dt));
    camera.lookAt(tank.x, tank.y + 1.6, tank.z);
    camera.fov = 44;
    camera.updateProjectionMatrix();
    stableCameraPosition.copy(camera.position);
    aimCamera.position.copy(camera.position);
    aimCamera.quaternion.copy(camera.quaternion);
    aimCamera.fov = camera.fov;
    aimCamera.aspect = camera.aspect;
    aimCamera.updateProjectionMatrix();
    aimCamera.updateMatrixWorld(true);
    return;
  }

  if (crewState.role !== 'EXTERNAL') {
    forward.set(-Math.sin(tank.heading), 0, -Math.cos(tank.heading));
    if (crewState.role === 'GUNNER') {
      tankRoot.localToWorld(tmpVector.set(0, 2.05, -0.35));
      camera.position.lerp(tmpVector, snap ? 1 : 1 - Math.exp(-7 * dt));
      cameraLook.copy(aimPoint);
      camera.fov = damp(camera.fov, 52 / crewState.zoom, 5, dt);
    } else if (crewState.role === 'COMMANDER') {
      tankRoot.localToWorld(tmpVector.set(0, 3.05, 0.15));
      camera.position.lerp(tmpVector, snap ? 1 : 1 - Math.exp(-7 * dt));
      cameraLook.copy(aimPoint);
      camera.fov = damp(camera.fov, 42 / crewState.zoom, 5, dt);
    } else {
      tankRoot.localToWorld(tmpVector.set(0, 1.15, -2.8));
      camera.position.lerp(tmpVector, snap ? 1 : 1 - Math.exp(-7 * dt));
      cameraLook.set(tank.x, tank.y + 1.1, tank.z).addScaledVector(forward, 30);
      camera.fov = damp(camera.fov, 68 / crewState.zoom, 5, dt);
    }
    camera.lookAt(cameraLook);
    stableCameraPosition.copy(camera.position);
    aimCamera.position.copy(camera.position);
    aimCamera.quaternion.copy(camera.quaternion);
    aimCamera.fov = camera.fov;
    aimCamera.aspect = camera.aspect;
    aimCamera.updateProjectionMatrix();
    aimCamera.updateMatrixWorld(true);
    return;
  }

  back.set(
    Math.sin(tank.heading + cameraRig.yawOffset),
    0,
    Math.cos(tank.heading + cameraRig.yawOffset),
  );
  const portrait = lowPower && window.innerHeight > window.innerWidth * 1.1;
  const followDistance = portrait ? Math.max(cameraRig.distance, 17) : cameraRig.distance;
  desiredCamera.set(tank.x, tank.y + 2.15, tank.z)
    .addScaledVector(back, Math.cos(cameraRig.pitch) * followDistance)
    .addScaledVector(up, Math.sin(cameraRig.pitch) * followDistance);
  desiredCamera.y = Math.max(
    desiredCamera.y,
    terrainHeight(desiredCamera.x, desiredCamera.z) + 1.35,
  );

  forward.set(-Math.sin(tank.heading), 0, -Math.cos(tank.heading));
  const lookAhead = 7.5 * Math.max(0, 1 - Math.abs(cameraRig.yawOffset) / 2.2);
  desiredLook.set(tank.x, tank.y + 1.55, tank.z).addScaledVector(forward, lookAhead);

  if (snap) {
    camera.position.copy(desiredCamera);
    cameraRig.look.copy(desiredLook);
  } else {
    camera.position.lerp(desiredCamera, 1 - Math.exp(-5.4 * dt));
    cameraRig.look.lerp(desiredLook, 1 - Math.exp(-6.2 * dt));
  }

  // Capture the settled camera before the blast shove. Aim and impact
  // reticles use this stable transform, so recoil shakes the view without
  // dragging the cursor ray across the terrain.
  stableCameraPosition.copy(camera.position);

  // The camera gets a physical shove from the blast before the random jitter:
  // back and up, followed by a brief FOV punch and a damped lens jolt.
  shake.kick *= Math.exp(-9.2 * dt);
  shake.fov *= Math.exp(-7.5 * dt);
  if (shake.kick > 0.001) {
    camera.position.addScaledVector(back, shake.kick * 0.55);
    camera.position.y += shake.kick * 0.22;
  }

  cameraLook.copy(cameraRig.look);
  if (shake.amount > 0.0001) {
    const amount = Math.min(0.55, shake.amount);
    camera.position.x += (Math.random() - 0.5) * amount;
    camera.position.y += (Math.random() - 0.5) * amount * 0.7;
    camera.position.z += (Math.random() - 0.5) * amount;
    cameraLook.x += (Math.random() - 0.5) * amount * 0.5;
    cameraLook.y += (Math.random() - 0.5) * amount * 0.35;
    shake.amount *= Math.exp(-7.2 * dt);
    shake.timer += dt;
  } else {
    shake.amount = 0;
  }
  camera.lookAt(cameraLook);
  aimCamera.position.copy(stableCameraPosition);
  aimCamera.quaternion.copy(camera.quaternion);
  if (shake.kick > 0.001) {
    camera.rotateZ((Math.random() - 0.5) * 0.035 * shake.kick);
    camera.rotateX((Math.random() - 0.5) * 0.02 * shake.kick);
  }

  const targetFov = 56 + Math.min(Math.abs(tank.speed) * 0.48, 7) + shake.timer * 1.4 + shake.fov + shake.kick * 2.4;
  if (Math.abs(camera.fov - targetFov) > 0.04) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }
  aimCamera.aspect = camera.aspect;
  aimCamera.fov = camera.fov;
  aimCamera.updateProjectionMatrix();
  aimCamera.updateMatrixWorld(true);
  shake.timer = Math.max(0, shake.timer - dt * 5);
}

function updateSun() {
  if (!sunLight) return;
  const nextX = tank.x + sunDirection.x * 100;
  const nextY = tank.y + sunDirection.y * 100;
  const nextZ = tank.z + sunDirection.z * 100;
  if (Math.abs(nextX - lastSunX) < 0.02
    && Math.abs(nextY - lastSunY) < 0.02
    && Math.abs(nextZ - lastSunZ) < 0.02) return;
  lastSunX = nextX;
  lastSunY = nextY;
  lastSunZ = nextZ;
  sunLight.position.set(nextX, nextY, nextZ);
  sunLight.target.position.set(tank.x, tank.y, tank.z);
  sunLight.target.updateMatrixWorld();
}

function getTracerAssets(spec) {
  if (!tracerAssets.has(spec.id)) {
    const coreGeometry = new THREE.SphereGeometry(0.1, 8, 6);
    const trailGeometry = new THREE.CylinderGeometry(0.025, 0.07, 1, 5, 1, true).rotateX(Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: spec.tracer,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    tracerAssets.set(spec.id, { coreGeometry, trailGeometry, material });
  }
  return tracerAssets.get(spec.id);
}

function prewarmShotAssets() {
  // Build and draw the exact first-shot effect set once behind the loader. A
  // dry compile misses the tracer, flash and decal variants in this renderer,
  // and they otherwise compile on the first trigger pull.
  const warm = [];
  for (const spec of SHELLS) {
    const tracer = makeTracer(spec);
    tracer.group.position.set(0, -1000, 0);
    tracer.core.frustumCulled = false;
    tracer.trail.frustumCulled = false;
    warm.push(tracer);
  }
  const restoreDecals = fx.prewarm();
  const warmPosition = new THREE.Vector3(0, -1000, 0);
  fx.muzzle(warmPosition, up, warmPosition);
  fx.casing(warmPosition, up);
  fx.impact(warmPosition, up, 'ground', 1);
  fx.explosion(warmPosition, 1);
  // Render through the same composer path used in gameplay, so the first
  // shot does not create a new pipeline state at the trigger pull.
  post.render(0.016);
  for (const tracer of warm) scene.remove(tracer.group);
  restoreDecals();
  fx.update(10);
}

function makeTracer(spec) {
  const assets = getTracerAssets(spec);
  const group = new THREE.Group();
  const core = new THREE.Mesh(assets.coreGeometry, assets.material);
  const trail = new THREE.Mesh(assets.trailGeometry, assets.material);
  trail.position.z = 3.6;
  trail.scale.set(1, 1, 7.2);
  group.add(core);
  group.add(trail);
  scene.add(group);
  return { group, core, trail };
}

function fire() {
  if (!app.ready || !barrelPivot || crewState.photoMode) return;
  if (gun.reload > 0) {
    showNotice(`LOADING ${gun.reload.toFixed(1)}S`, 900);
    return;
  }
  if (repair.module) {
    showNotice(`CREW REPAIRING ${repair.module.toUpperCase()}`, 900);
    return;
  }
  if (systems.gun <= 0) {
    showNotice('GUN DISABLED · REPAIR REQUIRED', 1100);
    return;
  }
  if (!audio.muted) audio.unlock();
  applyVisuals();
  tankRoot.updateMatrixWorld(true);
  barrelPivot.getWorldPosition(muzzleBase);
  barrelPivot.getWorldQuaternion(targetQuaternion);
  gunDirection.copy(forwardFromGun).applyQuaternion(targetQuaternion).normalize();
  muzzlePosition.copy(muzzleBase).addScaledVector(gunDirection, 5.9);

  const spec = SHELLS[gun.selected];
  const heatPenalty = clamp(gun.barrelHeat * 0.011 + gun.barrelWear * 0.7, 0, 0.24);
  const modulePenalty = 1 - systems.gun / 100;
  const dispersion = 0.00075 + Math.abs(tank.speed) * 0.000045 + heatPenalty * 0.004 + modulePenalty * 0.006;
  const fuse = FUSES[fuseIndex];
  const dudChance = clamp(gun.barrelWear * 0.11 + (systems.gun < 35 ? 0.04 : 0), 0, 0.22);
  const dud = Math.random() < dudChance;
  const pelletCount = spec.pellets || 1;
  const velocityScale = (1 + (environment.state.tempC - 18) * 0.00035) * (1 - gun.barrelWear * 0.28);
  const guidedTarget = spec.guided ? (gun.trackedTarget || gun.lasedTarget) : null;
  let firstTracer = null;

  for (let pellet = 0; pellet < pelletCount; pellet++) {
    shotDirection.copy(gunDirection);
    const pelletSpread = dispersion * (pelletCount > 1 ? 5.5 : 1);
    shotDirection.x += (Math.random() - 0.5) * pelletSpread;
    shotDirection.y += (Math.random() - 0.5) * pelletSpread + gun.zeroError;
    shotDirection.z += (Math.random() - 0.5) * pelletSpread;
    shotDirection.normalize();
    forward.set(-Math.sin(tank.heading), 0, -Math.cos(tank.heading));
    shotVelocity.copy(shotDirection).multiplyScalar(spec.velocity * velocityScale).addScaledVector(forward, tank.speed * 0.25);
    const tracer = makeTracer(spec);
    tracer.group.position.copy(muzzlePosition);
    tracer.group.quaternion.setFromUnitVectors(forwardFromGun, shotVelocity.clone().normalize());
    if (!firstTracer) firstTracer = tracer;
    projectiles.push({
      position: muzzlePosition.clone(),
      previous: muzzlePosition.clone(),
      velocity: shotVelocity.clone(),
      life: spec.guided ? 16 : 7.5,
      spec,
      tracer,
      ammo: spec.id,
      penetration: spec.penetration * (1 - gun.barrelWear * 0.34),
      damage: spec.damage * (1 - gun.barrelWear * 0.18),
      blast: spec.blast,
      fuse,
      fuseRange: gun.lasedRange,
      dud,
      guidedTarget,
      guided: spec.guided,
      age: 0,
      source: 'player',
    });
  }

  gun.shots++;
  gun.reload = spec.reload * (1 + (1 - systems.crew / 100) * 0.45);
  gun.reloadTotal = gun.reload;
  gun.reloadStage = 0;
  gun.cooldown = 0.28;
  gun.lastShot = performance.now();
  gun.barrelHeat = Math.min(1.6, gun.barrelHeat + spec.heat);
  gun.barrelWear = Math.min(1, gun.barrelWear + spec.wear * 0.05);
  gun.zeroError = clamp(gun.zeroError + (Math.random() - 0.5) * 0.00035 + spec.wear * 0.0002, -0.012, 0.012);
  gun.armed = false;
  gun.solutionTimer = Math.max(0, gun.solutionTimer - 1.2);
  audio.fire(spec.id);
  audio.crew(spec.id === 'APFSDS' ? 'Sabot, fire' : `${spec.label}, fire`);
  window.setTimeout(() => audio.reload(), 420);
  fx.muzzle(muzzlePosition, gunDirection, tankRoot.position);
  fx.casing(muzzleBase, gunDirection);
  post.flash(0.95);
  flashScreen();
  recoil.pitchVelocity += 1.7 * spec.recoil;
  recoil.rollVelocity += (Math.random() - 0.5) * 0.9 * spec.recoil;
  recoil.heaveVelocity -= 0.62 * spec.recoil;
  recoil.barrelVelocity += 4.8 * spec.recoil;
  shake.amount = Math.min(0.52, shake.amount + 0.36 * spec.recoil);
  shake.fov = Math.min(2.6, shake.fov + 1.8);
  shake.kick = Math.min(1.35, shake.kick + 1);
  shake.timer = Math.min(1.4, shake.timer + 0.7);
  if (spec.smoke) {
    const point = muzzlePosition.clone().addScaledVector(gunDirection, 18);
    point.y = terrainHeight(point.x, point.z) + 0.7;
    handleSmokeEvent(point, 10, 12);
  }
  updateAmmoUi();
  updateHud(0);
  if (!gun.solutionTimer) showNotice('UNSOLVED SHOT · LASE FOR FCS', 1100);
}

function lase() {
  if (!app.ready || !range || !barrelPivot) return;
  applyVisuals();
  tankRoot.updateMatrixWorld(true);
  barrelPivot.getWorldPosition(muzzleBase);
  barrelPivot.getWorldQuaternion(targetQuaternion);
  gunDirection.copy(forwardFromGun).applyQuaternion(targetQuaternion).normalize();
  muzzlePosition.copy(muzzleBase).addScaledVector(gunDirection, 5.9);

  raycaster.setFromCamera(pointer.ndc, aimCamera);
  raycaster.near = 0;
  raycaster.far = 1200;
  const targetHits = raycaster.intersectObjects(range.colliders, false);
  let point = null;
  let targetName = '';
  let target = null;
  for (const hit of targetHits) {
    const unit = hit.object.userData.target;
    if (!unit || !unit.alive) continue;
    point = hit.point;
    target = unit;
    targetName = unit.name;
    break;
  }
  if (!point) {
    const groundHits = raycaster.intersectObject(terrain.ground, false);
    if (groundHits.length) point = groundHits[0].point;
  }
  if (!point) {
    showNotice('LASER · NO RETURN', 1100);
    audio.laser();
    return;
  }
  const smoke = environment.smokeAt(point);
  if (smoke > 0.84 && Math.random() < 0.38) {
    showNotice('LASER · ATTENUATED · NO RETURN', 1200);
    audio.laser();
    return;
  }
  const attenuation = 1 + smoke * (Math.random() * 0.035);
  gun.lasedRange = point.distanceTo(tankRoot.position) * attenuation;
  gun.lasedTimer = 8;
  gun.lasedTarget = target;
  gun.armed = true;
  gun.solution = solveElevation(gun.lasedRange, SHELLS[gun.selected].velocity);
  gun.solutionTimer = 8;
  audio.laser();
  fx.laserBeam?.(muzzlePosition, point);
  showNotice(
    targetName
      ? `LASER ${Math.round(gun.lasedRange)}M · ${targetName} · FCS ${smoke > 0.3 ? 'PARTIAL' : 'SOLVED'}`
      : `LASER ${Math.round(gun.lasedRange)}M · FCS ${smoke > 0.3 ? 'PARTIAL' : 'SOLVED'}`,
    1400,
  );
  audio.crew(smoke > 0.3 ? 'Lase partial, gunner' : 'Lased, target');
  ballistics.solveElevationAsync(gun.lasedRange, SHELLS[gun.selected].velocity, SHELLS[gun.selected].drag, environment.wind).then((solution) => {
    if (solution != null && gun.lasedRange > 20) {
      gun.solution = solution;
      gun.solutionTimer = 8;
    }
  });
}

function backupRange() {
  if (!app.ready || !range) return;
  raycaster.setFromCamera(pointer.ndc, aimCamera);
  const groundHits = raycaster.intersectObject(terrain.ground, false);
  const targetHits = raycaster.intersectObjects(range.colliders, false);
  const point = targetHits[0]?.point || groundHits[0]?.point;
  if (!point) {
    showNotice('OPTICAL RANGEFINDER · NO RETURN', 1100);
    return;
  }
  const trueRange = point.distanceTo(tankRoot.position);
  const error = trueRange * (0.012 + Math.abs(systems.optics - 100) * 0.0004);
  gun.lasedRange = trueRange + (Math.random() - 0.5) * 2 * error;
  gun.lasedTimer = 6;
  gun.armed = true;
  gun.solution = solveElevation(gun.lasedRange, SHELLS[gun.selected].velocity);
  gun.solutionTimer = 6;
  showNotice(`OPTICAL ${Math.round(gun.lasedRange)}M · ±${Math.max(1, Math.round(error))}M`, 1400);
  audio.ready();
}

function designateTarget() {
  if (!app.ready || !range) return;
  let target = gun.lasedTarget;
  if (!target?.alive) {
    const hits = raycaster.setFromCamera(pointer.ndc, aimCamera).intersectObjects(range.colliders, false);
    target = hits.find((hit) => hit.object.userData.target?.alive)?.object.userData.target || null;
  }
  if (!target) {
    showNotice('NO TARGET TO HAND OFF', 900);
    return;
  }
  gun.trackedTarget = target;
  gun.lasedTarget = target;
  gun.lasedRange = target.getAimPoint(tmpVector).distanceTo(tankRoot.position);
  gun.lasedTimer = 12;
  gun.solutionTimer = 12;
  gun.armed = true;
  showNotice(`COMMANDER HANDOFF · ${target.name} · TRACKING`, 1400);
  audio.crew('Target handed off');
}

function cycleSight() {
  const index = SIGHTS.indexOf(crewState.sight);
  crewState.sight = SIGHTS[(index + 1) % SIGHTS.length];
  document.body.classList.toggle('sight-thermal', crewState.sight === 'THERMAL');
  document.body.classList.toggle('sight-night', crewState.sight === 'NIGHT');
  post.setSight(crewState.sight === 'THERMAL' ? 1 : crewState.sight === 'NIGHT' ? 2 : 0, crewState.thermalPolarity);
  showNotice(`SIGHT · ${crewState.sight}${crewState.sight === 'THERMAL' ? ` · ${crewState.thermalPolarity > 0 ? 'WHITE HOT' : 'BLACK HOT'}` : ''}`, 1200);
  audio.click?.();
}

function cyclePolarity() {
  crewState.thermalPolarity *= -1;
  post.setSight(crewState.sight === 'THERMAL' ? 1 : crewState.sight === 'NIGHT' ? 2 : 0, crewState.thermalPolarity);
  showNotice(`THERMAL · ${crewState.thermalPolarity > 0 ? 'WHITE HOT' : 'BLACK HOT'}`, 1000);
}

function cycleFuse() {
  fuseIndex = (fuseIndex + 1) % FUSES.length;
  showNotice(`FUZE · ${FUSES[fuseIndex]}`, 1000);
  updateAmmoUi();
}

function cycleRole() {
  const index = CREW_ROLES.indexOf(crewState.role);
  crewState.role = CREW_ROLES[(index + 1) % CREW_ROLES.length];
  document.body.classList.toggle('role-gunner', crewState.role === 'GUNNER');
  document.body.classList.toggle('role-commander', crewState.role === 'COMMANDER');
  document.body.classList.toggle('role-driver', crewState.role === 'DRIVER');
  showNotice(`CREW · ${crewState.role}`, 900);
}

function toggleButtoned() {
  crewState.buttoned = !crewState.buttoned;
  document.body.classList.toggle('is-buttoned', crewState.buttoned);
  showNotice(crewState.buttoned ? 'HATCHES CLOSED · BUTTONED UP' : 'HATCHES OPEN · UNBUTTONED', 1000);
  audio.crew(crewState.buttoned ? 'Buttoned up' : 'Hatches open');
}

function cycleWeather() {
  const label = environment.cycle();
  showNotice(`WEATHER · ${label}`, 1300);
  audio.radio(label === 'SANDSTORM' ? 'Sandstorm, reduce speed' : `Weather ${label}`);
}

function startRepair() {
  if (repair.module) {
    showNotice(`REPAIRING ${repair.module.toUpperCase()} ${Math.round(repair.timer / repair.total * 100)}%`, 900);
    return;
  }
  let worst = null;
  let health = 70;
  for (const [key, value] of Object.entries(systems)) {
    if (key === 'crew' || key === 'fuel') continue;
    if (value < health) {
      health = value;
      worst = key;
    }
  }
  if (!worst) {
    showNotice('NO DAMAGE TO REPAIR', 900);
    return;
  }
  repair = { module: worst, timer: 7.5, total: 7.5 };
  showNotice(`DAMAGE CONTROL · ${worst.toUpperCase()}`, 1100);
  audio.crew(`Repairing ${worst}`);
}

function updateRepair(dt) {
  if (!repair.module) return;
  repair.timer -= dt;
  if (Math.floor(repair.timer * 2) !== Math.floor((repair.timer + dt) * 2)) audio.repairTick();
  if (repair.timer > 0) return;
  systems[repair.module] = Math.min(100, systems[repair.module] + 58);
  if (systems[repair.module] > 92) systems[repair.module] = 100;
  showNotice(`${repair.module.toUpperCase()} · REPAIR COMPLETE`, 1200);
  audio.ready();
  repair = { module: null, timer: 0, total: 0 };
}

function applyPlayerDamage({ damage = 10, kind = 'CANNON', module = null, source = null }) {
  if (!app.ready || crewState.photoMode) return;
  const targetModule = module || (Math.random() < 0.34 ? 'engine' : Math.random() < 0.56 ? 'tracks' : Math.random() < 0.7 ? 'optics' : 'crew');
  const armorFactor = crewState.buttoned ? 0.72 : 1;
  systems[targetModule] = clamp(systems[targetModule] - damage * armorFactor, 0, 100);
  if (targetModule === 'tracks') systems.stabilizer = clamp(systems.stabilizer - damage * 0.2, 0, 100);
  if (targetModule === 'crew') systems.crew = clamp(systems.crew - damage * 0.22, 0, 100);
  damageFlash = 1;
  warningTimer = 2.5;
  damageLevel = Math.min(1, 0.34 + (1 - systems.crew / 100) * 0.6);
  if (source) warningSource.copy(source);
  else warningSource.set(tank.x, tank.y, tank.z - 10);
  if (ui.damageArcs) ui.damageArcs.classList.add('is-visible');
  post.setDamage(damageLevel);
  shake.amount = Math.min(0.8, shake.amount + 0.28);
  shake.kick = Math.min(1.2, shake.kick + 0.7);
  audio.damage();
  audio.crew(targetModule === 'crew' ? 'Crew hit!' : 'We are hit!', 0.2);
  showNotice(`${kind} HIT · ${targetModule.toUpperCase()} DAMAGE`, 1200);
  if (systems.crew <= 0) {
    systems.crew = 6;
    showNotice('CREW SHOCK · ACTION SLOWED', 1600);
  }
  if (systems.tracks <= 0) tank.speed *= 0.2;
}

function updateCombatTimers(dt) {
  smokeCooldown = Math.max(0, smokeCooldown - dt);
  damageFlash = Math.max(0, damageFlash - dt * 1.8);
  warningTimer = Math.max(0, warningTimer - dt);
  incomingTimer = Math.max(0, incomingTimer - dt);
  if (camera && (warningTimer > 0 || incomingTimer > 0)) {
    camera.getWorldDirection(tmpVector);
    const cameraBearing = Math.atan2(-tmpVector.x, -tmpVector.z);
    if (warningTimer > 0) {
      damageAngle = wrapAngle(Math.atan2(warningSource.x - tank.x, -(warningSource.z - tank.z)) - cameraBearing);
    }
    if (incomingTimer > 0) {
      incomingAngle = wrapAngle(Math.atan2(incomingSource.x - tank.x, -(incomingSource.z - tank.z)) - cameraBearing);
    }
  }
  post.setDamage(warningTimer > 0 ? damageLevel * clamp(warningTimer / 2.5, 0, 1) : 0);
  mgCooldown = Math.max(0, mgCooldown - dt);
  gun.barrelHeat = Math.max(0, gun.barrelHeat - dt * 0.055);
  gun.barrelWear = Math.min(1, gun.barrelWear + dt * 0.000005);
  if (gun.solutionTimer > 0) gun.solutionTimer = Math.max(0, gun.solutionTimer - dt);
  if (gun.lasedTimer > 0) {
    gun.lasedTimer = Math.max(0, gun.lasedTimer - dt);
    if (gun.lasedTimer <= 0) {
      gun.lasedRange = 0;
      gun.lasedTarget = null;
    }
  }
  if (gun.reload > 0) {
    const previousStage = gun.reloadStage;
    gun.reloadStage = gun.reloadTotal > 0 ? 1 - gun.reload / gun.reloadTotal : 1;
    if (previousStage < 0.48 && gun.reloadStage >= 0.48) audio.reload();
  }
  if (damageFlash > 0.2) {
    ui.damageFlash.classList.add('is-on');
  } else {
    ui.damageFlash.classList.remove('is-on');
  }
  if (warningTimer <= 0) ui.damageArcs?.classList.remove('is-visible');
  if (systems.fuel < 12 && Math.random() < dt * 3) {
    localPoint.set(0, 1.2, 2.5);
    tankRoot?.localToWorld(localPoint);
    fx.exhaust(localPoint, 0);
    fx.smokeScreen(localPoint, 3, 4);
  }
  updateRepair(dt);
}

function fireMG() {
  if (!app.ready || mgCooldown > 0 || gun.reload > 0 || crewState.photoMode) return;
  mgCooldown = 0.09;
  applyVisuals();
  tankRoot.updateMatrixWorld(true);
  barrelPivot.getWorldPosition(muzzleBase);
  barrelPivot.getWorldQuaternion(targetQuaternion);
  gunDirection.copy(forwardFromGun).applyQuaternion(targetQuaternion).normalize();
  muzzlePosition.copy(muzzleBase).addScaledVector(gunDirection, 5.9);
  const spec = { id: 'MG', label: 'MG', velocity: 920, drag: 0.00018, damage: 5, penetration: 18, blast: 0.2, tracer: 0xffe0a0, color: 0xd7a15b, hint: '' };
  const count = 1;
  for (let i = 0; i < count; i++) {
    shotDirection.copy(gunDirection);
    shotDirection.x += (Math.random() - 0.5) * 0.005;
    shotDirection.y += (Math.random() - 0.5) * 0.005;
    shotVelocity.copy(shotDirection).multiplyScalar(spec.velocity);
    const tracer = makeTracer(spec);
    tracer.group.position.copy(muzzlePosition);
    tracer.group.quaternion.setFromUnitVectors(forwardFromGun, shotVelocity.clone().normalize());
    projectiles.push({
      position: muzzlePosition.clone(), previous: muzzlePosition.clone(), velocity: shotVelocity.clone(),
      life: 4, spec, tracer, ammo: 'MG', penetration: 18, damage: 5, blast: 0.2, fuse: 'IMPACT', dud: false, age: 0, source: 'player',
    });
  }
  mgShots++;
  audio.mg();
  post.flash(0.2);
  shake.amount = Math.min(0.1, shake.amount + 0.015);
}

function removeProjectile(index) {
  const projectile = projectiles[index];
  scene.remove(projectile.tracer.group);
  projectiles.splice(index, 1);
}

function spawnImpact(point, normal, kind, scale = 1) {
  fx.impact(point, normal, kind, scale);
  audio.impact(kind);
  post.flash(kind === 'explosion' ? 0.7 : 0.25);
  shake.amount = Math.min(0.32, shake.amount + (kind === 'explosion' ? 0.12 : 0.035));
}

function showHitMarker(killed) {
  if (!ui.hitmarker) return;
  if (camera) {
    ui.hitmarker.style.left = `${(pointer.ndc.x * 0.5 + 0.5) * window.innerWidth}px`;
    ui.hitmarker.style.top = `${(-pointer.ndc.y * 0.5 + 0.5) * window.innerHeight}px`;
  }
  ui.hitmarker.classList.remove('is-visible', 'is-kill');
  void ui.hitmarker.offsetWidth;
  ui.hitmarker.classList.add('is-visible');
  if (killed) ui.hitmarker.classList.add('is-kill');
  window.setTimeout(() => ui.hitmarker.classList.remove('is-visible', 'is-kill'), 260);
}

function showScorePopup(points, worldPosition, killed, label) {
  if (!ui.popups || !camera) return;
  screenPoint.copy(worldPosition).project(camera);
  const element = document.createElement('div');
  element.className = `score-popup${killed ? ' is-kill' : ''}`;
  element.style.left = `${(screenPoint.x * 0.5 + 0.5) * window.innerWidth}px`;
  element.style.top = `${(-screenPoint.y * 0.5 + 0.5) * window.innerHeight}px`;
  element.innerHTML = `<b>+${points}</b><span>${killed ? 'DESTROYED' : 'HIT'} · ${label}</span>`;
  ui.popups.appendChild(element);
  window.setTimeout(() => element.remove(), 1350);
  while (ui.popups.children.length > 6) ui.popups.firstElementChild.remove();
}

function addFeed(label, points, killed, detail = '') {
  if (!ui.feed) return;
  const row = document.createElement('div');
  row.className = `feed__row${killed ? ' is-kill' : ''}`;
  row.innerHTML = `<span>${killed ? 'TARGET DOWN' : 'HIT'}</span><b>${label}${detail ? ` · ${detail}` : ''}</b><em>+${points}</em>`;
  ui.feed.prepend(row);
  window.setTimeout(() => row.remove(), 4200);
  while (ui.feed.children.length > 4) ui.feed.lastElementChild.remove();
}

function registerHit(target, point, normal, zone, projectile) {
  const spec = projectile.spec;
  const direction = tmpVector.copy(projectile.velocity).normalize();
  const incidence = Math.acos(clamp(Math.abs(direction.dot(normal)), 0, 1));
  const result = target.hit({
    zone,
    ammo: projectile.ammo,
    penetration: projectile.penetration,
    damage: projectile.damage,
    blast: projectile.blast,
    fuse: projectile.fuse,
    dud: projectile.dud,
    incidence,
  });
  if (result.ignored) return;
  if (result.friendly) {
    gun.combo = 0;
    gun.comboTimer = 0;
    gun.score = Math.max(0, gun.score - 500);
    showNotice('FRIENDLY FIRE · −500 · CEASE FIRE', 1800);
    audio.warning(0.5);
    audio.crew('Check fire! Friendly!');
    addFeed('FRIENDLY FIRE', -500, false, 'NO-FIRE TARGET');
    updateHud(0);
    return;
  }

  gun.hits++;
  if (result.killed) {
    gun.kills++;
    missionKills++;
  }
  gun.combo = Math.min(9, gun.combo + 1);
  gun.comboTimer = 5.4;
  gun.lastHit = {
    name: target.name,
    zone: String(zone).toUpperCase(),
    message: result.message,
    penetrated: result.penetrated,
    armor: result.effectiveArmor,
    ammo: projectile.ammo,
    distance: Math.round(point.distanceTo(tankRoot.position)),
    damage: Math.round(result.damage),
  };
  const multiplier = 1 + (gun.combo - 1) * 0.25;
  const distance = point.distanceTo(tankRoot.position);
  const zoneBonus = { ammo: 260, engine: 160, optics: 145, turret: 90, track: 80, fuel: 90, crew: 60 }[zone] || 0;
  const rawPoints = target.score + distance * 0.6 + zoneBonus;
  const points = Math.round(rawPoints * multiplier * (result.penetrated ? 1 : 0.34));
  gun.score += points;
  if (gun.score > gun.best) {
    gun.best = gun.score;
    saveBest(gun.best);
  }
  const destructive = target.kind === 'fuel' || target.kind === 'tank' || target.kind === 'hulk';
  if (result.killed && destructive) {
    fx.explosion(point, target.kind === 'tank' ? 2.1 : 1.2);
    audio.explosion(1.2, distance);
    post.flash(0.95);
    shake.amount = Math.min(0.4, shake.amount + 0.2);
    spawnImpact(point, normal, target.kind === 'fuel' ? 'explosion' : 'tank', 1.4);
  } else {
    spawnImpact(
      point,
      normal,
      target.kind === 'steel' ? 'metal' : target.kind === 'infantry' || target.kind === 'atgm' ? 'ground' : 'tank',
      target.kind === 'steel' ? 1.1 : 1.35,
    );
  }
  if (projectile.fuse === 'DELAY' && result.penetrated && !result.killed) {
    window.setTimeout(() => fx.explosion(point.clone(), 0.65), 120);
  }
  if (projectile.ammo === 'SMOKE') handleSmokeEvent(point, 9, 12);
  if (target.hostile && !result.killed && Math.random() < 0.22) {
    handleSmokeEvent(target.getAimPoint(tmpVector).add(new THREE.Vector3(0, 0.4, 0)), 7, 9);
  }
  audio.hit(result.killed);
  showHitMarker(result.killed);
  showScorePopup(points, point, result.killed, `${target.name} · ${String(zone).toUpperCase()} · ${result.message}`);
  addFeed(target.name, points, result.killed, `${String(zone).toUpperCase()} · ${result.message} · ${Math.round(result.damage)} DMG`);
  if (result.killed && missionKills > 0 && missionKills % 4 === 0) {
    missionWave++;
    range?.setWave(missionWave);
    objective = `WAVE ${missionWave} · HOLD THE RANGE`;
    showNotice(`WAVE ${missionWave} · THREAT INCREASED`, 1800);
    audio.radio(`Wave ${missionWave}, they are pushing`);
  }
  updateHud(0);
}

function registerStructureHit(structure, point, normal, zone, projectile) {
  const result = structure.hit({
    ammo: projectile.ammo,
    damage: projectile.damage,
    penetration: projectile.penetration,
    blast: projectile.blast,
    fuse: projectile.fuse,
  });
  if (result.ignored) return;
  const points = result.killed ? structure.score : Math.round(structure.score * 0.12);
  gun.score += points;
  spawnImpact(point, normal, 'ground', result.killed ? 1.8 : 1);
  if (result.killed) fx.explosion(point, 1);
  addFeed(structure.name, points, result.killed, result.message);
  audio.hit(result.killed);
  showScorePopup(points, point, result.killed, `${structure.name} · ${result.message}`);
}

function registerGroundImpact(point, projectile) {
  const normal = terrainNormal(point.x, point.z);
  gun.combo = 0;
  gun.comboTimer = 0;
  if (projectile.ammo === 'SMOKE') {
    handleSmokeEvent(point, 10, 12);
  }
  if (projectile.blast > 5 || projectile.fuse === 'AIRBURST') {
    fx.explosion(point, Math.min(2, projectile.blast * 0.18));
    audio.explosion(0.7, point.distanceTo(tankRoot.position));
    post.flash(0.5);
  }
  spawnImpact(point, normal, 'ground', projectile.blast > 4 ? 1.5 : 1);
  updateHud(0);
}

function detonateAirburst(projectile) {
  const point = projectile.position.clone();
  fx.explosion(point, 1.3);
  audio.explosion(0.8, point.distanceTo(tankRoot.position));
  post.flash(0.45);
  if (range) {
    for (const target of range.targets) {
      if (!target.alive || target.friendly) continue;
      const distance = target.getAimPoint(tmpVector).distanceTo(point);
      if (distance > 16) continue;
      target.hit({
        zone: 'hull',
        ammo: projectile.ammo,
        penetration: projectile.penetration * 0.34,
        damage: projectile.damage * 0.32,
        blast: projectile.blast,
        fuse: 'AIRBURST',
        incidence: 0.2,
      });
    }
  }
}

function updateProjectiles(dt) {
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const projectile = projectiles[index];
    projectile.age = (projectile.age || 0) + dt;
    projectile.life -= dt;
    if (projectile.guided && projectile.guidedTarget?.alive) {
      projectile.guidedTarget.getAimPoint(tmpVector2);
      tmpVector.copy(tmpVector2).sub(projectile.position).normalize().multiplyScalar(projectile.spec.velocity);
      projectile.velocity.lerp(tmpVector, Math.min(1, dt * 5.5));
    } else if (projectile.ammo === 'ATGM' && !projectile.guidedTarget) {
      projectile.velocity.x += (Math.random() - 0.5) * 6 * dt;
      projectile.velocity.z += (Math.random() - 0.5) * 6 * dt;
    }
    projectile.previous.copy(projectile.position);
    projectile.velocity.y -= GRAVITY * dt;
    projectile.velocity.multiplyScalar(Math.exp(-projectile.spec.drag * dt));
    projectile.velocity.x += environment.wind.x * 0.035 * dt;
    projectile.velocity.z += environment.wind.z * 0.035 * dt;
    projectile.position.addScaledVector(projectile.velocity, dt);
    projectile.tracer.group.position.copy(projectile.position);
    if (projectile.velocity.lengthSq() > 0.01) {
      projectile.tracer.group.quaternion.setFromUnitVectors(
        forwardFromGun,
        segmentDirection.copy(projectile.velocity).normalize(),
      );
    }

    if (projectile.fuse === 'AIRBURST' && projectile.age > 0.18 && projectile.fuseRange > 20) {
      const travelled = projectile.previous.distanceTo(projectile.position);
      if (projectile.age * projectile.spec.velocity >= projectile.fuseRange - travelled) {
        detonateAirburst(projectile);
        removeProjectile(index);
        continue;
      }
    }
    if (projectile.fuse === 'PROXIMITY' && projectile.age > 0.12 && range) {
      let proximityTarget = null;
      let proximityDistance = 8;
      for (const target of range.targets) {
        if (!target.alive || target.friendly) continue;
        const distance = target.getAimPoint(tmpVector).distanceTo(projectile.position);
        if (distance < proximityDistance) {
          proximityDistance = distance;
          proximityTarget = target;
        }
      }
      if (proximityTarget) {
        hitPoint.copy(projectile.position);
        hitNormal.copy(worldUp);
        registerHit(proximityTarget, hitPoint, hitNormal, 'hull', projectile);
        removeProjectile(index);
        continue;
      }
    }
    if (!projectile.flyby && projectile.position.distanceTo(camera.position) < 7) {
      projectile.flyby = true;
      audio.flyby(projectile.position.x > tank.x ? 0.5 : -0.5);
    }

    segmentDirection.copy(projectile.position).sub(projectile.previous);
    const segmentLength = segmentDirection.length();
    if (segmentLength > 0.001) {
      projectileRaycaster.set(projectile.previous, segmentDirection.normalize());
      projectileRaycaster.near = 0;
      projectileRaycaster.far = segmentLength;

      let closest = null;
      const targetHits = range ? projectileRaycaster.intersectObjects(range.colliders, false) : [];
      for (const hit of targetHits) {
        const target = range?.getTargetForObject(hit.object);
        if (!target || !target.alive) continue;
        if (!closest || hit.distance < closest.distance) {
          closest = { type: hit.object.userData.destructible ? 'structure' : 'target', hit, target };
        }
      }
      const terrainHit = projectileRaycaster.intersectObject(terrain.ground, false)[0];
      if (terrainHit && (!closest || terrainHit.distance < closest.hit.distance)) {
        closest = { type: 'ground', hit: terrainHit };
      }

      if (closest) {
        hitPoint.copy(closest.hit.point);
        hitNormal.copy(closest.hit.face?.normal || worldUp).transformDirection(closest.hit.object.matrixWorld);
        if (closest.type === 'target') {
          registerHit(closest.target, hitPoint, hitNormal, closest.hit.object.userData.zone, projectile);
        } else if (closest.type === 'structure') {
          registerStructureHit(closest.target, hitPoint, hitNormal, closest.hit.object.userData.zone, projectile);
        } else {
          registerGroundImpact(hitPoint, projectile);
        }
        removeProjectile(index);
        continue;
      }
    }

    if (projectile.life <= 0 || projectile.position.y < terrainHeight(projectile.position.x, projectile.position.z) - 1) {
      if (projectile.life <= 0) {
        gun.combo = 0;
        gun.comboTimer = 0;
      }
      removeProjectile(index);
    }
  }
}

function enemyTracer(kind) {
  return makeTracer({
    id: `ENEMY-${kind}`,
    tracer: kind === 'ATGM' ? 0xff6338 : 0xffcf7a,
    color: 0xc87842,
  });
}

function handleEnemyFire(payload) {
  if (!app.ready || crewState.photoMode) return;
  const { from, target, speed = 760, damage = 50, kind = 'CANNON', guided = false, source = null } = payload;
  const direction = tmpVector.copy(target).sub(from).normalize();
  const tracer = enemyTracer(kind);
  tracer.group.position.copy(from);
  tracer.group.quaternion.setFromUnitVectors(forwardFromGun, direction.clone());
  enemyShots++;
  enemyProjectiles.push({
    position: from.clone(), previous: from.clone(), velocity: direction.multiplyScalar(speed),
    life: 12, tracer, damage, kind, guidedTarget: tankRoot.position.clone(), guided, age: 0, source,
  });
  const distance = from.distanceTo(tankRoot.position);
  const pan = clamp((tmpVector2.copy(from).sub(tankRoot.position).normalize().dot(forward)), -1, 1) * 0.7;
  if (kind === 'ATGM') audio.missile(distance, pan);
  else audio.distantFire(distance, pan);
  incomingTimer = Math.max(incomingTimer, 1.4);
  incomingSource.copy(from);
  showNotice(`${source?.name || 'HOSTILE'} · ${kind} INCOMING`, 900);
}

function pointToSegmentDistance(point, a, b) {
  tmpVector.copy(b).sub(a);
  const lengthSq = tmpVector.lengthSq();
  if (lengthSq < 0.0001) return point.distanceTo(a);
  const t = clamp(tmpVector2.copy(point).sub(a).dot(tmpVector) / lengthSq, 0, 1);
  return point.distanceTo(tmpVector2.copy(a).addScaledVector(tmpVector, t));
}

function updateEnemyProjectiles(dt) {
  const playerCenter = tmpVector2.set(tank.x, tank.y + 1.2, tank.z);
  for (let index = enemyProjectiles.length - 1; index >= 0; index--) {
    const projectile = enemyProjectiles[index];
    projectile.age += dt;
    projectile.life -= dt;
    projectile.previous.copy(projectile.position);
    if (projectile.guided) {
      projectile.guidedTarget.set(tank.x, tank.y + 1.2, tank.z);
      tmpVector.copy(projectile.guidedTarget).sub(projectile.position).normalize().multiplyScalar(260);
      projectile.velocity.lerp(tmpVector, Math.min(1, dt * 2.3));
    } else {
      projectile.velocity.y -= GRAVITY * dt;
    }
    projectile.position.addScaledVector(projectile.velocity, dt);
    projectile.tracer.group.position.copy(projectile.position);
    projectile.tracer.group.quaternion.setFromUnitVectors(forwardFromGun, segmentDirection.copy(projectile.velocity).normalize());

    if (pointToSegmentDistance(playerCenter, projectile.previous, projectile.position) < 3.2) {
      applyPlayerDamage({ damage: projectile.damage, kind: projectile.kind, source: projectile.previous });
      fx.explosion(projectile.position, projectile.kind === 'ATGM' ? 1.2 : 0.7);
      audio.explosion(0.7, 0);
      post.flash(0.8);
      scene.remove(projectile.tracer.group);
      enemyProjectiles.splice(index, 1);
      continue;
    }
    const ground = terrainHeight(projectile.position.x, projectile.position.z);
    if (projectile.position.y < ground || projectile.life <= 0) {
      if (projectile.position.y < ground) {
        fx.impact(projectile.position, terrainNormal(projectile.position.x, projectile.position.z), 'ground', 0.8);
        audio.impact('ground', projectile.position.distanceTo(playerCenter));
      }
      scene.remove(projectile.tracer.group);
      enemyProjectiles.splice(index, 1);
    }
  }
}

function clearEnemyProjectiles() {
  for (const projectile of enemyProjectiles) scene.remove(projectile.tracer.group);
  enemyProjectiles.length = 0;
}

function handleArtillery(point, delay = 6, source = null) {
  artilleryShots++;
  artilleryQueue.push({ point: point.clone(), timer: delay, source, warned: false });
  audio.warning(0.3);
  showNotice(source?.name ? `${source.name} · FIRE MISSION INBOUND` : 'ARTILLERY INBOUND', 1700);
  audio.radio('Fire mission inbound');
}

function updateArtillery(dt) {
  for (let index = artilleryQueue.length - 1; index >= 0; index--) {
    const shell = artilleryQueue[index];
    shell.timer -= dt;
    if (!shell.warned && shell.timer < 2.2) {
      shell.warned = true;
      audio.artilleryIncoming(shell.point.distanceTo(tankRoot.position), 0.2);
    }
    if (shell.timer > 0) continue;
    const impact = shell.point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14));
    impact.y = terrainHeight(impact.x, impact.z) + 0.2;
    fx.explosion(impact, 2.2);
    audio.explosion(1.3, impact.distanceTo(tankRoot.position), 0.2);
    post.flash(0.8);
    shake.amount = Math.min(0.8, shake.amount + 0.32);
    if (impact.distanceTo(tankRoot.position) < 18) {
      applyPlayerDamage({ damage: 42 * (1 - impact.distanceTo(tankRoot.position) / 18), kind: 'ARTILLERY', source: impact });
    }
    artilleryQueue.splice(index, 1);
  }
}

function handleSmokeEvent(point, radius = 8, life = 10) {
  environment?.addSmoke(point, radius, life);
  fx.smokeScreen(point, radius, life);
  if (radius > 7) showNotice('SMOKE SCREEN DEPLOYED', 1000);
}

function handleRangeEvent(type, data) {
  if (type === 'wave') {
    missionWave = data || missionWave;
    objective = `WAVE ${missionWave} · HOLD THE RANGE`;
    showNotice(`WAVE ${missionWave} · THREAT INCREASED`, 1500);
    audio.radio(`Wave ${missionWave}, stand by`);
  } else if (type === 'enemyFire') {
    if (data?.name) {
      incomingTimer = Math.max(incomingTimer, 0.8);
      incomingSource.set(tank.x, tank.y, tank.z - 100);
    }
  } else if (type === 'artillery') {
    showNotice('OBSERVER ACTIVE · INDIRECT FIRE', 900);
  } else if (type === 'respawn') {
    // Keeping this silent avoids a feed spam during sustained fire.
  }
}

function updateGunnery(dt) {
  if (gun.reload > 0) {
    const before = gun.reload;
    gun.reload = Math.max(0, gun.reload - dt);
    if (before > 0 && gun.reload === 0) {
      audio.ready();
      showNotice(`${SHELLS[gun.selected].id} READY`, 700);
      audio.crew('Up');
    }
  }
  gun.cooldown = Math.max(0, gun.cooldown - dt);
  if (gun.comboTimer > 0) {
    gun.comboTimer -= dt;
    if (gun.comboTimer <= 0) gun.combo = 0;
  }
  if (range) {
    range.update(dt, tankRoot.position, playerVelocity, camera);
  }
  updateProjectiles(dt);
  updateEnemyProjectiles(dt);
  updateArtillery(dt);
}

function updateAmmoUi() {
  const spec = SHELLS[gun.selected];
  if (ui.reticleAmmo) ui.reticleAmmo.textContent = `${spec.id} / ${FUSES[fuseIndex]}`;
  for (const chip of ui.ammoChips) {
    chip.classList.toggle('is-active', chip.dataset.shell === spec.id);
  }
  if (ui.rangeReadout) ui.rangeReadout.classList.toggle('is-solved', gun.lasedTimer > 0);
}

function updateHud(dt) {
  hudElapsed += dt;
  fpsElapsed += dt;
  fpsFrames++;
  if (hudElapsed < 0.08) return;
  hudElapsed = 0;

  const kmh = Math.round(Math.abs(tank.speed) * 3.6);
  const rpmText = engineOn ? `${Math.round(600 + tank.rpm * 1600)} RPM` : 'ENGINE OFF';
  if (ui.speed) ui.speed.textContent = String(kmh).padStart(3, '0');
  if (ui.gear) ui.gear.textContent = tank.gear;
  if (ui.miniGear) ui.miniGear.textContent = tank.gear;
  if (ui.miniRpm) ui.miniRpm.textContent = rpmText;
  if (ui.miniSpeed) ui.miniSpeed.textContent = `${kmh} KM/H`;
  const throttle = keys.has('KeyW') ? 1 : 0;
  if (ui.throttle) ui.throttle.style.transform = `scaleX(${throttle})`;
  if (ui.driveState) ui.driveState.textContent = repair.module
    ? 'REPAIR'
    : parkingBrake
      ? 'PARKING'
      : !engineOn
        ? 'ENGINE OFF'
        : keys.has('Space')
          ? 'BRAKE'
          : tank.gear === 'N'
            ? 'NEUTRAL'
            : tank.speed < -0.25
              ? 'REVERSE'
              : tank.speed > 0.25
                ? 'DRIVE'
                : 'IDLE';
  const traverse = ((tank.turretYaw * 180) / Math.PI + 360) % 360;
  if (ui.turret) ui.turret.textContent = `${String(Math.round(traverse)).padStart(3, '0')}°`;
  const elevation = (tank.gunPitch * 180) / Math.PI;
  if (ui.elevation) ui.elevation.textContent = `${elevation >= 0 ? '+' : ''}${elevation.toFixed(1)}°`;
  if (ui.grade) ui.grade.textContent = `${tank.grade >= 0 ? '+' : ''}${(tank.grade * 100).toFixed(1)}%`;
  if (ui.grid) ui.grid.textContent = `X ${Math.round(tank.x)} · Z ${Math.round(tank.z)}`;

  const spec = SHELLS[gun.selected];
  const multiplier = 1 + Math.max(0, gun.combo - 1) * 0.25;
  if (ui.score) ui.score.textContent = String(gun.score).padStart(6, '0');
  if (ui.best) ui.best.textContent = `BEST ${String(gun.best).padStart(6, '0')}`;
  if (ui.combo) {
    ui.combo.textContent = gun.combo > 0 ? `x${multiplier.toFixed(2)}` : 'x1.00';
    ui.combo.classList.toggle('is-hot', gun.combo >= 3);
  }
  const reloadTotal = gun.reloadTotal || spec.reload;
  if (ui.reloadBar) ui.reloadBar.style.transform = `scaleX(${1 - clamp(gun.reload / reloadTotal, 0, 1)})`;
  if (ui.reloadLabel) ui.reloadLabel.textContent = gun.reload > 0 ? `${repair.module ? 'REPAIRING' : 'LOADING'} ${gun.reload.toFixed(1)}S` : 'READY';
  if (ui.rangeReadout) {
    ui.rangeReadout.textContent = gun.lasedRange > 0 ? `${Math.round(gun.lasedRange)} M` : '--- M';
    ui.rangeReadout.classList.toggle('is-solved', gun.lasedTimer > 0);
  }
  if (ui.reloadRing) ui.reloadRing.style.setProperty('--reload', String(1 - clamp(gun.reload / reloadTotal, 0, 1)));

  if (ui.sight) ui.sight.textContent = `${crewState.sight} ${crewState.sight === 'THERMAL' ? (crewState.thermalPolarity > 0 ? 'WH' : 'BH') : `${crewState.zoom}X`}`;
  if (ui.role) ui.role.textContent = crewState.role;
  if (ui.weather) ui.weather.textContent = environment.getState().label;
  if (ui.wind) ui.wind.textContent = `${Math.round(environment.state.windSpeed)} M/S ${Math.round(environment.state.windAngle)}°`;
  if (ui.temp) ui.temp.textContent = `${Math.round(environment.state.tempC)}°C`;
  if (ui.fuse) ui.fuse.textContent = FUSES[fuseIndex];
  if (ui.compass) ui.compass.textContent = `${String(Math.round(((-tank.heading * 180) / Math.PI + 360) % 360)).padStart(3, '0')}°`;
  if (ui.objective) ui.objective.textContent = objective;
  if (ui.backend) ui.backend.textContent = app.backend || 'WEBGL';
  if (ui.tracker) {
    ui.tracker.textContent = gun.trackedTarget?.alive ? `TRACK · ${gun.trackedTarget.name}` : 'TRACK · MANUAL';
    ui.tracker.classList.toggle('is-locked', Boolean(gun.trackedTarget?.alive));
  }
  if (ui.shotFlag) ui.shotFlag.textContent = shotCameraActive ? 'SHOT CAM ON' : '';
  if (ui.menuEngine) ui.menuEngine.textContent = engineOn ? 'ENGINE RUNNING' : 'ENGINE OFF';
  if (ui.menuBrake) ui.menuBrake.textContent = parkingBrake ? 'PARKING BRAKE ON' : 'PARKING BRAKE OFF';
  if (ui.menuGear) ui.menuGear.textContent = tank.gear;
  if (ui.menuRpm) ui.menuRpm.textContent = rpmText;
  if (ui.menuSpeed) ui.menuSpeed.textContent = `${kmh} KM/H`;
  if (ui.menuSmoke) ui.menuSmoke.textContent = smokeCooldown > 0 ? `${smokeCharges} · ${Math.ceil(smokeCooldown)}S` : `${smokeCharges} READY`;
  if (ui.menuShell) ui.menuShell.textContent = `${spec.id} / ${FUSES[fuseIndex]}`;
  if (ui.menuRole) ui.menuRole.textContent = crewState.role;
  if (ui.menuSight) ui.menuSight.textContent = `${crewState.sight} ${crewState.sight === 'THERMAL' ? (crewState.thermalPolarity > 0 ? 'WH' : 'BH') : `${crewState.zoom}X`}`;
  if (ui.menuWeather) ui.menuWeather.textContent = environment.getState().label;
  if (ui.menuGearbox) ui.menuGearbox.textContent = autoGear ? 'AUTO' : 'MANUAL';
  if (ui.menuQuality) ui.menuQuality.textContent = lowPower ? 'PHONE' : 'HIGH';
  if (ui.escapeAudio) ui.escapeAudio.textContent = `AUDIO ${audio.muted ? 'OFF' : 'ON'}`;
  if (ui.escapeGearbox) ui.escapeGearbox.textContent = autoGear ? 'AUTO GEAR ON' : 'AUTO GEAR OFF';
  if (ui.escapeQuality) ui.escapeQuality.textContent = lowPower ? 'QUALITY PHONE' : 'QUALITY HIGH';
  if (ui.damageArcs) {
    ui.damageArcs.style.setProperty('--damage-angle', `${damageAngle}rad`);
    ui.damageArcs.classList.toggle('is-visible', warningTimer > 0);
  }
  if (ui.laserWarning) {
    ui.laserWarning.style.setProperty('--warning-angle', `${incomingAngle}rad`);
    ui.laserWarning.classList.toggle('is-visible', incomingTimer > 0);
  }
  for (const bar of ui.systemBars) {
    const key = bar.dataset.system;
    const value = systems[key] ?? 100;
    bar.style.setProperty('--value', `${value}%`);
    bar.classList.toggle('is-critical', value < 30);
  }
  if (ui.repair) {
    ui.repair.classList.toggle('is-visible', Boolean(repair.module));
    if (ui.repairBar) ui.repairBar.style.transform = `scaleX(${repair.total ? 1 - repair.timer / repair.total : 0})`;
    if (ui.repairLabel) ui.repairLabel.textContent = repair.module ? `DAMAGE CONTROL · ${repair.module.toUpperCase()}` : '';
  }
  if (ui.perf && ui.perf.classList.contains('is-visible')) {
    ui.perf.innerHTML = [
      `FPS ${Math.round(fpsAverage)}  ·  FRAME ${lastFrameTime.toFixed(1)} MS`,
      `SCALE ${renderScale.toFixed(2)}  ·  ${renderer?.info.render.calls || 0} CALLS`,
      `TRI ${Math.round(triangles / 1000)}K  ·  PROJECTILES ${projectiles.length + enemyProjectiles.length}`,
      `SYS E${Math.round(systems.engine)} T${Math.round(systems.tracks)} O${Math.round(systems.optics)} G${Math.round(systems.gun)}`,
      `WIND ${environment.state.windSpeed.toFixed(1)}  ·  VIS ${environment.state.visibility.toFixed(2)}`,
    ].join('<br>');
  }
  if (ui.projectileMarker && camera) {
    const active = projectiles.find((projectile) => projectile.source === 'player') || enemyProjectiles[0];
    if (active) {
      screenPoint.copy(active.position).project(camera);
      const x = (screenPoint.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-screenPoint.y * 0.5 + 0.5) * window.innerHeight;
      ui.projectileMarker.classList.add('is-visible');
      ui.projectileMarker.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (ui.projectileReadout) ui.projectileReadout.textContent = active.source === 'player' ? 'TRACK' : 'INBOUND';
    } else {
      ui.projectileMarker.classList.remove('is-visible');
    }
  }

  if (fpsElapsed >= 0.5) {
    const measured = fpsFrames / fpsElapsed;
    fpsAverage = fpsAverage * 0.72 + measured * 0.28;
    if (ui.fps) ui.fps.textContent = String(Math.round(measured));
    fpsElapsed = 0;
    fpsFrames = 0;
  }
}

let simAccumulator = 0;
let adaptiveTimer = 0;
let frameStart = 0;

function simulate(dt) {
  updateMotion(dt);
  updateRecoil(dt);
  updateAim(dt);
  applyVisuals();
  updateTracks(dt);
  updateGunnery(dt);
}

function updateShotCamera() {
  if (!shotCamera) return;
  const projectile = projectiles[0];
  if (projectile) {
    tmpVector.copy(projectile.velocity).normalize();
    shotCamera.position.copy(projectile.position).addScaledVector(tmpVector, -7).add(new THREE.Vector3(0, 2.2, 0));
    shotCamera.lookAt(projectile.position.clone().addScaledVector(tmpVector, 22));
  } else {
    tankRoot.getWorldPosition(tmpVector);
    shotCamera.position.set(tank.x, tank.y + 5.5, tank.z + 8);
    shotCamera.lookAt(aimPoint);
  }
  post.setShotCamera(shotCamera, shotCameraActive);
}

function updateAdaptiveResolution(dt) {
  adaptiveTimer += dt;
  if (adaptiveTimer < 2.4) return;
  adaptiveTimer = 0;
  const minScale = lowPower ? 0.8 : 0.85;
  const maxScale = 1;
  if (fpsAverage < 36 && renderScale > minScale) {
    renderScale = Math.max(minScale, renderScale - 0.05);
    post.setRenderScale(renderScale);
  } else if (fpsAverage > 54 && renderScale < maxScale) {
    renderScale = Math.min(maxScale, renderScale + 0.03);
    post.setRenderScale(renderScale);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.25);
  const dt = Math.min(rawDt, 0.2);
  frameStart = performance.now();
  if (environment && !paused) {
    environment.update(dt, tankRoot?.position || tmpVector.set(0, 0, 0));
    sunDirection.copy(environment.state.sunDirection);
  }
  updateSun();
  if (app.ready) {
    if (!paused && !crewState.photoMode) {
      simAccumulator = Math.min(0.5, simAccumulator + dt);
      let steps = 0;
      while (simAccumulator >= 1 / 60 && steps < 24) {
        simulate(1 / 60);
        simAccumulator -= 1 / 60;
        steps++;
      }
      updateCombatTimers(dt);
    }
    if (!paused) {
      updateCamera(dt);
      updateReticles();
      updateShotCamera();
      updateAdaptiveResolution(dt);
    }
    updateHud(dt);
  }
  if (environment && !paused) fx.setWind(environment.wind);
  if (!paused) fx.update(dt);
  audio.update({
    speed: tank.speed,
    moving: !paused && Math.abs(tank.speed) > 0.5,
    rpm: tank.rpm,
    engineOn: engineOn && !paused,
    rain: environment?.state.rain || 0,
    wind: environment?.state.windSpeed || 0,
    buttoned: crewState.buttoned,
    damage: 1 - systems.crew / 100,
    repairing: Boolean(repair.module),
    tempC: environment?.state.tempC || 18,
  });
  post.render(dt);
  lastFrameTime = performance.now() - frameStart;
}

function cycleZoom() {
  const zoomLevels = [1, 4, 8];
  const index = zoomLevels.indexOf(crewState.zoom);
  crewState.zoom = zoomLevels[(index + 1) % zoomLevels.length];
  showNotice(`OPTIC ZOOM · ${crewState.zoom}X`, 900);
}

function callWingman() {
  if (!range) return;
  const point = aimPoint.clone();
  range.callSupport(point);
  showNotice('WINGMAN · FIRE MISSION REQUESTED', 1400);
  audio.radio('Wingman, fire mission');
}

function toggleShotCamera() {
  shotCameraActive = !shotCameraActive;
  post.setShotCamera(shotCamera, shotCameraActive);
  showNotice(shotCameraActive ? 'SHOT CAMERA · ON' : 'SHOT CAMERA · OFF', 900);
}

function togglePerf() {
  if (!ui.perf) return;
  ui.perf.classList.toggle('is-visible');
}

function setPaused(open) {
  if (!app.ready) return;
  paused = Boolean(open);
  document.body.classList.toggle('is-paused', paused);
  if (ui.escape) {
    ui.escape.classList.toggle('is-open', paused);
    ui.escape.setAttribute('aria-hidden', String(!paused));
  }
  if (paused) {
    keys.clear();
    pointer.dragging = false;
    document.body.classList.remove('is-pointing', 'is-dragging');
    simAccumulator = 0;
    updateHud(0.2);
  } else {
    clock.getDelta();
    simAccumulator = 0;
  }
}

function shiftGear(direction) {
  if (paused) return;
  autoGear = false;
  const next = clamp(tank.gearIndex + direction, 0, GEARS.length - 1);
  if (next === tank.gearIndex) {
    showNotice(direction > 0 ? 'TOP GEAR' : 'LOWEST GEAR', 700);
    return;
  }
  tank.gearIndex = next;
  tank.gear = GEARS[next].label;
  showNotice(`GEAR ${tank.gear}`, 780);
  audio.gearShift?.();
}

function toggleIgnition() {
  if (paused) return;
  if (engineOn && Math.abs(tank.speed) > 1.2) {
    showNotice('STOP THE VEHICLE BEFORE SHUTDOWN', 1000);
    return;
  }
  engineOn = !engineOn;
  if (!engineOn) {
    tank.rpm = 0;
    showNotice('ENGINE SHUT DOWN', 1100);
  } else {
    showNotice('ENGINE START · IDLE', 1100);
  }
  audio.ignition?.(engineOn);
}

function toggleParkingBrake() {
  if (paused) return;
  parkingBrake = !parkingBrake;
  showNotice(parkingBrake ? 'PARKING BRAKE SET' : 'PARKING BRAKE RELEASED', 900);
  audio.click?.();
}

function deploySmoke() {
  if (!app.ready || paused) return;
  if (smokeCooldown > 0) {
    showNotice(`SMOKE READY IN ${Math.ceil(smokeCooldown)}S`, 900);
    return;
  }
  if (smokeCharges <= 0) {
    showNotice('SMOKE DISCHARGERS EMPTY', 1000);
    return;
  }
  smokeCharges--;
  smokeCooldown = 9;
  const origin = new THREE.Vector3(
    tank.x - Math.sin(tank.heading) * 9,
    tank.y + 0.9,
    tank.z - Math.cos(tank.heading) * 9,
  );
  fx.smokeScreen(origin, 17, 16);
  fx.smokeScreen(new THREE.Vector3(tank.x, tank.y + 1.1, tank.z), 9, 12);
  audio.smoke?.();
  showNotice(`SMOKE GRENADE · ${smokeCharges} REMAIN`, 1200);
}

function togglePhoto() {
  crewState.photoMode = !crewState.photoMode;
  document.body.classList.toggle('photo-mode', crewState.photoMode);
  post.setPhoto(crewState.photoMode ? 1 : 0);
  if (crewState.photoMode) {
    keys.clear();
    showNotice('PHOTO MODE · FREE CAMERA · O TO RESUME', 1800);
    document.body.classList.remove('hide-hints');
  } else {
    cameraRig.yawOffset = 0;
    cameraRig.pitch = 0.34;
    cameraRig.distance = 11.5;
    updateCamera(1, true);
    showNotice('SIMULATION RESUMED', 900);
  }
}

function selectShell(index) {
  if (index < 0 || index >= SHELLS.length) return;
  gun.selected = index;
  updateAmmoUi();
  updateHud(0);
  showNotice(`${SHELLS[index].id} · ${SHELLS[index].hint}`, 1200);
}

function bindInput() {
  ui.escapeResume?.addEventListener('click', () => setPaused(false));
  ui.escapeReset?.addEventListener('click', () => {
    resetTank(true);
    setPaused(false);
    showNotice('RANGE RESET · ENGINE RUNNING · GEAR 1', 1400);
  });
  ui.escapeAudio?.addEventListener('click', () => {
    const muted = audio.toggle();
    showNotice(muted ? 'AUDIO MUTED' : 'AUDIO LIVE', 900);
    updateHud(0.2);
  });
  ui.escapeGearbox?.addEventListener('click', () => {
    autoGear = !autoGear;
    showNotice(autoGear ? 'AUTO GEARBOX ON' : 'MANUAL GEARBOX', 1000);
    updateHud(0.2);
  });
  ui.escapeQuality?.addEventListener('click', () => {
    lowPower = !lowPower;
    applyQualityMode();
    showNotice(lowPower ? 'PHONE QUALITY · PERFORMANCE' : 'HIGH QUALITY · SHADOWS ON', 1300);
    updateHud(0.2);
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      event.preventDefault();
      if (paused) setPaused(false);
      else if (crewState.photoMode) togglePhoto();
      else setPaused(true);
      return;
    }
    if (paused) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyR') resetTank(true);
    if (event.code === 'KeyC') deploySmoke();
    if (event.code === 'KeyH') toggleParkingBrake();
    if (event.code === 'Backquote') toggleIgnition();
    if (event.code === 'Comma' || event.code === 'BracketLeft') shiftGear(-1);
    if (event.code === 'Period' || event.code === 'BracketRight') shiftGear(1);
    if (event.code === 'KeyF') lase();
    if (event.code === 'KeyN') backupRange();
    if (event.code === 'KeyG') designateTarget();
    if (event.code === 'KeyV') cycleSight();
    if (event.code === 'KeyB') cyclePolarity();
    if (event.code === 'KeyX') cycleFuse();
    if (event.code === 'KeyK') cycleRole();
    if (event.code === 'KeyU') toggleButtoned();
    if (event.code === 'KeyJ') cycleWeather();
    if (event.code === 'KeyE') startRepair();
    if (event.code === 'KeyQ') fireMG();
    if (event.code === 'KeyY') callWingman();
    if (event.code === 'KeyZ') cycleZoom();
    if (event.code === 'KeyI') toggleShotCamera();
    if (event.code === 'KeyP') togglePerf();
    if (event.code === 'KeyO') togglePhoto();
    if (event.code === 'KeyM') {
      const muted = audio.toggle();
      showNotice(muted ? 'AUDIO MUTED' : 'AUDIO LIVE', 900);
    }
    if (event.code === 'Digit1') selectShell(0);
    if (event.code === 'Digit2') selectShell(1);
    if (event.code === 'Digit3') selectShell(2);
    if (event.code === 'Digit4') selectShell(3);
    if (event.code === 'Digit5') selectShell(4);
    if (event.code === 'Digit6') selectShell(5);
    if (event.code === 'Digit7') selectShell(6);
  });

  for (const button of document.querySelectorAll('[data-touch-key]')) {
    const code = button.dataset.touchKey;
    const press = (event) => {
      event.preventDefault();
      audio.unlock();
      keys.add(code);
      button.classList.add('is-down');
      button.setPointerCapture?.(event.pointerId);
    };
    const release = (event) => {
      event.preventDefault();
      keys.delete(code);
      button.classList.remove('is-down');
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  for (const button of document.querySelectorAll('[data-touch-action]')) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      audio.unlock();
      const action = button.dataset.touchAction;
      if (action === 'menu') setPaused(true);
      if (action === 'fire') fire();
      if (action === 'lase') lase();
      if (action === 'smoke') deploySmoke();
      if (action === 'gear-up') shiftGear(1);
      if (action === 'gear-down') shiftGear(-1);
    });
  }

  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pointer.dragging = false;
    document.body.classList.remove('is-dragging');
    for (const button of document.querySelectorAll('[data-touch-key]')) button.classList.remove('is-down');
  });

  canvas.addEventListener('pointerenter', () => {
    pointer.inside = true;
    pointer.dirty = true;
    document.body.classList.add('is-pointing');
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    if (!pointer.dragging) document.body.classList.remove('is-pointing');
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (ui.reticle) {
      ui.reticle.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    }
    pointer.dirty = true;
    pointer.inside = true;
    document.body.classList.add('is-pointing');

    if (pointer.dragging) {
      const dx = event.clientX - pointer.lastX;
      const dy = event.clientY - pointer.lastY;
      cameraRig.yawOffset -= dx * 0.0055;
      cameraRig.pitch = clamp(cameraRig.pitch - dy * 0.004, 0.06, 1.03);
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    audio.unlock();
    if (event.button === 0) {
      event.preventDefault();
      if (event.shiftKey) fireMG();
      else fire();
      return;
    }
    if (event.button !== 2) return;
    event.preventDefault();
    pointer.dragging = true;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    document.body.classList.add('is-dragging');
    canvas.setPointerCapture(event.pointerId);
  });

  const releasePointer = (event) => {
    if (!pointer.dragging) return;
    pointer.dragging = false;
    document.body.classList.remove('is-dragging');
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      cameraRig.distance = clamp(cameraRig.distance + event.deltaY * 0.012, 7.5, 30);
    },
    { passive: false },
  );

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    post.setSize();
    fx.resize();
  });
}

async function init() {
  buildScene();
  bindInput();
  animate();
  await loadVehicle();
}

init().catch(showError);
