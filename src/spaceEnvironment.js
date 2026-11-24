import * as THREE from 'three';
import {
  NebulaSkyboxShader,
  PlanetAtmosphereShader,
  PlanetRingsShader,
  WarpStreaksShader,
} from './shaders.js';
import {
  createExoplanetTexture,
  createGlowTexture,
  createAnamorphicFlareTexture,
} from './textures.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates an organically displaced rocky asteroid geometry.
 */
function createAsteroidGeometry() {
  const geo = new THREE.IcosahedronGeometry(1.0, 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n1 = Math.sin(v.x * 3.1 + 0.5) * Math.cos(v.y * 2.7 - 0.3) * Math.sin(v.z * 3.4);
    const n2 = Math.sin(v.x * 6.8 - v.z * 5.2) * Math.cos(v.y * 6.1);
    const crater = Math.max(0, 1.0 - v.distanceTo(new THREE.Vector3(0.6, 0.5, 0.6)) * 1.6);
    const scale = 1.0 + n1 * 0.24 + n2 * 0.08 - crater * 0.22;
    v.multiplyScalar(scale);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a single Orbital Hyperspace Transit Ring Gate.
 */
function createTransitGate(gateMaterials) {
  const group = new THREE.Group();
  const radius = 18.5;

  // Outer armored titanium structural torus
  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.72, 12, 64),
    gateMaterials.hull
  );
  group.add(outerRing);

  // Inner slim beveled guide track
  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 1.35, 0.22, 8, 64),
    gateMaterials.dark
  );
  group.add(innerRing);

  // Glowing segmented energy arc (rotates gently inside gate)
  const spinner = new THREE.Group();
  const arcCount = 6;
  const arcLen = (Math.PI * 2) / arcCount;
  const glowMat = gateMaterials.glowTemplate.clone();

  for (let i = 0; i < arcCount; i++) {
    const startAngle = i * arcLen + 0.14;
    const seg = new THREE.Mesh(
      new THREE.TorusGeometry(radius - 1.0, 0.16, 8, 16, arcLen - 0.28),
      glowMat
    );
    seg.rotation.z = startAngle;
    spinner.add(seg);
  }
  group.add(spinner);

  // 4 Heavy Radial Pylons + Amber Beacon Tip Lights
  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2 + Math.PI / 4;
    const pylon = new THREE.Group();
    pylon.rotation.z = angle;

    const strut = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 4.4, 2.2),
      gateMaterials.hull
    );
    strut.position.set(0, radius + 1.4, 0);
    pylon.add(strut);

    const innerFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 2.4, 1.35),
      gateMaterials.dark
    );
    innerFin.position.set(0, radius - 1.4, 0);
    pylon.add(innerFin);

    const beacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.9, 0.45),
      gateMaterials.amber
    );
    beacon.position.set(0, radius - 2.35, 0.4);
    pylon.add(beacon);

    group.add(pylon);
  }

  return { group, spinner, glowMat, flash: 0 };
}

/**
 * Builds the complete deep space environment:
 * - Nebula skybox
 * - Multi-color distant starfield
 * - GPU-driven warp streak ribbons
 * - Ringed exoplanet with atmospheric Fresnel halo & orbiting moon
 * - Distant star with corona & anamorphic lens flare
 * - Instanced rocky asteroid belt framing the corridor
 * - Cycling orbital transit ring gates
 */
