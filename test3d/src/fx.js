import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const _position = new THREE.Vector3();
const _velocity = new THREE.Vector3();
const _spread = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _tilt = new THREE.Quaternion();
const _yaw = new THREE.Quaternion();
const _matrix = new THREE.Matrix4();
const _scale = new THREE.Vector3();
const _random = (min, max) => min + Math.random() * (max - min);

function canvasTexture(size, draw, colorSpace = THREE.SRGBColorSpace) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function makeSoftTexture() {
  return canvasTexture(128, (context, size) => {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.28, 'rgba(255,255,255,0.62)');
    gradient.addColorStop(0.65, 'rgba(255,255,255,0.18)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
}

function makeFlashTexture() {
  return canvasTexture(256, (context, size) => {
    context.translate(size / 2, size / 2);
    for (let i = 0; i < 10; i++) {
      context.rotate(Math.PI / 5);
      const gradient = context.createLinearGradient(0, 0, 0, -size * 0.46);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.2, 'rgba(255,240,185,0.96)');
      gradient.addColorStop(1, 'rgba(255,145,40,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(-size * 0.035, 0);
      context.lineTo(0, -size * 0.46);
      context.lineTo(size * 0.035, 0);
      context.closePath();
      context.fill();
    }
    const core = context.createRadialGradient(0, 0, 0, 0, 0, size * 0.28);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.3, 'rgba(255,241,190,0.98)');
    core.addColorStop(1, 'rgba(255,126,20,0)');
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, size * 0.28, 0, Math.PI * 2);
    context.fill();
  });
}

