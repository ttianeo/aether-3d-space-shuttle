import * as THREE from 'three';

/**
 * Deterministic pseudo-random helper for repeatable procedural textures.
 */
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
 * Generates high-detail aerospace titanium-ceramic hull textures (albedo, bump, roughness).
 */
export function createHullTextures() {
  const size = 1024;
  const rand = mulberry32(4219);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  // Base metallic pearl-titanium fill
  ctx.fillStyle = '#cfd8e4';
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#909090';
  bCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#5a5a5a';
  rCtx.fillRect(0, 0, size, size);

  // Subtle brushed metal longitudinal streaks
  for (let i = 0; i < 1800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 30 + rand() * 140;
    const alpha = 0.015 + rand() * 0.03;
    const bright = rand() > 0.5;
    ctx.fillStyle = bright
      ? `rgba(255,255,255,${alpha})`
      : `rgba(40,55,75,${alpha})`;
    ctx.fillRect(x, y, 1.5, len);

    rCtx.fillStyle = bright
      ? `rgba(110,110,110,${alpha * 2})`
      : `rgba(50,50,50,${alpha * 2})`;
    rCtx.fillRect(x, y, 2, len);
  }

  // Modular aerospace hull panels with tonal variation
  const cols = 8;
  const rows = 8;
  const cw = size / cols;
  const ch = size / rows;

  for (let gx = 0; gx < cols; gx++) {
    for (let gy = 0; gy < rows; gy++) {
      const px = gx * cw;
      const py = gy * ch;
      const shadeShift = Math.floor((rand() - 0.5) * 28);
      const r = 198 + shadeShift;
      const g = 208 + shadeShift;
      const b = 222 + shadeShift;

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px + 2, py + 2, cw - 4, ch - 4);

      const roughVal = Math.floor(72 + rand() * 44);
      rCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
      rCtx.fillRect(px + 2, py + 2, cw - 4, ch - 4);

      const bumpVal = Math.floor(140 + (rand() - 0.5) * 24);
      bCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
      bCtx.fillRect(px + 2, py + 2, cw - 4, ch - 4);

      // Sub-hatch details on selected panels
      if (rand() > 0.55) {
        const inset = 18;
        ctx.strokeStyle = 'rgba(42, 54, 72, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + inset, py + inset, cw - inset * 2, ch - inset * 2);

        bCtx.strokeStyle = '#3c3c3c';
        bCtx.lineWidth = 2;
        bCtx.strokeRect(px + inset, py + inset, cw - inset * 2, ch - inset * 2);
      }

      // Micro-rivets along panel edges
      const rivetCount = 5;
      for (let rv = 1; rv < rivetCount; rv++) {
        const rx = px + (cw / rivetCount) * rv;
        const ryTop = py + 8;
        const ryBot = py + ch - 8;
        ctx.fillStyle = 'rgba(60, 76, 98, 0.45)';
        ctx.beginPath();
        ctx.arc(rx, ryTop, 1.4, 0, Math.PI * 2);
        ctx.arc(rx, ryBot, 1.4, 0, Math.PI * 2);
        ctx.fill();

        bCtx.fillStyle = '#404040';
        bCtx.beginPath();
        bCtx.arc(rx, ryTop, 1.6, 0, Math.PI * 2);
        bCtx.arc(rx, ryBot, 1.6, 0, Math.PI * 2);
        bCtx.fill();
      }
    }
  }

  // Crisp recessed panel seams
  ctx.strokeStyle = 'rgba(30, 42, 60, 0.72)';
  ctx.lineWidth = 2.5;
  bCtx.strokeStyle = '#1a1a1a';
  bCtx.lineWidth = 3.5;
  rCtx.strokeStyle = '#c8c8c8';
  rCtx.lineWidth = 3.5;

  for (let i = 0; i <= cols; i++) {
    const x = i * cw;
    [ctx, bCtx, rCtx].forEach((c) => {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, size);
      c.stroke();
    });
  }
  for (let j = 0; j <= rows; j++) {
    const y = j * ch;
    [ctx, bCtx, rCtx].forEach((c) => {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(size, y);
      c.stroke();
    });
  }

  // Technical aerospace accent band
  ctx.fillStyle = 'rgba(26, 46, 74, 0.65)';
  ctx.fillRect(0, ch * 3 + 4, size, 16);
  ctx.fillStyle = 'rgba(56, 224, 255, 0.55)';
  ctx.fillRect(0, ch * 3 + 22, size, 4);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = 8;

  return { map, bumpMap, roughnessMap };
}

/**
 * Generates dark carbon-ceramic heat-shield tile textures for belly & leading edges.
 */
