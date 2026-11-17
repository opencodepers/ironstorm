import * as THREE from 'three';

export const GRAVITY = 9.81;

export function createRng(seed = 0x72a1) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const WEATHER = {
  clear: {
    label: 'CLEAR',
    fog: 0.00105,
    fogColor: 0x8b9485,
    windSpeed: 2.4,
    windAngle: 118,
    tempC: 18,
    wet: 0,
    rain: 0,
    snow: 0,
    dust: 0,
    cloud: 0.14,
    turbidity: 3,
    exposure: 0.8,
    visibility: 1,
  },
  overcast: {
    label: 'OVERCAST',
    fog: 0.00145,
    fogColor: 0x7c8780,
    windSpeed: 5.2,
    windAngle: 152,
    tempC: 11,
    wet: 0.22,
    rain: 0,
    snow: 0,
    dust: 0,
    cloud: 0.62,
    turbidity: 5.6,
    exposure: 0.72,
    visibility: 0.86,
  },
  rain: {
    label: 'RAIN',
    fog: 0.0021,
    fogColor: 0x6d7a78,
    windSpeed: 7.8,
    windAngle: 164,
    tempC: 8,
    wet: 0.85,
    rain: 0.9,
    snow: 0,
    dust: 0,
    cloud: 0.88,
    turbidity: 8,
    exposure: 0.62,
    visibility: 0.62,
  },
  snow: {
    label: 'SNOW',
    fog: 0.0019,
    fogColor: 0xaab4af,
    windSpeed: 4.1,
    windAngle: 132,
    tempC: -6,
    wet: 0.35,
    rain: 0,
    snow: 0.92,
    dust: 0,
    cloud: 0.74,
    turbidity: 4.2,
    exposure: 0.88,
    visibility: 0.7,
  },
  sand: {
    label: 'SANDSTORM',
    fog: 0.0032,
    fogColor: 0x9c8562,
    windSpeed: 14,
    windAngle: 96,
    tempC: 34,
    wet: 0,
    rain: 0,
    snow: 0,
    dust: 0.95,
    cloud: 0.4,
    turbidity: 9,
    exposure: 0.76,
    visibility: 0.38,
  },
};

const WEATHER_ORDER = ['clear', 'overcast', 'rain', 'snow', 'sand'];

function makeWeatherPoints(scene, count, size, color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  return points;
}

function makeRain(scene, count = 1300) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 6);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xb9c8ca,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  scene.add(lines);
  return { lines, positions, count, drops: new Float32Array(count * 3) };
}

