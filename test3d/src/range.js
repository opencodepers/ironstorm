import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _aim = new THREE.Vector3();
const _point = new THREE.Vector3();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _target = new THREE.Vector3();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const random = () => Math.random();

function makeTargetTexture(label, accent = '#b23b2b') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = '#d7d0bd';
  context.fillRect(0, 0, 512, 512);
  const rings = [
    [accent, 246],
    ['#e4ddc9', 196],
    [accent, 146],
    ['#e5dfcd', 98],
    [accent, 52],
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
  context.fillText('LIVE TARGET', 256, 44);
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

function makeTargetLodProxy(hostile = false) {
  const group = new THREE.Group();
  group.name = 'target-lod-proxy';
  const olive = new THREE.MeshStandardMaterial({
    color: hostile ? 0x30382a : 0x3d4436,
    roughness: 0.86,
    metalness: 0.2,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22261f, roughness: 0.9, metalness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xc65b2f, roughness: 0.65, metalness: 0.1 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.35, 1.05, 7), olive);
  hull.position.y = 0.95;
  group.add(hull);
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 1.5), olive);
  glacis.position.set(0, 1.15, -3.2);
  group.add(glacis);
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 7.1), dark);
    track.position.set(side * 1.42, 0.45, 0);
    group.add(track);
  }
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.38, 0.66, 10), olive);
  turret.position.set(0, 1.68, 0.12);
  group.add(turret);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 4.1, 7), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.78, -2.45);
  group.add(barrel);
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.95), accent);
    panel.position.set(side * 1.1, 1.78, 0.55);
    group.add(panel);
  }
  group.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = true;
  });
  return group;
}

function makeFramePost(material, x, z = 0) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 2.8, 8), material);
  post.position.set(x, 1.4, z);
  post.castShadow = true;
  post.receiveShadow = true;
  return post;
}

function makeCollider(size, position, zone, extra = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), invisibleMaterial);
  mesh.position.copy(position);
  mesh.userData.zone = zone;
  Object.assign(mesh.userData, extra);
  return mesh;
}