function makeSparkTexture() {
  return canvasTexture(64, (context, size) => {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,225,145,1)');
    gradient.addColorStop(1, 'rgba(255,110,20,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
}

function makeScorchTexture() {
  return canvasTexture(256, (context, size) => {
    context.clearRect(0, 0, size, size);
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(8,7,5,0.86)');
    gradient.addColorStop(0.35, 'rgba(17,13,9,0.66)');
    gradient.addColorStop(0.7, 'rgba(35,27,18,0.24)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * size * 0.34;
      const radius = 8 + Math.random() * 28;
      const x = size / 2 + Math.cos(angle) * distance;
      const y = size / 2 + Math.sin(angle) * distance;
      const blot = context.createRadialGradient(x, y, 0, x, y, radius);
      blot.addColorStop(0, 'rgba(7,6,4,0.26)');
      blot.addColorStop(1, 'rgba(7,6,4,0)');
      context.fillStyle = blot;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function makeTrackTexture() {
  return canvasTexture(128, (context, size) => {
    context.clearRect(0, 0, size, size);
    context.fillStyle = 'rgba(23,18,13,0.42)';
    context.fillRect(size * 0.27, 0, size * 0.46, size);
    context.fillStyle = 'rgba(11,9,7,0.38)';
    for (let y = 2; y < size; y += 16) {
      context.fillRect(size * 0.24, y, size * 0.52, 6);
    }
    context.fillStyle = 'rgba(80,65,45,0.14)';
    for (let y = 8; y < size; y += 19) {
      context.fillRect(size * 0.18, y, size * 0.64, 2);
    }
  });
}

class ParticlePool {
  constructor(scene, { count, texture, blending, renderOrder = 3 }) {
    this.count = count;
    this.cursor = 0;
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.baseOpacity = new Float32Array(count);
    this.opacity = new Float32Array(count);
    this.size = new Float32Array(count);
    this.growth = new Float32Array(count);
    this.gravity = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(this.opacity, 1).setUsage(THREE.DynamicDrawUsage));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uHeight: { value: window.innerHeight },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aOpacity;
        attribute vec3 aColor;
        uniform float uHeight;
        varying float vOpacity;
        varying vec3 vColor;
        void main() {
          vColor = aColor;
          vOpacity = aOpacity;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uHeight / max(1.0, -mv.z), 1.0, 180.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vOpacity;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          float alpha = tex.a * vOpacity;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(vColor * tex.rgb, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    scene.add(this.points);
  }

  setHeight(height) {
    this.points.material.uniforms.uHeight.value = height;
  }

  spawn({
    position,
    velocity = _velocity.set(0, 0, 0),
    life = 1,
    size = 0.5,
    growth = 0,
    gravity = 0,
    drag = 0,
    color = 0xffffff,
    opacity = 1,
  }) {
    const index = this.cursor++ % this.count;
    const offset = index * 3;
    this.positions[offset] = position.x;
    this.positions[offset + 1] = position.y;
    this.positions[offset + 2] = position.z;
    this.velocities[offset] = velocity.x;
    this.velocities[offset + 1] = velocity.y;
    this.velocities[offset + 2] = velocity.z;
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    this.colors[offset] = c.r;
    this.colors[offset + 1] = c.g;
    this.colors[offset + 2] = c.b;
    this.life[index] = life;
    this.maxLife[index] = life;
    this.baseOpacity[index] = opacity;
    this.opacity[index] = opacity;
    this.size[index] = size;
    this.growth[index] = growth;
    this.gravity[index] = gravity;
    this.drag[index] = drag;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      dirty = true;
      this.life[i] -= dt;
      const index = i * 3;
      if (this.life[i] <= 0) {
        this.opacity[i] = 0;
        continue;
      }
      const drag = Math.exp(-this.drag[i] * dt);
      this.velocities[index] *= drag;
      this.velocities[index + 2] *= drag;
      this.velocities[index + 1] = this.velocities[index + 1] * drag - this.gravity[i] * dt;
      this.positions[index] += this.velocities[index] * dt;
      this.positions[index + 1] += this.velocities[index + 1] * dt;
      this.positions[index + 2] += this.velocities[index + 2] * dt;
      this.size[i] += this.growth[i] * dt;
      const age = this.maxLife[i] - this.life[i];
      const fadeIn = Math.min(1, age * 18);
      const fadeOut = Math.min(1, this.life[i] / (this.maxLife[i] * 0.55));
      this.opacity[i] = this.baseOpacity[i] * fadeIn * fadeOut;
    }
    if (!dirty) return;
    const geometry = this.points.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aColor.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
    geometry.attributes.aOpacity.needsUpdate = true;
  }
}

class DecalLayer {
  constructor(scene, texture, count, opacity = 1) {
    this.count = count;
    this.cursor = 0;
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        toneMapped: false,
      }),
      count,
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  add(position, normal = UP, yaw = 0, width = 1, length = 1) {
    _tilt.setFromUnitVectors(FORWARD, normal);
    _yaw.setFromAxisAngle(normal, yaw);
    _quaternion.copy(_yaw).multiply(_tilt);
    _scale.set(width, length, 1);
    _matrix.compose(position, _quaternion, _scale);
    this.mesh.setMatrixAt(this.cursor++ % this.count, _matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = true;
  }
}

class Shockwaves {
  constructor(scene, count = 8) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffc17a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), material);
      mesh.visible = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      this.items.push({ mesh, life: 0, maxLife: 0, radius: 1 });
    }
  }

  spawn(position, normal, radius = 2, life = 0.28) {
    const item = this.items.find((entry) => entry.life <= 0) || this.items[0];
    item.life = life;
    item.maxLife = life;
    item.radius = radius;
    item.mesh.visible = true;
    item.mesh.position.copy(position).addScaledVector(normal, 0.04);
    item.mesh.quaternion.setFromUnitVectors(FORWARD, normal);
    item.mesh.scale.setScalar(radius * 0.2);
    item.mesh.material.opacity = 0.6;
  }

  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.mesh.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      item.mesh.scale.setScalar(item.radius * (0.2 + t * 1.4));
      item.mesh.material.opacity = (1 - t) * 0.52;
    }
  }
}

