import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  createContactShadowTexture,
  createGeometricRugTextures,
  createSofaFabricTextures,
  createThrowBlanketTexture,
  createTVScreenController,
} from '../textures/proceduralTextures.js';

function tagInteractive(obj, hotspotId) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.userData.hotspotId = hotspotId;
    }
  });
}

function addBoxCollider(colliders, x, z, w, d) {
  colliders.push({
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
  });
}

function addContactShadow(parent, shadowTex, x, z, w, d, opacity = 0.65) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity,
      depthWrite: false,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.003, z);
  parent.add(mesh);
}

/**
 * Creates a plump pillow geometry by subdividing a RoundedBoxGeometry and puffing the center.
 */
function createPlumpPillowGeometry(w, h, d) {
  const geo = new RoundedBoxGeometry(w, h, d, 5, 0.045);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = x / (w * 0.5);
    const ny = y / (h * 0.5);
    // Bulge center softly while pinching corners slightly
    const puff = Math.max(0, 1 - (nx * nx * 0.65 + ny * ny * 0.65));
    pos.setZ(i, z * (0.72 + puff * 0.62));
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates botanical curved leaf blades in a ceramic pot with dark soil.
 */
function createBotanicalPlant(scale = 1, leafColor = 0x2a5c30, potColor = 0x2c2825) {
  const group = new THREE.Group();

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115 * scale, 0.082 * scale, 0.19 * scale, 18),
    new THREE.MeshStandardMaterial({ color: potColor, roughness: 0.55, metalness: 0.08 })
  );
  pot.position.y = 0.095 * scale;
  pot.castShadow = true;
  pot.receiveShadow = true;
  group.add(pot);

  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(0.105 * scale, 16),
    new THREE.MeshStandardMaterial({ color: 0x261c14, roughness: 0.95 })
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.18 * scale;
  group.add(soil);

  // Leaf blade shape
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.055 * scale, 0.08 * scale, 0.065 * scale, 0.2 * scale, 0, 0.3 * scale);
  leafShape.bezierCurveTo(-0.065 * scale, 0.2 * scale, -0.055 * scale, 0.08 * scale, 0, 0);

  const leafGeo = new THREE.ShapeGeometry(leafShape, 8);
  const lPos = leafGeo.attributes.position;
  for (let i = 0; i < lPos.count; i++) {
    const y = lPos.getY(i);
    const x = lPos.getX(i);
    // Natural arch along blade length + V-fold midrib
    const arch = Math.pow(y / (0.3 * scale), 1.8) * 0.085 * scale;
    const vFold = Math.abs(x) * 0.22;
    lPos.setZ(i, -arch + vFold);
  }
  leafGeo.computeVertexNormals();

  const leafMat = new THREE.MeshStandardMaterial({
    color: leafColor,
    roughness: 0.45,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3b6332, roughness: 0.7 });

  const leafCount = 13;
  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2 + (i % 2) * 0.25;
    const tier = i % 3;
    const stemH = (0.14 + tier * 0.07) * scale;

    const branch = new THREE.Group();
    branch.position.set(Math.cos(angle) * 0.02 * scale, 0.17 * scale, Math.sin(angle) * 0.02 * scale);
    branch.rotation.y = angle;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005 * scale, 0.008 * scale, stemH, 6),
      stemMat
    );
    stem.position.y = stemH / 2;
    stem.rotation.x = 0.22 + tier * 0.14;
    branch.add(stem);

    const blade = new THREE.Mesh(leafGeo, leafMat);
    blade.position.set(0, stemH * 0.9, Math.sin(0.22 + tier * 0.14) * stemH * 0.5);
    blade.rotation.x = 0.55 + tier * 0.22;
    blade.scale.setScalar(0.8 + (i % 3) * 0.16);
    blade.castShadow = true;
    branch.add(blade);

    group.add(branch);
  }

  return group;
}

/**
 * Framed painting with stepped wood molding, cream mat passepartout, and subtle glass sheen.
 */