function hasLineOfSight(from, to, terrainHeight) {
  const distance = from.distanceTo(to);
  if (distance < 1) return true;
  const steps = Math.min(24, Math.max(4, Math.floor(distance / 16)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    if (y < terrainHeight(x, z) + 0.35) return false;
  }
  return true;
}

function assignTarget(colliders, target) {
  for (const collider of target.colliders) collider.userData.target = target;
}

class RangeTarget {
  constructor({
    name,
    kind,
    group,
    colliders,
    centerOffset,
    health,
    score,
    respawnDelay,
    hideOnDeath = false,
    platePivot = null,
    turretPivot = null,
    hostile = false,
    friendly = false,
    weapon = 'CANNON',
    armor = null,
    path = null,
    popup = false,
    cover = false,
    era = 0,
    composite = false,
    maxRange = 800,
    reaction = 2.8,
    damage = 55,
    projectileSpeed = 760,
    lod = null,
  }) {
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
    this.turretPivot = turretPivot;
    this.hostile = hostile;
    this.friendly = friendly;
    this.weapon = weapon;
    this.armor = armor || { hull: 42, turret: 42 };
    this.path = path;
    this.popup = popup;
    this.cover = cover;
    this.era = era;
    this.composite = composite;
    this.maxRange = maxRange;
    this.reaction = reaction;
    this.damage = damage;
    this.projectileSpeed = projectileSpeed;
    this.alive = true;
    this.respawnTimer = 0;
    this.hideTimer = 0;
    this.swing = 0;
    this.swingVelocity = 0;
    this.hitPulse = 0;
    this.fireTimer = hostile ? 9 + Math.random() * 7 : 2 + Math.random() * 4;
    this.displayTimer = 0;
    this.burning = 0;
    this.destroyedTime = 0;
    this.modules = { engine: 100, tracks: 100, optics: 100, turret: 100, gun: 100, ammo: 100 };
    this.basePosition = group.position.clone();
    this.origin = group.position.clone();
    this.pathTime = Math.random() * 10;
    this.detail = [];
    for (const child of group.children) {
      if (child.isMesh && child !== colliders[0]) this.detail.push(child);
    }
    this.velocity = new THREE.Vector3();
    this.lastPosition = group.position.clone();
    this.colliderGroup = group;
    this.visibilityTimer = Math.random() * 0.2;
    this.contactShadow = null;
    this.lod = lod;
    group.traverse((child) => {
      if (child.isMesh && child.material?.map === contactShadowTexture) this.contactShadow = child;
    });
    this.wasHit = false;
    assignTarget(colliders, this);
  }

  getAimPoint(target = new THREE.Vector3()) {
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(target.copy(this.centerOffset));
  }

  getState() {
    return {
      name: this.name,
      kind: this.kind,
      alive: this.alive,
      health: this.health,
      maxHealth: this.maxHealth,
      score: this.score,
      aimPoint: this.getAimPoint(new THREE.Vector3()).toArray(),
      hostile: this.hostile,
      friendly: this.friendly,
      weapon: this.weapon,
      fireTimer: this.fireTimer,
      modules: { ...this.modules },
      velocity: [this.velocity.x, this.velocity.y, this.velocity.z],
      lodLevel: this.lod?.getCurrentLevel?.() ?? null,
    };
  }

  hit(payload) {
    if (!this.alive) return { ignored: true, killed: false };
    if (this.friendly) {
      const result = {
        friendly: true,
        killed: false,
        penetrated: true,
        zone: payload.zone || 'HULL',
        damage: 0,
        message: 'FRIENDLY FIRE',
      };
      this.hitPulse = 0.3;
      return result;
    }

    const zone = String(payload.zone || 'hull').toLowerCase();
    const angle = Number.isFinite(payload.incidence) ? clamp(Math.abs(payload.incidence), 0, 1.45) : 0.2;
    const ammo = payload.ammo || 'APFSDS';
    const dud = Boolean(payload.dud);
    const armor = this.armor[zone] ?? this.armor.hull ?? this.armor.plate ?? 40;
    let effective = armor / Math.max(0.28, Math.cos(angle));

    if (this.composite) effective *= 1.12;
    if (this.era > 0 && (zone === 'hull' || zone === 'turret' || zone === 'ammo')) {
      if (ammo === 'HEAT') {
        effective += 260;
        this.era = Math.max(0, this.era - 1);
      } else if (ammo === 'APFSDS' && payload.penetration > 320) {
        effective += 34;
        this.era = Math.max(0, this.era - 1);
      }
    }

    let penetration = payload.penetration || 500;
    if (ammo === 'HEAT') penetration = Math.max(350, penetration * 0.82);
    if (ammo === 'HE') penetration = Math.min(penetration, 90);
    if (ammo === 'HESH') penetration = Math.min(penetration, 120);
    if (ammo === 'SMOKE' || ammo === 'CAN') penetration = 0;

    const ricochet = ammo === 'APFSDS' && angle > 1.12 && penetration < effective * 1.45;
    const penetrated = !dud && !ricochet && penetration >= effective * (0.92 + Math.random() * 0.12);
    const blast = payload.blast || 0;
    let damage = 0;
    let message = ricochet ? 'RICOCHET' : '';

    if (penetrated) {
      damage = (payload.damage || 50) * (zone === 'ammo' ? 1.8 : zone === 'engine' ? 1.3 : zone === 'optics' ? 1.1 : 1);
      if (ammo === 'HESH') {
        damage *= 1.3;
        message = 'SPALL';
      }
      if (this.kind === 'tank' || this.kind === 'hulk') {
        this.modules[zone] = Math.max(0, (this.modules[zone] ?? 100) - damage * 0.8);
        if (zone === 'engine') this.burning = 8;
        if (zone === 'ammo' && Math.random() < 0.36) {
          damage = this.health + 10;
          message = 'AMMO DETONATION';
        }
      }
    } else if (blast > 2) {
      damage = blast * (this.kind === 'infantry' ? 2.4 : 0.28);
    }

    if (dud) {
      damage = 0;
      message = 'DUD';
    } else if (ammo === 'SMOKE') {
      damage = 1;
      message = 'SMOKE';
    } else if (!penetrated && !message) {
      message = ammo === 'HE' ? 'BLAST' : 'NO PENETRATION';
    }

    this.health -= damage;
    this.hitPulse = 0.25;
    this.swingVelocity += Math.min(5.2, 1.2 + damage * 0.018);
    if (this.health > 0) {
      return {
        ignored: false,
        penetrated,
        ricochet,
        spall: ammo === 'HESH',
        killed: false,
        zone,
        damage,
        message,
        effectiveArmor: effective,
      };
    }

    this.alive = false;
    this.respawnTimer = this.respawnDelay;
    this.hideTimer = this.hideOnDeath ? 1.8 : 0;
    this.destroyedTime = 0;
    if (this.popup) this.displayTimer = 0;
    return {
      ignored: false,
      penetrated,
      ricochet,
      spall: ammo === 'HESH',
      killed: true,
      zone,
      damage,
      message: message || 'TARGET DESTROYED',
      effectiveArmor: effective,
    };
  }

  reset() {
    this.health = this.maxHealth;
    this.alive = true;
    this.respawnTimer = 0;
    this.hideTimer = 0;
    this.burning = 0;
    this.destroyedTime = 0;
    this.hitPulse = 0;
    this.swing = 0;
    this.swingVelocity = 0;
    this.modules = { engine: 100, tracks: 100, optics: 100, turret: 100, gun: 100, ammo: 100 };
    this.group.visible = true;
    this.group.position.copy(this.basePosition);
    this.origin.copy(this.basePosition);
    this.lastPosition.copy(this.group.position);
    if (this.platePivot) this.platePivot.rotation.x = 0;
    if (this.turretPivot) {
      this.turretPivot.rotation.set(0, 0, 0);
      this.turretPivot.position.set(0, 0, 0);
    }
  }

  update(dt, context) {
    this.hitPulse = Math.max(0, this.hitPulse - dt);
    this.burning = Math.max(0, this.burning - dt);

    // Cheap occlusion/LOD pass. Target colliders remain raycastable while
    // distant or terrain-occluded visual detail is removed from the draw list.
    this.visibilityTimer -= dt;
    if (context.camera && this.visibilityTimer <= 0) {
      this.visibilityTimer = 0.18;
      const cameraPosition = context.camera.position;
      const aim = this.getAimPoint(_target);
      const distance = aim.distanceTo(cameraPosition);
      let occluded = false;
      if (distance > 55 && this.kind !== 'air') {
        const samples = Math.min(18, Math.max(5, Math.floor(distance / 24)));
        for (let i = 1; i < samples; i++) {
          const t = i / samples;
          const x = cameraPosition.x + (aim.x - cameraPosition.x) * t;
          const y = cameraPosition.y + (aim.y - cameraPosition.y) * t;
          const z = cameraPosition.z + (aim.z - cameraPosition.z) * t;
          if (y < context.terrainHeight(x, z) + 0.32) {
            occluded = true;
            break;
          }
        }
      }
      this.group.visible = !occluded;
      if (this.contactShadow) this.contactShadow.visible = !occluded && distance < 300;
    }
    if (this.platePivot) {
      const acceleration = -56 * this.swing - 6.5 * this.swingVelocity;
      this.swingVelocity += acceleration * dt;
      this.swing += this.swingVelocity * dt;
      this.platePivot.rotation.x = this.swing;
    }

    if (!this.alive) {
      this.destroyedTime += dt;
      if (this.turretPivot && this.kind === 'tank') {
        const time = Math.min(2.6, this.destroyedTime);
        this.turretPivot.position.y = time * 1.45;
        this.turretPivot.rotation.y += dt * (1.2 + time * 2.2);
        this.turretPivot.rotation.z = Math.min(0.62, time * 0.24);
      }
      if (this.hideTimer > 0) {
        this.hideTimer -= dt;
        if (this.hideTimer <= 0 && this.hideOnDeath) this.group.visible = false;
      }
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.reset();
        context.onEvent?.('respawn', this);
      }
      return;
    }

    this.lastPosition.copy(this.group.position);
    this.pathTime += dt;
    if (this.path) {
      const path = this.path;
      if (path.type === 'cross') {
        const span = path.max - path.min;
        const phase = (this.pathTime * path.speed) % 2;
        const t = phase < 1 ? phase : 2 - phase;
        this.group.position.x = this.origin.x + path.min + span * t;
        this.group.position.z = this.origin.z + (path.z || 0);
      } else if (path.type === 'advance') {
        const span = path.max - path.min;
        const phase = (this.pathTime * path.speed) % 2;
        const t = phase < 1 ? phase : 2 - phase;
        this.group.position.z = this.origin.z + path.min + span * t;
      } else if (path.type === 'zigzag') {
        this.group.position.x = this.origin.x + Math.sin(this.pathTime * path.speed) * path.min;
        this.group.position.z = this.origin.z + Math.sin(this.pathTime * path.speed * 1.6) * path.max;
      }
      this.group.position.y = this.basePosition.y;
    }
    if (this.popup) {
      const exposed = this.displayTimer > 0;
      const targetY = exposed ? this.basePosition.y : this.basePosition.y - 1.8;
      this.group.position.y += (targetY - this.group.position.y) * Math.min(1, dt * 7);
      this.displayTimer = Math.max(0, this.displayTimer - dt);
      if (this.displayTimer <= 0) {
        this.displayTimer = 4 + Math.random() * 4;
        this.group.position.y = this.basePosition.y - 1.8;
      }
    }
    if (this.kind === 'air' && this.airCenter) {
      const radius = 78;
      this.group.position.x = this.airCenter.x + Math.cos(this.pathTime * 0.22) * radius;
      this.group.position.z = this.airCenter.z + Math.sin(this.pathTime * 0.22) * radius;
      this.group.position.y = this.airCenter.y + Math.sin(this.pathTime * 0.7) * 2.5;
      this.group.rotation.y = -this.pathTime * 0.22 + Math.PI * 0.5;
    }
    this.velocity.copy(this.group.position).sub(this.lastPosition).divideScalar(Math.max(dt, 0.0001));

    if (!this.hostile && !this.weapon.includes('ARTILLERY')) return;
    if (this.friendly) return;

    const player = context.player;
    if (!player) return;
    _from.copy(this.getAimPoint(new THREE.Vector3()));
    _to.copy(player);
    const distance = _from.distanceTo(_to);
    if (distance > this.maxRange || distance < 30) return;
    if (this.cover && !hasLineOfSight(_from, _to, context.terrainHeight)) return;
    if (this.kind === 'infantry' && this.group.position.y < this.basePosition.y - 0.4) return;

    if (this.turretPivot) {
      const local = this.group.worldToLocal(_to.clone());
      const desired = Math.atan2(-local.x, -local.z);
      this.turretPivot.rotation.y += Math.atan2(Math.sin(desired - this.turretPivot.rotation.y), Math.cos(desired - this.turretPivot.rotation.y)) * Math.min(1, dt * 1.6);
    }

    if (this.weapon === 'ARTILLERY') {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 26 + Math.random() * 14;
        context.onArtillery?.(_to.clone(), 7 + Math.random() * 6, this);
        context.onEvent?.('artillery', this);
      }
      return;
    }

    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    const aimError = this.kind === 'infantry' ? 4.2 : this.kind === 'atgm' ? 1.1 : 1.8;
    _point.copy(_to).add(new THREE.Vector3(
      (Math.random() - 0.5) * aimError,
      (Math.random() - 0.5) * aimError * 0.5,
      (Math.random() - 0.5) * aimError,
    ));
    _point.y += 1.7;
    const leadTime = distance / Math.max(200, this.projectileSpeed);
    if (context.playerVelocity) _point.addScaledVector(context.playerVelocity, leadTime * 0.7);
    context.onEnemyFire?.({
      from: _from.clone(),
      target: _point.clone(),
      kind: this.weapon,
      damage: this.damage,
      speed: this.projectileSpeed,
      source: this,
      guided: this.weapon === 'ATGM',
    });
    context.onEvent?.('enemyFire', this);
    this.fireTimer = this.weapon === 'ATGM'
      ? 12 + Math.random() * 8
      : this.kind === 'infantry' ? 5 + Math.random() * 5 : 7 + Math.random() * 5;
  }
}