export function createCarbonTileTextures() {
  const size = 512;
  const rand = mulberry32(9001);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  ctx.fillStyle = '#1a202c';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#242424';
  bCtx.fillRect(0, 0, size, size);

  const tileW = 32;
  const tileH = 24;
  for (let row = 0; row < size / tileH; row++) {
    const offset = (row % 2) * (tileW / 2);
    for (let col = -1; col <= size / tileW + 1; col++) {
      const x = col * tileW + offset;
      const y = row * tileH;
      const v = Math.floor(24 + rand() * 18);
      ctx.fillStyle = `rgb(${v},${v + 4},${v + 11})`;
      ctx.fillRect(x + 1.5, y + 1.5, tileW - 3, tileH - 3);

      const bv = Math.floor(155 + rand() * 45);
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);
    }
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  return { map, bumpMap };
}

/**
 * Generates an atmospheric banded exoplanet surface texture.
 */
export function createExoplanetTexture() {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Vertical latitude base gradient (sapphire / ice-teal / twilight violet gas giant)
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#0a1228');
  grad.addColorStop(0.14, '#132854');
  grad.addColorStop(0.28, '#1e4a82');
  grad.addColorStop(0.39, '#488cc2');
  grad.addColorStop(0.47, '#8ad5ec');
  grad.addColorStop(0.55, '#2b6199');
  grad.addColorStop(0.67, '#1d3266');
  grad.addColorStop(0.79, '#3a4b88');
  grad.addColorStop(0.9, '#152248');
  grad.addColorStop(1.0, '#091024');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const rand = mulberry32(7712);

  // Swirling atmospheric jet-stream bands
  for (let i = 0; i < 240; i++) {
    const y = rand() * h;
    const bandH = 2 + rand() * 14;
    const palette = [
      'rgba(162, 232, 255, 0.14)',
      'rgba(62, 134, 214, 0.16)',
      'rgba(14, 28, 62, 0.24)',
      'rgba(190, 155, 255, 0.10)',
      'rgba(240, 200, 150, 0.08)',
    ];
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];

    ctx.beginPath();
    ctx.moveTo(0, y);
    const freq = 1 + Math.floor(rand() * 3);
    const amp = 2 + rand() * 7;
    const phase = rand() * Math.PI * 2;
    for (let x = 0; x <= w; x += 16) {
      const yy = y + Math.sin((x / w) * Math.PI * 2 * freq + phase) * amp;
      ctx.lineTo(x, yy);
    }
    for (let x = w; x >= 0; x -= 16) {
      const yy =
        y + bandH + Math.sin((x / w) * Math.PI * 2 * freq + phase + 0.4) * amp;
      ctx.lineTo(x, yy);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Prominent swirling storm eye (Great Cyan Vortex)
  const sx = w * 0.36;
  const sy = h * 0.44;
  for (let r = 56; r > 4; r -= 4) {
    const t = r / 56;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1.65, 0.82);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle =
      r < 18
        ? `rgba(210, 248, 255, ${(1 - t) * 0.26})`
        : `rgba(88, 195, 240, ${(1 - t) * 0.16})`;
    ctx.fill();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Generates a soft luminous radial glow sprite texture (for stars, corona, flares).
 */
export function createGlowTexture(innerColor = '#ffffff', midColor = '#5be4ff', outerColor = 'rgba(20, 60, 160, 0)') {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, innerColor);
  grad.addColorStop(0.18, innerColor);
  grad.addColorStop(0.42, midColor);
  grad.addColorStop(1.0, outerColor);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates an anamorphic horizontal sci-fi star flare texture.
 */
export function createAnamorphicFlareTexture() {
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Horizontal streak
  const hGrad = ctx.createLinearGradient(0, h / 2, w, h / 2);
  hGrad.addColorStop(0.0, 'rgba(60, 190, 255, 0)');
  hGrad.addColorStop(0.32, 'rgba(90, 210, 255, 0.22)');
  hGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.92)');
  hGrad.addColorStop(0.68, 'rgba(90, 210, 255, 0.22)');
  hGrad.addColorStop(1.0, 'rgba(60, 190, 255, 0)');

  ctx.fillStyle = hGrad;
  ctx.fillRect(0, h / 2 - 4, w, 8);

  // Soft vertical falloff mask
  ctx.globalCompositeOperation = 'destination-in';
  const vGrad = ctx.createLinearGradient(0, 0, 0, h);
  vGrad.addColorStop(0.0, 'rgba(255,255,255,0)');
  vGrad.addColorStop(0.45, 'rgba(255,255,255,0.65)');
  vGrad.addColorStop(0.5, 'rgba(255,255,255,1)');
  vGrad.addColorStop(0.55, 'rgba(255,255,255,0.65)');
  vGrad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
