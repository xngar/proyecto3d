import * as THREE from 'three';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function finalizeTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true, mirrored = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  const wrap = mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  tex.wrapS = repeatX > 1 || mirrored ? wrap : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 || mirrored ? wrap : THREE.ClampToEdgeWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Medium-dark walnut/oak laminate plank flooring: color, bump, and roughness maps.
 */
export function createWoodFloorTextures() {
  const { canvas: cCol, ctx: ctxCol } = makeCanvas(1024, 1024);
  const { canvas: cBmp, ctx: ctxBmp } = makeCanvas(1024, 1024);
  const { canvas: cRgh, ctx: ctxRgh } = makeCanvas(1024, 1024);

  ctxCol.fillStyle = '#5a3d27';
  ctxCol.fillRect(0, 0, 1024, 1024);
  ctxBmp.fillStyle = '#909090';
  ctxBmp.fillRect(0, 0, 1024, 1024);
  ctxRgh.fillStyle = '#707070';
  ctxRgh.fillRect(0, 0, 1024, 1024);

  const cols = 6;
  const rows = 12;
  const plankW = 1024 / cols;
  const plankH = 1024 / rows;

  const tones = ['#5a3e28', '#68472e', '#4d3320', '#704e34', '#5f412a', '#523723'];

  for (let c = 0; c < cols; c++) {
    const offset = (c % 2) * (plankH * 0.5);
    for (let r = -1; r <= rows; r++) {
      const x = c * plankW;
      const y = r * plankH + offset;
      const seed = (c * 17 + r * 31 + 99) % 100;
      const tone = tones[seed % tones.length];

      ctxCol.fillStyle = tone;
      ctxCol.fillRect(x, y, plankW, plankH);

      // Per-plank subtle sheen variation in roughness map
      const rVal = 95 + (seed % 40);
      ctxRgh.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      ctxRgh.fillRect(x, y, plankW, plankH);

      ctxBmp.fillStyle = '#9a9a9a';
      ctxBmp.fillRect(x, y, plankW, plankH);

      // Rich organic wood grain streaks
      for (let i = 0; i < 42; i++) {
        const gx = x + ((i * 29 + c * 19 + r * 11) % plankW);
        const w = 1 + (i % 3);
        const alpha = 0.045 + ((i * 13) % 7) * 0.015;
        ctxCol.fillStyle = i % 2 === 0 ? `rgba(24, 14, 7, ${alpha})` : `rgba(178, 134, 92, ${alpha * 0.85})`;
        ctxCol.fillRect(gx, y + 2, w, plankH - 4);

        ctxBmp.fillStyle = i % 2 === 0 ? 'rgba(110,110,110,0.28)' : 'rgba(185,185,185,0.22)';
        ctxBmp.fillRect(gx, y + 2, w, plankH - 4);

        ctxRgh.fillStyle = i % 2 === 0 ? 'rgba(155,155,155,0.2)' : 'rgba(80,80,80,0.2)';
        ctxRgh.fillRect(gx, y + 2, w, plankH - 4);
      }

      // Plank V-groove bevel seam
      ctxCol.strokeStyle = 'rgba(20, 11, 5, 0.65)';
      ctxCol.lineWidth = 2.5;
      ctxCol.strokeRect(x + 0.5, y + 0.5, plankW - 1, plankH - 1);

      ctxBmp.strokeStyle = '#181818';
      ctxBmp.lineWidth = 3;
      ctxBmp.strokeRect(x + 0.5, y + 0.5, plankW - 1, plankH - 1);

      ctxRgh.strokeStyle = '#d0d0d0';
      ctxRgh.lineWidth = 3;
      ctxRgh.strokeRect(x + 0.5, y + 0.5, plankW - 1, plankH - 1);
    }
  }

  return {
    map: finalizeTexture(cCol, { repeatX: 3.5, repeatY: 5.5, srgb: true }),
    bumpMap: finalizeTexture(cBmp, { repeatX: 3.5, repeatY: 5.5, srgb: false }),
    roughnessMap: finalizeTexture(cRgh, { repeatX: 3.5, repeatY: 5.5, srgb: false }),
  };
}

/**
 * Subtle plaster wall micro-texture bump map.
 */
export function createWallPlasterBump() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) {
    const x = (i * 73) % 256;
    const y = (i * 41 + Math.floor(i / 256) * 19) % 256;
    const v = 112 + (i % 34);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }
  return finalizeTexture(canvas, { repeatX: 6, repeatY: 4, srgb: false });
}

/**
 * Geometric block rug in terracotta red, ochre tan, sage grey, cream, and espresso brown + woven pile bump.
 */