class Destructible {
  constructor({ name, mesh, collider, health = 220, score = 80, materialKind = 'structure', position }) {
    this.name = name;
    this.mesh = mesh;
    this.collider = collider;
    this.health = health;
    this.maxHealth = health;
    this.score = score;
    this.materialKind = materialKind;
    this.alive = true;
    this.position = position.clone();
    collider.userData.destructible = this;
    this.aimPoint = position.clone();
    this.aimPoint.y += 1.2;
  }

  getState() {
    return {
      name: this.name,
      kind: 'destructible',
      alive: this.alive,
      health: this.health,
      maxHealth: this.maxHealth,
      score: this.score,
      aimPoint: this.aimPoint.toArray(),
      hostile: false,
      friendly: false,
      weapon: 'STATIC',
    };
  }

  getAimPoint(target = new THREE.Vector3()) {
    return target.copy(this.aimPoint);
  }

  hit(payload) {
    if (!this.alive) return { ignored: true, killed: false };
    const damage = payload.ammo === 'APFSDS' ? payload.damage * 1.4 : payload.damage;
    this.health -= damage;
    if (this.health > 0) return { ignored: false, penetrated: true, killed: false, damage, message: 'STRUCTURE HIT' };
    this.alive = false;
    this.mesh.visible = false;
    this.collider.visible = false;
    return { ignored: false, penetrated: true, killed: true, damage, message: 'STRUCTURE DESTROYED' };
  }

