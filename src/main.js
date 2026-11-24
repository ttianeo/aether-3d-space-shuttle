import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createSpacecraft } from './spacecraft.js';
import { createSpaceEnvironment } from './spaceEnvironment.js';
import { CinematicFXShader } from './shaders.js';
import { SpaceAudioEngine } from './audioEngine.js';

/**
 * Generates a rich cosmic PMREM environment reflection texture
 * so metallic hull panels and clearcoat canopy reflect realistic starlight & nebula hues.
 */
function createSpaceEnvironmentMap(renderer, sunDir) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();

  // Deep cosmic sky gradient shell
  const envSky = new THREE.Mesh(
    new THREE.SphereGeometry(40, 24, 16),
    new THREE.MeshBasicMaterial({ color: '#0b1834', side: THREE.BackSide })
  );
  envScene.add(envSky);

  // Bright sun highlight panel for crisp specular glints across metallic panels
  const sunPanel = new THREE.Mesh(
    new THREE.CircleGeometry(7, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 4.1, 3.6) })
  );
  sunPanel.position.copy(sunDir).normalize().multiplyScalar(28);
  sunPanel.lookAt(0, 0, 0);
  envScene.add(sunPanel);

  // Cool ionized cyan nebula bounce lobe
  const cyanLobe = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.35, 1.85) })
  );
  cyanLobe.position.set(-22, 10, 14);
  cyanLobe.lookAt(0, 0, 0);
  envScene.add(cyanLobe);

  // Magenta-violet nebula rim reflection lobe
  const magentaLobe = new THREE.Mesh(
    new THREE.CircleGeometry(12, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.28, 1.05) })
  );
  magentaLobe.position.set(14, -14, 18);
  magentaLobe.lookAt(0, 0, 0);
  envScene.add(magentaLobe);

  // Soft overhead aerospace rim strip
  const topStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.75, 2.2), side: THREE.DoubleSide })
  );
  topStrip.position.set(0, 26, -4);
  topStrip.rotation.x = Math.PI / 2;
  envScene.add(topStrip);

  const envRT = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  return envRT.texture;
}

// ============================================================================
// SCENE, RENDERER & LIGHTING SETUP
// ============================================================================
const container = document.getElementById('canvas-container');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#02040a');

const camera = new THREE.PerspectiveCamera(
  52,
  window.innerWidth / window.innerHeight,
  0.1,
  1400
);
camera.position.set(2.8, 2.6, 11.8);

const sunDir = new THREE.Vector3(0.62, 0.28, -0.73).normalize();
scene.environment = createSpaceEnvironmentMap(renderer, sunDir);
scene.environmentIntensity = 0.85;

// Dramatic cosmic lighting rig
const sunLight = new THREE.DirectionalLight('#fff2df', 2.65);
sunLight.position.copy(sunDir).multiplyScalar(120);
scene.add(sunLight);

const hemiLight = new THREE.HemisphereLight('#4f94de', '#1e1036', 0.75);
scene.add(hemiLight);

const rimLight = new THREE.DirectionalLight('#2cd4ff', 1.15);
rimLight.position.set(-45, 22, 34);
scene.add(rimLight);

// ============================================================================
// BUILD SPACE ENVIRONMENT & VX-09 AETHER SPACECRAFT
// ============================================================================
const spaceEnv = createSpaceEnvironment(sunDir);
scene.add(spaceEnv.group);

const spacecraft = createSpacecraft();
scene.add(spacecraft.group);

// ============================================================================
// HDR POST-PROCESSING COMPOSER (Bloom + Chromatic/Vignette + ACES Output)
// ============================================================================
const renderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  { type: THREE.HalfFloatType, samples: 4 }
);

const composer = new EffectComposer(renderer, renderTarget);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.38, // strength
  0.38, // radius
  1.05  // HDR threshold so metallic hull stays razor-sharp and only true emissives bloom
);
composer.addPass(bloomPass);