class FlashSprites {
  constructor(scene, count = 8) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      const material = new THREE.SpriteMaterial({
        map: makeFlashTexture(),
        color: 0xffd39a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 5;
      scene.add(sprite);
      this.items.push({ sprite, life: 0, maxLife: 0, baseScale: 1, baseOpacity: 1 });
    }
  }

  spawn(position, scale, life = 0.075, color = 0xffd39a) {
    const item = this.items.find((entry) => entry.life <= 0) || this.items[0];
    item.life = life;
    item.maxLife = life;
    item.baseScale = scale;
    item.baseOpacity = 0.95;
    item.sprite.visible = true;
    item.sprite.position.copy(position);
    item.sprite.material.color.set(color);
    item.sprite.material.rotation = Math.random() * Math.PI * 2;
    item.sprite.material.opacity = 0.95;
    item.sprite.scale.setScalar(scale);
  }

  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.sprite.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      item.sprite.material.opacity = item.baseOpacity * (1 - t);
      item.sprite.scale.setScalar(item.baseScale * (0.55 + t * 0.9));
    }
  }
}

class LaserBeams {
  constructor(scene, count = 4) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const material = new THREE.LineBasicMaterial({
        color: 0xffd28a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const line = new THREE.Line(geometry, material);
      line.visible = false;
      line.renderOrder = 6;
      scene.add(line);
      this.items.push({ line, life: 0, maxLife: 0 });
    }
  }

  spawn(from, to) {
    const item = this.items.find((entry) => entry.life <= 0) || this.items[0];
    const positions = item.line.geometry.attributes.position.array;
    positions[0] = from.x;
    positions[1] = from.y;
    positions[2] = from.z;
    positions[3] = to.x;
    positions[4] = to.y;
    positions[5] = to.z;
    item.line.geometry.attributes.position.needsUpdate = true;
    item.line.geometry.computeBoundingSphere();
    item.line.visible = true;
    item.life = 0.16;
    item.maxLife = 0.16;
    item.line.material.opacity = 0.9;
  }

  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.line.visible = false;
        continue;
      }
      item.line.material.opacity = (item.life / item.maxLife) * 0.9;
    }
  }
}

class PulseLights {
  constructor(scene, count = 5) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffa45e, 0, 34, 2);
      light.visible = false;
      scene.add(light);
      this.items.push({ light, life: 0, maxLife: 0, intensity: 0 });
    }
  }

  pulse(position, intensity, distance, life, color = 0xffa45e) {
    const item = this.items.find((entry) => entry.life <= 0) || this.items[0];
    item.life = life;
    item.maxLife = life;
    item.intensity = intensity;
    item.light.visible = true;
    item.light.position.copy(position);
    item.light.color.set(color);
    item.light.intensity = intensity;
    item.light.distance = distance;
  }

  update(dt) {
    for (const item of this.items) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.light.visible = false;
        continue;
      }
      const t = item.life / item.maxLife;
      item.light.intensity = item.intensity * t * t;
    }
  }
}