function createFramedPainting(textureLoader, imageUrl, width, height, frameColor = 0x8e7c62) {
  const group = new THREE.Group();
  const tex = textureLoader.load(imageUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.42,
    metalness: 0.34,
  });

  const frameDepth = 0.04;
  const border = 0.05;
  const frameBack = new THREE.Mesh(
    new RoundedBoxGeometry(width + border * 2, height + border * 2, frameDepth, 2, 0.008),
    frameMat
  );
  frameBack.castShadow = true;
  frameBack.receiveShadow = true;
  group.add(frameBack);

  // Subtle cream passepartout mat
  const matBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.032, height + 0.032),
    new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.85 })
  );
  matBoard.position.z = frameDepth / 2 + 0.001;
  group.add(matBoard);

  const artPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.48 })
  );
  artPlane.position.z = frameDepth / 2 + 0.0025;
  group.add(artPlane);

  // Subtle protective glass reflection plane
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.025, height + 0.025),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07,
      roughness: 0.08,
      metalness: 0.1,
    })
  );
  glass.position.z = frameDepth / 2 + 0.004;
  group.add(glass);

  return group;
}

/**
 * Plush slipcovered sofa with RoundedBoxGeometry cushions, rolled armrests, skirt folds, and real photo cushions.
 */
function createSofa({ seats = 3, fabricTextures, cushionTex1, cushionTex2, hasThrow = false, throwTex }) {
  const sofa = new THREE.Group();
  const seatWidth = seats === 3 ? 1.62 : 1.16;
  const armW = 0.21;
  const totalW = seatWidth + armW * 2;
  const depth = 0.88;

  const fabricMat = new THREE.MeshStandardMaterial({
    map: fabricTextures.map,
    bumpMap: fabricTextures.bumpMap,
    bumpScale: 0.006,
    color: 0xe6dccb,
    roughness: 0.88,
  });

  // Base apron with soft bevel
  const base = new THREE.Mesh(new RoundedBoxGeometry(totalW, 0.24, depth, 4, 0.035), fabricMat);
  base.position.set(0, 0.14, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  sofa.add(base);

  // Subtle wavy slipcover bottom skirt
  const skirtGeo = new THREE.BoxGeometry(totalW + 0.02, 0.12, depth + 0.02, 24, 2, 12);
  const skPos = skirtGeo.attributes.position;
  for (let i = 0; i < skPos.count; i++) {
    const x = skPos.getX(i);
    const y = skPos.getY(i);
    if (y < 0) {
      const z = skPos.getZ(i);
      skPos.setZ(i, z + Math.sin(x * 18) * 0.008);
    }
  }
  skirtGeo.computeVertexNormals();
  const skirt = new THREE.Mesh(skirtGeo, fabricMat);
  skirt.position.set(0, 0.065, 0);
  skirt.castShadow = true;
  sofa.add(skirt);

  // Plush rounded seat cushions
  const cw = seatWidth / seats - 0.015;
  for (let i = 0; i < seats; i++) {
    const cx = -seatWidth / 2 + (i + 0.5) * (seatWidth / seats);
    const cushion = new THREE.Mesh(
      new RoundedBoxGeometry(cw, 0.16, depth - 0.16, 5, 0.055),
      fabricMat
    );
    cushion.position.set(cx, 0.34, 0.06);
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    sofa.add(cushion);
  }

  // Sculpted backrest cushions
  for (let i = 0; i < seats; i++) {
    const cx = -seatWidth / 2 + (i + 0.5) * (seatWidth / seats);
    const backCush = new THREE.Mesh(
      new RoundedBoxGeometry(cw, 0.48, 0.22, 5, 0.065),
      fabricMat
    );
    backCush.position.set(cx, 0.6, -depth / 2 + 0.12);
    backCush.rotation.x = -0.08;
    backCush.castShadow = true;
    backCush.receiveShadow = true;
    sofa.add(backCush);
  }

  // Rolled slipcovered armrests
  for (const side of [-1, 1]) {
    const armBody = new THREE.Mesh(
      new RoundedBoxGeometry(armW, 0.44, depth - 0.04, 4, 0.045),
      fabricMat
    );
    armBody.position.set(side * (seatWidth / 2 + armW / 2), 0.36, 0);
    armBody.castShadow = true;
    armBody.receiveShadow = true;
    sofa.add(armBody);

    const armRoll = new THREE.Mesh(
      new THREE.CylinderGeometry(armW / 2, armW / 2, depth - 0.05, 18),
      fabricMat
    );
    armRoll.rotation.x = Math.PI / 2;
    armRoll.position.set(side * (seatWidth / 2 + armW / 2), 0.57, 0);
    armRoll.castShadow = true;
    sofa.add(armRoll);
  }

  // Plump decorative cushions using real cropped textures
  const pillowGeo1 = createPlumpPillowGeometry(0.43, 0.39, 0.15);
  const pillowGeo2 = createPlumpPillowGeometry(0.4, 0.37, 0.14);

  const pillow1Mat = new THREE.MeshStandardMaterial({
    map: cushionTex1,
    bumpMap: fabricTextures.bumpMap,
    bumpScale: 0.008,
    roughness: 0.78,
  });
  const pillow2Mat = new THREE.MeshStandardMaterial({
    map: cushionTex2,
    bumpMap: fabricTextures.bumpMap,
    bumpScale: 0.008,
    roughness: 0.78,
  });

  const p1 = new THREE.Mesh(pillowGeo1, pillow1Mat);
  p1.position.set(-seatWidth * 0.26, 0.57, -0.14);
  p1.rotation.set(-0.26, 0.24, 0.08);
  p1.castShadow = true;
  sofa.add(p1);

  const p2 = new THREE.Mesh(pillowGeo2, seats === 3 ? pillow1Mat : pillow2Mat);
  p2.position.set(seatWidth * 0.23, 0.56, -0.14);
  p2.rotation.set(-0.24, -0.26, -0.06);
  p2.castShadow = true;
  sofa.add(p2);

  if (hasThrow && throwTex) {
    const throwGeo = new RoundedBoxGeometry(0.24, 0.34, 0.54, 4, 0.045);
    const tPos = throwGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const z = tPos.getZ(i);
      tPos.setX(i, tPos.getX(i) + Math.sin(z * 26) * 0.01);
    }
    throwGeo.computeVertexNormals();
    const throwMesh = new THREE.Mesh(
      throwGeo,
      new THREE.MeshStandardMaterial({
        map: throwTex,
        bumpMap: fabricTextures.bumpMap,
        bumpScale: 0.007,
        roughness: 0.85,
      })
    );
    throwMesh.position.set(-(seatWidth / 2 + armW / 2), 0.48, 0.05);
    throwMesh.castShadow = true;
    sofa.add(throwMesh);
  }

  return sofa;
}