export function createGeometricRugTextures() {
  const { canvas, ctx } = makeCanvas(1024, 768);
  const { canvas: cBmp, ctx: ctxBmp } = makeCanvas(512, 384);

  ctx.fillStyle = '#8b4135';
  ctx.fillRect(0, 0, 1024, 768);

  const blocks = [
    { x: 0, y: 0, w: 320, h: 360, c: '#8c3c31' },
    { x: 320, y: 0, w: 280, h: 240, c: '#a0724c' },
    { x: 600, y: 0, w: 424, h: 290, c: '#9b968c' },
    { x: 0, y: 360, w: 270, h: 408, c: '#a29d93' },
    { x: 270, y: 240, w: 330, h: 310, c: '#82342b' },
    { x: 600, y: 290, w: 424, h: 260, c: '#8e4135' },
    { x: 270, y: 550, w: 390, h: 218, c: '#9d7652' },
    { x: 660, y: 550, w: 364, h: 218, c: '#b8b2a6' },
    { x: 75, y: 75, w: 170, h: 210, c: '#b3aba0', r: 16 },
    { x: 115, y: 120, w: 95, h: 120, c: '#48382f', r: 10 },
    { x: 360, y: 310, w: 160, h: 170, c: '#9c978d', r: 14 },
    { x: 685, y: 65, w: 240, h: 170, c: '#7e332a', r: 16 },
    { x: 735, y: 105, w: 140, h: 90, c: '#9b958b', r: 10 },
    { x: 60, y: 440, w: 150, h: 240, c: '#81332a', r: 16 },
    { x: 700, y: 345, w: 240, h: 155, c: '#b5afa4', r: 16 },
    { x: 350, y: 595, w: 210, h: 125, c: '#7a332a', r: 12 },
  ];

  for (const b of blocks) {
    ctx.fillStyle = b.c;
    if (b.r) {
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, b.r);
      ctx.fill();
    } else {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }

  for (let i = 0; i < 65000; i++) {
    const x = (i * 97) % 1024;
    const y = (i * 53 + Math.floor(i / 1024) * 17) % 768;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(20,10,5,0.07)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = 'rgba(42, 28, 22, 0.6)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 1014, 758);

  // Carpet pile bump map
  ctxBmp.fillStyle = '#808080';
  ctxBmp.fillRect(0, 0, 512, 384);
  for (let i = 0; i < 55000; i++) {
    const v = 70 + (i % 120);
    ctxBmp.fillStyle = `rgb(${v},${v},${v})`;
    ctxBmp.fillRect((i * 59) % 512, (i * 37 + Math.floor(i / 512) * 11) % 384, 2, 2);
  }

  return {
    map: finalizeTexture(canvas, { srgb: true }),
    bumpMap: finalizeTexture(cBmp, { srgb: false }),
  };
}

/**
 * Woven beige slipcover fabric color + bump texture.
 */
export function createSofaFabricTextures() {
  const { canvas, ctx } = makeCanvas(256, 256);
  const { canvas: cBmp, ctx: ctxBmp } = makeCanvas(256, 256);

  ctx.fillStyle = '#e2d7c4';
  ctx.fillRect(0, 0, 256, 256);
  ctxBmp.fillStyle = '#808080';
  ctxBmp.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(255,250,242,0.08)' : 'rgba(130,115,96,0.07)';
    ctx.fillRect(0, y, 256, 1);
    ctxBmp.fillStyle = y % 4 === 0 ? '#a8a8a8' : '#5e5e5e';
    ctxBmp.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 2) {
    ctx.fillStyle = x % 4 === 0 ? 'rgba(255,250,242,0.05)' : 'rgba(130,115,96,0.06)';
    ctx.fillRect(x, 0, 1, 256);
    ctxBmp.fillStyle = x % 4 === 0 ? 'rgba(210,210,210,0.45)' : 'rgba(70,70,70,0.45)';
    ctxBmp.fillRect(x, 0, 1, 256);
  }

  return {
    map: finalizeTexture(canvas, { repeatX: 7, repeatY: 7, srgb: true }),
    bumpMap: finalizeTexture(cBmp, { repeatX: 7, repeatY: 7, srgb: false }),
  };
}

/**
 * Black-and-white patterned throw blanket draped over the 2-seat sofa arm.
 */
