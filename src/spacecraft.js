import * as THREE from 'three';
import { createHullTextures, createCarbonTileTextures, createGlowTexture } from './textures.js';
import { EnginePlumeShader } from './shaders.js';

/**
 * Builds a sleek chined lifting-body fuselage via multi-station lofting along Z.
 * Nose points toward -Z; tail sits at +Z.
 */
function createLoftedFuselageGeometry() {
  // Each station: { z, w (half-width), top (dorsal height), bot (ventral depth), chineY, sharpness }
  const stations = [
    { z: -5.65, w: 0.03, top: 0.02, bot: -0.02, chineY: 0.0, topPinch: 0.5 },
    { z: -5.1,  w: 0.24, top: 0.14, bot: -0.09, chineY: -0.02, topPinch: 0.65 },
    { z: -4.2,  w: 0.54, top: 0.28, bot: -0.17, chineY: -0.05, topPinch: 0.72 },
    { z: -3.1,  w: 0.88, top: 0.44, bot: -0.25, chineY: -0.08, topPinch: 0.75 },
    { z: -2.0,  w: 1.18, top: 0.58, bot: -0.32, chineY: -0.1, topPinch: 0.72 },
    { z: -0.7,  w: 1.48, top: 0.68, bot: -0.37, chineY: -0.11, topPinch: 0.65 },
    { z: 0.8,   w: 1.66, top: 0.66, bot: -0.39, chineY: -0.11, topPinch: 0.58 },
    { z: 2.2,   w: 1.56, top: 0.56, bot: -0.35, chineY: -0.09, topPinch: 0.55 },
    { z: 3.15,  w: 1.32, top: 0.43, bot: -0.28, chineY: -0.06, topPinch: 0.55 },
    { z: 3.35,  w: 1.16, top: 0.34, bot: -0.22, chineY: -0.04, topPinch: 0.55 },
  ];

  const radialSegs = 28;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let s = 0; s < stations.length; s++) {
    const st = stations[s];
    const v = s / (stations.length - 1);

    for (let r = 0; r <= radialSegs; r++) {
      const u = r / radialSegs;
      const theta = u * Math.PI * 2; // 0 = +X chine, PI/2 = +Y top, PI = -X chine, 3PI/2 = -Y belly
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Sharpen the stealth chine edge around sinT ≈ 0
      const signX = Math.sign(cosT);
      const x = signX * Math.pow(Math.abs(cosT), 0.82) * st.w;

      let y;
      if (sinT >= 0) {
        // Upper sculpted dorsal deck with subtle faceted ridge
        const lift = Math.pow(sinT, st.topPinch);
        y = st.chineY + lift * (st.top - st.chineY);
      } else {
        // Flatter heat-shielded lifting-body belly
        const drop = Math.pow(-sinT, 0.52);
        y = st.chineY + drop * (st.bot - st.chineY);
      }

      positions.push(x, y, st.z);
      uvs.push(u * 2.0, v * 3.0);
    }
  }

  const ringLen = radialSegs + 1;
  for (let s = 0; s < stations.length - 1; s++) {
    for (let r = 0; r < radialSegs; r++) {
      const a = s * ringLen + r;
      const b = (s + 1) * ringLen + r;
      const c = (s + 1) * ringLen + (r + 1);
      const d = s * ringLen + (r + 1);

      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  // Cap aft bulkhead
  const aftCenterIdx = positions.length / 3;
  const last = stations[stations.length - 1];
  positions.push(0, 0.05, last.z);
  uvs.push(0.5, 1.0);
  const lastRingStart = (stations.length - 1) * ringLen;
  for (let r = 0; r < radialSegs; r++) {
    indices.push(aftCenterIdx, lastRingStart + r, lastRingStart + r + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Helper to create an extruded wing or stabilizer panel lying in XZ plane.
 */
function createAeroPanel(points2D, thickness, bevelSize = 0.03) {
  const shape = new THREE.Shape();
  shape.moveTo(points2D[0][0], points2D[0][1]);
  for (let i = 1; i < points2D.length; i++) {
    shape.lineTo(points2D[i][0], points2D[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize: bevelSize,
    bevelSegments: 2,
  });
  // ExtrudeGeometry builds in XY and extrudes along +Z; rotate so shape X->X, shape Y->-Z, thickness->Y
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -thickness * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the VX-09 "AETHER" Orbital Interceptor / Space Shuttle.
 * Returns { group, update(elapsed, dt, state) }
 */
export function createSpacecraft() {
  const root = new THREE.Group();
  const hullTex = createHullTextures();
  const carbonTex = createCarbonTileTextures();

  // --- Shared PBR Materials ---
  const hullMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dfe8f4'),
    map: hullTex.map,
    bumpMap: hullTex.bumpMap,
    bumpScale: 0.035,
    roughnessMap: hullTex.roughnessMap,
    metalness: 0.76,
    roughness: 0.34,
  });

  const darkCarbonMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a3242'),
    map: carbonTex.map,
    bumpMap: carbonTex.bumpMap,
    bumpScale: 0.04,
    metalness: 0.62,
    roughness: 0.46,
  });

  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#394356'),
    metalness: 0.88,
    roughness: 0.28,
  });

  const cobaltAccentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#19335c'),
    metalness: 0.72,
    roughness: 0.32,
  });

  const canopyGlassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#091b33'),
    emissive: new THREE.Color('#061a30'),
    emissiveIntensity: 0.35,
    metalness: 0.25,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.84,
    reflectivity: 1.0,
  });

  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#70eeff'),
    emissive: new THREE.Color('#1cd8ff'),
    emissiveIntensity: 1.85,
    roughness: 0.15,
    metalness: 0.1,
  });

  const amberGlowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffd391'),
    emissive: new THREE.Color('#ff8822'),
    emissiveIntensity: 1.85,
    roughness: 0.2,
  });

  const engineCoreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    emissive: new THREE.Color('#5ceeff'),
    emissiveIntensity: 2.6,
    roughness: 0.1,
  });

  // =========================================================================
  // 1. MAIN LOFTED FUSELAGE & VENTRAL HEAT-SHIELD
  // =========================================================================
  const fuselageGeo = createLoftedFuselageGeometry();
  const fuselageMesh = new THREE.Mesh(fuselageGeo, hullMat);
  root.add(fuselageMesh);

  // Dark carbon ventral heat-shield belly shell
  const bellyGeo = fuselageGeo.clone();
  bellyGeo.scale(0.97, 0.96, 0.985);
  const bellyPositions = bellyGeo.attributes.position;
  for (let i = 0; i < bellyPositions.count; i++) {
    const y = bellyPositions.getY(i);
    if (y > -0.05) {
      bellyPositions.setY(i, -0.05);
    }
  }
  bellyGeo.computeVertexNormals();
  const bellyMesh = new THREE.Mesh(bellyGeo, darkCarbonMat);
  bellyMesh.position.y = -0.035;
  root.add(bellyMesh);

  // Nose radar/quantum probe tip
  const noseTipGeo = new THREE.ConeGeometry(0.11, 0.85, 16);
  noseTipGeo.rotateX(-Math.PI / 2);
  const noseTip = new THREE.Mesh(noseTipGeo, darkCarbonMat);
  noseTip.position.set(0, 0.0, -5.85);
  root.add(noseTip);

  const probeNeedleGeo = new THREE.CylinderGeometry(0.012, 0.025, 0.65, 8);
  probeNeedleGeo.rotateX(-Math.PI / 2);
  const probeNeedle = new THREE.Mesh(probeNeedleGeo, gunmetalMat);
  probeNeedle.position.set(0, 0.0, -6.38);
  root.add(probeNeedle);

  // Dorsal Spine Ridge + Illuminated Cooling Spine Conduit (aft of cockpit: z = +0.15 to +3.18)
  const spineGeo = createAeroPanel(
    [
      [-0.36, -0.15],
      [-0.5, -2.7],
      [-0.28, -3.18],
      [0.28, -3.18],
      [0.5, -2.7],
      [0.36, -0.15],
    ],
    0.22,
    0.04
  );
  const spineMesh = new THREE.Mesh(spineGeo, cobaltAccentMat);
  spineMesh.position.set(0, 0.61, 0);
  root.add(spineMesh);

  // Glowing cyan energy strip recessed along the dorsal spine
  const spineStripGeo = new THREE.BoxGeometry(0.11, 0.05, 2.55);
  const spineStrip = new THREE.Mesh(spineStripGeo, cyanGlowMat);
  spineStrip.position.set(0, 0.75, 1.55);
  root.add(spineStrip);

  // Dorsal radiator louver slats flanking the spine
  for (let side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.04, 0.14),
        amberGlowMat
      );
      vent.position.set(side * 0.48, 0.64, 0.75 + i * 0.45);
      vent.rotation.z = -side * 0.28;
      root.add(vent);
    }
  }

  // =========================================================================
  // 2. IRIDESCENT COCKPIT CANOPY & INTERIOR HUD
  // =========================================================================
  const canopyGroup = new THREE.Group();
  canopyGroup.position.set(0, 0.53, -1.55);

  const canopyGeo = new THREE.SphereGeometry(1, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.58);
  canopyGeo.scale(0.56, 0.44, 1.55);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyGlassMat);
  canopyGroup.add(canopyMesh);

  // Structural canopy arch ribs (sleek dark titanium framing)
  const arch1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.53, 0.032, 10, 28, Math.PI),
    darkCarbonMat
  );
  arch1.scale.set(1.04, 0.82, 1.0);
  arch1.position.set(0, 0.02, -0.22);
  arch1.rotation.x = 0.24;
  canopyGroup.add(arch1);

  const arch2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.036, 10, 28, Math.PI),
    darkCarbonMat
  );
  arch2.scale.set(1.03, 0.81, 1.0);
  arch2.position.set(0, 0.01, 0.58);
  arch2.rotation.x = -0.18;
  canopyGroup.add(arch2);

  // Cockpit interior tub + holographic pilot HUD glass + pilot headrest
  const cockpitTub = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.12, 1.85),
    darkCarbonMat
  );
  cockpitTub.position.set(0, 0.02, 0.05);
  canopyGroup.add(cockpitTub);

  const pilotSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.34, 0.14),
    gunmetalMat
  );
  pilotSeat.position.set(0, 0.16, 0.36);
  pilotSeat.rotation.x = -0.28;
  canopyGroup.add(pilotSeat);

  const holoHudMat = new THREE.MeshBasicMaterial({
    color: '#3cf0ff',
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const holoHud = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.18), holoHudMat);
  holoHud.position.set(0, 0.19, -0.45);
  holoHud.rotation.x = -0.35;
  canopyGroup.add(holoHud);

  // Subtle cyan glow inside cockpit
  const cockpitLight = new THREE.PointLight('#2ee6ff', 1.4, 3.2);
  cockpitLight.position.set(0, 0.22, -0.25);
  canopyGroup.add(cockpitLight);

  root.add(canopyGroup);

  // =========================================================================
  // 3. SWEPT COMPOUND DELTA WINGS, LEADING EDGES, AILERONS & WINGLETS
  // =========================================================================
  const ailerons = [];
  const canards = [];
  const strobeMaterials = [];

  for (const side of [-1, 1]) {
    const wingGroup = new THREE.Group();

    // Main swept delta wing shape (note: 2D Y maps to -Z, so negative Y -> +Z aft!)
    const wingPts = [
      [side * 1.15, 1.45],   // front root (z = -1.45)
      [side * 2.55, 0.25],   // mid cranked leading edge
      [side * 5.05, -2.05],  // outer wingtip front (z = +2.05)
      [side * 4.92, -2.82],  // outer wingtip aft (z = +2.82)
      [side * 3.35, -2.35],  // stealth trailing notch
      [side * 2.5,  -2.95],  // inner trailing edge
      [side * 1.2,  -2.55],  // aft root (z = +2.55)
    ];
    if (side === -1) wingPts.reverse();

    const wingGeo = createAeroPanel(wingPts, 0.12, 0.032);
    const wingMesh = new THREE.Mesh(wingGeo, hullMat);
    wingMesh.position.y = -0.06;
    wingMesh.rotation.z = side * -0.045; // Subtle aggressive anhedral droop
    wingGroup.add(wingMesh);

    // Cobalt technical wing accent stripe
    const stripePts = [
      [side * 2.2, 0.3],
      [side * 3.9, -1.2],
      [side * 3.7, -1.75],
      [side * 2.0, -0.4],
    ];
    if (side === -1) stripePts.reverse();
    const stripeMesh = new THREE.Mesh(createAeroPanel(stripePts, 0.142, 0.01), cobaltAccentMat);
    stripeMesh.position.y = -0.06;
    stripeMesh.rotation.z = side * -0.045;
    wingGroup.add(stripeMesh);

    // Dark carbon-ceramic leading edge armor strip
    const lePts = [
      [side * 1.18, 1.5],
      [side * 2.58, 0.28],
      [side * 5.1, -2.04],
      [side * 4.86, -2.14],
      [side * 2.46, 0.08],
      [side * 1.18, 1.2],
    ];
    if (side === -1) lePts.reverse();
    const leadingEdge = new THREE.Mesh(createAeroPanel(lePts, 0.145, 0.025), darkCarbonMat);
    leadingEdge.position.y = -0.06;
    leadingEdge.rotation.z = side * -0.045;
    wingGroup.add(leadingEdge);

    // Articulated Trailing-Edge Aileron Flap
    const aileronPivot = new THREE.Group();
    aileronPivot.position.set(side * 3.9, -0.22, 2.55);
    const flapMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.38, 0.06, 0.34),
      darkCarbonMat
    );
    flapMesh.position.set(0, 0, 0.16);
    flapMesh.rotation.y = side * 0.24;
    aileronPivot.add(flapMesh);
    wingGroup.add(aileronPivot);
    ailerons.push({ pivot: aileronPivot, side });

    // Up-swept Canted Winglet + Plasma Strip + Navigation Beacon
    const wingletGroup = new THREE.Group();
    wingletGroup.position.set(side * 4.95, -0.25, 2.38);
    wingletGroup.rotation.z = -side * 0.42; // Swept upward & outward

    const wingletPts = [
      [0.0, 0.46],
      [0.95, -0.35],
      [0.92, -0.78],
      [0.0, -0.45],
    ];
    const wlGeo = createAeroPanel(wingletPts, 0.075, 0.02);
    // Rotate so panel extends vertically along +Y
    wlGeo.rotateZ(Math.PI / 2);
    const wingletMesh = new THREE.Mesh(wlGeo, darkCarbonMat);
    wingletGroup.add(wingletMesh);

    // Glowing Cyan Plasma Conduit along winglet leading ridge
    const wingGlowBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.92, 0.06),
      cyanGlowMat
    );
    wingGlowBar.position.set(0, 0.48, -0.04);
    wingGlowBar.rotation.x = 0.72;
    wingletGroup.add(wingGlowBar);

    // Port (Red) / Starboard (Green) Aviation Navigation Strobe
    const navColor = side === -1 ? '#ff2448' : '#22ff88';
    const navMat = new THREE.MeshStandardMaterial({
      color: navColor,
      emissive: new THREE.Color(navColor),
      emissiveIntensity: 3.2,
      roughness: 0.1,
    });
    const navBulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), navMat);
    navBulb.position.set(0, 0.94, 0.56);
    wingletGroup.add(navBulb);
    strobeMaterials.push({ mat: navMat, base: 3.2, phase: side === -1 ? 0 : Math.PI });

    wingGroup.add(wingletGroup);

    // Forward Swept Stealth Canard
    const canardPivot = new THREE.Group();
    canardPivot.position.set(side * 0.85, -0.02, -3.15);
    const canardPts = [
      [0, 0.45],
      [side * 1.15, -0.28],
      [side * 1.05, -0.58],
      [0, -0.22],
    ];
    if (side === -1) canardPts.reverse();
    const canardMesh = new THREE.Mesh(createAeroPanel(canardPts, 0.055, 0.015), darkCarbonMat);
    canardPivot.add(canardMesh);
    root.add(canardPivot);
    canards.push({ pivot: canardPivot, side });

    // Side Airframe Intake Nacelle + Internal Radiator Glow
    const intakeGroup = new THREE.Group();
    intakeGroup.position.set(side * 1.32, -0.04, 0.55);

    const intakeBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.46, 3.1),
      gunmetalMat
    );
    intakeGroup.add(intakeBody);

    // Angled stealth intake lip
    const intakeCowl = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.5, 0.55),
      darkCarbonMat
    );
    intakeCowl.position.set(0, 0.02, -1.62);
    intakeCowl.rotation.y = side * 0.18;
    intakeGroup.add(intakeCowl);

    // Glowing ionized intake core
    const intakeGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.3),
      cyanGlowMat
    );
    intakeGlow.position.set(0, 0, -1.89);
    intakeGlow.rotation.y = Math.PI + side * 0.18;
    intakeGroup.add(intakeGlow);

    // Auxiliary under-wing vernier thruster pod
    const auxPod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.24, 1.55, 16),
      gunmetalMat
    );
    auxPod.rotation.x = Math.PI / 2;
    auxPod.position.set(side * 2.18, -0.18, 2.05);
    wingGroup.add(auxPod);

    const auxCore = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 16),
      engineCoreMat
    );
    auxCore.position.set(side * 2.18, -0.18, 2.83);
    wingGroup.add(auxCore);

    root.add(intakeGroup);
    root.add(wingGroup);

    // =========================================================================
    // 4. TWIN CANTED VERTICAL TAIL STABILIZERS
    // =========================================================================
    const tailGroup = new THREE.Group();
    tailGroup.position.set(side * 1.18, 0.24, 2.18);
    tailGroup.rotation.z = -side * 0.46; // V-cant outward

    const tailPts = [
      [0.0, 1.05],
      [1.62, -0.68],
      [1.56, -1.25],
      [0.0, -0.95],
    ];
    const tailGeo = createAeroPanel(tailPts, 0.085, 0.022);
    tailGeo.rotateZ(Math.PI / 2);
    const tailMesh = new THREE.Mesh(tailGeo, hullMat);
    tailGroup.add(tailMesh);

    // Tail accent cyan glow strip hugging leading edge
    const tailGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 1.35, 0.055),
      cyanGlowMat
    );
    tailGlow.position.set(0, 0.84, -0.14);
    tailGlow.rotation.x = 0.81;
    tailGroup.add(tailGlow);

    // White anti-collision strobe on tail fin tip
    const tailStrobeMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: new THREE.Color('#ccf6ff'),
      emissiveIntensity: 3.5,
    });
    const tailStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), tailStrobeMat);
    tailStrobe.position.set(0, 1.58, 1.15);
    tailGroup.add(tailStrobe);
    strobeMaterials.push({ mat: tailStrobeMat, base: 1.2, flash: true, phase: side === -1 ? 0 : 0.15 });

    root.add(tailGroup);
  }

  // =========================================================================
  // 5. TWIN VECTORING ION/FUSION THRUSTERS + VOLUMETRIC PLASMA PLUMES
  // =========================================================================
  const plumeUniformSets = [];
  const mainPlumeMeshes = [];
  const auxPlumeMeshes = [];
  const glowSpriteTex = createGlowTexture('#ffffff', '#3de8ff', 'rgba(20, 80, 220, 0)');
  const engineFlares = [];

  for (const side of [-1, 1]) {
    const engineGroup = new THREE.Group();
    engineGroup.position.set(side * 0.72, -0.02, 3.22);

    // Outer machined thruster shroud
    const shroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.75, 24, 1, true),
      gunmetalMat
    );
    shroud.rotation.x = Math.PI / 2;
    shroud.position.z = 0.05;
    engineGroup.add(shroud);

    // Dark recessed inner combustion collar
    const innerCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.4, 0.65, 20, 1, true),
      darkCarbonMat
    );
    innerCollar.rotation.x = Math.PI / 2;
    innerCollar.position.z = 0.08;
    engineGroup.add(innerCollar);

    // 12 interlocking vectoring nozzle petals arranged radially
    const petalCount = 12;
    for (let p = 0; p < petalCount; p++) {
      const angle = (p / petalCount) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.04, 0.44),
        darkCarbonMat
      );
      petal.position.set(Math.cos(angle) * 0.41, Math.sin(angle) * 0.41, 0.32);
      petal.rotation.z = angle + Math.PI / 2;
      petal.rotation.x = 0.12;
      engineGroup.add(petal);
    }

    // Blazing recessed plasma core disc
    const coreDisc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), engineCoreMat);
    coreDisc.position.z = 0.25;
    engineGroup.add(coreDisc);

    // Inner incandescent plasma plume cone (pointing along +Z)
    const innerPlumeGeo = new THREE.CylinderGeometry(0.28, 0.02, 3.8, 28, 18, true);
    innerPlumeGeo.translate(0, -1.9, 0);
    innerPlumeGeo.rotateX(-Math.PI / 2);

    const innerMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(EnginePlumeShader.uniforms),
      vertexShader: EnginePlumeShader.vertexShader,
      fragmentShader: EnginePlumeShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const innerPlume = new THREE.Mesh(innerPlumeGeo, innerMat);
    innerPlume.position.z = 0.28;
    engineGroup.add(innerPlume);
    plumeUniformSets.push(innerMat.uniforms);
    mainPlumeMeshes.push(innerPlume);

    // Outer wider plasma ion sheath
    const outerPlumeGeo = new THREE.CylinderGeometry(0.41, 0.06, 5.4, 28, 18, true);
    outerPlumeGeo.translate(0, -2.7, 0);
    outerPlumeGeo.rotateX(-Math.PI / 2);

    const outerMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(EnginePlumeShader.uniforms),
      vertexShader: EnginePlumeShader.vertexShader,
      fragmentShader: EnginePlumeShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    outerMat.uniforms.uMidColor.value.set('#148eff');
    const outerPlume = new THREE.Mesh(outerPlumeGeo, outerMat);
    outerPlume.position.z = 0.24;
    engineGroup.add(outerPlume);
    plumeUniformSets.push(outerMat.uniforms);
    mainPlumeMeshes.push(outerPlume);

    // Volumetric engine flare sprite right at nozzle mouth
    const flareMat = new THREE.SpriteMaterial({
      map: glowSpriteTex,
      color: new THREE.Color('#3ad8ff'),
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flare = new THREE.Sprite(flareMat);
    flare.position.set(0, 0, 0.46);
    flare.scale.set(1.35, 1.35, 1);
    engineGroup.add(flare);
    engineFlares.push(flare);

    root.add(engineGroup);

    // Auxiliary Under-Wing Mini-Plumes
    const auxGeo = new THREE.CylinderGeometry(0.14, 0.015, 2.2, 16, 10, true);
    auxGeo.translate(0, -1.1, 0);
    auxGeo.rotateX(-Math.PI / 2);
    const auxMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(EnginePlumeShader.uniforms),
      vertexShader: EnginePlumeShader.vertexShader,
      fragmentShader: EnginePlumeShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const auxPlume = new THREE.Mesh(auxGeo, auxMat);
    auxPlume.position.set(side * 2.18, -0.18, 2.84);
    root.add(auxPlume);
    plumeUniformSets.push(auxMat.uniforms);
    auxPlumeMeshes.push(auxPlume);
  }

  // Dynamic bounce light from twin ion engines illuminating tail fins & rear deck
  const engineGlowLight = new THREE.PointLight('#28c8ff', 2.8, 12, 1.8);
  engineGlowLight.position.set(0, 0.15, 4.4);
  root.add(engineGlowLight);

  // Subtle wingtip ionized plasma slipstream trails
  const slipstreamMats = [];
  const slipstreamMeshes = [];
  for (const side of [-1, 1]) {
    const trailGeo = new THREE.CylinderGeometry(0.04, 0.004, 5.5, 8, 6, true);
    trailGeo.translate(0, -2.75, 0);
    trailGeo.rotateX(-Math.PI / 2);
    const trailMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(EnginePlumeShader.uniforms),
      vertexShader: EnginePlumeShader.vertexShader,
      fragmentShader: EnginePlumeShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    trailMat.uniforms.uThrottle.value = 0.25;
    const trailMesh = new THREE.Mesh(trailGeo, trailMat);
    trailMesh.position.set(side * 5.28, 0.56, 2.86);
    root.add(trailMesh);
    slipstreamMats.push(trailMat);
    slipstreamMeshes.push(trailMesh);
  }

  const cruiseColor = new THREE.Color('#38ddff');
  const warpColor = new THREE.Color('#ff5cd8');
  const tmpColor = new THREE.Color();

  /**
   * Per-frame animation of engines, flaps, strobes, and warp response.
   */
  function update(elapsed, dt, state) {
    const { warp = 0, roll = 0, pitch = 0, throttle = 0.72 } = state;

    // Update all engine plasma shaders
    for (const u of plumeUniformSets) {
      u.uTime.value = elapsed;
      u.uWarp.value = warp;
      u.uThrottle.value = throttle;
    }

    // Elongate & pulse main thruster plumes with throttle & Warp Boost
    const flicker = 0.96 + Math.sin(elapsed * 44) * 0.04 + Math.cos(elapsed * 67) * 0.03;
    const plumeScaleZ = (0.85 + throttle * 0.45 + warp * 1.45) * flicker;
    const plumeScaleXY = 0.92 + warp * 0.38;
    for (const m of mainPlumeMeshes) {
      m.scale.set(plumeScaleXY, plumeScaleXY, plumeScaleZ);
    }
    for (const m of auxPlumeMeshes) {
      m.scale.set(0.9 + warp * 0.25, 0.9 + warp * 0.25, plumeScaleZ * 0.85);
    }

    // Wingtip ionized slipstreams flare up during hard banking or Warp Drive
    const slipIntensity = THREE.MathUtils.clamp(Math.abs(roll) * 0.75 + warp * 0.95, 0.06, 1.0);
    for (let i = 0; i < slipstreamMats.length; i++) {
      slipstreamMats[i].uniforms.uTime.value = elapsed;
      slipstreamMats[i].uniforms.uWarp.value = warp;
      slipstreamMats[i].uniforms.uThrottle.value = slipIntensity * 0.65;
      slipstreamMeshes[i].scale.set(1, 1, 0.45 + warp * 2.1 + Math.abs(roll) * 0.9);
    }

    // Shift engine core light & lens flare color smoothly from cyan -> vivid magenta-white in Warp
    tmpColor.copy(cruiseColor).lerp(warpColor, warp * 0.72);
    engineGlowLight.color.copy(tmpColor);
    engineGlowLight.intensity = (2.6 + warp * 3.8) * flicker;
    engineCoreMat.emissive.copy(tmpColor);
    engineCoreMat.emissiveIntensity = 2.4 + warp * 2.0;

    for (const f of engineFlares) {
      f.material.color.copy(tmpColor);
      const fs = (1.28 + warp * 0.95) * flicker;
      f.scale.set(fs, fs, 1);
    }

    // Articulated Ailerons & Forward Canards react to roll & pitch
    for (const a of ailerons) {
      a.pivot.rotation.x = THREE.MathUtils.clamp(pitch * 0.65 + a.side * roll * 0.55, -0.45, 0.45);
    }
    for (const c of canards) {
      c.pivot.rotation.x = THREE.MathUtils.clamp(-pitch * 0.55 - c.side * roll * 0.22, -0.35, 0.35);
    }

    // Realistic aviation strobe beacons
    for (const s of strobeMaterials) {
      if (s.flash) {
        // Double-pulse crisp aviation strobe every 1.8s
        const cycle = (elapsed + s.phase) % 1.8;
        const pulse =
          (cycle > 0.0 && cycle < 0.07) || (cycle > 0.14 && cycle < 0.21) ? 7.5 : 0.35;
        s.mat.emissiveIntensity = pulse;
      } else {
        s.mat.emissiveIntensity = s.base * (0.7 + 0.3 * Math.sin(elapsed * 3.5 + s.phase));
      }
    }
  }

  return { group: root, update };
}
