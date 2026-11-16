import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _aim = new THREE.Vector3();

function makeTargetTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = '#d7d0bd';
  context.fillRect(0, 0, 512, 512);

  const rings = [
    ['#c05231', 246],
    ['#e4ddc9', 196],
    ['#b7442d', 146],
    ['#e5dfcd', 98],
    ['#b23b2b', 52],
  ];
  for (const [color, radius] of rings) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(256, 256, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = 'rgba(38,39,32,0.55)';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(256, 256, 250, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = '#35372f';
  context.font = '700 52px "Arial Narrow", sans-serif';
  context.textAlign = 'center';
  context.fillText(label, 256, 476);
  context.font = '500 22px "Consolas", monospace';
  context.fillText('GUNNERY TARGET', 256, 44);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeSignTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  context.fillStyle = '#22271d';
  context.fillRect(0, 0, 512, 192);
  context.strokeStyle = '#c46b3a';
  context.lineWidth = 12;
  context.strokeRect(8, 8, 496, 176);
  context.fillStyle = '#d8d7bf';
  context.font = '700 100px "Arial Narrow", sans-serif';
  context.textAlign = 'center';
  context.fillText(`${label} M`, 256, 126);
  context.fillStyle = '#a6ab91';
  context.font = '500 24px "Consolas", monospace';
  context.fillText('LASER RANGE', 256, 164);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 12, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.24)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const contactShadowTexture = makeContactShadowTexture();
const invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });

function makeContactShadow(width, length) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
      toneMapped: false,
    }),
  );
  mesh.position.y = 0.045;
  mesh.renderOrder = 1;
  return mesh;
}

function makeFramePost(material, x, z = 0) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 2.8, 8), material);
  post.position.set(x, 1.4, z);
  post.castShadow = true;
  post.receiveShadow = true;
  return post;
}

function makeCollider(size, position, zone) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), invisibleMaterial);
  mesh.position.copy(position);
  mesh.userData.zone = zone;
  return mesh;
}

class RangeTarget {
  constructor({ name, kind, group, colliders, centerOffset, health, score, respawnDelay, hideOnDeath = false, platePivot = null }) {
    this.name = name;
    this.kind = kind;
    this.group = group;
    this.colliders = colliders;
    this.centerOffset = centerOffset;
    this.maxHealth = health;
    this.health = health;
    this.score = score;
    this.respawnDelay = respawnDelay;
    this.hideOnDeath = hideOnDeath;
    this.platePivot = platePivot;
    this.alive = true;
    this.respawnTimer = 0;
    this.hideTimer = 0;
    this.swing = 0;
    this.swingVelocity = 0;
    this.hitPulse = 0;
    this.turretPivot = null;
    for (const collider of colliders) collider.userData.target = this;
  }

  getAimPoint(target = new THREE.Vector3()) {
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(target.copy(this.centerOffset));
  }

  hit(damage) {
    if (!this.alive) return { ignored: true, killed: false };
    this.health -= damage;
    this.hitPulse = 0.18;
    this.swingVelocity += Math.min(4.5, 1.2 + damage * 0.018);
    if (this.health > 0) return { killed: false };
    this.alive = false;
    this.respawnTimer = this.respawnDelay;
    this.hideTimer = this.hideOnDeath ? 1.35 : 0;
    return { killed: true };
  }

  update(dt) {
    this.hitPulse = Math.max(0, this.hitPulse - dt);
    if (this.platePivot) {
      const acceleration = -56 * this.swing - 6.5 * this.swingVelocity;
      this.swingVelocity += acceleration * dt;
      this.swing += this.swingVelocity * dt;
      this.platePivot.rotation.x = this.swing;
    }
    if (!this.alive) {
      if (this.hideTimer > 0) {
        this.hideTimer -= dt;
        if (this.turretPivot) this.turretPivot.rotation.y += dt * 1.8;
        if (this.hideTimer <= 0 && this.hideOnDeath) this.group.visible = false;
      }
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.alive = true;
        this.health = this.maxHealth;
        this.group.visible = true;
        this.hideTimer = 0;
        this.swing = 0;
        this.swingVelocity = 0;
        if (this.platePivot) this.platePivot.rotation.x = 0;
        if (this.turretPivot) this.turretPivot.rotation.y = 0;
      }
    }
  }
}