function createDiningChair(darkWoodMat, seatFabricMat) {
  const chair = new THREE.Group();

  // Slightly tapered rounded legs
  for (const lx of [-0.19, 0.19]) {
    for (const lz of [-0.19, 0.19]) {
      const isBack = lz < 0;
      const h = isBack ? 0.94 : 0.45;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.016, h, 10),
        darkWoodMat
      );
      leg.position.set(lx, h / 2, lz);
      if (isBack) leg.rotation.x = -0.05;
      leg.castShadow = true;
      chair.add(leg);
    }
  }

  const seatWood = new THREE.Mesh(
    new RoundedBoxGeometry(0.45, 0.045, 0.45, 3, 0.012),
    darkWoodMat
  );
  seatWood.position.set(0, 0.44, 0);
  seatWood.castShadow = true;
  chair.add(seatWood);

  const seatPad = new THREE.Mesh(
    new RoundedBoxGeometry(0.42, 0.055, 0.42, 4, 0.02),
    seatFabricMat
  );
  seatPad.position.set(0, 0.48, 0.01);
  seatPad.receiveShadow = true;
  chair.add(seatPad);

  const topRail = new THREE.Mesh(
    new RoundedBoxGeometry(0.45, 0.075, 0.04, 3, 0.014),
    darkWoodMat
  );
  topRail.position.set(0, 0.93, -0.21);
  chair.add(topRail);

  const backPad = new THREE.Mesh(
    new RoundedBoxGeometry(0.35, 0.35, 0.04, 4, 0.016),
    seatFabricMat
  );
  backPad.position.set(0, 0.72, -0.2);
  backPad.rotation.x = -0.05;
  chair.add(backPad);

  return chair;
}

/**
 * Creates a realistic layered rose blossom for the dining centerpiece.
 */
function createRoseBlossom(color) {
  const rose = new THREE.Group();
  const petalMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });

  // Inner bud
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), petalMat);
  bud.scale.set(1, 1.2, 1);
  rose.add(bud);

  // Outer cupped petals
  for (let ring = 0; ring < 2; ring++) {
    const count = ring === 0 ? 5 : 6;
    const rad = ring === 0 ? 0.018 : 0.028;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.4;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 8, 6, 0, Math.PI),
        petalMat
      );
      petal.position.set(Math.cos(a) * rad, -ring * 0.004, Math.sin(a) * rad);
      petal.rotation.y = -a + Math.PI / 2;
      petal.rotation.x = 0.35 + ring * 0.22;
      rose.add(petal);
    }
  }
  return rose;
}

/**
 * Populates the living-dining room with sculpted furniture, real textures, and contact shadows.
 */