export function createThrowBlanketTexture() {
  const { canvas, ctx } = makeCanvas(512, 512);
  ctx.fillStyle = '#24272c';
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 24; y < 512; y += 48) {
    for (let x = 24; x < 512; x += 48) {
      ctx.fillStyle = (x + y) % 96 === 0 ? '#dcdad4' : '#738599';
      ctx.beginPath();
      ctx.ellipse(x, y, 14, 7, (x + y) * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finalizeTexture(canvas, { srgb: true });
}

/**
 * Soft radial/rectangular ambient-occlusion contact shadow texture for grounding furniture.
 */
export function createContactShadowTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  const grad = ctx.createRadialGradient(128, 128, 22, 128, 128, 124);
  grad.addColorStop(0, 'rgba(10, 7, 4, 0.56)');
  grad.addColorStop(0.55, 'rgba(10, 7, 4, 0.28)');
  grad.addColorStop(1, 'rgba(10, 7, 4, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/**
 * Exterior balcony view: daylight sky, layered trees, and warm ochre residential building.
 */
export function createExteriorViewTexture() {
  const { canvas, ctx } = makeCanvas(1024, 512);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
  skyGrad.addColorStop(0, '#a8d1ee');
  skyGrad.addColorStop(0.55, '#e8f3fa');
  skyGrad.addColorStop(1, '#d2dfc9');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Distant warm ochre/terracotta apartment building (visible in photos)
  ctx.fillStyle = '#d7965f';
  ctx.fillRect(620, 148, 188, 285);
  ctx.fillStyle = '#bd7b48';
  ctx.fillRect(620, 148, 188, 14);
  for (let wy = 182; wy < 405; wy += 40) {
    for (let wx = 640; wx < 790; wx += 36) {
      ctx.fillStyle = '#4e6373';
      ctx.fillRect(wx, wy, 20, 26);
    }
  }

  // Lush multi-layered foliage trees
  const treeColors = ['#486b33', '#5c8243', '#3b5928', '#6f9250', '#81a461'];
  for (let i = 0; i < 36; i++) {
    const cx = 20 + i * 29;
    const cy = 338 + Math.sin(i * 1.4) * 38;
    const rad = 36 + (i % 5) * 12;
    ctx.fillStyle = treeColors[i % treeColors.length];
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(canvas, { srgb: true });
}

/**
 * Animated canvas texture for the Smart TV when turned ON.
 */
export function createTVScreenController() {
  const { canvas, ctx } = makeCanvas(512, 288);
  const texture = finalizeTexture(canvas, { srgb: true });
  let isOn = false;

  const drawFrame = (time) => {
    if (!isOn) {
      const offGrad = ctx.createLinearGradient(0, 0, 512, 288);
      offGrad.addColorStop(0, '#0d0f13');
      offGrad.addColorStop(1, '#191d23');
      ctx.fillStyle = offGrad;
      ctx.fillRect(0, 0, 512, 288);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(240, 0);
      ctx.lineTo(120, 288);
      ctx.lineTo(0, 288);
      ctx.closePath();
      ctx.fill();
      texture.needsUpdate = true;
      return;
    }

    const t = time * 0.6;
    const grad = ctx.createLinearGradient(0, 0, 512, 288);
    grad.addColorStop(0, '#18344c');
    grad.addColorStop(0.55, '#c47b54');
    grad.addColorStop(1, '#261d28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 288);

    const sunX = 256 + Math.sin(t * 0.4) * 45;
    const sunY = 128 + Math.cos(t * 0.3) * 10;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 72);
    sunGrad.addColorStop(0, '#fff3cf');
    sunGrad.addColorStop(0.4, 'rgba(247, 178, 103, 0.7)');
    sunGrad.addColorStop(1, 'rgba(247, 178, 103, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1f2332';
    ctx.beginPath();
    ctx.moveTo(0, 288);
    ctx.lineTo(0, 200);
    ctx.lineTo(110, 145);
    ctx.lineTo(230, 195);
    ctx.lineTo(355, 132);
    ctx.lineTo(512, 188);
    ctx.lineTo(512, 288);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 224, 175, 0.25)';
    for (let i = 0; i < 8; i++) {
      const rw = 40 + Math.sin(t * 2 + i) * 18;
      ctx.fillRect(sunX - rw / 2, 212 + i * 8, rw, 3);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillRect(18, 228, 205, 42);
    ctx.fillStyle = '#f8efe4';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('AMBIENT 4K · PAISAJES', 30, 248);
    ctx.fillStyle = '#e09f67';
    ctx.font = '11px sans-serif';
    ctx.fillText('● Reproduciendo en vivo', 30, 263);

    texture.needsUpdate = true;
  };

  drawFrame(0);

  return {
    texture,
    get isOn() {
      return isOn;
    },
    setOn(val) {
      isOn = Boolean(val);
      drawFrame(performance.now() * 0.001);
    },
    update(time) {
      if (isOn) drawFrame(time);
    },
  };
}
