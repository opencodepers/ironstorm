import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTerrain, terrainHeight, terrainNormal, RANGE_LIMIT } from './terrain.js';
import { createPost } from './post.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';
import { createRange } from './range.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
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
    id: 'APFSDS',
    label: 'APFSDS',
    velocity: 850,
    drag: 0.000035,
    reload: 6.4,
    damage: 125,
    blast: 1.5,
    recoil: 0.95,
    tracer: 0xffe7b0,
    color: 0xe6cf92,
    hint: 'SABOT · FLAT TRAJECTORY',
  },
  {
    id: 'HEAT',
    label: 'HEAT-FS',
    velocity: 620,
    drag: 0.00005,
    reload: 7.8,
    damage: 95,
    blast: 5.5,
    recoil: 1.15,
    tracer: 0xffb05e,
    color: 0xd88946,
    hint: 'CHEMICAL · BLAST',
  },
  {
    id: 'HE',
    label: 'HE-FRAG',
    velocity: 680,
    drag: 0.00006,
    reload: 8.6,
    damage: 55,
    blast: 9,
    recoil: 1.3,
    tracer: 0xff8a4a,
    color: 0xc76b42,
    hint: 'AREA · ANTI-MATERIEL',
  },
];

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
};

const cameraRig = {
  yawOffset: 0,
  pitch: 0.34,
  distance: 15,
  look: new THREE.Vector3(0, 1.5, -7),
};

const pointer = {
  ndc: new THREE.Vector2(0, 0.05),
  inside: false,
  dragging: false,
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
const sunDirection = new THREE.Vector3();
const sunLight = new THREE.DirectionalLight();
const fillLight = new THREE.DirectionalLight();
const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3();
const back = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const cameraLook = new THREE.Vector3();
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
  pitchVelocity: 0,
  rollVelocity: 0,
  heaveVelocity: 0,
};

const shake = {
  amount: 0,
  timer: 0,
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
  lastShot: null,
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
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x8b9485, 0.00105);

  camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.15, 8000);
  camera.position.set(0, 6.5, 17);

  terrain = createTerrain();
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
  const environment = pmrem.fromScene(envScene, 0.04, 0.1, 4000);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.54;
  pmrem.dispose();

  sunLight.color.set(0xffd8ad);
  sunLight.intensity = 2.75;
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
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

  tankRoot = new THREE.Group();
  tankRoot.name = 'tank_root';
  scene.add(tankRoot);

  contactShadow = makeContactShadow();
  scene.add(contactShadow);

  post = createPost(renderer, scene, camera);
  fx = createFx(scene, renderer);
  audio = createAudio();

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

  setLoad(0.93, 'DEPLOYING TARGET BATTERY');
  range = createRange({
    scene,
    vehicleScene: gltf.scene,
    terrainHeight,
  });

  setLoad(0.99, 'ALIGNING FIRE CONTROL');
  tank.y = terrainHeight(tank.x, tank.z) + 0.04;
  tank.vy = 0;
  applyVisuals();
  updateCamera(1, true);
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
  tank.y = terrainHeight(0, 0) + 0.04;
  cameraRig.yawOffset = 0;
  cameraRig.pitch = 0.34;
  cameraRig.distance = 15;
  recoil.pitch = 0;
  recoil.roll = 0;
  recoil.heave = 0;
  recoil.pitchVelocity = 0;
  recoil.rollVelocity = 0;
  recoil.heaveVelocity = 0;
  shake.amount = 0;
  gun.lasedRange = 0;
  gun.lasedTimer = 0;
  trackDistance = 0;
  clearProjectiles();
  if (tankRoot) {
    tankRoot.position.set(tank.x, tank.y, tank.z);
    tankRoot.quaternion.identity();
  }
  if (turretPivot) turretPivot.rotation.set(0, 0, 0);
  if (barrelPivot) barrelPivot.rotation.set(0, 0, 0);
  if (contactShadow) {
    contactShadow.position.set(tank.x, terrainHeight(tank.x, tank.z) + 0.06, tank.z);
    contactShadow.rotation.y = tank.heading;
  }
  if (snapCamera) updateCamera(1, true);
}

