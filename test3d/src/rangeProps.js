import * as THREE from 'three';
import { terrainHeight } from './terrain.js';

// A hundred pieces of range furniture around the firing lane. Everything is
// baked into four instanced batches at startup: no per-object meshes, no
// per-frame matrix updates, and no shadow casters.
const PROP_COUNT = 100;
const ROWS = 10;
const COLUMNS = 5;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const PROP_TYPES = [
  {
    id: 'crate',
    count: 25,
    lift: 0.46,
    geometry: new THREE.BoxGeometry(1.15, 0.92, 1.15),
    material: new THREE.MeshStandardMaterial({ color: 0x5b5038, roughness: 0.94, metalness: 0.04 }),
  },
  {
    id: 'drum',
    count: 25,
    lift: 0.56,
    geometry: new THREE.CylinderGeometry(0.42, 0.42, 1.12, 10),
    material: new THREE.MeshStandardMaterial({ color: 0x7b3d29, roughness: 0.72, metalness: 0.32 }),
  },
  {
    id: 'barrier',
    count: 25,
    lift: 0.4,
    geometry: new THREE.BoxGeometry(2.3, 0.8, 0.5),
    material: new THREE.MeshStandardMaterial({ color: 0x6b6a5d, roughness: 0.97, metalness: 0.02 }),
  },
  {
    id: 'tooth',
    count: 25,
    lift: 0.59,
    geometry: new THREE.ConeGeometry(0.62, 1.18, 4),
    material: new THREE.MeshStandardMaterial({ color: 0x54574d, roughness: 0.9, metalness: 0.18 }),
  },
];

export function createRangeProps({ scene, lowPower = false }) {
  const group = new THREE.Group();
  group.name = 'range-props-100';
  const random = seededRandom(0x5a1e);
  const dummy = new THREE.Object3D();
  let offset = 0;

  for (const type of PROP_TYPES) {
    const mesh = new THREE.InstancedMesh(type.geometry, type.material, type.count);
    mesh.name = `range-props-${type.id}`;
    mesh.castShadow = false;
    mesh.receiveShadow = !lowPower;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    for (let i = 0; i < type.count; i++) {
      const index = offset + i;
      const side = index % 2 === 0 ? -1 : 1;
      const rank = Math.floor(index / 2);
      const row = rank % ROWS;
      const column = Math.floor(rank / ROWS);

      // Keep the central gunnery lane and the target line clear.
      const x = side * (58 + column * 14 + (random() - 0.5) * 8);
      const z = -48 - row * 32 - (random() - 0.5) * 12;
      const scale = 0.82 + random() * 0.3;

      dummy.position.set(x, terrainHeight(x, z) + type.lift * scale, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.set(scale, 0.9 + random() * 0.22, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    offset += type.count;
  }

  group.matrixAutoUpdate = false;
  group.updateMatrix();
  scene.add(group);

  return {
    group,
    count: PROP_COUNT,
    drawCalls: PROP_TYPES.length,
    update() {
      // Static by design. This keeps the 100-object field free at runtime.
    },
  };
}