export function createFx(scene, renderer) {
  const soft = makeSoftTexture();
  const spark = makeSparkTexture();
  const smoke = new ParticlePool(scene, { count: 420, texture: soft, blending: THREE.NormalBlending });
  const dust = new ParticlePool(scene, { count: 360, texture: soft, blending: THREE.NormalBlending });
  const sparks = new ParticlePool(scene, { count: 320, texture: spark, blending: THREE.AdditiveBlending });
  const fire = new ParticlePool(scene, { count: 260, texture: soft, blending: THREE.AdditiveBlending });
  const shockwaves = new Shockwaves(scene);
  const lasers = new LaserBeams(scene);
  const flashes = new FlashSprites(scene);
  const lights = new PulseLights(scene);
  const scorch = new DecalLayer(scene, makeScorchTexture(), 40, 0.88);
  const tracks = new DecalLayer(scene, makeTrackTexture(), 220, 0.72);
  const pools = [smoke, dust, sparks, fire];
  const size = new THREE.Vector2();

  const resize = () => {
    renderer.getDrawingBufferSize(size);
    for (const pool of pools) pool.setHeight(size.y);
  };
  resize();

  const randomVector = (scale) => {
    _spread.set(_random(-1, 1), _random(-0.2, 1), _random(-1, 1)).normalize().multiplyScalar(scale);
    return _spread;
  };

  const emitMuzzle = (position, direction) => {
    flashes.spawn(_position.copy(position).addScaledVector(direction, 0.18), _random(3.8, 5.6), 0.08, 0xffe0a2);
    flashes.spawn(position, _random(2.2, 3.3), 0.055, 0xff9b45);

    for (let i = 0; i < 11; i++) {
      const spread = randomVector(_random(0.7, 2.6));
      smoke.spawn({
        position: _position.copy(position).addScaledVector(spread, _random(0.1, 0.45)),
        velocity: _velocity.copy(direction).multiplyScalar(_random(1.8, 4.5)).add(spread),
        life: _random(1.1, 2.2),
        size: _random(0.45, 1.0),
        growth: _random(0.7, 1.5),
        gravity: -0.06,
        drag: 1.4,
        color: i % 3 === 0 ? 0x7a6a51 : 0x4d4b40,
        opacity: _random(0.16, 0.32),
      });
    }

    for (let i = 0; i < 9; i++) {
      const spread = randomVector(_random(0.5, 2.5));
      sparks.spawn({
        position: _position.copy(position).addScaledVector(direction, _random(0.0, 0.6)),
        velocity: _velocity.copy(direction).multiplyScalar(_random(8, 17)).add(spread),
        life: _random(0.2, 0.52),
        size: _random(0.045, 0.11),
        gravity: 8.5,
        drag: 0.8,
        color: 0xffc06b,
        opacity: 1,
      });
    }

    shockwaves.spawn(position, direction, 1.35, 0.18);
    lights.pulse(position, 55, 36, 0.095, 0xffb36a);

    if (position.y < 3.2) {
      const ground = _position.set(position.x, position.y - 1.35, position.z);
      shockwaves.spawn(ground, UP, 2.0, 0.35);
    }
  };

  const emitImpact = (position, normal, kind, scale = 1) => {
    const isExplosion = kind === 'explosion';
    const isTank = kind === 'tank';
    const isMetal = kind === 'metal';
    const fireCount = isExplosion ? 34 : isTank ? 18 : isMetal ? 7 : 3;
    const smokeCount = isExplosion ? 26 : isTank ? 14 : isMetal ? 6 : 12;
    const sparkCount = isExplosion ? 38 : isTank ? 24 : isMetal ? 28 : 9;

    for (let i = 0; i < fireCount; i++) {
      const spread = randomVector(_random(1.2, 5.2) * scale);
      fire.spawn({
        position: _position.copy(position).addScaledVector(spread, 0.12),
        velocity: _velocity.copy(spread).addScaledVector(normal, _random(0.5, 4.5)),
        life: _random(0.22, 0.62),
        size: _random(0.35, 1.05) * scale,
        growth: _random(0.4, 1.7),
        gravity: -1.1,
        drag: 1.8,
        color: i % 4 === 0 ? 0xfff1b2 : i % 3 === 0 ? 0xff8b2d : 0xff4b16,
        opacity: _random(0.55, 0.95),
      });
    }

    for (let i = 0; i < smokeCount; i++) {
      const spread = randomVector(_random(0.8, 4.0) * scale);
      smoke.spawn({
        position: _position.copy(position).addScaledVector(spread, _random(0.2, 0.8)),
        velocity: _velocity.copy(spread).addScaledVector(normal, _random(0.4, 3.0)),
        life: _random(1.2, 3.0),
        size: _random(0.55, 1.4) * scale,
        growth: _random(0.8, 2.0),
        gravity: -0.18,
        drag: 1.1,
        color: i % 5 === 0 ? 0x8d7c61 : i % 3 === 0 ? 0x5e584b : 0x35342e,
        opacity: _random(0.16, 0.36),
      });
    }

    for (let i = 0; i < sparkCount; i++) {
      const spread = randomVector(_random(2.5, 10) * scale);
      sparks.spawn({
        position: _position.copy(position).addScaledVector(spread, 0.05),
        velocity: _velocity.copy(spread).addScaledVector(normal, _random(1, 7)),
        life: _random(0.25, 0.9),
        size: _random(0.04, 0.13),
        gravity: 11,
        drag: 0.5,
        color: i % 3 === 0 ? 0xffe4a3 : 0xff8e38,
        opacity: 1,
      });
    }

    shockwaves.spawn(position, isMetal ? normal : UP, (isExplosion ? 4.5 : isTank ? 2.4 : isMetal ? 1.2 : 1.8) * scale, isExplosion ? 0.45 : 0.3);
    lights.pulse(position, isExplosion ? 120 : isTank ? 65 : 25, isExplosion ? 55 : 24, isExplosion ? 0.45 : 0.22, 0xff8c3f);
    if (kind === 'ground') {
      scorch.add(_position.copy(position).addScaledVector(normal, 0.035), normal, Math.random() * Math.PI * 2, 2.1 * scale, 2.1 * scale);
    }
  };

  return {
    resize,
    update(dt) {
      for (const pool of pools) pool.update(dt);
      shockwaves.update(dt);
      lasers.update(dt);
      flashes.update(dt);
      lights.update(dt);
    },
    muzzle: emitMuzzle,
    impact: emitImpact,
    laserBeam(from, to) {
      lasers.spawn(from, to);
      flashes.spawn(_position.copy(to), 0.5, 0.09, 0xffdda0);
    },
    explosion(position, scale = 1.6) {
      emitImpact(position, UP, 'explosion', scale);
      lights.pulse(position, 180 * scale, 70 * scale, 0.6, 0xff6b25);
    },
    trackDust(position, motion, strength = 1) {
      const count = Math.min(3, Math.max(1, Math.floor(Math.abs(strength) * 3)));
      for (let i = 0; i < count; i++) {
        dust.spawn({
          position: _position.copy(position).add(new THREE.Vector3(_random(-0.3, 0.3), _random(0.05, 0.3), _random(-0.3, 0.3))),
          velocity: _velocity.copy(motion).multiplyScalar(_random(0.1, 0.6)).add(new THREE.Vector3(_random(-0.5, 0.5), _random(0.25, 1.0), _random(-0.5, 0.5))),
          life: _random(0.85, 1.8),
          size: _random(0.35, 0.75),
          growth: _random(0.5, 1.1),
          gravity: 0.08,
          drag: 1.2,
          color: i % 2 ? 0x8f8069 : 0x6c6253,
          opacity: _random(0.08, 0.18),
        });
      }
    },
    exhaust(position, speed) {
      if (Math.random() > 0.48 + Math.min(0.4, Math.abs(speed) * 0.04)) return;
      smoke.spawn({
        position: _position.copy(position).add(new THREE.Vector3(_random(-0.25, 0.25), _random(0.0, 0.2), _random(-0.25, 0.25))),
        velocity: _velocity.set(_random(-0.15, 0.15), _random(0.35, 1.0), _random(-0.15, 0.15)),
        life: _random(1.0, 2.2),
        size: _random(0.22, 0.5),
        growth: _random(0.2, 0.7),
        gravity: -0.22,
        drag: 0.7,
        color: 0x3e3d35,
        opacity: _random(0.06, 0.13),
      });
    },
    trackMark(position, normal, yaw) {
      tracks.add(position, normal, yaw, 0.56, 1.18);
    },
    muzzleLightPosition: new THREE.Vector3(),
  };
}