function updateRecoil(dt) {
  recoil.pitchVelocity += (-recoil.pitch * 92 - recoil.pitchVelocity * 9.5) * dt;
  recoil.pitch += recoil.pitchVelocity * dt;
  recoil.rollVelocity += (-recoil.roll * 84 - recoil.rollVelocity * 9) * dt;
  recoil.roll += recoil.rollVelocity * dt;
  recoil.heaveVelocity += (-recoil.heave * 126 - recoil.heaveVelocity * 12) * dt;
  recoil.heave += recoil.heaveVelocity * dt;
}

function applyRecoil() {
  recoilEuler.set(recoil.pitch, 0, recoil.roll);
  recoilQuaternion.setFromEuler(recoilEuler);
  tankRoot.quaternion.multiply(recoilQuaternion);
}

function updateMotion(dt) {
  const throttle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const boost = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const braking = keys.has('Space');

  if (braking) {
    tank.speed = moveToward(tank.speed, 0, 13 * dt);
  } else if (throttle > 0) {
    tank.speed = moveToward(tank.speed, boost ? 18.5 : 13.8, (boost ? 6.2 : 4.1) * dt);
  } else if (throttle < 0) {
    tank.speed = moveToward(tank.speed, -4.6, 3.1 * dt);
  } else {
    tank.speed = moveToward(tank.speed, 0, 1.65 * dt);
  }

  forward.set(-Math.sin(tank.heading), 0, -Math.cos(tank.heading));
  const ahead = terrainHeight(tank.x + forward.x * 2.9, tank.z + forward.z * 2.9);
  const behind = terrainHeight(tank.x - forward.x * 2.9, tank.z - forward.z * 2.9);
  tank.grade = (ahead - behind) / 5.8;
  tank.speed -= tank.grade * 9.81 * 0.32 * dt;
  tank.speed = clamp(tank.speed, -6.5, 21);

  const speedFactor = Math.min(Math.abs(tank.speed) / 9, 1);
  tank.heading += steer * (0.62 + 0.44 * speedFactor) * dt;
  forward.set(-Math.sin(tank.heading), 0, -Math.cos(tank.heading));

  tank.x += forward.x * tank.speed * dt;
  tank.z += forward.z * tank.speed * dt;

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
}

function solveElevation(distance, velocity) {
  const ratio = clamp((9.81 * distance) / (velocity * velocity), 0, 0.95);
  return 0.5 * Math.asin(ratio);
}

function updateAim(dt) {
  if (!turretPivot || !barrelPivot) return;
  raycaster.setFromCamera(pointer.ndc, camera);

  // Aim at the actual collider under the reticle. This is what makes the
  // crosshair meaningful at range instead of mapping mouse height to elevation.
  let hasAimPoint = false;
  if (range) {
    const targetHits = raycaster.intersectObjects(range.colliders, false);
    for (const hit of targetHits) {
      const target = hit.object.userData.target;
      if (!target || !target.alive) continue;
      aimPoint.copy(hit.point);
      hasAimPoint = true;
      break;
    }
  }
  if (!hasAimPoint) {
    aimPlane.constant = -(tank.y + 1.45);
    hasAimPoint = Boolean(raycaster.ray.intersectPlane(aimPlane, aimPoint));
  }
  if (!hasAimPoint) {
    aimPoint.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, 600);
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
  tank.turretYaw = approachAngle(tank.turretYaw, desiredLocal, 2.35 * dt);

  turretPivot.rotation.y = tank.turretYaw;
  turretPivot.updateMatrixWorld(true);
  barrelPivot.getWorldPosition(barrelWorldPosition);
  turretPivot.getWorldQuaternion(turretWorldQuaternion).invert();
  aimDirection.copy(aimPoint).sub(barrelWorldPosition).normalize().applyQuaternion(turretWorldQuaternion);
  const spec = SHELLS[gun.selected];
  const ballistic = gun.lasedTimer > 0 && gun.lasedRange > 20
    ? solveElevation(gun.lasedRange, spec.velocity)
    : 0;
  const desiredPitch = clamp(Math.atan2(aimDirection.y, -aimDirection.z) + ballistic, -0.12, 0.27);
  tank.gunPitch = damp(tank.gunPitch, desiredPitch, 11, dt);
}

function applyVisuals() {
  if (turretPivot) turretPivot.rotation.y = tank.turretYaw;
  if (barrelPivot) barrelPivot.rotation.x = tank.gunPitch;
}

