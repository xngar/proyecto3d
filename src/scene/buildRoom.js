import * as THREE from 'three';
import {
  createExteriorViewTexture,
  createWallPlasterBump,
  createWoodFloorTextures,
} from '../textures/proceduralTextures.js';

/**
 * Builds the architectural shell (floor, walls with pass-through & hallway, ceiling,
 * balcony window with sculpted curtains, kitchen alcove, and dynamic Day/Night lighting).
 */
export function buildRoom(scene) {
  const group = new THREE.Group();
  const colliders = [];

  const plasterBump = createWallPlasterBump();
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xeae2d6,
    bumpMap: plasterBump,
    bumpScale: 0.004,
    roughness: 0.88,
    metalness: 0.01,
  });
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xf4f0ea,
    bumpMap: plasterBump,
    bumpScale: 0.003,
    roughness: 0.92,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf6f2ec,
    roughness: 0.55,
  });
  const pineMat = new THREE.MeshStandardMaterial({
    color: 0xc28e54,
    roughness: 0.52,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a22,
    roughness: 0.48,
  });

  // 1. Wood-plank laminate floor with specular roughness & bevel bump maps
  const floorTextures = createWoodFloorTextures();
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTextures.map,
    bumpMap: floorTextures.bumpMap,
    bumpScale: 0.012,
    roughnessMap: floorTextures.roughnessMap,
    roughness: 0.62,
    metalness: 0.06,
    envMapIntensity: 0.72,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 8.6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(1.2, 0, -0.1);
  floor.receiveShadow = true;
  group.add(floor);

  // 2. Ceiling
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 8.6), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(1.2, 2.58, -0.1);
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // Helper to create solid wall segments with baseboard + crown molding
  const addWall = (x, y, z, w, h, d, { molding = true, collide = true } = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (molding) {
      const baseH = 0.095;
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.014, baseH, d + 0.014),
        trimMat
      );
      base.position.set(x, baseH / 2, z);
      base.receiveShadow = true;
      group.add(base);

      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.02, 0.075, d + 0.02),
        trimMat
      );
      crown.position.set(x, 2.58 - 0.0375, z);
      group.add(crown);
    }

    if (collide) {
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });
    }
    return mesh;
  };

  // Left Wall (x = -1.95, from z = -3.8 to z = +3.2)
  addWall(-2.0, 1.29, -0.3, 0.1, 2.58, 7.0);

  // Dining Back Wall (z = +3.2, from x = -1.95 to x = +1.05)
  addWall(-0.45, 1.29, 3.25, 3.0, 2.58, 0.1);

  // Right Wall segments (x = +1.95)
  addWall(2.0, 1.29, -1.625, 0.1, 2.58, 4.35);

  // Pass-through wall (z = +0.55 to z = +1.85)
  addWall(2.0, 0.475, 1.2, 0.1, 0.95, 1.3);
  addWall(2.0, 2.315, 1.2, 0.1, 0.53, 1.3, { molding: false });
  const crownPass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, 1.3), trimMat);
  crownPass.position.set(2.0, 2.5425, 1.2);
  group.add(crownPass);

  // Pine wood frame around the pass-through window
  const passGroup = new THREE.Group();
  passGroup.name = 'PassThroughWindow';
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 1.44), pineMat);
  sill.position.set(1.98, 0.96, 1.2);
  sill.castShadow = true;
  sill.receiveShadow = true;
  passGroup.add(sill);

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 1.38), pineMat);
  topFrame.position.set(1.99, 2.04, 1.2);
  passGroup.add(topFrame);

  for (const fz of [0.53, 1.87]) {
    const sideFrame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 0.05), pineMat);
    sideFrame.position.set(1.99, 1.5, fz);
    passGroup.add(sideFrame);
  }
  passGroup.traverse((child) => {
    if (child.isMesh) child.userData.hotspotId = 'pasaplatos';
  });
  group.add(passGroup);

  // Pillar between pass-through and hallway opening
  addWall(2.0, 1.29, 2.0, 0.1, 2.58, 0.3);

  // Hallway & Kitchen enclosing walls
  addWall(3.85, 1.29, 0.8, 0.1, 2.58, 6.2);
  addWall(2.9, 1.29, -0.3, 1.9, 2.58, 0.1);
  addWall(2.3, 1.29, 4.25, 3.3, 2.58, 0.1);
  addWall(1.0, 1.29, 3.75, 0.1, 2.58, 1.0);

  // 3. Kitchen Alcove Interior (visible through pass-through)
  const kitchenGroup = new THREE.Group();
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xe3e5e2, roughness: 0.35 });
  const kitchenBack = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.2), tileMat);
  kitchenBack.rotation.y = -Math.PI / 2;
  kitchenBack.position.set(3.78, 1.2, 1.1);
  kitchenGroup.add(kitchenBack);

  const fridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 1.82, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x383c42, roughness: 0.32, metalness: 0.55 })
  );
  fridge.position.set(3.38, 0.91, 1.65);
  fridge.castShadow = true;
  kitchenGroup.add(fridge);

  const magnetColors = [0xd9534f, 0x7b52ab, 0xf0ad4e, 0x5bc0de, 0x5cb85c];
  for (let i = 0; i < 12; i++) {
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.045, 0.045),
      new THREE.MeshStandardMaterial({ color: magnetColors[i % magnetColors.length], roughness: 0.4 })
    );
    mag.position.set(3.015, 1.15 + (i % 4) * 0.14, 1.42 + Math.floor(i / 4) * 0.18);
    kitchenGroup.add(mag);
  }

  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.88, 1.35), pineMat);
  counter.position.set(3.42, 0.44, 0.55);
  kitchenGroup.add(counter);

  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.04, 1.38),
    new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.25 })
  );
  counterTop.position.set(3.42, 0.9, 0.55);
  kitchenGroup.add(counterTop);

  const toaster = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.24, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.28, metalness: 0.72 })
  );
  toaster.position.set(3.4, 1.04, 0.75);
  kitchenGroup.add(toaster);

  const upperCab = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.75, 1.1), pineMat);
  upperCab.position.set(3.54, 1.78, 0.55);
  kitchenGroup.add(upperCab);

  const microwave = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.28, 0.48),
    new THREE.MeshStandardMaterial({ color: 0xe8e8e6, roughness: 0.35 })
  );
  microwave.position.set(3.42, 1.54, 0.55);
  kitchenGroup.add(microwave);
  const microWindow = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.18, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.15, metalness: 0.3 })
  );
  microWindow.position.set(3.255, 1.54, 0.58);
  kitchenGroup.add(microWindow);

  const kitchenLight = new THREE.PointLight(0xfff1dc, 1.2, 4.5, 1.8);
  kitchenLight.position.set(2.9, 2.35, 1.1);
  kitchenGroup.add(kitchenLight);
  group.add(kitchenGroup);

  // 4. Hallway wine-rack / glass-door bar cabinet
  const barCab = new THREE.Group();
  const barBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.75, 0.44), darkWoodMat);
  barBody.position.set(2.55, 0.875, 3.95);
  barBody.castShadow = true;
  barCab.add(barBody);

  for (let gx = 0; gx < 3; gx++) {
    for (let gy = 0; gy < 3; gy++) {
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.035, 0.22, 8),
        new THREE.MeshStandardMaterial({ color: 0x1f3a28, roughness: 0.2 })
      );
      bottle.rotation.x = Math.PI / 2;
      bottle.position.set(2.2 + gx * 0.12, 0.28 + gy * 0.12, 3.74);
      barCab.add(bottle);
    }
  }
  group.add(barCab);

  // 5. Full-width Balcony Window Wall (z = -3.80)
  colliders.push({ minX: -2.05, maxX: 2.05, minZ: -3.95, maxZ: -3.72 });

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2d2926, roughness: 0.4, metalness: 0.45 });
  const topWinBar = new THREE.Mesh(new THREE.BoxGeometry(3.96, 0.08, 0.1), frameMat);
  topWinBar.position.set(0, 2.54, -3.8);
  group.add(topWinBar);

  const botWinBar = new THREE.Mesh(new THREE.BoxGeometry(3.96, 0.06, 0.1), frameMat);
  botWinBar.position.set(0, 0.03, -3.8);
  group.add(botWinBar);

  for (const vx of [-1.92, -0.65, 0.65, 1.92]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.52, 0.08), frameMat);
    mullion.position.set(vx, 1.29, -3.8);
    group.add(mullion);
  }

  const glassPane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.86, 2.48),
    new THREE.MeshPhysicalMaterial({
      color: 0xeef7ff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.06,
      metalness: 0.1,
    })
  );
  glassPane.position.set(0, 1.29, -3.8);
  group.add(glassPane);

  // Balcony railing outside
  const railBar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.04, 0.04), frameMat);
  railBar.position.set(0, 1.02, -4.35);
  group.add(railBar);
  for (let rx = -1.8; rx <= 1.8; rx += 0.45) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.02, 0.025), frameMat);
    post.position.set(rx, 0.51, -4.35);
    group.add(post);
  }

  // Exterior sunlit sky/trees/apartment backdrop
  const exteriorTex = createExteriorViewTexture();
  const exteriorMat = new THREE.MeshBasicMaterial({ map: exteriorTex });
  const exteriorBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 5.4), exteriorMat);
  exteriorBackdrop.position.set(0, 1.65, -6.4);
  group.add(exteriorBackdrop);

  // Curtain rod with finials
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 3.84, 12), frameMat);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 2.48, -3.66);
  group.add(rod);
  for (const fx of [-1.92, 1.92]) {
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), frameMat);
    finial.position.set(fx, 2.48, -3.66);
    group.add(finial);
  }

  // Soft wavy continuous sheer curtain (sine-wave pleated cloth!)
  const sheerGeo = new THREE.PlaneGeometry(3.66, 2.44, 72, 12);
  const sPos = sheerGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const x = sPos.getX(i);
    sPos.setZ(i, Math.sin(x * 22) * 0.026);
  }
  sheerGeo.computeVertexNormals();
  const sheerMat = new THREE.MeshStandardMaterial({
    color: 0xf9f6f0,
    emissive: 0xfff8ed,
    emissiveIntensity: 0.04,
    transparent: true,
    opacity: 0.46,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const sheerCurtain = new THREE.Mesh(sheerGeo, sheerMat);
  sheerCurtain.position.set(0, 1.24, -3.66);
  group.add(sheerCurtain);

  // Sculpted hourglass gathered bronze drapes with sinusoidal pleats & tie-back ring
  const drapeMat = new THREE.MeshStandardMaterial({
    color: 0x9b714c,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const drapeGeo = new THREE.CylinderGeometry(0.22, 0.24, 2.44, 28, 24);
  const dPos = drapeGeo.attributes.position;
  for (let i = 0; i < dPos.count; i++) {
    const x = dPos.getX(i);
    const y = dPos.getY(i);
    const z = dPos.getZ(i);
    const angle = Math.atan2(z, x);
    // Hourglass pinch around y = -0.15
    const pinch = 0.42 + 0.58 * Math.min(1, Math.abs(y + 0.15) * 1.15);
    const pleat = 1 + Math.sin(angle * 10) * 0.12;
    dPos.setX(i, x * pinch * pleat);
    dPos.setZ(i, z * pinch * pleat);
  }
  drapeGeo.computeVertexNormals();

  for (const side of [-1, 1]) {
    const drape = new THREE.Mesh(drapeGeo, drapeMat);
    drape.position.set(side * 1.66, 1.24, -3.55);
    drape.castShadow = true;
    group.add(drape);

    const tieBack = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.018, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x6e4f33, roughness: 0.6 })
    );
    tieBack.rotation.x = Math.PI / 2;
    tieBack.position.set(side * 1.66, 1.09, -3.55);
    group.add(tieBack);
  }

  // 6. Lighting Rig (Day / Night dynamic system + Balcony Area Light)
  const hemiLight = new THREE.HemisphereLight(0xf6f8ff, 0x8f775e, 0.62);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff4e2, 1.35);
  sunLight.position.set(0.35, 3.3, -6.6);
  sunLight.target.position.set(0, 0.5, 0.8);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 16;
  sunLight.shadow.camera.left = -4.2;
  sunLight.shadow.camera.right = 4.2;
  sunLight.shadow.camera.top = 4;
  sunLight.shadow.camera.bottom = -2;
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.018;
  group.add(sunLight);
  group.add(sunLight.target);

  // Soft natural area light spanning the balcony window
  const windowAreaLight = new THREE.RectAreaLight(0xeef6ff, 1.15, 3.6, 2.2);
  windowAreaLight.position.set(0, 1.32, -3.52);
  windowAreaLight.lookAt(0, 1.0, 0);
  group.add(windowAreaLight);

  const windowBounce = new THREE.PointLight(0xe6f1ff, 0.55, 9, 1.5);
  windowBounce.position.set(0, 1.75, -2.7);
  group.add(windowBounce);

  const diningBounce = new THREE.PointLight(0xfff1dd, 0.55, 7, 1.6);
  diningBounce.position.set(-0.3, 2.2, 1.8);
  group.add(diningBounce);

  scene.add(group);

  return {
    group,
    colliders,
    lighting: {
      hemiLight,
      sunLight,
      windowAreaLight,
      windowBounce,
      diningBounce,
      kitchenLight,
      exteriorMat,
      sheerMat,
    },
  };
}