export function createEnvironment(scene, {
  sky,
  sunLight,
  terrainMaterial,
  hemisphere,
  renderer,
} = {}) {
  const random = createRng(0x51a7);
  const state = {
    mode: 'clear',
    label: 'CLEAR',
    wind: new THREE.Vector3(),
    windSpeed: WEATHER.clear.windSpeed,
    windAngle: WEATHER.clear.windAngle,
    tempC: WEATHER.clear.tempC,
    wet: 0,
    rain: 0,
    snow: 0,
    dust: 0,
    visibility: 1,
    fog: WEATHER.clear.fog,
    fogColor: WEATHER.clear.fogColor,
    cloud: WEATHER.clear.cloud,
    turbidity: WEATHER.clear.turbidity,
    timeOfDay: 13.2,
    exposure: WEATHER.clear.exposure,
    sunDirection: new THREE.Vector3(),
    target: { ...WEATHER.clear },
    smoke: [],
    lightning: 0,
  };

  const rain = makeRain(scene);
  const snow = makeWeatherPoints(scene, 900, 0.09, 0xdfe8e4, 0.9);
  const dust = makeWeatherPoints(scene, 620, 0.25, 0xc3a36f, 0.24);
  const smokeSprites = [];

  for (let i = 0; i < rain.count; i++) {
    const offset = i * 3;
    rain.drops[offset] = (random() - 0.5) * 120;
    rain.drops[offset + 1] = random() * 48;
    rain.drops[offset + 2] = (random() - 0.5) * 120;
  }
  const snowPositions = snow.geometry.attributes.position.array;
  for (let i = 0; i < snowPositions.length; i += 3) {
    snowPositions[i] = (random() - 0.5) * 130;
    snowPositions[i + 1] = random() * 46;
    snowPositions[i + 2] = (random() - 0.5) * 130;
  }
  const dustPositions = dust.geometry.attributes.position.array;
  for (let i = 0; i < dustPositions.length; i += 3) {
    dustPositions[i] = (random() - 0.5) * 170;
    dustPositions[i + 1] = random() * 25;
    dustPositions[i + 2] = (random() - 0.5) * 170;
  }

  let weatherTimer = 72;
  const tmpDirection = new THREE.Vector3();
  let lastSkyUpdate = -1;
  let focus = new THREE.Vector3();

  const applySky = () => {
    if (sky?.material?.uniforms) {
      const uniforms = sky.material.uniforms;
      uniforms.turbidity.value = state.turbidity;
      uniforms.cloudCoverage.value = state.cloud;
      uniforms.cloudDensity.value = 0.16 + state.cloud * 0.38;
      uniforms.showSunDisc.value = state.mode === 'clear' ? 0.34 : 0.08;
    }
    if (sunLight) {
      sunLight.intensity = state.mode === 'clear' ? 2.75 : state.mode === 'rain' ? 1.1 : state.mode === 'snow' ? 1.8 : 1.45;
      sunLight.color.set(state.mode === 'sand' ? 0xffc183 : state.mode === 'snow' ? 0xdbe8f4 : 0xffd8ad);
    }
    if (hemisphere) hemisphere.intensity = 0.18 + state.visibility * 0.12;
    if (terrainMaterial?.color) {
      terrainMaterial.color.setRGB(
        1 - state.wet * 0.18 + state.snow * 0.18,
        1 - state.wet * 0.14 + state.snow * 0.16,
        1 - state.wet * 0.08 + state.snow * 0.12,
      );
      terrainMaterial.roughness = state.wet > 0.3 ? 0.86 : 1;
      terrainMaterial.envMapIntensity = 0.26 + state.wet * 0.2;
    }
    if (scene.fog) {
      scene.fog.density = state.fog;
      scene.fog.color.set(state.fogColor);
    }
    if (renderer) renderer.toneMappingExposure = state.exposure;
  };

  const setMode = (mode, announce = true) => {
    if (!WEATHER[mode]) return;
    state.mode = mode;
    state.target = { ...WEATHER[mode] };
    state.label = WEATHER[mode].label;
    weatherTimer = 84;
    applySky();
    if (announce) {
      document.documentElement.style.setProperty('--weather', WEATHER[mode].label);
    }
  };

  const cycle = () => {
    const index = WEATHER_ORDER.indexOf(state.mode);
    setMode(WEATHER_ORDER[(index + 1) % WEATHER_ORDER.length]);
    return state.label;
  };

  const addSmoke = (position, radius = 9, life = 11) => {
    const smoke = {
      position: position.clone(),
      radius,
      life,
      maxLife: life,
    };
    state.smoke.push(smoke);
    if (state.smoke.length > 24) state.smoke.shift();
    return smoke;
  };

  const smokeAt = (point) => {
    let density = 0;
    for (const puff of state.smoke) {
      const distance = puff.position.distanceTo(point);
      if (distance < puff.radius) {
        density = Math.max(density, 1 - distance / puff.radius);
      }
    }
    return Math.max(density, (state.rain * 0.035 + state.snow * 0.02 + state.dust * 0.08) * state.visibility);
  };

  const updateParticles = (dt) => {
    const windX = state.wind.x;
    const windZ = state.wind.z;
    const center = focus;

    rain.lines.visible = state.rain > 0.02;
    rain.lines.material.opacity = 0.28 * state.rain;
    if (rain.lines.visible) {
      const positions = rain.positions;
      const count = rain.count;
      for (let i = 0; i < count; i++) {
        const index = i * 3;
        rain.drops[index] += windX * dt * 0.35;
        rain.drops[index + 1] -= (26 + (i % 7) * 2.9) * dt;
        rain.drops[index + 2] += windZ * dt * 0.35;
        if (rain.drops[index + 1] < -4) {
          rain.drops[index] = (random() - 0.5) * 125;
          rain.drops[index + 1] = 38 + random() * 16;
          rain.drops[index + 2] = (random() - 0.5) * 125;
        }
        const offset = i * 6;
        positions[offset] = center.x + rain.drops[index];
        positions[offset + 1] = center.y + rain.drops[index + 1];
        positions[offset + 2] = center.z + rain.drops[index + 2];
        positions[offset + 3] = positions[offset] - windX * 0.08;
        positions[offset + 4] = positions[offset + 1] - 1.4;
        positions[offset + 5] = positions[offset + 2] - windZ * 0.08;
      }
      rain.lines.geometry.attributes.position.needsUpdate = true;
    }

    snow.visible = state.snow > 0.02;
    snow.material.opacity = 0.82 * state.snow;
    if (snow.visible) {
      const positions = snow.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += windX * dt * 0.7;
        positions[i + 1] -= (1.2 + (i % 9) * 0.11) * dt;
        positions[i + 2] += windZ * dt * 0.7;
        if (positions[i + 1] < -5) {
          positions[i] = (random() - 0.5) * 130;
          positions[i + 1] = 28 + random() * 20;
          positions[i + 2] = (random() - 0.5) * 130;
        }
      }
      snow.position.set(center.x, center.y, center.z);
      snow.geometry.attributes.position.needsUpdate = true;
    }

    dust.visible = state.dust > 0.02;
    dust.material.opacity = 0.18 * state.dust;
    if (dust.visible) {
      const positions = dust.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += windX * dt * 1.4;
        positions[i + 1] += Math.sin((positions[i] + positions[i + 2]) * 0.04) * dt * 0.25;
        positions[i + 2] += windZ * dt * 1.4;
        if (positions[i] > 85) positions[i] = -85;
        if (positions[i] < -85) positions[i] = 85;
        if (positions[i + 2] > 85) positions[i + 2] = -85;
        if (positions[i + 2] < -85) positions[i + 2] = 85;
      }
      dust.position.set(center.x, center.y, center.z);
      dust.geometry.attributes.position.needsUpdate = true;
    }
  };

  const update = (dt, position = null) => {
    if (position) focus.copy(position);
    weatherTimer -= dt;
    if (weatherTimer <= 0) {
      setMode(WEATHER_ORDER[(WEATHER_ORDER.indexOf(state.mode) + 1) % WEATHER_ORDER.length], false);
    }

    const target = state.target;
    const blend = 1 - Math.exp(-0.8 * dt);
    for (const key of ['wet', 'rain', 'snow', 'dust', 'visibility', 'fog', 'tempC', 'cloud', 'turbidity', 'exposure', 'windSpeed', 'windAngle']) {
      state[key] = THREE.MathUtils.lerp(state[key], target[key] ?? state[key], blend);
    }
    state.fogColor = target.fogColor;
    state.fog = THREE.MathUtils.lerp(state.fog, target.fog, blend);
    state.timeOfDay += dt * 0.0025;
    if (state.timeOfDay >= 24) state.timeOfDay -= 24;
    const hourAngle = ((state.timeOfDay - 6) / 12) * Math.PI;
    const elevation = Math.sin(hourAngle) * 0.9 + 0.08;
    const azimuth = (state.timeOfDay / 24) * Math.PI * 2 + 1.2;
    tmpDirection.set(
      Math.cos(azimuth) * Math.cos(elevation),
      Math.max(0.08, Math.sin(elevation)),
      Math.sin(azimuth) * Math.cos(elevation),
    ).normalize();
    state.sunDirection.copy(tmpDirection);
    if (sky?.material?.uniforms?.sunPosition) {
      sky.material.uniforms.sunPosition.value.copy(tmpDirection);
    }
    const angle = THREE.MathUtils.degToRad(state.windAngle);
    const pulse = 0.72 + 0.28 * Math.sin(state.timeOfDay * 3.1 + state.tempC);
    state.wind.set(Math.cos(angle) * state.windSpeed * pulse, 0, Math.sin(angle) * state.windSpeed * pulse);
    state.label = target.label;
    state.cloud = THREE.MathUtils.lerp(state.cloud, target.cloud, blend);
    state.turbidity = THREE.MathUtils.lerp(state.turbidity, target.turbidity, blend);
    state.exposure = THREE.MathUtils.lerp(state.exposure, target.exposure, blend);

    for (const puff of state.smoke) {
      puff.life -= dt;
      puff.radius += dt * 0.32;
      puff.position.addScaledVector(state.wind, dt * 0.12);
    }
    for (let i = state.smoke.length - 1; i >= 0; i--) {
      if (state.smoke[i].life <= 0) state.smoke.splice(i, 1);
    }

    if (state.timeOfDay - lastSkyUpdate > 0.12 || Math.abs(state.fog - (scene.fog?.density || 0)) > 0.0002) {
      lastSkyUpdate = state.timeOfDay;
      applySky();
    }
    updateParticles(dt);
  };

  const getState = () => ({
    mode: state.mode,
    label: state.label,
    windSpeed: state.windSpeed,
    windAngle: state.windAngle,
    wind: state.wind.toArray(),
    tempC: state.tempC,
    wet: state.wet,
    rain: state.rain,
    snow: state.snow,
    dust: state.dust,
    visibility: state.visibility,
    timeOfDay: state.timeOfDay,
    smoke: state.smoke.length,
    exposure: state.exposure,
  });

  setMode('clear', false);
  state.wind.set(WEATHER.clear.windSpeed, 0, 0);
  focus.set(0, 0, 0);

  return {
    state,
    getState,
    update,
    setMode,
    cycle,
    addSmoke,
    smokeAt,
    get wind() {
      return state.wind;
    },
    get visibility() {
      return state.visibility;
    },
    weather: WEATHER,
  };
}