const cinematicPass = new ShaderPass(CinematicFXShader);
composer.addPass(cinematicPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// ============================================================================
// ORBIT CONTROLS (active in FREE ORBIT camera mode)
// ============================================================================
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.06;
orbitControls.minDistance = 5.5;
orbitControls.maxDistance = 38;
orbitControls.enabled = false;

// ============================================================================
// INTERACTIVE FLIGHT STATE, INPUTS & AUDIO
// ============================================================================
const audio = new SpaceAudioEngine();

const state = {
  camMode: 'chase', // 'chase' | 'cinematic' | 'wing' | 'orbit'
  autopilot: true,
  warpInput: false,
  warp: 0,
  speed: 44,
  gatesCleared: 0,
  shipPos: new THREE.Vector3(0, 0, 0),
  shipTarget: new THREE.Vector2(0, 0),
  shipVel: new THREE.Vector2(0, 0),
  roll: 0,
  pitch: 0,
  yaw: 0,
  barrelRollProgress: 0,
  barrelRollDir: 1,
  mouseNorm: new THREE.Vector2(0, 0),
  keys: {
    w: false,
    a: false,
    s: false,
    d: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
  },
  cinematicTimer: 0,
};

// HUD Elements
const elSpeed = document.getElementById('hud-speed');
const elWarp = document.getElementById('hud-warp');
const elGates = document.getElementById('hud-gates');
const elThrust = document.getElementById('hud-thrust');
const elHorizon = document.querySelector('.horizon-ring');
const btnAudio = document.getElementById('btn-audio');
const elAudioLabel = document.getElementById('audio-label');
const btnHud = document.getElementById('btn-hud');
const btnHudRestore = document.getElementById('btn-hud-restore');
const btnWarp = document.getElementById('btn-warp');
const btnAutopilot = document.getElementById('btn-autopilot');
const btnRoll = document.getElementById('btn-roll');
const camButtons = Array.from(document.querySelectorAll('#camera-modes .pill'));

function setCameraMode(mode) {
  state.camMode = mode;
  orbitControls.enabled = mode === 'orbit';
  if (mode === 'orbit') {
    orbitControls.target.copy(state.shipPos);
    camera.position.set(state.shipPos.x + 7.5, state.shipPos.y + 4.2, state.shipPos.z + 9.2);
    orbitControls.update();
  }
  camButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cam === mode);
  });
}

function triggerBarrelRoll(dir = 1) {
  if (state.barrelRollProgress <= 0) {
    state.barrelRollProgress = 0.001;
    state.barrelRollDir = dir;
  }
}

function toggleHud() {
  document.body.classList.toggle('hud-hidden');
}

function toggleAudio() {
  const on = audio.toggle();
  btnAudio.classList.toggle('active', on);
  elAudioLabel.textContent = on ? 'AUDIO ON' : 'AUDIO OFF';
}

function setAutopilot(val) {
  state.autopilot = val;
  btnAutopilot.classList.toggle('active', val);
}

// Button Bindings
camButtons.forEach((btn) => {
  btn.addEventListener('click', () => setCameraMode(btn.dataset.cam));
});

btnAudio.addEventListener('click', toggleAudio);
btnHud.addEventListener('click', toggleHud);
btnHudRestore.addEventListener('click', toggleHud);
btnAutopilot.addEventListener('click', () => setAutopilot(!state.autopilot));
btnRoll.addEventListener('click', () => triggerBarrelRoll(Math.random() > 0.5 ? 1 : -1));

// Warp button supports both hold-to-warp and quick-click toggle feel via pointer down/up
btnWarp.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  state.warpInput = true;
});
window.addEventListener('pointerup', () => {
  state.warpInput = false;
});
btnWarp.addEventListener('pointerleave', () => {
  state.warpInput = false;
});

// Pointer steer tracking
window.addEventListener('pointermove', (e) => {
  state.mouseNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
  state.mouseNorm.y = -((e.clientY / window.innerHeight) * 2 - 1);
});