function addTarget(root, targets, colliders, target) {
  root.add(target.group);
  targets.push(target);
  colliders.push(...target.colliders);
}

function createSteelTarget(root, targets, colliders, { x, z, distance, terrainHeight }) {
  const group = new THREE.Group();
  group.name = `steel-target-${distance}`;
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = Math.atan2(-x, -z);
  const steel = new THREE.MeshStandardMaterial({ color: 0x454b44, roughness: 0.55, metalness: 0.72 });
  const plateMaterial = new THREE.MeshStandardMaterial({
    map: makeTargetTexture(`${distance}`),
    roughness: 0.58,
    metalness: 0.3,
    emissive: 0x1c0b06,
    emissiveIntensity: 0.15,
  });

  group.add(makeFramePost(steel, -1.6));
  group.add(makeFramePost(steel, 1.6));
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.14, 0.14), steel);
  crossbar.position.y = 2.8;
  crossbar.castShadow = true;
  group.add(crossbar);
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.12, 0.8), steel);
  base.position.y = 0.06;
  base.receiveShadow = true;
  group.add(base);

  const platePivot = new THREE.Group();
  platePivot.position.set(0, 2.75, 0.08);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.11, 48), plateMaterial);
  plate.rotation.x = Math.PI / 2;
  plate.position.y = -0.86;
  plate.castShadow = true;
  plate.receiveShadow = true;
  platePivot.add(plate);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.055, 8, 48), steel);
  rim.position.set(0, -0.86, 0.02);
  platePivot.add(rim);
  group.add(platePivot);
  group.add(makeContactShadow(4.6, 2.4));

  const collider = makeCollider(new THREE.Vector3(2.4, 2.35, 0.48), new THREE.Vector3(0, 2.0, 0.03), 'plate');
  group.add(collider);
  addTarget(root, targets, colliders, new RangeTarget({
    name: `STEEL ${distance}M`,
    kind: 'steel',
    group,
    colliders: [collider],
    centerOffset: new THREE.Vector3(0, 2.0, 0.03),
    health: 40,
    score: 180 + Math.round(distance * 0.5),
    respawnDelay: 2.6,
    platePivot,
  }));
}

function createBarrelCluster(root, targets, colliders, { x, z, distance, terrainHeight }) {
  const group = new THREE.Group();
  group.name = `fuel-target-${distance}`;
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = Math.atan2(-x, -z);
  const red = new THREE.MeshStandardMaterial({ color: 0x983d25, roughness: 0.54, metalness: 0.4 });
  const band = new THREE.MeshStandardMaterial({ color: 0x272b27, roughness: 0.55, metalness: 0.7 });
  const positions = [
    [-0.75, 0, 0],
    [0.75, 0, 0],
    [0, 0, 0.75],
  ];
  for (const [bx, , bz] of positions) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 1.22, 18), red);
    barrel.position.set(bx, 0.62, bz);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    group.add(barrel);
    for (const y of [0.2, 0.95]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.025, 5, 18), band);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(bx, y, bz);
      group.add(ring);
    }
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 18), band);
    lid.position.set(bx, 1.245, bz);
    group.add(lid);
  }
  group.add(makeContactShadow(3.4, 2.8));
  const collider = makeCollider(new THREE.Vector3(2.4, 1.4, 1.8), new THREE.Vector3(0, 0.72, 0.28), 'fuel');
  group.add(collider);
  addTarget(root, targets, colliders, new RangeTarget({
    name: `FUEL ${distance}M`,
    kind: 'fuel',
    group,
    colliders: [collider],
    centerOffset: new THREE.Vector3(0, 0.8, 0.28),
    health: 24,
    score: 260 + Math.round(distance * 0.55),
    respawnDelay: 7.5,
    hideOnDeath: true,
  }));
}

