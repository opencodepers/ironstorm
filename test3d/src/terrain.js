import * as THREE from 'three';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const RANGE_SIZE = 1000;
export const RANGE_LIMIT = 458;

function hash2(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function fbm(x, y, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += noise2(x * frequency, y * frequency) * amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

export function terrainHeight(x, z) {
  const distance = Math.hypot(x, z);
  const spawnMask = smoothstep(13, 38, distance);
  const openMask = smoothstep(18, 78, distance);

  // A shallow, gently rolling firing lane keeps the 100-460 m targets visible
  // without turning the whole proving ground into a flat plane.
  const lane =
    (1 - smoothstep(22, 60, Math.abs(x))) *
    smoothstep(14, 58, -z) *
    (1 - smoothstep(430, 560, -z));

  const broad = (fbm(x * 0.011 + 11.7, z * 0.011 - 4.2, 5) - 0.5) * 19;
  const medium = (fbm(x * 0.036 - 3.1, z * 0.036 + 7.4, 4) - 0.5) * 3.8;
  const fine = (fbm(x * 0.13 + 1.4, z * 0.13 - 8.2, 3) - 0.5) * 0.52;
  let height = (broad + medium + fine) * (0.08 + 0.92 * openMask);
  height += Math.sin((x + z) * 0.017) * 1.4 * openMask;
  height *= 1 - lane * 0.68;
  return height * spawnMask;
}

export function terrainNormal(x, z, epsilon = 0.55) {
  const left = terrainHeight(x - epsilon, z);
  const right = terrainHeight(x + epsilon, z);
  const back = terrainHeight(x, z - epsilon);
  const front = terrainHeight(x, z + epsilon);
  return new THREE.Vector3(left - right, epsilon * 2, back - front).normalize();
}

function canvasTexture(canvas, colorSpace = THREE.SRGBColorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeGroundTextures(highDetail = false) {
  const size = highDetail ? 1024 : 512;
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const broad = noise2(u * 7.5 + 11, v * 7.5 - 4);
      const medium = noise2(u * 38 - 3, v * 38 + 9);
      const fine = noise2(u * 175 + 2, v * 175 - 7);
      const grit = Math.max(0, noise2(u * 290 + 19, v * 290 - 13) - 0.7);
      heights[y * size + x] = broad * 0.46 + medium * 0.34 + fine * 0.2 + grit * 1.9;
    }
  }

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const albedo = albedoCanvas.getContext('2d');
  const albedoImage = albedo.createImageData(size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rough = roughCanvas.getContext('2d');
  const roughImage = rough.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const u = x / size;
      const v = y / size;
      const h = heights[index];
      const moss = smoothstep(0.48, 0.72, noise2(u * 4.2 + 31, v * 4.2 - 17));
      const stone = smoothstep(0.72, 0.9, h);
      const dust = noise2(u * 68 + 8, v * 68 + 2);
      const fine = noise2(u * 220, v * 220);
      const exposure = 0.82 + (h - 0.55) * 0.3 + (fine - 0.5) * 0.1;

      let r = 188 * exposure;
      let g = 180 * exposure;
      let b = 158 * exposure;
      r = lerp(r, 188, moss * 0.24);
      g = lerp(g, 194, moss * 0.3);
      b = lerp(b, 154, moss * 0.28);
      const stoneMix = stone * 0.4;
      r = lerp(r, 179, stoneMix);
      g = lerp(g, 180, stoneMix);
      b = lerp(b, 171, stoneMix);
      const dustMix = (dust - 0.5) * 0.12;
      r *= 1 + dustMix;
      g *= 1 + dustMix;
      b *= 1 + dustMix * 0.7;

      const offset = index * 4;
      albedoImage.data[offset] = clamp(r, 0, 255);
      albedoImage.data[offset + 1] = clamp(g, 0, 255);
      albedoImage.data[offset + 2] = clamp(b, 0, 255);
      albedoImage.data[offset + 3] = 255;

      const roughValue = clamp(214 + (fine - 0.5) * 24 + (1 - h) * 26, 0, 255);
      roughImage.data[offset] = roughValue;
      roughImage.data[offset + 1] = roughValue;
      roughImage.data[offset + 2] = roughValue;
      roughImage.data[offset + 3] = 255;
    }
  }

  albedo.putImageData(albedoImage, 0, 0);
  rough.putImageData(roughImage, 0, 0);

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalContext = normalCanvas.getContext('2d');
  const normalImage = normalContext.createImageData(size, size);
  const strength = 4.2;

  const sample = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const offset = (y * size + x) * 4;
      normalImage.data[offset] = clamp(((-dx / length) * 0.5 + 0.5) * 255, 0, 255);
      normalImage.data[offset + 1] = clamp(((-dy / length) * 0.5 + 0.5) * 255, 0, 255);
      normalImage.data[offset + 2] = clamp(((1 / length) * 0.5 + 0.5) * 255, 0, 255);
      normalImage.data[offset + 3] = 255;
    }
  }
  normalContext.putImageData(normalImage, 0, 0);

  const map = canvasTexture(albedoCanvas);
  map.repeat.set(120, 120);
  const normalMap = canvasTexture(normalCanvas, THREE.NoColorSpace);
  normalMap.repeat.set(120, 120);
  const roughnessMap = canvasTexture(roughCanvas, THREE.NoColorSpace);
  roughnessMap.repeat.set(120, 120);
  return { map, normalMap, roughnessMap };
}

function makeConcreteTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const grain = noise2(u * 120, v * 120);
      const stain = noise2(u * 12 + 4, v * 12 - 8);
      const value = clamp(82 + grain * 20 + stain * 10, 0, 255);
      const offset = (y * size + x) * 4;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value * 0.97;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = canvasTexture(canvas);
  texture.repeat.set(7, 7);
  return texture;
}

function seededRandom(seed = 1731) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeGrassTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, size, size);
  const random = seededRandom(90210);

  for (let i = 0; i < 42; i++) {
    const baseX = size * 0.5 + (random() - 0.5) * size * 0.82;
    const height = size * (0.3 + random() * 0.66);
    const bend = (random() - 0.5) * size * 0.28;
    const hue = 64 + random() * 38;
    context.strokeStyle = `hsla(${hue}, 36%, ${34 + random() * 22}%, ${0.55 + random() * 0.4})`;
    context.lineWidth = 0.8 + random() * 1.7;
    context.beginPath();
    context.moveTo(baseX, size);
    context.quadraticCurveTo(baseX + bend * 0.4, size - height * 0.56, baseX + bend, size - height);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeGrassGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0,
      0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5,
    ]), 3),
  );
  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(new Float32Array([
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
    ]), 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  geometry.computeVertexNormals();
  return geometry;
}