// Keyboard Controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    state.warpInput = true;
    return;
  }
  if (e.key in state.keys) {
    state.keys[e.key] = true;
    setAutopilot(false);
  }
  const lower = e.key.toLowerCase();
  if (lower in state.keys) {
    state.keys[lower] = true;
    setAutopilot(false);
  }
  if (lower === 'r') triggerBarrelRoll(state.roll >= 0 ? 1 : -1);
  if (lower === 'h') toggleHud();
  if (lower === 'm') toggleAudio();
  if (lower === 'p') setAutopilot(!state.autopilot);
  if (e.key === '1') setCameraMode('chase');
  if (e.key === '2') setCameraMode('cinematic');
  if (e.key === '3') setCameraMode('wing');
  if (e.key === '4') setCameraMode('orbit');
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    state.warpInput = false;
    return;
  }
  if (e.key in state.keys) state.keys[e.key] = false;
  const lower = e.key.toLowerCase();
  if (lower in state.keys) state.keys[lower] = false;
});

// Resize handling
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
});

// ============================================================================
// MAIN ANIMATION LOOP
// ============================================================================
const clock = new THREE.Clock();
const desiredCamPos = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();
const currentLookAt = new THREE.Vector3(0, 0, -12);
const tmpVec = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  // 1. Warp Drive ramp-up / ramp-down
  const warpTarget = state.warpInput ? 1.0 : 0.0;
  state.warp = THREE.MathUtils.lerp(state.warp, warpTarget, 1.0 - Math.exp(-dt * (warpTarget > 0.5 ? 4.2 : 2.6)));
  document.body.classList.toggle('warp-active', state.warp > 0.25);

  state.speed = THREE.MathUtils.lerp(44, 152, state.warp);

  // 2. Spacecraft flight steering (Autopilot weaves gracefully OR manual WASD/Mouse)
  const manualX =
    (state.keys.d || state.keys.ArrowRight ? 1 : 0) -
    (state.keys.a || state.keys.ArrowLeft ? 1 : 0);
  const manualY =
    (state.keys.w || state.keys.ArrowUp ? 1 : 0) -
    (state.keys.s || state.keys.ArrowDown ? 1 : 0);

  if (state.autopilot) {
    // Graceful aerospace patrol weave + subtle mouse parallax influence
    const autoX = Math.sin(elapsed * 0.42) * 3.8 + Math.sin(elapsed * 0.19) * 1.4;
    const autoY = Math.cos(elapsed * 0.55) * 1.7 + Math.sin(elapsed * 0.27) * 0.7;
    state.shipTarget.x = autoX + state.mouseNorm.x * 2.0;
    state.shipTarget.y = autoY + state.mouseNorm.y * 1.3;
  } else {
    if (manualX !== 0 || manualY !== 0) {
      state.shipTarget.x += manualX * dt * 11.5;
      state.shipTarget.y += manualY * dt * 8.5;
    } else {
      // Smoothly follow pointer when WASD idle
      state.shipTarget.x = THREE.MathUtils.lerp(state.shipTarget.x, state.mouseNorm.x * 6.8, dt * 3.0);
      state.shipTarget.y = THREE.MathUtils.lerp(state.shipTarget.y, state.mouseNorm.y * 4.2, dt * 3.0);
    }
  }

  // Clamp cleanly inside transit gate corridor
  state.shipTarget.x = THREE.MathUtils.clamp(state.shipTarget.x, -7.2, 7.2);
  state.shipTarget.y = THREE.MathUtils.clamp(state.shipTarget.y, -4.4, 4.4);

  const prevX = state.shipPos.x;
  const prevY = state.shipPos.y;
  const followRate = 1.0 - Math.exp(-dt * 3.8);
  state.shipPos.x = THREE.MathUtils.lerp(state.shipPos.x, state.shipTarget.x, followRate);
  state.shipPos.y = THREE.MathUtils.lerp(state.shipPos.y, state.shipTarget.y, followRate);
  // Subtle forward surge into frame during Warp Boost
  const surgeZ = -state.warp * 1.65 + Math.sin(elapsed * 1.1) * 0.25;
  state.shipPos.z = THREE.MathUtils.lerp(state.shipPos.z, surgeZ, 1.0 - Math.exp(-dt * 3.0));

  const vx = (state.shipPos.x - prevX) / Math.max(dt, 0.001);
  const vy = (state.shipPos.y - prevY) / Math.max(dt, 0.001);

  // Coordinated aerodynamic banking & pitch + micro-turbulence
  const targetRoll = THREE.MathUtils.clamp(-vx * 0.095, -0.78, 0.78);
  const targetPitch = THREE.MathUtils.clamp(vy * 0.065, -0.42, 0.42);
  const targetYaw = THREE.MathUtils.clamp(-vx * 0.028, -0.22, 0.22);

  state.roll = THREE.MathUtils.lerp(state.roll, targetRoll, 1.0 - Math.exp(-dt * 5.2));
  state.pitch = THREE.MathUtils.lerp(state.pitch, targetPitch, 1.0 - Math.exp(-dt * 5.2));
  state.yaw = THREE.MathUtils.lerp(state.yaw, targetYaw, 1.0 - Math.exp(-dt * 5.2));

  // Optional 360° Barrel Roll animation
  let barrelAngle = 0;
  if (state.barrelRollProgress > 0) {
    state.barrelRollProgress += dt * 0.92;
    if (state.barrelRollProgress >= 1.0) {
      state.barrelRollProgress = 0;
    } else {
      const t = state.barrelRollProgress;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      barrelAngle = eased * Math.PI * 2 * state.barrelRollDir;
    }
  }

  // Apply spacecraft transform + subtle warp vibration
  const vibe = (0.012 + state.warp * 0.048);
  spacecraft.group.position.set(
    state.shipPos.x + Math.sin(elapsed * 37) * vibe,
    state.shipPos.y + Math.cos(elapsed * 43) * vibe,
    state.shipPos.z
  );
  spacecraft.group.rotation.order = 'YXZ';
  spacecraft.group.rotation.y = state.yaw;
  spacecraft.group.rotation.x = state.pitch + Math.sin(elapsed * 2.1) * 0.014;
  spacecraft.group.rotation.z = state.roll + barrelAngle;

  // Update spacecraft animated sub-systems
  spacecraft.update(elapsed, dt, {
    warp: state.warp,
    roll: state.roll + (state.barrelRollProgress > 0 ? 0.9 : 0),
    pitch: state.pitch,
    throttle: 0.65 + state.warp * 0.35,
  });

  // 3. Update space environment & transit gate crossings
  spaceEnv.update(
    elapsed,
    dt,
    { speed: state.speed, warp: state.warp },
    () => {
      state.gatesCleared += 1;
      elGates.textContent = String(state.gatesCleared).padStart(2, '0');
      audio.playGateWhoosh(state.warp);
    }
  );

  // 4. Camera Choreography & Relativistic FOV Dilation
  const targetFov =
    state.camMode === 'wing'
      ? 62 + state.warp * 18
      : 52 + state.warp * 21;
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1.0 - Math.exp(-dt * 4.5));
  camera.updateProjectionMatrix();

  const shakeAmt = state.warp * 0.14;
  const shakeX = Math.sin(elapsed * 58) * shakeAmt;
  const shakeY = Math.cos(elapsed * 64) * shakeAmt;

  if (state.camMode === 'chase') {
    // Dynamic hero chase camera with slight starboard offset to frame exoplanet & bow
    desiredCamPos.set(
      state.shipPos.x * 0.72 + 2.3 + state.mouseNorm.x * 1.4 + shakeX,
      state.shipPos.y * 0.72 + 2.55 + state.mouseNorm.y * 0.8 + shakeY,
      state.shipPos.z + 11.4 - state.warp * 1.4
    );
    desiredLookAt.set(
      state.shipPos.x * 0.9 - 1.1,
      state.shipPos.y * 0.9 + 0.15,
      state.shipPos.z - 16.0
    );
    camera.position.lerp(desiredCamPos, 1.0 - Math.exp(-dt * 4.2));
    currentLookAt.lerp(desiredLookAt, 1.0 - Math.exp(-dt * 5.8));
    camera.lookAt(currentLookAt);
  } else if (state.camMode === 'cinematic') {
    state.cinematicTimer += dt;
    const phase = Math.floor(state.cinematicTimer / 7.5) % 4;
    const localT = (state.cinematicTimer % 7.5) / 7.5;

    if (phase === 0) {
      // Sweeping 3/4 Front-Starboard Hero Shot
      const angle = -0.35 + localT * 0.55;
      desiredCamPos.set(
        state.shipPos.x + Math.sin(angle) * 11.5 + 5.0,
        state.shipPos.y + 2.2 + Math.sin(localT * Math.PI) * 1.2,
        state.shipPos.z - 7.8 + localT * 3.5
      );
      desiredLookAt.set(state.shipPos.x, state.shipPos.y, state.shipPos.z + 0.5);
    } else if (phase === 1) {
      // Low Dramatic Port-Ventral Pass framing planet & roaring thrusters
      desiredCamPos.set(
        state.shipPos.x + 8.8 - localT * 3.2,
        state.shipPos.y - 2.6 + localT * 2.2,
        state.shipPos.z + 7.2 + localT * 3.8
      );
      desiredLookAt.set(state.shipPos.x - 1.2, state.shipPos.y + 0.2, state.shipPos.z - 6.0);
    } else if (phase === 2) {
      // High Banking Orbital Glide
      const ang = localT * 1.25 - 0.6;
      desiredCamPos.set(
        state.shipPos.x + Math.cos(ang) * 13.5,
        state.shipPos.y + 5.6 - localT * 2.0,
        state.shipPos.z + Math.sin(ang) * 10.0 + 4.0
      );
      desiredLookAt.copy(state.shipPos);
    } else {
      // Tight Aft Thruster Chase
      desiredCamPos.set(
        state.shipPos.x - 1.8 + localT * 3.6 + shakeX,
        state.shipPos.y + 1.35 + shakeY,
        state.shipPos.z + 8.6
      );
      desiredLookAt.set(state.shipPos.x, state.shipPos.y + 0.2, state.shipPos.z - 22.0);
    }

    camera.position.lerp(desiredCamPos, 1.0 - Math.exp(-dt * 2.2));
    currentLookAt.lerp(desiredLookAt, 1.0 - Math.exp(-dt * 4.0));
    camera.lookAt(currentLookAt);
  } else if (state.camMode === 'wing') {
    // Locked dynamically over the starboard wingtip looking past canopy into space!
    tmpVec.set(4.9, 1.55, 4.1).applyEuler(spacecraft.group.rotation).add(spacecraft.group.position);
    desiredCamPos.copy(tmpVec).add(new THREE.Vector3(shakeX * 0.4, shakeY * 0.4, 0));
    tmpVec.set(-1.6, 0.25, -26.0).applyEuler(spacecraft.group.rotation).add(spacecraft.group.position);
    desiredLookAt.copy(tmpVec);

    camera.position.lerp(desiredCamPos, 1.0 - Math.exp(-dt * 12.0));
    currentLookAt.lerp(desiredLookAt, 1.0 - Math.exp(-dt * 12.0));
    camera.lookAt(currentLookAt);
  } else if (state.camMode === 'orbit') {
    orbitControls.target.lerp(state.shipPos, 1.0 - Math.exp(-dt * 6.0));
    orbitControls.update();
  }

  // 5. Post-Processing Dynamic Warp Grading
  bloomPass.strength = THREE.MathUtils.lerp(0.38, 0.56, state.warp);
  cinematicPass.uniforms.uTime.value = elapsed;
  cinematicPass.uniforms.uWarp.value = state.warp;

  // 6. Telemetry HUD & Artificial Horizon Update
  const kmPerSec = 14.8 + state.warp * 279.8 + Math.sin(elapsed * 2.4) * 0.3;
  const cFactor = 0.18 + state.warp * 0.8;
  const thrustPct = Math.round(64 + state.warp * 36 + Math.sin(elapsed * 8) * 1.5);
  elSpeed.innerHTML = `${kmPerSec.toFixed(1)} <small>km/s</small>`;
  elWarp.innerHTML = `${cFactor.toFixed(2)} <small>c</small>`;
  elThrust.textContent = `${Math.min(100, thrustPct)}%`;

  if (elHorizon) {
    const rollDeg = THREE.MathUtils.radToDeg(state.roll) * 0.75;
    const pitchPx = state.pitch * 38;
    elHorizon.style.transform = `translateY(${pitchPx.toFixed(1)}px) rotate(${rollDeg.toFixed(1)}deg) scale(${(1 + state.warp * 0.12).toFixed(3)})`;
  }

  // Update procedural Web Audio soundscape
  audio.update(state.warp, (state.speed - 44) / 108);

  // Render full HDR post-processed frame
  composer.render();
}

animate();