function createTargetTank(root, targets, colliders, { vehicleScene, x, z, distance, terrainHeight }) {
  if (!vehicleScene) return;
  const group = new THREE.Group();
  group.name = `hulk-target-${distance}`;
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = Math.PI;
  group.scale.setScalar(1.0);

  const clone = vehicleScene.clone(true);
  clone.traverse((child) => {
    if (!child.isMesh) return;
    const source = Array.isArray(child.material) ? child.material[0] : child.material;
    const material = source.clone();
    material.color.multiplyScalar(0.66);
    material.roughness = Math.min(1, (material.roughness || 0.8) + 0.08);
    child.material = material;
    child.castShadow = false;
    child.receiveShadow = true;
  });
  group.add(clone);
  group.add(makeContactShadow(7.8, 11.5));

  const turret = clone.getObjectByName('turret_pivot');
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0xc65b2f,
    roughness: 0.6,
    metalness: 0.1,
    emissive: 0x2b0b04,
    emissiveIntensity: 0.12,
  });
  if (turret) {
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 1.1), panelMaterial);
      panel.position.set(side * 1.14, 0.15, 0.55);
      turret.add(panel);
    }
  }

  const hull = makeCollider(new THREE.Vector3(3.35, 2.0, 8.8), new THREE.Vector3(0, 1.15, -0.1), 'hull');
  const turretCollider = makeCollider(new THREE.Vector3(2.75, 1.05, 2.7), new THREE.Vector3(0, 2.3, 0.35), 'turret');
  group.add(hull);
  group.add(turretCollider);

  const target = new RangeTarget({
    name: `T-72 HULK ${distance}M`,
    kind: 'tank',
    group,
    colliders: [hull, turretCollider],
    centerOffset: new THREE.Vector3(0, 1.55, 0),
    health: 115,
    score: 820 + Math.round(distance * 0.7),
    respawnDelay: 10.5,
    hideOnDeath: true,
  });
  target.turretPivot = turret;
  addTarget(root, targets, colliders, target);
}

function createDistanceSign(root, x, z, distance, terrainHeight) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = 0;
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x4e5549, roughness: 0.62, metalness: 0.45 });
  for (const dx of [-1.2, 1.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 2.3, 6), postMaterial);
    post.position.set(dx, 1.15, 0);
    post.castShadow = true;
    group.add(post);
  }
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 1.09),
    new THREE.MeshStandardMaterial({ map: makeSignTexture(distance), roughness: 0.76, metalness: 0.06 }),
  );
  board.position.set(0, 1.88, 0.03);
  board.castShadow = true;
  group.add(board);
  root.add(group);
}

export function createRange({ scene, vehicleScene, terrainHeight }) {
  const root = new THREE.Group();
  root.name = 'gunnery-range';
  scene.add(root);
  const targets = [];
  const colliders = [];

  createBarrelCluster(root, targets, colliders, { x: -8, z: -132, distance: 132, terrainHeight });
  createSteelTarget(root, targets, colliders, { x: 10, z: -240, distance: 240, terrainHeight });
  createSteelTarget(root, targets, colliders, { x: -12, z: -330, distance: 330, terrainHeight });
  createTargetTank(root, targets, colliders, { vehicleScene, x: 0, z: -392, distance: 392, terrainHeight });
  createSteelTarget(root, targets, colliders, { x: 14, z: -462, distance: 462, terrainHeight });

  createDistanceSign(root, 24, -110, 100, terrainHeight);
  createDistanceSign(root, 24, -210, 200, terrainHeight);
  createDistanceSign(root, 24, -310, 300, terrainHeight);
  createDistanceSign(root, 24, -410, 400, terrainHeight);

  return {
    root,
    targets,
    colliders,
    update(dt) {
      for (const target of targets) target.update(dt);
    },
    getState() {
      return targets.map((target) => ({
        name: target.name,
        kind: target.kind,
        alive: target.alive,
        health: target.health,
        maxHealth: target.maxHealth,
        score: target.score,
        aimPoint: target.getAimPoint(_aim).toArray(),
      }));
    },
  };
}
