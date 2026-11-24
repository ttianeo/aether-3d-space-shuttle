import * as THREE from 'three';

/**
 * 1. Procedural Cosmic Nebula & Deep-Space Skybox Shader
 */
export const NebulaSkyboxShader = {
  uniforms: {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.62, 0.28, -0.73).normalize() },
    uWarp: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform float uWarp;
    varying vec3 vDir;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z
      );
    }

    float fbm(vec3 p) {
      float v = 0.0;
      float a = 0.52;
      mat3 rot = mat3(
        0.00,  0.80,  0.60,
       -0.80,  0.36, -0.48,
       -0.60, -0.48,  0.64
      );
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = rot * p * 2.08 + vec3(1.7, 9.2, 4.1);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec3 d = normalize(vDir);

      // Rich high-contrast deep space base
      vec3 col = mix(vec3(0.004, 0.008, 0.022), vec3(0.012, 0.024, 0.056), clamp(d.y * 0.5 + 0.5, 0.0, 1.0));

      // Tilted galactic band plane
      vec3 galacticNormal = normalize(vec3(0.32, 0.88, -0.35));
      float bandDist = abs(dot(d, galacticNormal));
      float galacticBand = exp(-bandDist * 4.4);

      // Volumetric layered nebula fBM
      vec3 q = d * 2.4 + vec3(0.0, uTime * 0.006, 0.0);
      float n1 = fbm(q);
      float n2 = fbm(q * 1.9 + vec3(n1 * 1.6, -n1 * 1.2, 0.5));
      float filament = pow(clamp(n2, 0.0, 1.0), 2.8);
      float cloud = pow(smoothstep(0.34, 0.88, n1), 1.45);

      // Rich cosmic nebula palette: sapphire blue, ionized teal, cosmic rose-magenta
      vec3 sapphire = vec3(0.035, 0.12, 0.38);
      vec3 teal = vec3(0.03, 0.34, 0.48);
      vec3 magenta = vec3(0.42, 0.07, 0.38);
      vec3 warmDust = vec3(0.48, 0.22, 0.14);

      vec3 nebula = mix(sapphire, teal, smoothstep(0.38, 0.8, n2));
      nebula = mix(nebula, magenta, smoothstep(0.48, 0.86, fbm(d * 3.1 + 4.0)) * 0.78);
      nebula += warmDust * pow(filament, 2.2) * galacticBand * 0.32;

      // Dark cosmic dust lanes cutting across galactic band
      float dustLane = smoothstep(0.44, 0.7, fbm(d * 4.2 + 8.3));
      float nebulaMask = (cloud * 0.42 + filament * 0.68) * (0.18 + galacticBand * 0.92);
      col += nebula * nebulaMask * (1.0 - dustLane * 0.62) * (0.78 + uWarp * 0.18);

      // Subtle sun atmospheric scatter in skybox direction
      float sunDot = max(dot(d, normalize(uSunDir)), 0.0);
      col += vec3(0.2, 0.48, 0.95) * pow(sunDot, 14.0) * 0.32;
      col += vec3(1.0, 0.92, 0.82) * pow(sunDot, 180.0) * 1.0;

      // Crisp distant pinpoint background stars
      vec3 starGrid = floor(d * 290.0);
      float h = hash(starGrid);
      if (h > 0.992) {
        vec3 cellCenter = (starGrid + 0.5) / 290.0;
        float dist = length(d - normalize(cellCenter));
        float starIntensity = smoothstep(0.0022, 0.0003, dist);
        float twinkle = 0.72 + 0.28 * sin(uTime * (2.0 + fract(h * 91.0) * 4.0) + h * 100.0);
        vec3 starColor = mix(vec3(0.65, 0.85, 1.0), vec3(1.0, 0.88, 0.72), fract(h * 37.3));
        col += starColor * starIntensity * twinkle * (0.65 + fract(h * 13.7) * 0.85);
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/**
 * 2. Volumetric Ion / Plasma Engine Exhaust Plume Shader
 */
export const EnginePlumeShader = {
  uniforms: {
    uTime: { value: 0 },
    uWarp: { value: 0 },
    uThrottle: { value: 0.75 },
    uCoreColor: { value: new THREE.Color('#ffffff') },
    uMidColor: { value: new THREE.Color('#2ce6ff') },
    uWarpColor: { value: new THREE.Color('#ff49d2') },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormalView;
    varying vec3 vViewPos;
    uniform float uTime;
    uniform float uWarp;

    void main() {
      vUv = uv;
      vec3 pos = position;
      // Subtle high-frequency plasma flutter increasing toward plume tip
      float tipFactor = 1.0 - uv.y;
      float flutter = sin(uTime * 48.0 + pos.y * 9.0 + pos.x * 12.0) * 0.032 * tipFactor * (1.0 + uWarp * 0.8);
      pos.x += flutter;
      pos.z += cos(uTime * 42.0 + pos.y * 7.5) * 0.032 * tipFactor * (1.0 + uWarp * 0.8);

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      vNormalView = normalize(normalMatrix * normal);
      vViewPos = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uWarp;
    uniform float uThrottle;
    uniform vec3 uCoreColor;
    uniform vec3 uMidColor;
    uniform vec3 uWarpColor;

    varying vec2 vUv;
    varying vec3 vNormalView;
    varying vec3 vViewPos;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      // vUv.y = 1.0 at nozzle exit, 0.0 at tail tip
      float axial = vUv.y;

      // View-angle soft edge falloff (volumetric look)
      vec3 viewDir = normalize(vViewPos);
      float ndotv = abs(dot(normalize(vNormalView), viewDir));
      float softEdge = pow(ndotv, 1.25);

      // Fast scrolling plasma turbulence
      float speed = 9.0 + uWarp * 18.0;
      float n1 = noise2(vec2(vUv.x * 6.0, axial * 5.0 + uTime * speed));
      float n2 = noise2(vec2(vUv.x * 12.0 - uTime * 2.0, axial * 11.0 + uTime * speed * 1.4));
      float turb = n1 * 0.65 + n2 * 0.35;

      // Mach shock-diamond rings near the nozzle
      float diamonds = pow(0.5 + 0.5 * sin(axial * 28.0 + uTime * 16.0), 3.0) * smoothstep(0.18, 0.92, axial);

      // Taper opacity smoothly toward tip and edge
      float tailFade = smoothstep(0.0, 0.68, axial + (turb - 0.5) * 0.25);
      float nozzleFade = smoothstep(1.0, 0.93, axial);

      vec3 outerTint = mix(uMidColor, uWarpColor, uWarp * 0.75);
      vec3 color = mix(outerTint, uCoreColor, smoothstep(0.48, 0.97, axial * ndotv + diamonds * 0.28));

      float intensity = (0.82 + uThrottle * 0.34 + uWarp * 0.42) * (0.72 + turb * 0.36 + diamonds * 0.34);
      float alpha = softEdge * tailFade * nozzleFade * clamp(0.32 + uThrottle * 0.42, 0.0, 0.82);

      gl_FragColor = vec4(color * intensity, alpha);
    }
  `,
};

/**
 * 3. Exoplanet Atmospheric Fresnel Halo Shader
 */
export const PlanetAtmosphereShader = {
  uniforms: {
    uSunDir: { value: new THREE.Vector3(0.62, 0.28, -0.73).normalize() },
    uGlowColor: { value: new THREE.Color('#3ecbff') },
    uRimColor: { value: new THREE.Color('#8ff4ff') },
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormalWorld;
    varying vec3 vViewDirWorld;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vNormalWorld = normalize(mat3(modelMatrix) * normal);
      vViewDirWorld = normalize(cameraPosition - worldPos.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uSunDir;
    uniform vec3 uGlowColor;
    uniform vec3 uRimColor;

    varying vec3 vNormalWorld;
    varying vec3 vViewDirWorld;

    void main() {
      vec3 N = normalize(vNormalWorld);
      vec3 V = normalize(vViewDirWorld);
      vec3 L = normalize(uSunDir);

      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.4);
      float sunWrap = smoothstep(-0.28, 0.75, dot(N, L));

      vec3 col = mix(uGlowColor, uRimColor, fresnel);
      float alpha = fresnel * (0.14 + sunWrap * 0.95);

      gl_FragColor = vec4(col * (1.1 + sunWrap * 0.9), alpha);
    }
  `,
};

/**
 * 4. Multi-Band Icy Planetary Rings Shader with Real-Time Planet Shadow
 */
export const PlanetRingsShader = {
  uniforms: {
    uSunDir: { value: new THREE.Vector3(0.62, 0.28, -0.73).normalize() },
    uPlanetCenter: { value: new THREE.Vector3(-82, -18, -165) },
    uPlanetRadius: { value: 44.0 },
    uInnerRadius: { value: 56.0 },
    uOuterRadius: { value: 108.0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorldPos;
    varying float vRadius;

    void main() {
      vRadius = length(position.xy);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uSunDir;
    uniform vec3 uPlanetCenter;
    uniform float uPlanetRadius;
    uniform float uInnerRadius;
    uniform float uOuterRadius;

    varying vec3 vWorldPos;
    varying float vRadius;

    void main() {
      float t = clamp((vRadius - uInnerRadius) / (uOuterRadius - uInnerRadius), 0.0, 1.0);

      // Edge soft fade
      float edgeFade = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.9, t);

      // Multi-frequency icy ringlets
      float bands = 0.55
        + 0.25 * sin(t * 78.0)
        + 0.14 * sin(t * 185.0 + 1.2)
        + 0.08 * cos(t * 340.0);

      // Cassini-style major dark division + secondary division
      float cassini = 1.0 - smoothstep(0.56, 0.585, t) * (1.0 - smoothstep(0.625, 0.65, t)) * 0.92;
      float encke = 1.0 - smoothstep(0.84, 0.85, t) * (1.0 - smoothstep(0.862, 0.872, t)) * 0.78;

      // Color gradient across ring radii (pale ice-cyan, titanium silver, dusty lilac)
      vec3 innerCol = vec3(0.45, 0.68, 0.92);
      vec3 midCol = vec3(0.76, 0.88, 0.98);
      vec3 outerCol = vec3(0.42, 0.52, 0.78);
      vec3 col = mix(innerCol, midCol, smoothstep(0.0, 0.55, t));
      col = mix(col, outerCol, smoothstep(0.55, 1.0, t));
      col *= (0.72 + bands * 0.45);

      // Real-time spherical shadow cast by planet onto its rings
      vec3 rel = vWorldPos - uPlanetCenter;
      vec3 L = normalize(uSunDir);
      float proj = dot(rel, L);
      float shadow = 1.0;
      if (proj < 0.0) {
        vec3 perp = rel - proj * L;
        float distFromAxis = length(perp);
        shadow = smoothstep(uPlanetRadius * 0.96, uPlanetRadius * 1.06, distFromAxis);
        shadow = mix(0.1, 1.0, shadow);
      }

      float alpha = edgeFade * cassini * encke * clamp(0.18 + bands * 0.52, 0.0, 0.78);
      gl_FragColor = vec4(col * shadow, alpha);
    }
  `,
};

/**
 * 5. GPU-Driven High-Speed Warp Streaks / Space Dust Shader (InstancedMesh)
 */
export const WarpStreaksShader = {
  uniforms: {
    uOffset: { value: 0 },
    uWarp: { value: 0 },
    uSpanZ: { value: 260.0 },
  },
  vertexShader: /* glsl */ `
    attribute vec3 aOffset;
    attribute vec3 aColor;
    attribute float aSpeed;
    attribute float aLength;

    uniform float uOffset;
    uniform float uWarp;
    uniform float uSpanZ;

    varying vec3 vColor;
    varying vec2 vUv;
    varying float vFade;

    void main() {
      vUv = uv;
      vColor = aColor;

      // Infinite seamless Z-wrapping on GPU
      float z = mod(aOffset.z + uOffset * aSpeed + uSpanZ * 0.5, uSpanZ) - uSpanZ * 0.5;
      // Push range slightly ahead of camera: [-200, +60]
      z -= 70.0;

      // Stretch along Z dramatically when Warp Drive activates
      float stretch = aLength * (1.0 + uWarp * 7.5);
      float thickness = mix(0.85, 1.12, uWarp);

      vec3 transformed = vec3(
        position.x * thickness,
        position.y * thickness,
        position.z * stretch
      );

      vec3 worldPos = transformed + vec3(aOffset.x, aOffset.y, z);

      // Fade smoothly at far entry and near exit behind camera
      float farFade = smoothstep(-200.0, -135.0, z);
      float nearFade = smoothstep(52.0, 16.0, z);
      vFade = farFade * nearFade;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uWarp;
    varying vec3 vColor;
    varying vec2 vUv;
    varying float vFade;

    void main() {
      // Taper brightness smoothly at both ends of streak
      float lengthwise = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
      vec3 warpPalette = mix(vec3(0.35, 0.82, 1.0), vec3(0.88, 0.42, 1.0), fract(vColor.r * 5.7));
      vec3 warpShift = mix(vColor, warpPalette, uWarp * 0.65);
      float brightness = mix(0.68, 1.02, uWarp);
      float alpha = lengthwise * vFade * mix(0.38, 0.56, uWarp);
      gl_FragColor = vec4(warpShift * brightness, alpha);
    }
  `,
};

/**
 * 6. Post-Processing Cinematic Vignette, Warp Chromatic Aberration & Subtle Film Grain
 */
export const CinematicFXShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uWarp: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uWarp;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);

      // Radial chromatic aberration swells dynamically during Warp Boost
      float caStrength = mix(0.0008, 0.0068, uWarp) * pow(dist * 1.45, 1.6);
      vec2 dir = normalize(centered + 1e-5) * caStrength;

      float r = texture2D(tDiffuse, vUv + dir).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir).b;
      vec3 color = vec3(r, g, b);

      // Subtle radial speed-edge glow during hyperdrive
      color += vec3(0.09, 0.22, 0.42) * smoothstep(0.42, 0.85, dist) * uWarp * 0.28;

      // Filmic vignette
      float vignette = smoothstep(0.92, 0.24, dist);
      color *= mix(0.54, 1.0, vignette);

      // Ultra-subtle film grain
      float grain = (rand(vUv + fract(uTime)) - 0.5) * 0.018;
      color += grain;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