function updateTracks(dt) {
  if (!trackMaterial || !trackMaterial.map) return;
  trackOffset = (trackOffset + tank.speed * dt * 0.16) % 1;
  for (const map of [trackMaterial.map, trackMaterial.normalMap, trackMaterial.roughnessMap]) {
    if (map) map.offset.y = trackOffset;
  }
}

function updateCamera(dt, snap = false) {
  if (!camera) return;
  back.set(
    Math.sin(tank.heading + cameraRig.yawOffset),
    0,
    Math.cos(tank.heading + cameraRig.yawOffset),
  );
  desiredCamera.set(tank.x, tank.y + 2.15, tank.z)
    .addScaledVector(back, Math.cos(cameraRig.pitch) * cameraRig.distance)
    .addScaledVector(up, Math.sin(cameraRig.pitch) * cameraRig.distance);
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

  cameraLook.copy(cameraRig.look);
  if (shake.amount > 0.0001) {
    const amount = Math.min(0.24, shake.amount);
    camera.position.x += (Math.random() - 0.5) * amount;
    camera.position.y += (Math.random() - 0.5) * amount * 0.7;
    camera.position.z += (Math.random() - 0.5) * amount;
    cameraLook.x += (Math.random() - 0.5) * amount * 0.5;
    cameraLook.y += (Math.random() - 0.5) * amount * 0.35;
    shake.amount *= Math.exp(-9.5 * dt);
    shake.timer += dt;
  } else {
    shake.amount = 0;
  }
  camera.lookAt(cameraLook);

  const targetFov = 56 + Math.min(Math.abs(tank.speed) * 0.48, 7) + shake.timer * 2.2;
  if (Math.abs(camera.fov - targetFov) > 0.04) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }
  shake.timer = Math.max(0, shake.timer - dt * 5);
}