  reset() {
    this.alive = true;
    this.health = this.maxHealth;
    this.mesh.visible = true;
    this.collider.visible = true;
  }
}

function freezeLocalMatrices(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.updateMatrix();
    child.matrixAutoUpdate = false;
  });
}

function addTarget(root, targets, colliders, target, destructibles) {
  root.add(target.group);
  freezeLocalMatrices(target.group);
  targets.push(target);
  colliders.push(...target.colliders);
  if (destructibles) destructibles.push(target);
}

function createSteelTarget(root, targets, colliders, { x, z, distance, terrainHeight, path = null, friendly = false, label = null }) {
  const group = new THREE.Group();
  group.name = `steel-target-${distance}`;
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = Math.atan2(-x, -z);
  const steel = new THREE.MeshStandardMaterial({ color: friendly ? 0x324a64 : 0x454b44, roughness: 0.55, metalness: 0.72 });
  const plateMaterial = new THREE.MeshStandardMaterial({
    map: makeTargetTexture(`${distance}`, friendly ? '#2d5f94' : '#b23b2b'),
    roughness: 0.58,
    metalness: 0.3,
    emissive: friendly ? 0x061c38 : 0x1c0b06,
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
  if (path) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(path.max - path.min + 4, 0.08, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2c302b, roughness: 0.65, metalness: 0.6 }),
    );
    rail.position.set(path.min + (path.max - path.min) * 0.5, 0.08, 0);
    group.add(rail);
  }
  const target = new RangeTarget({
    name: label || (friendly ? `FRIENDLY ${distance}M` : `STEEL ${distance}M`),
    kind: friendly ? 'friendly' : 'steel',
    group,
    colliders: [collider],
    centerOffset: new THREE.Vector3(0, 2.0, 0.03),
    health: friendly ? 1000 : 40,
    score: friendly ? 0 : 180 + Math.round(distance * 0.5),
    respawnDelay: friendly ? 999 : 2.6,
    platePivot,
    friendly,
    armor: { plate: friendly ? 70 : 55, hull: 55 },
    path,
  });
  addTarget(root, targets, colliders, target, null);
  return target;
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
    armor: { fuel: 9, hull: 9 },
  }), null);
}

