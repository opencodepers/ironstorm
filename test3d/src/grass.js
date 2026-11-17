import * as THREE from 'three';
import { terrainHeight } from './terrain.js';

const TILE_SIZE = 20;
const TILE_RADIUS = 4;
const MAX_TILE_CAPACITY = 1600;
const PAD_CLEAR_RADIUS = 14;
const LANE_CLEAR_HALF_WIDTH = 8;
const BLADES_PER_TUFT = 12;

function cellSeed(gx, gz) {
  return (Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663) ^ 0x9e3779b9) >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeTuftGeometry() {
  const positions = [];
  const colors = [];
  const indices = [];
  const random = seededRandom(0x51f15e);
  const baseColor = new THREE.Color(0x1a3410);
  const tipColor = new THREE.Color(0x6da344);

  for (let blade = 0; blade < BLADES_PER_TUFT; blade++) {
    const angle = random() * Math.PI * 2;
    const radius = 0.06 + random() * 0.62;
    const rootX = Math.cos(angle) * radius;
    const rootZ = Math.sin(angle) * radius;
    const height = 0.65 + random() * 0.75;
    const width = 0.024 + random() * 0.032;
    const lean = 0.08 + random() * 0.24;
    const leanAngle = angle + (random() - 0.5) * 0.75;
    const tipX = rootX + Math.cos(leanAngle) * lean;
    const tipZ = rootZ + Math.sin(leanAngle) * lean;
    const sideX = Math.cos(angle + Math.PI * 0.5) * width;
    const sideZ = Math.sin(angle + Math.PI * 0.5) * width;
    const variation = 0.76 + random() * 0.32;
    const base = positions.length / 3;

    positions.push(
      rootX - sideX, 0, rootZ - sideZ,
      rootX + sideX, 0, rootZ + sideZ,
      tipX, height, tipZ,
    );
    const rootShade = baseColor.clone().multiplyScalar(variation);
    const tipShade = tipColor.clone().multiplyScalar(variation);
    colors.push(
      rootShade.r, rootShade.g, rootShade.b,
      rootShade.r, rootShade.g, rootShade.b,
      tipShade.r, tipShade.g, tipShade.b,
    );
    indices.push(base, base + 1, base + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function createNearGrass() {
  const group = new THREE.Group();
  group.name = 'lush-near-grass';
  const geometry = makeTuftGeometry();
  const timeUniform = { value: 0 };

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    toneMapped: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTime = timeUniform;
    shader.vertexShader = `uniform float uGrassTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 grassRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float grassWave = sin(uGrassTime * 1.15 + grassRoot.x * 0.22 + grassRoot.z * 0.16);
        grassWave += sin(uGrassTime * 2.3 + grassRoot.z * 0.31) * 0.35;
        float grassBend = max(position.y, 0.0);
        transformed.x += grassWave * 0.055 * grassBend;
        transformed.z += cos(uGrassTime * 0.95 + grassRoot.x * 0.19) * 0.04 * grassBend;
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'lush-near-grass-blades-v5';

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const pool = [];
  const active = new Map();
  let centerX = Infinity;
  let centerZ = Infinity;

  const createTile = () => {
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_TILE_CAPACITY);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  };

  const populateTile = (mesh, gx, gz, capacity) => {
    const random = seededRandom(cellSeed(gx, gz));
    const originX = gx * TILE_SIZE;
    const originZ = gz * TILE_SIZE;
    let count = 0;

    for (let attempt = 0; attempt < capacity * 2 && count < capacity; attempt++) {
      const x = originX + random() * TILE_SIZE;
      const z = originZ + random() * TILE_SIZE;
      if (Math.hypot(x, z) < PAD_CLEAR_RADIUS) continue;
      const mownLane = Math.abs(x) < LANE_CLEAR_HALF_WIDTH && z < -24;

      const width = 0.9 + random() * 0.35;
      const height = (mownLane ? 0.52 : 0.9) + random() * (mownLane ? 0.25 : 0.35);
      dummy.position.set(x, terrainHeight(x, z) + 0.012, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.set(width, height, width);
      dummy.updateMatrix();
      mesh.setMatrixAt(count, dummy.matrix);
      color.setHSL(0.235 + random() * 0.05, 0.2 + random() * 0.14, 0.62 + random() * 0.18);
      mesh.setColorAt(count, color);
      count++;
    }

    mesh.count = count;
    mesh.visible = count > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (count > 0) mesh.computeBoundingSphere();
  };

  const refreshTiles = (nextX, nextZ) => {
    const wanted = new Set();
    for (let dz = -TILE_RADIUS; dz <= TILE_RADIUS; dz++) {
      for (let dx = -TILE_RADIUS; dx <= TILE_RADIUS; dx++) {
        wanted.add(`${nextX + dx}:${nextZ + dz}`);
      }
    }

    for (const [key, mesh] of active) {
      if (wanted.has(key)) continue;
      group.remove(mesh);
      active.delete(key);
      pool.push(mesh);
    }

    for (const key of wanted) {
      if (active.has(key)) continue;
      const [gx, gz] = key.split(':').map(Number);
      const ring = Math.max(Math.abs(gx - nextX), Math.abs(gz - nextZ));
      const capacity = ring <= 1 ? 1600 : ring === 2 ? 1200 : ring === 3 ? 450 : 180;
      const mesh = pool.pop() || createTile();
      populateTile(mesh, gx, gz, capacity);
      active.set(key, mesh);
    }
  };

  refreshTiles(0, 0);
  centerX = 0;
  centerZ = 0;
  group.updateMatrixWorld(true);

  return {
    group,
    update(position, time) {
      timeUniform.value = time;
      if (!position) return;
      const nextX = Math.floor(position.x / TILE_SIZE);
      const nextZ = Math.floor(position.z / TILE_SIZE);
      if (nextX !== centerX || nextZ !== centerZ) {
        centerX = nextX;
        centerZ = nextZ;
        refreshTiles(nextX, nextZ);
      }
    },
    get tileCount() {
      return active.size;
    },
  };
}