function updateSun() {
  if (!sunLight) return;
  sunLight.position.set(
    tank.x + sunDirection.x * 100,
    tank.y + sunDirection.y * 100,
    tank.z + sunDirection.z * 100,
  );
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
  if (!app.ready || !barrelPivot) return;
  if (gun.reload > 0) {
    showNotice(`LOADING ${gun.reload.toFixed(1)}S`, 900);
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
  shotDirection.copy(gunDirection);
  const dispersion = 0.00075 + Math.abs(tank.speed) * 0.000045;
  shotDirection.x += (Math.random() - 0.5) * dispersion;
  shotDirection.y += (Math.random() - 0.5) * dispersion;
  shotDirection.z += (Math.random() - 0.5) * dispersion;
  shotDirection.normalize();

  forward.set(-Math.sin(tank.heading), 0, -Math.cos(tank.heading));
  shotVelocity.copy(shotDirection).multiplyScalar(spec.velocity).addScaledVector(forward, tank.speed * 0.25);
  const tracer = makeTracer(spec);
  tracer.group.position.copy(muzzlePosition);
  tracer.group.quaternion.setFromUnitVectors(forwardFromGun, shotVelocity.clone().normalize());

  projectiles.push({
    position: muzzlePosition.clone(),
    previous: muzzlePosition.clone(),
    velocity: shotVelocity.clone(),
    life: 7.5,
    spec,
    tracer,
  });

  gun.shots++;
  gun.reload = spec.reload;
  gun.reloadTotal = spec.reload;
  gun.cooldown = 0.28;
  gun.lastShot = performance.now();
  audio.fire(spec.id);
  window.setTimeout(() => audio.reload(), 420);
  fx.muzzle(muzzlePosition, gunDirection);
  post.flash(0.85);
  flashScreen();
  recoil.pitchVelocity += 1.35 * spec.recoil;
  recoil.rollVelocity += (Math.random() - 0.5) * 0.72 * spec.recoil;
  recoil.heaveVelocity -= 0.46 * spec.recoil;
  shake.amount = Math.min(0.28, shake.amount + 0.15 * spec.recoil);
  shake.timer = Math.min(1.4, shake.timer + 0.55);
  gun.lasedTimer = Math.max(0, gun.lasedTimer - 0.6);
  updateAmmoUi();
  updateHud(0);
}

function lase() {
  if (!app.ready || !range || !barrelPivot) return;
  applyVisuals();
  tankRoot.updateMatrixWorld(true);
  barrelPivot.getWorldPosition(muzzleBase);
  barrelPivot.getWorldQuaternion(targetQuaternion);
  gunDirection.copy(forwardFromGun).applyQuaternion(targetQuaternion).normalize();
  muzzlePosition.copy(muzzleBase).addScaledVector(gunDirection, 5.9);

  raycaster.setFromCamera(pointer.ndc, camera);
  raycaster.near = 0;
  raycaster.far = 1200;
  const targetHits = raycaster.intersectObjects(range.colliders, false);
  let point = null;
  let targetName = '';
  for (const hit of targetHits) {
    const target = hit.object.userData.target;
    if (!target || !target.alive) continue;
    point = hit.point;
    targetName = target.name;
    break;
  }
  if (!point) {
    const groundHits = raycaster.intersectObject(terrain.ground, false);
    if (groundHits.length) point = groundHits[0].point;
  }
  if (!point) {
    showNotice('LASER · NO RETURN', 1100);
    return;
  }
  gun.lasedRange = point.distanceTo(tankRoot.position);
  gun.lasedTimer = 8;
  audio.laser();
  fx.laserBeam?.(muzzlePosition, point);
  showNotice(
    targetName
      ? `LASER ${Math.round(gun.lasedRange)}M · ${targetName} · FCS SOLVED`
      : `LASER ${Math.round(gun.lasedRange)}M · FCS SOLVED`,
    1400,
  );
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

function addFeed(label, points, killed) {
  if (!ui.feed) return;
  const row = document.createElement('div');
  row.className = `feed__row${killed ? ' is-kill' : ''}`;
  row.innerHTML = `<span>${killed ? 'TARGET DOWN' : 'HIT'}</span><b>${label}</b><em>+${points}</em>`;
  ui.feed.prepend(row);
  window.setTimeout(() => row.remove(), 4200);
  while (ui.feed.children.length > 4) ui.feed.lastElementChild.remove();
}

function registerHit(target, point, normal, zone, projectile) {
  const spec = projectile.spec;
  const damage = spec.damage + (zone === 'turret' ? 24 : 0);
  const result = target.hit(damage);
  if (result.ignored) return;
  gun.hits++;
  if (result.killed) gun.kills++;
  gun.combo = Math.min(9, gun.combo + 1);
  gun.comboTimer = 5.4;
  const multiplier = 1 + (gun.combo - 1) * 0.25;
  const distance = point.distanceTo(tankRoot.position);
  const zoneBonus = zone === 'turret' ? 140 : zone === 'fuel' ? 90 : 0;
  const points = Math.round((target.score + distance * 0.6 + zoneBonus) * multiplier);
  gun.score += points;
  if (gun.score > gun.best) {
    gun.best = gun.score;
    saveBest(gun.best);
  }
  const destructive = target.kind === 'fuel' || target.kind === 'tank';
  if (result.killed && destructive) {
    fx.explosion(point, target.kind === 'tank' ? 2.0 : 1.2);
    audio.explosion?.(1.2);
    post.flash(0.95);
    shake.amount = Math.min(0.4, shake.amount + 0.2);
  } else {
    spawnImpact(
      point,
      normal,
      target.kind === 'steel' ? 'metal' : 'tank',
      target.kind === 'steel' ? 1.1 : 1.35,
    );
  }
  audio.hit(result.killed);
  showHitMarker(result.killed);
  showScorePopup(points, point, result.killed, target.name);
  addFeed(target.name, points, result.killed);
  updateHud(0);
}

function registerGroundImpact(point, projectile) {
  const normal = terrainNormal(point.x, point.z);
  gun.combo = 0;
  gun.comboTimer = 0;
  spawnImpact(point, normal, 'ground', projectile.spec.blast > 4 ? 1.5 : 1);
  updateHud(0);
}

function updateProjectiles(dt) {
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const projectile = projectiles[index];
    projectile.life -= dt;
    projectile.previous.copy(projectile.position);
    projectile.velocity.y -= 9.81 * dt;
    projectile.velocity.multiplyScalar(Math.exp(-projectile.spec.drag * dt));
    projectile.position.addScaledVector(projectile.velocity, dt);
    projectile.tracer.group.position.copy(projectile.position);
    if (projectile.velocity.lengthSq() > 0.01) {
      projectile.tracer.group.quaternion.setFromUnitVectors(
        forwardFromGun,
        segmentDirection.copy(projectile.velocity).normalize(),
      );
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
        const target = hit.object.userData.target;
        if (!target || !target.alive) continue;
        if (!closest || hit.distance < closest.distance) closest = { type: 'target', hit, target };
        break;
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

function updateGunnery(dt) {
  if (gun.reload > 0) {
    const before = gun.reload;
    gun.reload = Math.max(0, gun.reload - dt);
    if (before > 0 && gun.reload === 0) {
      audio.ready();
      showNotice(`${SHELLS[gun.selected].id} READY`, 700);
    }
  }
  gun.cooldown = Math.max(0, gun.cooldown - dt);
  if (gun.comboTimer > 0) {
    gun.comboTimer -= dt;
    if (gun.comboTimer <= 0) gun.combo = 0;
  }
  if (gun.lasedTimer > 0) {
    gun.lasedTimer -= dt;
    if (gun.lasedTimer <= 0) gun.lasedRange = 0;
  }
  if (range) range.update(dt);
  updateProjectiles(dt);
}

function updateAmmoUi() {
  const spec = SHELLS[gun.selected];
  if (ui.reticleAmmo) ui.reticleAmmo.textContent = spec.id;
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
  ui.speed.textContent = String(kmh).padStart(3, '0');
  ui.gear.textContent = tank.speed > 0.25 ? 'D' : tank.speed < -0.25 ? 'R' : 'N';
  const throttle = (keys.has('KeyW') || keys.has('KeyS')) ? 1 : 0;
  ui.throttle.style.transform = `scaleX(${throttle})`;
  ui.driveState.textContent = keys.has('Space')
    ? 'BRAKE'
    : keys.has('ShiftLeft') || keys.has('ShiftRight')
      ? 'BOOST'
      : tank.speed < -0.25
        ? 'REVERSE'
        : tank.speed > 0.25
          ? 'DRIVE'
          : 'IDLE';
  const traverse = ((tank.turretYaw * 180) / Math.PI + 360) % 360;
  ui.turret.textContent = `${String(Math.round(traverse)).padStart(3, '0')}°`;
  const elevation = (tank.gunPitch * 180) / Math.PI;
  ui.elevation.textContent = `${elevation >= 0 ? '+' : ''}${elevation.toFixed(1)}°`;
  ui.grade.textContent = `${tank.grade >= 0 ? '+' : ''}${(tank.grade * 100).toFixed(1)}%`;
  ui.grid.textContent = `X ${Math.round(tank.x)} · Z ${Math.round(tank.z)}`;

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
  if (ui.reloadLabel) ui.reloadLabel.textContent = gun.reload > 0 ? `LOADING ${gun.reload.toFixed(1)}S` : 'READY';
  if (ui.rangeReadout) {
    ui.rangeReadout.textContent = gun.lasedRange > 0 ? `${Math.round(gun.lasedRange)} M` : '--- M';
    ui.rangeReadout.classList.toggle('is-solved', gun.lasedTimer > 0);
  }

  if (fpsElapsed >= 0.5) {
    ui.fps.textContent = String(Math.round(fpsFrames / fpsElapsed));
    fpsElapsed = 0;
    fpsFrames = 0;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (app.ready) {
    updateMotion(dt);
    updateRecoil(dt);
    updateAim(dt);
    applyVisuals();
    updateTracks(dt);
    updateGunnery(dt);
    updateCamera(dt);
    updateHud(dt);
  }
  updateSun();
  fx.update(dt);
  post.render(dt);
}

function selectShell(index) {
  if (index < 0 || index >= SHELLS.length) return;
  gun.selected = index;
  updateAmmoUi();
  updateHud(0);
  showNotice(`${SHELLS[index].id} · ${SHELLS[index].hint}`, 1200);
}

function bindInput() {
  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyR') resetTank(true);
    if (event.code === 'KeyC') {
      cameraRig.yawOffset = 0;
      cameraRig.pitch = 0.34;
      cameraRig.distance = 15;
    }
    if (event.code === 'KeyH') document.body.classList.toggle('hide-hints');
    if (event.code === 'KeyF') lase();
    if (event.code === 'KeyM') {
      const muted = audio.toggle();
      showNotice(muted ? 'AUDIO MUTED' : 'AUDIO LIVE', 900);
    }
    if (event.code === 'Digit1') selectShell(0);
    if (event.code === 'Digit2') selectShell(1);
    if (event.code === 'Digit3') selectShell(2);
  });

  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pointer.dragging = false;
    document.body.classList.remove('is-dragging');
  });

  canvas.addEventListener('pointerenter', () => {
    pointer.inside = true;
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
      fire();
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