function createTargetTank(root, targets, colliders, { vehicleScene, x, z, distance, terrainHeight, hostile = false, moving = false }) {
  if (!vehicleScene) return;
  const group = new THREE.Group();
  group.name = `hulk-target-${distance}`;
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = Math.PI;
  const clone = vehicleScene.clone(true);
  clone.traverse((child) => {
    if (!child.isMesh) return;
    const source = Array.isArray(child.material) ? child.material[0] : child.material;
    const material = source.clone();
    material.color.multiplyScalar(hostile ? 0.5 : 0.66);
    material.roughness = Math.min(1, (material.roughness || 0.8) + 0.08);
    child.material = material;
    child.castShadow = false;
    child.receiveShadow = true;
  });
  const lod = new THREE.LOD();
  lod.addLevel(clone, 0);
  lod.addLevel(makeTargetLodProxy(hostile), 95, 0.08);
  group.add(lod);
  group.add(makeContactShadow(7.8, 11.5));
  const turret = clone.getObjectByName('turret_pivot');
  const panelMaterial = new THREE.MeshStandardMaterial({
    color: hostile ? 0x8d2c1d : 0xc65b2f,
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

  const hull = makeCollider(new THREE.Vector3(3.35, 1.35, 8.8), new THREE.Vector3(0, 0.72, -0.1), 'hull');
  const turretCollider = makeCollider(new THREE.Vector3(2.75, 0.95, 2.7), new THREE.Vector3(0, 1.72, 0.35), 'turret');
  const engine = makeCollider(new THREE.Vector3(2.9, 0.8, 1.7), new THREE.Vector3(0, 0.9, 3.3), 'engine');
  const optics = makeCollider(new THREE.Vector3(0.7, 0.4, 0.55), new THREE.Vector3(0, 1.98, -0.75), 'optics');
  const ammo = makeCollider(new THREE.Vector3(1.8, 0.55, 1.2), new THREE.Vector3(0, 1.62, 1.25), 'ammo');
  for (const side of [-1, 1]) {
    const track = makeCollider(new THREE.Vector3(0.45, 0.55, 7.8), new THREE.Vector3(side * 1.35, 0.42, 0), 'track');
    group.add(track);
  }
  group.add(hull);
  group.add(turretCollider);
  group.add(engine);
  group.add(optics);
  group.add(ammo);

  const target = new RangeTarget({
    name: hostile ? `T-72M HOSTILE ${distance}M` : `T-72 HULK ${distance}M`,
    kind: hostile ? 'tank' : 'hulk',
    group,
    colliders: [hull, turretCollider, engine, optics, ammo, ...group.children.filter((child) => child.userData.zone === 'track')],
    centerOffset: new THREE.Vector3(0, 1.55, 0),
    health: hostile ? 140 : 115,
    score: 820 + Math.round(distance * 0.7),
    respawnDelay: hostile ? 15 : 10.5,
    hideOnDeath: true,
    turretPivot: turret,
    hostile,
    weapon: hostile ? 'CANNON' : 'STATIC',
    armor: {
      hull: 420,
      turret: 470,
      engine: 80,
      optics: 95,
      ammo: 250,
      track: 45,
    },
    composite: true,
    era: hostile ? 1 : 0,
    path: moving ? { type: 'advance', min: -9, max: 9, speed: 0.1 } : null,
    damage: 70,
    projectileSpeed: 850,
    lod,
  });
  target.turretPivot = turret;
  addTarget(root, targets, colliders, target, null);
  return target;
}

function createEnemyTank(root, targets, colliders, { x, z, distance, terrainHeight }) {
  const group = new THREE.Group();
  group.name = `enemy-tank-${distance}`;
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = Math.atan2(-x, -z) + Math.PI;
  const olive = new THREE.MeshStandardMaterial({ color: 0x3e4936, roughness: 0.72, metalness: 0.42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f241c, roughness: 0.8, metalness: 0.5 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x6e3d25, roughness: 0.8, metalness: 0.2 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.15, 7.2), olive);
  hull.position.y = 1;
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 1.8), olive);
  glacis.position.set(0, 1.15, -3.4);
  group.add(glacis);
  for (const side of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 7.6), dark);
    track.position.set(side * 1.55, 0.45, 0);
    track.castShadow = true;
    group.add(track);
  }
  const turret = new THREE.Group();
  turret.name = `enemy-turret-${distance}`;
  turret.position.set(0, 1.7, 0.2);
  const turretBody = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.55, 0.8, 12), olive);
  turretBody.castShadow = true;
  turret.add(turretBody);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 4.2, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.12, -2.4);
  barrel.castShadow = true;
  turret.add(barrel);
  const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 10), rust);
  cupola.position.set(0.55, 0.58, 0.1);
  turret.add(cupola);
  group.add(turret);

  const hullCollider = makeCollider(new THREE.Vector3(3.5, 1.25, 7.2), new THREE.Vector3(0, 0.78, 0), 'hull');
  const turretCollider = makeCollider(new THREE.Vector3(2.5, 0.85, 2.6), new THREE.Vector3(0, 1.72, 0.2), 'turret');
  const engineCollider = makeCollider(new THREE.Vector3(2.8, 0.7, 1.4), new THREE.Vector3(0, 1.0, 2.8), 'engine');
  group.add(hullCollider);
  group.add(turretCollider);
  group.add(engineCollider);
  addTarget(root, targets, colliders, new RangeTarget({
    name: `T-72M ENEMY ${distance}M`,
    kind: 'tank',
    group,
    colliders: [hullCollider, turretCollider, engineCollider],
    centerOffset: new THREE.Vector3(0, 1.4, 0.2),
    health: 160,
    score: 980 + Math.round(distance * 0.6),
    respawnDelay: 18,
    hideOnDeath: true,
    turretPivot: turret,
    hostile: true,
    weapon: 'CANNON',
    armor: { hull: 400, turret: 450, engine: 80, ammo: 240, track: 40 },
    composite: true,
    era: 1,
    path: { type: 'zigzag', min: 7, max: 5, speed: 0.12 },
    damage: 70,
    projectileSpeed: 850,
  }), null);
}

