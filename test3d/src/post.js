import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Tone mapping and color conversion are folded into the grade pass. This keeps
// the same visual result while removing a full-screen copy from every frame.
const FinalShader = {
  name: 'FinalGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    toneMappingExposure: { value: 0.8 },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.5 },
    uGrain: { value: 0.025 },
    uFlash: { value: 0 },
    uWarm: { value: 0.1 },
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
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uFlash;
    uniform float uWarm;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float radius = length(centered);
      vec2 direction = centered / max(radius, 0.00001);
      float aberration = radius * radius * 0.0015;

      vec3 linear;
      linear.r = texture2D(tDiffuse, uv + direction * aberration).r;
      linear.g = texture2D(tDiffuse, uv).g;
      linear.b = texture2D(tDiffuse, uv - direction * aberration).b;

      vec3 color = sRGBTransferOETF(vec4(ACESFilmicToneMapping(linear), 1.0)).rgb;
      color = (color - 0.5) * 1.045 + 0.5;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, 1.08);
      color = mix(color, color * vec3(1.025, 1.0, 0.965), uWarm);
      float vignette = smoothstep(0.92, 0.26, radius);
      color *= mix(1.0, vignette, uVignette);

      float grain = hash(uv * uResolution + fract(uTime) * 91.7) - 0.5;
      color += grain * uGrain;
      color = mix(color, vec3(1.0, 0.78, 0.52), uFlash * 0.16);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderScale = 0.8;
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * renderScale);
  composer.setSize(window.innerWidth, window.innerHeight);

  if (composer.renderTarget1) composer.renderTarget1.samples = 2;
  if (composer.renderTarget2) composer.renderTarget2.samples = 2;

  const renderPass = new RenderPass(scene, camera);
  const grade = new ShaderPass(FinalShader);

  composer.addPass(renderPass);
  composer.addPass(grade);

  const size = new THREE.Vector2();
  const setSize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * renderScale);
    composer.setSize(width, height);
    renderer.getDrawingBufferSize(size);
    grade.uniforms.uResolution.value.set(size.x, size.y);
  };
  setSize();

  return {
    composer,
    grade,
    render(dt) {
      grade.uniforms.uTime.value += dt;
      grade.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
      if (grade.uniforms.uFlash.value > 0) {
        grade.uniforms.uFlash.value = Math.max(0, grade.uniforms.uFlash.value - dt * 6.5);
      }
      composer.render(dt);
    },
    setSize,
    flash(amount = 1) {
      grade.uniforms.uFlash.value = Math.min(1, grade.uniforms.uFlash.value + amount);
    },
  };
}