/* Ballistics solver
 * The long trajectory solve runs in a worker so a laser solution never blocks
 * the render thread. The main-thread fallback is deterministic and uses the
 * same equations. */
const WORKER_SOURCE = `
  const G = 9.81;
  function solve(data) {
    const { distance, speed, drag, windX, windZ, step = 1 / 120, maxTime = 8 } = data;
    let low = -0.08;
    let high = 0.48;
    let best = 0;
    for (let iteration = 0; iteration < 23; iteration++) {
      const angle = (low + high) * 0.5;
      let x = 0;
      let y = 0;
      let vx = Math.cos(angle) * speed + windX;
      let vy = Math.sin(angle) * speed;
      let t = 0;
      while (t < maxTime) {
        vy -= G * step;
        const damp = Math.exp(-drag * step);
        vx *= damp;
        vy *= damp;
        x += vx * step;
        y += vy * step;
        t += step;
        if (y < 0) break;
      }
      if (x < distance) low = angle;
      else high = angle;
      best = angle;
    }
    postMessage({ angle: best });
  }
  onmessage = (event) => solve(event.data);
`;

export function createBallistics() {
  let worker = null;
  let pending = null;
  let workerUrl = null;
  try {
    workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    worker = new Worker(workerUrl);
    worker.onmessage = (event) => {
      if (pending) {
        const resolve = pending;
        pending = null;
        resolve(event.data.angle);
      }
    };
    worker.onerror = () => {
      if (pending) {
        const resolve = pending;
        pending = null;
        resolve(null);
      }
    };
  } catch {
    worker = null;
  }

  const solveLocal = (distance, speed, drag = 0, windX = 0, windZ = 0) => {
    let low = -0.08;
    let high = 0.48;
    for (let iteration = 0; iteration < 22; iteration++) {
      const angle = (low + high) * 0.5;
      let x = 0;
      let y = 0;
      let vx = Math.cos(angle) * speed + windX;
      let vy = Math.sin(angle) * speed;
      const step = 1 / 120;
      for (let t = 0; t < 8; t += step) {
        vy -= GRAVITY * step;
        const damp = Math.exp(-drag * step);
        vx *= damp;
        vy *= damp;
        x += vx * step;
        y += vy * step;
        if (y < 0) break;
      }
      if (x < distance) low = angle;
      else high = angle;
    }
    return (low + high) * 0.5;
  };

  const solveElevation = (distance, speed, drag = 0, wind = null) => {
    const windX = wind?.x || 0;
    const windZ = wind?.z || 0;
    return solveLocal(distance, speed, drag, windX, windZ);
  };

  const solveElevationAsync = (distance, speed, drag = 0, wind = null) => {
    if (!worker) return Promise.resolve(solveElevation(distance, speed, drag, wind));
    return new Promise((resolve) => {
      pending = resolve;
      worker.postMessage({
        distance,
        speed,
        drag,
        windX: wind?.x || 0,
        windZ: wind?.z || 0,
      });
    });
  };

  const destroy = () => {
    worker?.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    worker = null;
  };

  return { solveElevation, solveElevationAsync, destroy };
}