function createInfantry(root, targets, colliders, { x, z, distance, terrainHeight, weapon = 'MG' }) {
  const group = new THREE.Group();
  group.name = `infantry-${distance}`;
  group.position.set(x, terrainHeight(x, z), z);
  group.rotation.y = Math.atan2(-x, -z);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.34, 1.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x4c5542, roughness: 0.9, metalness: 0.05 }),
  );
  body.position.y = 0.65;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x8b765b, roughness: 0.85 }),
  );
  head.position.y = 1.45;
  group.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x30382d, roughness: 0.75, metalness: 0.25 }),
  );
  helmet.position.y = 1.56;
  group.add(helmet);
  if (weapon === 'ATGM') {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b3d31, roughness: 0.7, metalness: 0.45 }),
    );
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0.35, 1.1, -0.25);
    group.add(tube);
  }
  const collider = makeCollider(new THREE.Vector3(0.8, 1.5, 0.65), new THREE.Vector3(0, 0.8, 0), 'crew');
  group.add(collider);
  const baseY = group.position.y;
  const target = new RangeTarget({
    name: weapon === 'ATGM' ? `ATGM TEAM ${distance}M` : `INFANTRY ${distance}M`,
    kind: weapon === 'ATGM' ? 'atgm' : 'infantry',
    group,
    colliders: [collider],
    centerOffset: new THREE.Vector3(0, 0.85, 0),
    health: weapon === 'ATGM' ? 16 : 12,
    score: 220 + distance,
    respawnDelay: 8,
    hideOnDeath: true,
    hostile: true,
    weapon,
    armor: { crew: 2, hull: 2 },
    popup: true,
    damage: weapon === 'ATGM' ? 95 : 18,
    projectileSpeed: weapon === 'ATGM' ? 260 : 780,
    maxRange: 520,
  });
  target.basePosition.set(x, baseY, z);
  target.popup = true;
  target.displayTimer = 3 + Math.random() * 4;
  group.position.y = baseY - 1.3;
  addTarget(root, targets, colliders, target, null);
}