export function createTerrain({ lowPower = false } = {}) {
  const highQuality = !lowPower;
  const size = RANGE_SIZE;
  const segments = lowPower ? 240 : 340;
  const positions = new Float32Array((segments + 1) * (segments + 1) * 3);
  const indices = [];
  let cursor = 0;

  for (let zIndex = 0; zIndex <= segments; zIndex++) {
    const z = (zIndex / segments - 0.5) * size;
    for (let xIndex = 0; xIndex <= segments; xIndex++) {
      const x = (xIndex / segments - 0.5) * size;
      positions[cursor++] = x;
      positions[cursor++] = terrainHeight(x, z);
      positions[cursor++] = z;
    }
  }

  for (let zIndex = 0; zIndex < segments; zIndex++) {
    for (let xIndex = 0; xIndex < segments; xIndex++) {
      const a = zIndex * (segments + 1) + xIndex;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const normal = geometry.getAttribute('normal');
  const colors = new Float32Array((segments + 1) * (segments + 1) * 3);
  const meadow = new THREE.Color(0x5d7446);
  const dryGrass = new THREE.Color(0x8b7a50);
  const dirt = new THREE.Color(0x725c42);
  const stone = new THREE.Color(0x77766c);
  const sand = new THREE.Color(0x927a57);
  const color = new THREE.Color();

  for (let i = 0; i < normal.count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const slope = 1 - normal.getY(i);
    const moisture = fbm(x * 0.04 + 21, z * 0.04 - 13);
    const grain = fbm(x * 0.2, z * 0.2);
    const lane = 1 - smoothstep(22, 60, Math.abs(x)) * 0.52;

    color.copy(meadow).lerp(dryGrass, clamp(moisture * 0.8 * lane, 0, 1));
    color.lerp(dirt, smoothstep(0.2, 0.5, slope) * 0.68);
    color.lerp(stone, smoothstep(0.3, 0.68, slope) * 0.82);
    color.lerp(sand, smoothstep(1.8, 5.5, y) * 0.16);
    color.offsetHSL(0, 0, (grain - 0.5) * 0.06);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const textures = makeGroundTextures(highQuality);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: textures.map,
    normalMap: textures.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: textures.roughnessMap,
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.32,
    dithering: true,
  });

  const group = new THREE.Group();
  group.name = 'proving-ground';
  const ground = new THREE.Mesh(geometry, material);
  ground.name = 'terrain';
  ground.receiveShadow = true;
  group.add(ground);

  const padMesh = new THREE.Mesh(
    new THREE.CircleGeometry(13.5, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: makeConcreteTexture(),
      color: 0x73756c,
      roughness: 0.8,
      metalness: 0.04,
    }),
  );
  padMesh.position.y = 0.035;
  padMesh.receiveShadow = true;
  group.add(padMesh);

  const padRing = new THREE.Mesh(
    new THREE.RingGeometry(12.35, 12.75, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xc36530, roughness: 0.62, metalness: 0.08 }),
  );
  padRing.position.y = 0.05;
  group.add(padRing);

  const laneStart = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 390).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xd08648, roughness: 0.7, metalness: 0.02 }),
  );
  laneStart.position.set(-7.7, 0.045, -208);
  group.add(laneStart);
  const laneStart2 = laneStart.clone();
  laneStart2.position.x = 7.7;
  group.add(laneStart2);

  const random = seededRandom();
  const markerGeometry = new THREE.CylinderGeometry(0.055, 0.075, 2.5, 7);
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: 0xc46634,
    roughness: 0.62,
    metalness: 0.08,
  });
  const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, 18);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + 0.16;
    const radius = 29;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    dummy.position.set(x, terrainHeight(x, z) + 1.25, z);
    dummy.rotation.set(0, -angle, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    markers.setMatrixAt(i, dummy.matrix);
  }
  markers.instanceMatrix.needsUpdate = true;
  markers.computeBoundingSphere();
  markers.castShadow = true;
  group.add(markers);

  const grassGeometry = makeGrassGeometry();
  const grassMaterial = new THREE.MeshStandardMaterial({
    map: makeGrassTexture(highQuality ? 256 : 128),
    color: 0xffffff,
    alphaTest: 0.34,
    side: THREE.DoubleSide,
    roughness: 0.95,
    metalness: 0,
    vertexColors: true,
  });
  const grassCount = lowPower ? 1400 : 8000;
  const grassSpan = 880;
  // Split the lawn into spatial chunks on desktop. Three can then reject the
  // chunks outside the view frustum instead of submitting all 8,000 blades.
  // A chunk is also hidden once it is too distant to resolve, which removes
  // the subpixel vegetation that aliases most on the horizon.
  const grassChunksPerAxis = lowPower ? 1 : 6;
  const grassChunkSpan = grassSpan / grassChunksPerAxis;
  const grassBuckets = Array.from({ length: grassChunksPerAxis ** 2 }, () => []);
  const grassColor = new THREE.Color();
  let placed = 0;
  while (placed < grassCount) {
    const x = (random() - 0.5) * grassSpan;
    const z = (random() - 0.5) * grassSpan;
    if (Math.hypot(x, z) < 17) continue;
    if (Math.abs(x) < 18 && z < -30) continue;
    const width = 0.7 + random() * 1.6;
    const height = 0.4 + random() * 0.9;
    dummy.position.set(x, terrainHeight(x, z) + 0.01, z);
    dummy.rotation.set(0, random() * Math.PI, 0);
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    grassColor.setHSL(0.16 + random() * 0.055, 0.16 + random() * 0.12, 0.48 + random() * 0.16);
    const cx = clamp(Math.floor((x + grassSpan * 0.5) / grassChunkSpan), 0, grassChunksPerAxis - 1);
    const cz = clamp(Math.floor((z + grassSpan * 0.5) / grassChunkSpan), 0, grassChunksPerAxis - 1);
    grassBuckets[cz * grassChunksPerAxis + cx].push({
      matrix: dummy.matrix.clone(),
      color: grassColor.clone(),
    });
    placed++;
  }

  const grassChunks = [];
  for (const bucket of grassBuckets) {
    if (!bucket.length) continue;
    const mesh = new THREE.InstancedMesh(grassGeometry, grassMaterial, bucket.length);
    for (let i = 0; i < bucket.length; i++) {
      mesh.setMatrixAt(i, bucket[i].matrix);
      mesh.setColorAt(i, bucket[i].color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    group.add(mesh);
    grassChunks.push(mesh);
  }

  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.02,
    vertexColors: true,
  });
  const rockCount = lowPower ? 140 : 420;
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount);
  const rockColor = new THREE.Color();
  placed = 0;
  while (placed < rockCount) {
    const x = (random() - 0.5) * 900;
    const z = (random() - 0.5) * 900;
    if (Math.hypot(x, z) < 58) continue;
    if (Math.abs(x) < 30 && z < -40) continue;
    const scaleX = 0.5 + random() * 2.1;
    const scaleY = 0.35 + random() * 1.5;
    const scaleZ = 0.5 + random() * 2.1;
    dummy.position.set(x, terrainHeight(x, z) + scaleY * 0.35, z);
    dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    dummy.scale.set(scaleX, scaleY, scaleZ);
    dummy.updateMatrix();
    rocks.setMatrixAt(placed, dummy.matrix);
    rockColor.setHSL(0.1, 0.05 + random() * 0.06, 0.26 + random() * 0.13);
    rocks.setColorAt(placed, rockColor);
    placed++;
  }
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  rocks.computeBoundingSphere();
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  const updateCulling = (cameraPosition) => {
    if (!cameraPosition || lowPower) return;
    const limit = 280;
    for (const mesh of grassChunks) {
      const sphere = mesh.boundingSphere;
      if (!sphere) continue;
      mesh.visible = cameraPosition.distanceTo(sphere.center) - sphere.radius < limit;
    }
  };

  return { group, ground, rocks, grassChunks, size, material, updateCulling };
}
