import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Tone mapping, colour conversion, sights and weather all fit in the final
// pass. Keeping one full-screen shader avoids extra copies and gives the
// thermal/night channels a shared grading path.
const FinalShader = {
  name: 'FinalGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    tShot: { value: null },
    toneMappingExposure: { value: 0.8 },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.38 },
    uGrain: { value: 0.002 },
    uFlash: { value: 0 },
    uWarm: { value: 0.1 },
    uSight: { value: 0 },
    uPolarity: { value: 1 },
    uMirage: { value: 0 },
    uRain: { value: 0 },
    uSnow: { value: 0 },
    uDust: { value: 0 },
    uWet: { value: 0 },
    uGlare: { value: 0 },
    uDamage: { value: 0 },
    uPhoto: { value: 0 },
    uShot: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform sampler2D tShot;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uFlash;
    uniform float uWarm;
    uniform float uSight;
    uniform float uPolarity;
    uniform float uMirage;
    uniform float uRain;
    uniform float uSnow;
    uniform float uDust;
    uniform float uWet;
    uniform float uGlare;
    uniform float uDamage;
    uniform float uPhoto;
    uniform float uShot;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    vec3 thermal(vec3 linear, vec2 uv) {
      float heat = clamp(dot(linear, vec3(0.3, 0.52, 0.18)) * 1.65, 0.0, 1.0);
      heat = pow(heat, 0.72);
      // Hot engine decks and muzzle flashes saturate first, exactly like a
      // cooled thermal channel.
      float hot = smoothstep(0.62, 1.0, heat);
      float level = uPolarity > 0.5 ? heat : 1.0 - heat;
      vec3 color = vec3(level);
      color += vec3(hot * 0.16, hot * 0.06, hot * 0.01);
      float scan = sin(uv.y * uResolution.y * 1.15 + uTime * 2.2) * 0.5 + 0.5;
      color *= 0.92 + scan * 0.08;
      color += (hash(uv * uResolution + uTime) - 0.5) * 0.035;
      return color;
    }

    vec3 nightVision(vec3 color, vec2 uv) {
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float gain = pow(luma, 0.58) * 1.6;
      vec3 green = vec3(0.15, 1.0, 0.36) * gain;
      green += vec3(0.01, 0.08, 0.03);
      float scan = sin(uv.y * uResolution.y * 0.72 + uTime * 3.0) * 0.5 + 0.5;
      green *= 0.9 + scan * 0.1;
      return green;
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float radius = length(centered);
      vec2 direction = centered / max(radius, 0.00001);

      // Heat shimmer follows the hot ground plane and disappears in thermal.
      float shimmer = uMirage * smoothstep(0.08, 0.5, uv.y) * (1.0 - smoothstep(0.55, 0.72, uv.y));
      if (shimmer > 0.001) {
        uv.x += sin(uv.y * 180.0 + uTime * 2.2) * 0.00065 * shimmer;
        uv.y += cos(uv.x * 120.0 + uTime * 1.7) * 0.00035 * shimmer;
      }

      float aberration = radius * radius * 0.0015;
      vec3 linear;
      linear.r = texture2D(tDiffuse, uv + direction * aberration).r;
      linear.g = texture2D(tDiffuse, uv).g;
      linear.b = texture2D(tDiffuse, uv - direction * aberration).b;

      vec3 color = sRGBTransferOETF(vec4(ACESFilmicToneMapping(linear), 1.0)).rgb;
      color = (color - 0.5) * 1.06 + 0.5;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, 1.1);
      color = mix(color, color * vec3(1.025, 1.0, 0.965), uWarm);
      color = mix(color, color * vec3(0.84, 0.94, 0.97), uWet * 0.34);
      color = mix(color, vec3(luma * 1.08 + 0.045), uSnow * 0.2);
      color = mix(color, color * vec3(1.08, 0.98, 0.82), uDust * 0.34);

      if (uSight > 0.5 && uSight < 1.5) {
        color = thermal(linear, uv);
      } else if (uSight > 1.5 && uSight < 2.5) {
        color = nightVision(color, uv);
      }

      float glare = pow(max(0.0, 1.0 - length(uv - vec2(0.72, 0.86)) * 1.45), 5.0) * uGlare;
      color += vec3(1.0, 0.76, 0.44) * glare * 0.25;

      if (uRain > 0.01) {
        float streak = noise(vec2(uv.x * 110.0, uv.y * 9.0 - uTime * 9.0));
        color += smoothstep(0.82, 1.0, streak) * 0.09 * uRain;
      }
      if (uSnow > 0.01) {
        float flakes = noise(uv * uResolution * 0.55 + uTime * 0.4);
        color += smoothstep(0.92, 1.0, flakes) * 0.22 * uSnow;
      }
      color += vec3(0.095, 0.04, 0.02) * uDust;

      float vignette = smoothstep(0.92, 0.26, radius);
      color *= mix(1.0, vignette, uVignette + uPhoto * 0.16);
      if (uDamage > 0.01) {
        float edge = smoothstep(0.18, 0.7, radius);
        color = mix(color, color * vec3(1.0, 0.36, 0.28), edge * uDamage * 0.7);
        color += (hash(uv * uResolution + uTime * 8.0) - 0.5) * 0.06 * uDamage;
      }

      float grain = hash(uv * uResolution + fract(uTime) * 91.7) - 0.5;
      color += grain * (uGrain + uPhoto * 0.002);
      color = mix(color, vec3(1.0, 0.78, 0.52), uFlash * 0.16);

      // Small after-action shot camera. The scene is rerendered into tShot only
      // while the camera is enabled; the border keeps it distinct from the HUD.
      if (uShot > 0.5) {
        vec2 shotUv = vec2(
          (uv.x - 0.705) / 0.265,
          (uv.y - 0.035) / 0.195
        );
        float shotAspect = (uResolution.x / max(1.0, uResolution.y)) * 0.75;
        shotUv.x = (shotUv.x - 0.5) * shotAspect + 0.5;
        if (shotUv.x > 0.0 && shotUv.x < 1.0 && shotUv.y > 0.0 && shotUv.y < 1.0) {
          vec3 shot = sRGBTransferOETF(vec4(texture2D(tShot, shotUv).rgb, 1.0)).rgb;
          float edge = min(min(shotUv.x, 1.0 - shotUv.x), min(shotUv.y, 1.0 - shotUv.y));
          color = mix(vec3(0.72, 0.45, 0.2), shot, smoothstep(0.004, 0.012, edge));
        }
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera, { highQuality = true } = {}) {
  const composer = new EffectComposer(renderer);
  let renderScale = 1;
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * renderScale);
  composer.setSize(window.innerWidth, window.innerHeight);

  const samples = highQuality ? Math.min(4, renderer.capabilities.maxSamples || 4) : 0;
  if (composer.renderTarget1) composer.renderTarget1.samples = samples;
  if (composer.renderTarget2) composer.renderTarget2.samples = samples;

  const renderPass = new RenderPass(scene, camera);
  const grade = new ShaderPass(FinalShader);

  composer.addPass(renderPass);
  composer.addPass(grade);

  const shotTarget = new THREE.WebGLRenderTarget(480, 270, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  });
  grade.uniforms.tShot.value = shotTarget.texture;
  let shotCamera = null;
  let shotActive = false;

  const size = new THREE.Vector2();
  const setSize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * renderScale);
    composer.setSize(width, height);
    renderer.getDrawingBufferSize(size);
    grade.uniforms.uResolution.value.set(size.x, size.y);
    grade.uniforms.uAspect.value = width / Math.max(1, height);
    shotTarget.setSize(Math.max(320, Math.round(width * 0.28)), Math.max(180, Math.round(height * 0.22)));
  };
  setSize();

  return {
    composer,
    grade,
    setRenderScale(value) {
      const next = Math.min(1, Math.max(0.75, value));
      if (Math.abs(next - renderScale) < 0.01) return;
      renderScale = next;
      setSize();
    },
    get renderScale() {
      return renderScale;
    },
    setSight(mode = 0, polarity = 1) {
      grade.uniforms.uSight.value = mode;
      grade.uniforms.uPolarity.value = polarity;
    },
    setEnvironment(values = {}) {
      grade.uniforms.uMirage.value = values.mirage ?? 0;
      grade.uniforms.uRain.value = values.rain ?? 0;
      grade.uniforms.uSnow.value = values.snow ?? 0;
      grade.uniforms.uDust.value = values.dust ?? 0;
      grade.uniforms.uWet.value = values.wet ?? 0;
      grade.uniforms.uGlare.value = values.glare ?? 0;
    },
    setDamage(value = 0) {
      grade.uniforms.uDamage.value = Math.min(1, Math.max(0, value));
    },
    setPhoto(value = 0) {
      grade.uniforms.uPhoto.value = value;
    },
    setShotCamera(nextCamera, enabled = true) {
      shotCamera = nextCamera;
      shotActive = Boolean(enabled && nextCamera);
      grade.uniforms.uShot.value = shotActive ? 1 : 0;
    },
    render(dt) {
      grade.uniforms.uTime.value += dt;
      grade.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
      if (grade.uniforms.uFlash.value > 0) {
        grade.uniforms.uFlash.value = Math.max(0, grade.uniforms.uFlash.value - dt * 6.5);
      }
      if (shotActive && shotCamera) {
        const previous = renderer.getRenderTarget();
        renderer.setRenderTarget(shotTarget);
        renderer.clear();
        renderer.render(scene, shotCamera);
        renderer.setRenderTarget(previous);
      }
      composer.render(dt);
    },
    setSize,
    flash(amount = 1) {
      grade.uniforms.uFlash.value = Math.min(1, grade.uniforms.uFlash.value + amount);
    },
  };
}