export function createSpaceEnvironment(sunDir) {
  const root = new THREE.Group();
  const rand = mulberry32(2026);

  // =========================================================================
  // 1. COSMIC NEBULA SKYBOX
  // =========================================================================
  const skyGeo = new THREE.SphereGeometry(680, 48, 32);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(NebulaSkyboxShader.uniforms),
    vertexShader: NebulaSkyboxShader.vertexShader,
    fragmentShader: NebulaSkyboxShader.fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  });
  skyMat.uniforms.uSunDir.value.copy(sunDir).normalize();
  const skybox = new THREE.Mesh(skyGeo, skyMat);
  root.add(skybox);

  // =========================================================================
  // 2. DISTANT 3D PARALLAX STARFIELD
  // =========================================================================
  const starCount = 3400;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starPalette = [
    new THREE.Color('#a6d8ff'),
    new THREE.Color('#ffffff'),
    new THREE.Color('#d8ecff'),
    new THREE.Color('#ffe2ba'),
    new THREE.Color('#c2b5ff'),
  ];

  for (let i = 0; i < starCount; i++) {
    const u = rand();
    const v = rand();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const radius = 240 + rand() * 360;

    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = radius * Math.cos(phi);

    const col = starPalette[Math.floor(rand() * starPalette.length)];
    const brightness = 0.55 + rand() * 0.45;
    starColors[i * 3] = col.r * brightness;
    starColors[i * 3 + 1] = col.g * brightness;
    starColors[i * 3 + 2] = col.b * brightness;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starSprite = createGlowTexture('#ffffff', 'rgba(180,230,255,0.65)', 'rgba(0,0,0,0)');
  const starMat = new THREE.PointsMaterial({
    size: 2.1,
    map: starSprite,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const starfield = new THREE.Points(starGeo, starMat);
  root.add(starfield);

  // =========================================================================
  // 3. GPU-DRIVEN WARP STREAKS / HIGH-SPEED SPACE DUST
  // =========================================================================
  const streakCount = 1200;
  const baseStreakGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.0, 4, 1, true);
  baseStreakGeo.rotateX(Math.PI / 2); // Align along Z while preserving uv.y lengthwise

  const streakGeo = new THREE.InstancedBufferGeometry();
  streakGeo.index = baseStreakGeo.index;
  streakGeo.attributes.position = baseStreakGeo.attributes.position;
  streakGeo.attributes.uv = baseStreakGeo.attributes.uv;

  const offsets = new Float32Array(streakCount * 3);
  const colors = new Float32Array(streakCount * 3);
  const speeds = new Float32Array(streakCount);
  const lengths = new Float32Array(streakCount);

  const streakPalette = [
    new THREE.Color('#5ce0ff'),
    new THREE.Color('#cce8ff'),
    new THREE.Color('#6ca8ff'),
    new THREE.Color('#c882ff'),
    new THREE.Color('#ffd099'),
  ];

  for (let i = 0; i < streakCount; i++) {
    // Keep inner radius > 10.5 so streaks form a crisp hyperspace tunnel framing the ship
    const angle = rand() * Math.PI * 2;
    const radius = 10.5 + Math.pow(rand(), 0.75) * 86.0;
    offsets[i * 3] = Math.cos(angle) * radius;
    offsets[i * 3 + 1] = Math.sin(angle) * radius * 0.72;
    offsets[i * 3 + 2] = (rand() - 0.5) * 260.0;

    const c = streakPalette[Math.floor(rand() * streakPalette.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    speeds[i] = 0.65 + rand() * 0.95;
    lengths[i] = 1.4 + rand() * 3.8;
  }

  streakGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  streakGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  streakGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
  streakGeo.setAttribute('aLength', new THREE.InstancedBufferAttribute(lengths, 1));

  const streakMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(WarpStreaksShader.uniforms),
    vertexShader: WarpStreaksShader.vertexShader,
    fragmentShader: WarpStreaksShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const warpStreaks = new THREE.Mesh(streakGeo, streakMat);
  warpStreaks.frustumCulled = false;
  root.add(warpStreaks);

  // =========================================================================
  // 4. RINGED EXOPLANET ("KEPLER-442b") + ATMOSPHERE + MOON
  // =========================================================================
  const planetCenter = new THREE.Vector3(-96, -28, -195);
  const planetRadius = 46;
  const planetGroup = new THREE.Group();
  planetGroup.position.copy(planetCenter);

  const planetTex = createExoplanetTexture();
  const planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(planetRadius, 64, 48),
    new THREE.MeshStandardMaterial({
      map: planetTex,
      roughness: 0.78,
      metalness: 0.08,
    })
  );
  planetGroup.add(planetMesh);

  // Luminous atmospheric Fresnel limb halo
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(PlanetAtmosphereShader.uniforms),
    vertexShader: PlanetAtmosphereShader.vertexShader,
    fragmentShader: PlanetAtmosphereShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
  atmoMat.uniforms.uSunDir.value.copy(sunDir).normalize();
  const atmoMesh = new THREE.Mesh(
    new THREE.SphereGeometry(planetRadius * 1.055, 64, 48),
    atmoMat
  );
  planetGroup.add(atmoMesh);

  // Multi-band tilted planetary ring system with real-time planet shadow
  const innerR = 58;
  const outerR = 114;
  const ringGeo = new THREE.RingGeometry(innerR, outerR, 128, 4);
  const ringMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(PlanetRingsShader.uniforms),
    vertexShader: PlanetRingsShader.vertexShader,
    fragmentShader: PlanetRingsShader.fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  ringMat.uniforms.uSunDir.value.copy(sunDir).normalize();
  ringMat.uniforms.uPlanetCenter.value.copy(planetCenter);
  ringMat.uniforms.uPlanetRadius.value = planetRadius;
  ringMat.uniforms.uInnerRadius.value = innerR;
  ringMat.uniforms.uOuterRadius.value = outerR;

  const ringsMesh = new THREE.Mesh(ringGeo, ringMat);
  ringsMesh.rotation.x = Math.PI * 0.43;
  ringsMesh.rotation.y = 0.24;
  planetGroup.add(ringsMesh);

  // Orbiting ice-moon near the outer ring plane
  const moonPivot = new THREE.Group();
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 24, 24),
    new THREE.MeshStandardMaterial({
      color: '#a8b8cf',
      roughness: 0.88,
      metalness: 0.06,
    })
  );
  moonMesh.position.set(78, 18, 42);
  moonPivot.add(moonMesh);
  planetGroup.add(moonPivot);

  root.add(planetGroup);

  // =========================================================================
  // 5. DISTANT STAR / SUN WITH VOLUMETRIC CORONA & ANAMORPHIC FLARE
  // =========================================================================
  const sunPos = sunDir.clone().normalize().multiplyScalar(390);
  const sunGroup = new THREE.Group();
  sunGroup.position.copy(sunPos);

  const sunCoreTex = createGlowTexture('#ffffff', '#ffe8be', 'rgba(80, 160, 255, 0)');
  const sunCore = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunCoreTex,
      color: '#fff6e8',
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sunCore.scale.set(95, 95, 1);
  sunGroup.add(sunCore);

  const sunHaloTex = createGlowTexture('#88dcff', 'rgba(60, 140, 255, 0.35)', 'rgba(0, 0, 0, 0)');
  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunHaloTex,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sunHalo.scale.set(220, 220, 1);
  sunGroup.add(sunHalo);

  const anamorphicTex = createAnamorphicFlareTexture();
  const sunFlare = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: anamorphicTex,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sunFlare.scale.set(290, 34, 1);
  sunGroup.add(sunFlare);

  root.add(sunGroup);

  // =========================================================================
  // 6. INSTANCED ASTEROID FIELD FRAMING THE TRANSIT CORRIDOR
  // =========================================================================
  const asteroidCount = 140;
  const asteroidGeo = createAsteroidGeometry();
  const asteroidMat = new THREE.MeshStandardMaterial({
    color: '#6b7588',
    roughness: 0.9,
    metalness: 0.18,
    flatShading: true,
  });

  const asteroidsMesh = new THREE.InstancedMesh(asteroidGeo, asteroidMat, asteroidCount);
  const asteroidData = [];
  const dummy = new THREE.Object3D();
  const asteroidSpanZ = 420;

  for (let i = 0; i < asteroidCount; i++) {
    const angle = rand() * Math.PI * 2;
    // Always outside radius 23 so asteroids stay clear of the 18.5-unit transit gates!
    const dist = 24 + Math.pow(rand(), 0.78) * 95;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist * 0.68;
    const z = -340 + rand() * asteroidSpanZ;
    const scale = 0.75 + Math.pow(rand(), 2.2) * 5.8;

    const item = {
      x,
      y,
      z,
      scale,
      rx: rand() * Math.PI * 2,
      ry: rand() * Math.PI * 2,
      rz: rand() * Math.PI * 2,
      drx: (rand() - 0.5) * 0.7,
      dry: (rand() - 0.5) * 0.7,
      speedMul: 0.75 + rand() * 0.45,
    };
    asteroidData.push(item);

    // Subtle per-asteroid mineral color tint
    const tint = new THREE.Color().setHSL(0.58 + (rand() - 0.5) * 0.08, 0.14, 0.36 + rand() * 0.18);
    asteroidsMesh.setColorAt(i, tint);
  }
  asteroidsMesh.instanceColor.needsUpdate = true;
  root.add(asteroidsMesh);

  // =========================================================================
  // 7. ORBITAL TRANSIT RING GATES
  // =========================================================================
  const gateMaterials = {
    hull: new THREE.MeshStandardMaterial({
      color: '#526076',
      metalness: 0.82,
      roughness: 0.34,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: '#1e2636',
      metalness: 0.75,
      roughness: 0.44,
    }),
    glowTemplate: new THREE.MeshStandardMaterial({
      color: '#7bf2ff',
      emissive: new THREE.Color('#20dcff'),
      emissiveIntensity: 2.4,
      roughness: 0.15,
    }),
    amber: new THREE.MeshStandardMaterial({
      color: '#ffd28a',
      emissive: new THREE.Color('#ff8e24'),
      emissiveIntensity: 2.6,
      roughness: 0.2,
    }),
  };

  const gateCount = 5;
  const gateSpacing = 128;
  const gates = [];

  for (let i = 0; i < gateCount; i++) {
    const gate = createTransitGate(gateMaterials);
    gate.group.position.set(0, 0, -55 - i * gateSpacing);
    gate.passed = false;
    gate.spinDir = i % 2 === 0 ? 1 : -1;
    root.add(gate.group);
    gates.push(gate);
  }

  let streakTravel = 0;
  const cyanGateCol = new THREE.Color('#20dcff');
  const warpGateCol = new THREE.Color('#ff5cd8');
  const flashGateCol = new THREE.Color('#ffffff');

  /**
   * Advances environment motion, gate crossings, asteroid tumbling, and warp shaders.
   */
  function update(elapsed, dt, state, onGatePass) {
    const { speed = 42, warp = 0 } = state;

    // Skybox & celestial slow drift
    skyMat.uniforms.uTime.value = elapsed;
    skyMat.uniforms.uWarp.value = warp;
    planetMesh.rotation.y = elapsed * 0.018;
    moonPivot.rotation.y = elapsed * 0.045;
    starfield.rotation.z = elapsed * 0.0025;

    // Warp streak scroll
    streakTravel += dt * speed * (1.25 + warp * 2.2);
    streakMat.uniforms.uOffset.value = streakTravel;
    streakMat.uniforms.uWarp.value = warp;

    // Asteroids streaming past along +Z
    const asteroidMove = dt * speed * 0.82;
    for (let i = 0; i < asteroidCount; i++) {
      const a = asteroidData[i];
      a.z += asteroidMove * a.speedMul;
      if (a.z > 80) {
        a.z -= asteroidSpanZ;
      }
      a.rx += a.drx * dt;
      a.ry += a.dry * dt;

      dummy.position.set(a.x, a.y, a.z);
      dummy.rotation.set(a.rx, a.ry, a.rz);
      dummy.scale.setScalar(a.scale);
      dummy.updateMatrix();
      asteroidsMesh.setMatrixAt(i, dummy.matrix);
    }
    asteroidsMesh.instanceMatrix.needsUpdate = true;

    // Orbital Transit Gates moving along +Z toward/past spacecraft
    const gateMove = dt * speed * 1.15;
    for (const g of gates) {
      const prevZ = g.group.position.z;
      g.group.position.z += gateMove;
      g.spinner.rotation.z += dt * (0.28 + warp * 0.85) * g.spinDir;

      // Detect crisp transit crossing past z = 0
      if (prevZ <= 0 && g.group.position.z > 0 && !g.passed) {
        g.passed = true;
        g.flash = 1.0;
        if (onGatePass) onGatePass();
      }

      // Recycle far behind camera back ahead into deep space
      if (g.group.position.z > 55) {
        g.group.position.z -= gateCount * gateSpacing;
        g.passed = false;
      }

      // Update gate glow color & transit flash decay
      if (g.flash > 0) {
        g.flash = Math.max(0, g.flash - dt * 2.4);
      }
      g.glowMat.emissive.copy(cyanGateCol).lerp(warpGateCol, warp * 0.78).lerp(flashGateCol, g.flash * 0.65);
      g.glowMat.emissiveIntensity = 1.9 + warp * 0.9 + g.flash * 2.4;
    }
  }

  return { group: root, update };
}