function createDestructible(root, destructibles, colliders, {
  name,
  position,
  size,
  color = 0x777569,
  health = 220,
  score = 90,
  terrainHeight,
}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.06 }),
  );
  mesh.position.copy(position);
  mesh.position.y = terrainHeight(position.x, position.z) + size.y * 0.5;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const collider = makeCollider(size, new THREE.Vector3(0, 0, 0), 'structure');
  collider.position.copy(mesh.position);
  root.add(mesh);
  root.add(collider);
  freezeLocalMatrices(mesh);
  collider.updateMatrix();
  collider.matrixAutoUpdate = false;
  const destructible = new Destructible({ name, mesh, collider, health, score, position: mesh.position });
  colliders.push(collider);
  destructibles.push(destructible);
  return destructible;
}

function createAirTarget(root, targets, colliders, { terrainHeight }) {
  const group = new THREE.Group();
  group.name = 'air-threat';
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 3.4, 6).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x555b50, roughness: 0.6, metalness: 0.6 }),
  );
  body.castShadow = true;
  group.add(body);
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.08, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x3a4136, roughness: 0.62, metalness: 0.45 }),
  );
  wing.position.z = 0.4;
  group.add(wing);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x30372e, roughness: 0.7, metalness: 0.4 }),
  );
  tail.position.z = 1.45;
  group.add(tail);
  const center = new THREE.Vector3(0, 25, -250);
  group.position.copy(center);
  const collider = makeCollider(new THREE.Vector3(5.5, 1.2, 4), new THREE.Vector3(0, 0, 0), 'air');
  group.add(collider);
  root.add(group);
  const target = new RangeTarget({
    name: 'AIR THREAT',
    kind: 'air',
    group,
    colliders: [collider],
    centerOffset: new THREE.Vector3(0, 0, 0),
    health: 40,
    score: 1200,
    respawnDelay: 24,
    hideOnDeath: true,
    hostile: true,
    weapon: 'STRAFE',
    armor: { air: 6, hull: 6 },
    damage: 22,
    projectileSpeed: 900,
    maxRange: 900,
  });
  target.pathTime = 0;
  target.airCenter = center;
  addTarget(root, targets, colliders, target, null);
  return target;
}