export function buildFurniture(scene, colliders) {
  const group = new THREE.Group();
  const textureLoader = new THREE.TextureLoader();

  const shadowTex = createContactShadowTexture();
  const sofaFabricTextures = createSofaFabricTextures();
  const rugTextures = createGeometricRugTextures();
  const throwTex = createThrowBlanketTexture();
  const tvController = createTVScreenController();

  const cushionTerraTex = textureLoader.load('./textures/cushion-terra-real.jpg');
  cushionTerraTex.colorSpace = THREE.SRGBColorSpace;
  const cushionDarkTex = textureLoader.load('./textures/cushion-dark-real.jpg');
  cushionDarkTex.colorSpace = THREE.SRGBColorSpace;

  const tableclothTex = textureLoader.load('./textures/tablecloth-real.jpg');
  tableclothTex.colorSpace = THREE.SRGBColorSpace;
  tableclothTex.wrapS = THREE.MirroredRepeatWrapping;
  tableclothTex.wrapT = THREE.MirroredRepeatWrapping;
  tableclothTex.repeat.set(3, 3);
  tableclothTex.anisotropy = 8;

  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x4f321e,
    roughness: 0.44,
    metalness: 0.05,
  });
  const mediumWoodMat = new THREE.MeshStandardMaterial({
    color: 0x86542d,
    roughness: 0.44,
    metalness: 0.04,
  });
  const blackMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1c1e22,
    roughness: 0.32,
    metalness: 0.72,
  });
  const silverMetalMat = new THREE.MeshStandardMaterial({
    color: 0xc8cdd4,
    roughness: 0.2,
    metalness: 0.88,
  });
  const chairPadMat = new THREE.MeshStandardMaterial({
    color: 0xcab99f,
    bumpMap: sofaFabricTextures.bumpMap,
    bumpScale: 0.005,
    roughness: 0.82,
  });

  // 1. Living Room Geometric Rug (with subtle soft edge bevel & pile bump)
  const rug = new THREE.Mesh(
    new RoundedBoxGeometry(2.26, 0.016, 2.46, 2, 0.006),
    new THREE.MeshStandardMaterial({
      map: rugTextures.map,
      bumpMap: rugTextures.bumpMap,
      bumpScale: 0.009,
      roughness: 0.94,
    })
  );
  rug.position.set(0.0, 0.008, -1.35);
  rug.receiveShadow = true;
  group.add(rug);

  // 2. Main 3-Seat Sofa (left wall)
  const sofa3 = createSofa({
    seats: 3,
    fabricTextures: sofaFabricTextures,
    cushionTex1: cushionTerraTex,
    cushionTex2: cushionDarkTex,
  });
  sofa3.rotation.y = Math.PI / 2;
  sofa3.position.set(-1.46, 0, -1.38);
  tagInteractive(sofa3, 'sofa-principal');
  addBoxCollider(colliders, -1.46, -1.38, 0.94, 2.12);
  addContactShadow(group, shadowTex, -1.44, -1.38, 1.15, 2.35, 0.62);
  group.add(sofa3);

  // 3. Secondary 2-Seat Sofa (right wall)
  const sofa2 = createSofa({
    seats: 2,
    fabricTextures: sofaFabricTextures,
    cushionTex1: cushionTerraTex,
    cushionTex2: cushionDarkTex,
    hasThrow: true,
    throwTex,
  });
  sofa2.rotation.y = -Math.PI / 2;
  sofa2.position.set(1.46, 0, -1.2);
  tagInteractive(sofa2, 'sofa-secundario');
  addBoxCollider(colliders, 1.46, -1.2, 0.94, 1.64);
  addContactShadow(group, shadowTex, 1.44, -1.2, 1.15, 1.85, 0.62);
  group.add(sofa2);

  // 4. Ceiling-Mounted Smart TV + Screen Light
  const tvGroup = new THREE.Group();
  tvGroup.position.set(1.18, 2.58, -3.05);

  const ceilingPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.03, 18),
    blackMetalMat
  );
  ceilingPlate.position.y = -0.015;
  tvGroup.add(ceilingPlate);

  const dropPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.62, 14),
    blackMetalMat
  );
  dropPole.position.y = -0.32;
  tvGroup.add(dropPole);

  const screenHolder = new THREE.Group();
  screenHolder.position.set(0, -0.58, 0);
  screenHolder.rotation.y = -0.62;
  screenHolder.rotation.x = 0.08;

  const tvChassis = new THREE.Mesh(
    new RoundedBoxGeometry(1.16, 0.67, 0.042, 2, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.28, metalness: 0.52 })
  );
  tvChassis.castShadow = true;
  screenHolder.add(tvChassis);

  const tvScreenMat = new THREE.MeshStandardMaterial({
    map: tvController.texture,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: tvController.texture,
    emissiveIntensity: 0.0,
    roughness: 0.14,
    metalness: 0.22,
  });
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.11, 0.62), tvScreenMat);
  tvScreen.position.z = 0.023;
  screenHolder.add(tvScreen);

  const tvGlowLight = new THREE.PointLight(0xffcb99, 0, 3.8, 1.8);
  tvGlowLight.position.set(0, 0, 0.35);
  screenHolder.add(tvGlowLight);

  tvGroup.add(screenHolder);
  tagInteractive(tvGroup, 'tv');
  group.add(tvGroup);

  // 5. Wooden 2-Tier Corner Media Console (right window corner)
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(1.56, 0, -2.62);
  consoleGroup.rotation.y = -0.25;

  for (const cx of [-0.36, 0.36]) {
    for (const cz of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.74, 0.04, 2, 0.008), mediumWoodMat);
      leg.position.set(cx, 0.37, cz);
      consoleGroup.add(leg);
    }
  }
  const topShelf = new THREE.Mesh(new RoundedBoxGeometry(0.84, 0.036, 0.5, 2, 0.01), mediumWoodMat);
  topShelf.position.y = 0.74;
  topShelf.castShadow = true;
  consoleGroup.add(topShelf);

  const midShelf = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.032, 0.44, 2, 0.008), mediumWoodMat);
  midShelf.position.y = 0.36;
  consoleGroup.add(midShelf);

  const stereo = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.22, 0.28, 2, 0.012), blackMetalMat);
  stereo.position.set(-0.12, 0.49, 0);
  consoleGroup.add(stereo);

  const orchidPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.055, 0.12, 16),
    new THREE.MeshStandardMaterial({ color: 0xf4f1eb, roughness: 0.32 })
  );
  orchidPot.position.set(-0.18, 0.82, -0.05);
  consoleGroup.add(orchidPot);
  const orchidStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.008, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: 0x3b6633 })
  );
  orchidStem.position.set(-0.18, 1.02, -0.05);
  consoleGroup.add(orchidStem);
  for (let f = 0; f < 4; f++) {
    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfffcf8, roughness: 0.42 })
    );
    bloom.scale.set(1.2, 0.9, 0.4);
    bloom.position.set(-0.18 + (f % 2) * 0.04, 1.06 + f * 0.045, -0.02);
    consoleGroup.add(bloom);
  }

  // Tall sculpted cat figurine
  const catBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.072, 0.46, 14),
    new THREE.MeshStandardMaterial({ color: 0x6e6862, roughness: 0.62 })
  );
  catBase.position.set(0.28, 0.98, 0.08);
  consoleGroup.add(catBase);

  addBoxCollider(colliders, 1.56, -2.62, 0.65, 0.9);
  addContactShadow(group, shadowTex, 1.56, -2.62, 0.9, 0.9, 0.55);
  group.add(consoleGroup);

  // Botanical plants
  const tallPlant = createBotanicalPlant(1.4, 0x265429);
  tallPlant.position.set(1.62, 0, -2.12);
  addContactShadow(group, shadowTex, 1.62, -2.12, 0.48, 0.48, 0.48);
  group.add(tallPlant);

  const cornerPlant = createBotanicalPlant(1.2, 0x2e6132);
  cornerPlant.position.set(-1.62, 0, -3.12);
  addContactShadow(group, shadowTex, -1.62, -3.12, 0.44, 0.44, 0.48);
  group.add(cornerPlant);

  // 6. Small Side Tables
  const leftStand = new THREE.Group();
  leftStand.position.set(-1.66, 0, 0.25);
  const lsTop = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.032, 0.42, 2, 0.008), darkWoodMat);
  lsTop.position.y = 0.55;
  leftStand.add(lsTop);
  for (const sx of [-0.16, 0.16]) {
    for (const sz of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.55, 0.035, 2, 0.006), darkWoodMat);
      leg.position.set(sx, 0.275, sz);
      leftStand.add(leg);
    }
  }
  const standPlant = createBotanicalPlant(0.88, 0x29592d);
  standPlant.position.set(-0.04, 0.565, -0.04);
  leftStand.add(standPlant);
  addBoxCollider(colliders, -1.66, 0.25, 0.46, 0.46);
  addContactShadow(group, shadowTex, -1.66, 0.25, 0.55, 0.55, 0.5);
  group.add(leftStand);

  const rightTable = new THREE.Group();
  rightTable.position.set(1.66, 0, 0.24);
  const rtTop = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.036, 0.48, 2, 0.01), blackMetalMat);
  rtTop.position.y = 0.52;
  rightTable.add(rtTop);
  for (const sx of [-0.2, 0.2]) {
    for (const sz of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.52, 0.035, 2, 0.006), blackMetalMat);
      leg.position.set(sx, 0.26, sz);
      rightTable.add(leg);
    }
  }
  const monstera = createBotanicalPlant(0.92, 0x2a5c30);
  monstera.position.set(-0.05, 0.54, 0.04);
  rightTable.add(monstera);
  addBoxCollider(colliders, 1.66, 0.24, 0.52, 0.52);
  addContactShadow(group, shadowTex, 1.66, 0.24, 0.6, 0.6, 0.5);
  group.add(rightTable);

  // 7. Dining Table with Real Floral Cloth & Wavy Draped Skirt + 4 Chairs
  const diningGroup = new THREE.Group();
  diningGroup.position.set(-0.48, 0, 1.75);

  const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 0.72, 20), darkWoodMat);
  tableLeg.position.y = 0.36;
  tableLeg.castShadow = true;
  diningGroup.add(tableLeg);

  const clothMat = new THREE.MeshStandardMaterial({
    map: tableclothTex,
    bumpMap: sofaFabricTextures.bumpMap,
    bumpScale: 0.004,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });

  // Rounded tablecloth top
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.042, 48), clothMat);
  tableTop.scale.set(1.12, 1, 0.94);
  tableTop.position.y = 0.75;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  diningGroup.add(tableTop);

  // Sculpted wavy hanging tablecloth skirt with organic fabric folds
  const skirtGeo = new THREE.CylinderGeometry(0.642, 0.73, 0.28, 64, 10, true);
  const skVerts = skirtGeo.attributes.position;
  for (let i = 0; i < skVerts.count; i++) {
    const x = skVerts.getX(i);
    const y = skVerts.getY(i);
    const z = skVerts.getZ(i);
    const angle = Math.atan2(z, x);
    // Normalized drop factor (0 at top edge, 1 at bottom hem)
    const drop = THREE.MathUtils.clamp((0.14 - y) / 0.28, 0, 1);
    const fold = Math.sin(angle * 14) * 0.032 * drop + Math.cos(angle * 7) * 0.015 * drop;
    const radScale = 1 + fold;
    skVerts.setX(i, x * radScale);
    skVerts.setZ(i, z * radScale);
  }
  skirtGeo.computeVertexNormals();
  const tableSkirt = new THREE.Mesh(skirtGeo, clothMat);
  tableSkirt.scale.set(1.12, 1, 0.94);
  tableSkirt.position.y = 0.61;
  tableSkirt.castShadow = true;
  diningGroup.add(tableSkirt);

  // Coral woven hem trim ribbon along the bottom of the tablecloth
  const hemGeo = new THREE.CylinderGeometry(0.725, 0.735, 0.038, 64, 2, true);
  const hVerts = hemGeo.attributes.position;
  for (let i = 0; i < hVerts.count; i++) {
    const x = hVerts.getX(i);
    const z = hVerts.getZ(i);
    const angle = Math.atan2(z, x);
    const fold = Math.sin(angle * 14) * 0.032 + Math.cos(angle * 7) * 0.015;
    hVerts.setX(i, x * (1 + fold));
    hVerts.setZ(i, z * (1 + fold));
  }
  hemGeo.computeVertexNormals();
  const hemTrim = new THREE.Mesh(
    hemGeo,
    new THREE.MeshStandardMaterial({ color: 0xd46a6e, roughness: 0.85, side: THREE.DoubleSide })
  );
  hemTrim.scale.set(1.12, 1, 0.94);
  hemTrim.position.y = 0.475;
  diningGroup.add(hemTrim);

  // Metallic gold fluted vase + layered peach roses
  const vase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.044, 0.17, 20),
    new THREE.MeshStandardMaterial({ color: 0xd1aa62, roughness: 0.22, metalness: 0.88 })
  );
  vase.position.set(0.06, 0.855, 0.02);
  vase.castShadow = true;
  diningGroup.add(vase);

  const roseColors = [0xf2b899, 0xe89c7f, 0xf7ceb4];
  for (let r = 0; r < 7; r++) {
    const angle = (r / 7) * Math.PI * 2;
    const rad = r === 0 ? 0 : 0.064;
    const blossom = createRoseBlossom(roseColors[r % roseColors.length]);
    blossom.position.set(
      0.06 + Math.cos(angle) * rad,
      0.965 + (r === 0 ? 0.025 : 0),
      0.02 + Math.sin(angle) * rad
    );
    blossom.rotation.set(Math.sin(angle) * 0.25, angle, Math.cos(angle) * 0.25);
    diningGroup.add(blossom);
  }
  // Small green bouquet leaves around roses
  const bLeafMat = new THREE.MeshStandardMaterial({ color: 0x356436, roughness: 0.6, side: THREE.DoubleSide });
  for (let l = 0; l < 6; l++) {
    const a = (l / 6) * Math.PI * 2 + 0.3;
    const bLeaf = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.08), bLeafMat);
    bLeaf.position.set(0.06 + Math.cos(a) * 0.07, 0.935, 0.02 + Math.sin(a) * 0.07);
    bLeaf.rotation.set(0.9, a, 0);
    diningGroup.add(bLeaf);
  }

  // Black TV remote on tablecloth
  const remote = new THREE.Mesh(
    new RoundedBoxGeometry(0.048, 0.016, 0.17, 2, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.35 })
  );
  remote.position.set(-0.22, 0.78, -0.14);
  remote.rotation.y = 0.55;
  diningGroup.add(remote);

  // 4 Dining Chairs + individual contact shadows
  const chairPositions = [
    { x: 0, z: -0.78, rot: 0 },
    { x: 0, z: 0.78, rot: Math.PI },
    { x: -0.82, z: 0, rot: Math.PI / 2 },
    { x: 0.82, z: 0, rot: -Math.PI / 2 },
  ];
  for (const cp of chairPositions) {
    const chair = createDiningChair(darkWoodMat, chairPadMat);
    chair.position.set(cp.x, 0, cp.z);
    chair.rotation.y = cp.rot;
    diningGroup.add(chair);
    addContactShadow(diningGroup, shadowTex, cp.x, cp.z, 0.65, 0.65, 0.45);
  }

  tagInteractive(diningGroup, 'mesa-comedor');
  addBoxCollider(colliders, -0.48, 1.75, 1.65, 1.65);
  addContactShadow(group, shadowTex, -0.48, 1.75, 1.35, 1.25, 0.55);
  group.add(diningGroup);

  // 8. Framed Paintings
  const artGroup = new THREE.Group();

  const lakeArt = createFramedPainting(textureLoader, './textures/art-lake.jpg', 1.05, 0.78, 0xc9b99b);
  lakeArt.position.set(-1.93, 1.66, -1.38);
  lakeArt.rotation.y = Math.PI / 2;
  artGroup.add(lakeArt);

  const mountainArt = createFramedPainting(
    textureLoader,
    './textures/art-mountain.jpg',
    1.02,
    0.76,
    0xb8a388
  );
  mountainArt.position.set(1.93, 1.66, -1.2);
  mountainArt.rotation.y = -Math.PI / 2;
  artGroup.add(mountainArt);

  const stillLifeArt = createFramedPainting(
    textureLoader,
    './textures/art-stilllife.jpg',
    1.04,
    0.78,
    0x7c674d
  );
  stillLifeArt.position.set(-0.42, 1.62, 3.18);
  stillLifeArt.rotation.y = Math.PI;
  artGroup.add(stillLifeArt);

  const smallSpecs = [
    { url: './textures/art-small-1.jpg', y: 1.92, w: 0.24, h: 0.3 },
    { url: './textures/art-small-2.jpg', y: 1.54, w: 0.24, h: 0.28 },
    { url: './textures/art-small-3.jpg', y: 1.12, w: 0.3, h: 0.38 },
  ];
  for (const sp of smallSpecs) {
    const smallFrame = createFramedPainting(textureLoader, sp.url, sp.w, sp.h, 0x62452f);
    smallFrame.position.set(-1.93, sp.y, 2.38);
    smallFrame.rotation.y = Math.PI / 2;
    artGroup.add(smallFrame);
  }

  tagInteractive(artGroup, 'cuadros');
  group.add(artGroup);

  // 9. Lighting Fixtures (5-arm Chandelier + Tall Dining Floor Lamp + Window Reading Lamp)
  const lampsGroup = new THREE.Group();

  const chandelier = new THREE.Group();
  chandelier.position.set(-0.48, 2.58, 1.75);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 18), silverMetalMat);
  canopy.position.y = -0.025;
  chandelier.add(canopy);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.26, 14), silverMetalMat);
  stem.position.y = -0.15;
  chandelier.add(stem);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d8,
    emissive: 0xffc978,
    emissiveIntensity: 0.25,
    roughness: 0.3,
  });
  const shadeGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f4f2,
    transparent: true,
    opacity: 0.8,
    roughness: 0.22,
  });

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.28, 10), silverMetalMat);
    arm.position.set(Math.cos(a) * 0.14, -0.22, Math.sin(a) * 0.14);
    arm.rotation.z = Math.cos(a) * 0.65;
    arm.rotation.x = -Math.sin(a) * 0.65;
    chandelier.add(arm);

    const tulip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.14, 16, 1, true), shadeGlassMat);
    tulip.position.set(Math.cos(a) * 0.25, -0.29, Math.sin(a) * 0.25);
    tulip.rotation.z = Math.cos(a) * 0.85;
    tulip.rotation.x = -Math.sin(a) * 0.85;
    chandelier.add(tulip);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 10), bulbMat);
    bulb.position.set(Math.cos(a) * 0.24, -0.28, Math.sin(a) * 0.24);
    chandelier.add(bulb);
  }

  const chandelierLight = new THREE.PointLight(0xffd7a1, 0.0, 7.5, 1.5);
  chandelierLight.position.y = -0.35;
  chandelier.add(chandelierLight);
  lampsGroup.add(chandelier);

  // Tall Dining Floor Lamp
  const floorLamp = new THREE.Group();
  floorLamp.position.set(-1.42, 0, 2.86);

  const flBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.03, 20), silverMetalMat);
  flBase.position.y = 0.015;
  floorLamp.add(flBase);

  const flPole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.38, 12), silverMetalMat);
  flPole.position.y = 0.7;
  floorLamp.add(flPole);

  for (const sy of [1.14, 1.24, 1.34]) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 16, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xeef4fa, roughness: 0.08, transmission: 0.45 })
    );
    sphere.position.y = sy;
    floorLamp.add(sphere);
  }

  const lampShadeMat = new THREE.MeshStandardMaterial({
    color: 0xd9cfc2,
    emissive: 0xffba6b,
    emissiveIntensity: 0.0,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const flShade = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.27, 26, 1, true), lampShadeMat);
  flShade.position.y = 1.52;
  flShade.castShadow = true;
  floorLamp.add(flShade);

  const floorLampLight = new THREE.PointLight(0xffcb88, 0.0, 4.8, 1.7);
  floorLampLight.position.y = 1.5;
  floorLamp.add(floorLampLight);

  addBoxCollider(colliders, -1.42, 2.86, 0.36, 0.36);
  addContactShadow(group, shadowTex, -1.42, 2.86, 0.42, 0.42, 0.45);
  lampsGroup.add(floorLamp);

  // Window Reading Lamp
  const readLamp = new THREE.Group();
  readLamp.position.set(-1.66, 0, -3.32);
  const rlBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 18), silverMetalMat);
  rlBase.position.y = 0.012;
  readLamp.add(rlBase);
  const rlStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.55, 10), silverMetalMat);
  rlStem.position.y = 0.78;
  readLamp.add(rlStem);
  const rlHead = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 14), silverMetalMat);
  rlHead.position.set(0.08, 1.54, 0.05);
  rlHead.rotation.z = -0.8;
  readLamp.add(rlHead);
  const readLampLight = new THREE.PointLight(0xffd296, 0.0, 3.8, 1.8);
  readLampLight.position.set(0.12, 1.48, 0.08);
  readLamp.add(readLampLight);
  lampsGroup.add(readLamp);

  tagInteractive(lampsGroup, 'iluminacion');
  group.add(lampsGroup);

  // 10. Hallway accent console
  const hallConsole = new THREE.Group();
  hallConsole.position.set(1.22, 0, 3.05);
  const hcBody = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.84, 0.56, 2, 0.012), mediumWoodMat);
  hcBody.position.y = 0.42;
  hcBody.castShadow = true;
  hallConsole.add(hcBody);
  const hcPlant = createBotanicalPlant(0.78, 0x356938);
  hcPlant.position.set(0, 0.84, 0);
  hallConsole.add(hcPlant);
  addBoxCollider(colliders, 1.22, 3.05, 0.46, 0.62);
  addContactShadow(group, shadowTex, 1.22, 3.05, 0.54, 0.7, 0.5);
  group.add(hallConsole);

  scene.add(group);

  return {
    group,
    tvController,
    tvScreenMat,
    tvGlowLight,
    lamps: {
      chandelierLight,
      floorLampLight,
      readLampLight,
      bulbMat,
      lampShadeMat,
    },
  };
}