export function createRange({
  scene,
  vehicleScene,
  terrainHeight,
  onEnemyFire,
  onArtillery,
  onSmoke,
  onEvent,
  environment,
  rngSeed = 0x4a71,
}) {
  const root = new THREE.Group();
  root.name = 'gunnery-range';
  scene.add(root);
  const targets = [];
  const colliders = [];
  const destructibles = [];
  const context = {
    player: null,
    playerVelocity: null,
    camera: null,
    terrainHeight,
    onEnemyFire,
    onArtillery,
    onSmoke,
    onEvent,
  };

  createBarrelCluster(root, targets, colliders, { x: -8, z: -132, distance: 132, terrainHeight });
  createSteelTarget(root, targets, colliders, { x: 10, z: -240, distance: 240, terrainHeight, path: { type: 'cross', min: -8, max: 8, speed: 0.11 } });
  createSteelTarget(root, targets, colliders, { x: -12, z: -330, distance: 330, terrainHeight });
  createTargetTank(root, targets, colliders, { vehicleScene, x: 0, z: -392, distance: 392, terrainHeight });
  createSteelTarget(root, targets, colliders, { x: 14, z: -462, distance: 462, terrainHeight });

  // Additional live gunnery problems. They stay inside the existing lane and
  // do not introduce a mode-select screen.
  createSteelTarget(root, targets, colliders, { x: -19, z: -205, distance: 205, terrainHeight, path: { type: 'cross', min: -5, max: 5, speed: 0.16 } });
  createSteelTarget(root, targets, colliders, { x: 22, z: -292, distance: 292, terrainHeight, path: { type: 'advance', min: -6, max: 8, speed: 0.12 } });
  createSteelTarget(root, targets, colliders, { x: 21, z: -190, distance: 190, terrainHeight, friendly: true, label: 'NO-FIRE 190M' });
  createInfantry(root, targets, colliders, { x: -27, z: -176, distance: 176, terrainHeight, weapon: 'MG' });
  createInfantry(root, targets, colliders, { x: 29, z: -248, distance: 248, terrainHeight, weapon: 'ATGM' });
  createInfantry(root, targets, colliders, { x: -35, z: -356, distance: 356, terrainHeight, weapon: 'MG' });
  createEnemyTank(root, targets, colliders, { x: 42, z: -414, distance: 414, terrainHeight });
  createEnemyTank(root, targets, colliders, { x: -48, z: -438, distance: 438, terrainHeight });
  const observer = createInfantry(root, targets, colliders, { x: 38, z: -338, distance: 338, terrainHeight, weapon: 'ARTILLERY' });
  if (observer) {
    observer.hostile = false;
    observer.fireTimer = 19;
  }

  // Static structures are shootable but are not counted as gunnery targets.
  createDestructible(root, destructibles, colliders, {
    name: 'CONCRETE WALL',
    position: new THREE.Vector3(-28, 0, -165),
    size: new THREE.Vector3(8, 2.4, 0.8),
    color: 0x8d8e80,
    health: 340,
    terrainHeight,
  });
  createDestructible(root, destructibles, colliders, {
    name: 'BUNKER',
    position: new THREE.Vector3(34, 0, -300),
    size: new THREE.Vector3(7, 3.1, 4.2),
    color: 0x65695e,
    health: 700,
    score: 260,
    terrainHeight,
  });
  createDestructible(root, destructibles, colliders, {
    name: 'VEHICLE HULK',
    position: new THREE.Vector3(-39, 0, -288),
    size: new THREE.Vector3(3.2, 1.8, 6.4),
    color: 0x4b4739,
    health: 420,
    score: 160,
    terrainHeight,
  });
  createDestructible(root, destructibles, colliders, {
    name: 'BERM',
    position: new THREE.Vector3(4, 0, -116),
    size: new THREE.Vector3(6, 1.2, 2.2),
    color: 0x76684d,
    health: 260,
    terrainHeight,
  });
  createAirTarget(root, targets, colliders, { terrainHeight });

  const createDistanceSign = (x, z, distance) => {
    const group = new THREE.Group();
    group.position.set(x, terrainHeight(x, z), z);
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
    group.updateMatrix();
    group.matrixAutoUpdate = false;
    freezeLocalMatrices(group);
    root.add(group);
  };
  createDistanceSign(24, -110, 100);
  createDistanceSign(24, -210, 200);
  createDistanceSign(24, -310, 300);
  createDistanceSign(24, -410, 400);

  let wave = 1;
  let waveTimer = 0;
  let randomSeed = 0x4a71;
  const random = () => {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  };

  return {
    root,
    targets,
    colliders,
    destructibles,
    get wave() {
      return wave;
    },
    get hostiles() {
      return targets.filter((target) => target.hostile && target.alive);
    },
    randomize() {
      for (const target of targets) {
        if (target.kind === 'air' || target.kind === 'tank') continue;
        const x = (random() - 0.5) * 10;
        const z = (random() - 0.5) * 7;
        target.basePosition.x += x;
        target.basePosition.z += z;
        target.origin.copy(target.basePosition);
        target.group.position.copy(target.basePosition);
      }
    },
    reset() {
      wave = 1;
      for (const target of targets) target.reset();
      for (const destructible of destructibles) destructible.reset();
    },
    setWave(value) {
      wave = Math.max(1, Math.floor(value));
      waveTimer = 0;
    },
    update(dt, player = null, playerVelocity = null, camera = null) {
      context.player = player;
      context.playerVelocity = playerVelocity;
      context.camera = camera;
      for (const target of targets) target.update(dt, context);
      for (const destructible of destructibles) destructible.update?.(dt);
      waveTimer += dt;
      if (waveTimer > 55) {
        waveTimer = 0;
        wave++;
        if (wave % 2 === 0) this.randomize();
        onEvent?.('wave', wave);
      }
      if (player && environment) {
        for (const target of targets) {
          if (!target.alive || !target.burning) continue;
          if (Math.random() < dt * 4) {
            target.getAimPoint(_aim);
            onSmoke?.(_aim.clone(), 4.5, 2.6, target);
          }
        }
      }
    },
    getState() {
      return targets.map((target) => target.getState());
    },
    getStructureState() {
      return destructibles.map((destructible) => destructible.getState());
    },
    getTargetForObject(object) {
      return object?.userData?.target || object?.userData?.destructible || null;
    },
    callSupport(point) {
      onArtillery?.(point, 3.2, { name: 'WINGMAN FIRE' });
    },
    setThreat(level) {
      const accuracy = clamp(level, 0, 3);
      for (const target of targets) {
        if (!target.hostile) continue;
        target.fireTimer = Math.max(1.2, target.fireTimer / (1 + accuracy * 0.18));
      }
    },
  };
}
