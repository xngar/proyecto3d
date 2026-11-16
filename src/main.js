import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  createContactShadowTexture,
  createTVScreenController,
} from './textures/proceduralTextures.js';
import { createHotspotMarkers } from './interactions/hotspots.js';
import {
  createNavigationController,
  ROOM_COLLIDERS,
  TOUR_ZONES,
} from './controls/navigation.js';
import { createHud } from './ui/hud.js';

RectAreaLightUniformsLib.init();

const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161412);

// Physically-based interior IBL reflections
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnv = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = roomEnv;
scene.environmentIntensity = 0.4;

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.08,
  40
);

// Post-processing: Render -> SSAO (corner/furniture depth) -> subtle Bloom -> Filmic Output
const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));

const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 0.35;
ssaoPass.minDistance = 0.002;
ssaoPass.maxDistance = 0.14;
composer.addPass(ssaoPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.14,
  0.45,
  1.15
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ==========================================================
// Dynamic Lighting Rig (Daylight from Balcony + Night Lamps)
// ==========================================================
const hemiLight = new THREE.HemisphereLight(0xf6f8ff, 0x8f775e, 0.72);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff4e2, 1.45);
sunLight.position.set(0.3, 3.2, -6.4);
sunLight.target.position.set(0, 0.5, 0.6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 16;
sunLight.shadow.camera.left = -4.0;
sunLight.shadow.camera.right = 4.0;
sunLight.shadow.camera.top = 3.8;
sunLight.shadow.camera.bottom = -2.0;
sunLight.shadow.bias = -0.0006;
sunLight.shadow.normalBias = 0.018;
scene.add(sunLight);
scene.add(sunLight.target);

const windowAreaLight = new THREE.RectAreaLight(0xeef6ff, 1.45, 3.2, 2.1);
windowAreaLight.position.set(0, 1.32, -3.02);
windowAreaLight.lookAt(0, 1.0, 0);
scene.add(windowAreaLight);

const windowBounce = new THREE.PointLight(0xe6f1ff, 0.65, 8.5, 1.5);
windowBounce.position.set(0, 1.75, -2.3);
scene.add(windowBounce);

const diningBounce = new THREE.PointLight(0xfff1dd, 0.55, 7, 1.6);
diningBounce.position.set(-0.3, 2.1, 1.4);
scene.add(diningBounce);

const kitchenLight = new THREE.PointLight(0xfff1dc, 0.95, 4.5, 1.8);
kitchenLight.position.set(2.6, 2.25, 0.5);
scene.add(kitchenLight);

// Nighttime lamp lights
const chandelierLight = new THREE.PointLight(0xffd7a1, 0.0, 7.5, 1.5);
chandelierLight.position.set(-0.36, 2.12, 1.45);
scene.add(chandelierLight);

const floorLampLight = new THREE.PointLight(0xffcb88, 0.0, 4.8, 1.7);
floorLampLight.position.set(-1.38, 1.48, 2.52);
scene.add(floorLampLight);

const readLampLight = new THREE.PointLight(0xffd296, 0.0, 3.8, 1.8);
readLampLight.position.set(-1.36, 1.44, -2.95);
scene.add(readLampLight);

const tvGlowLight = new THREE.PointLight(0xffcb99, 0.0, 3.8, 1.8);
tvGlowLight.position.set(0.86, 1.82, -2.62);
scene.add(tvGlowLight);

// Soft ambient-occlusion contact shadows on the floor under furniture
const shadowTex = createContactShadowTexture();
const addContactShadow = (x, z, w, d, opacity = 0.52) => {
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
  mesh.position.set(x, 0.004, z);
  scene.add(mesh);
};
addContactShadow(-1.25, -1.24, 1.15, 2.22, 0.56); // Sofa 3
addContactShadow(1.25, -1.12, 1.15, 1.75, 0.56); // Sofa 2
addContactShadow(-0.36, 1.45, 1.45, 1.35, 0.50); // Dining table
addContactShadow(1.36, -2.74, 1.05, 0.65, 0.45); // Media console
addContactShadow(1.44, 0.22, 0.56, 0.56, 0.45); // Black side table
addContactShadow(-1.48, 0.08, 0.50, 0.50, 0.45); // Left stand

// ==========================================================
// Hotspots, Interactive TV & Blender GLB Model Loader
// ==========================================================
const markers = createHotspotMarkers(scene);
const interactiveMeshes = [...markers.pinMeshes];

const tvController = createTVScreenController();
let tvScreenMat = null;
const bulbMats = [];
let shadeMat = null;
let exteriorSkyMat = null;
let sheerCurtainMat = null;

function resolveHotspotFromAncestors(obj) {
  let cur = obj;
  while (cur) {
    const n = cur.name || '';
    if (n.startsWith('Sofa_Principal')) return 'sofa-principal';
    if (n.startsWith('Sofa_Secundario')) return 'sofa-secundario';
    if (n.startsWith('TV_') || n.startsWith('Consola_Multimedia')) return 'tv';
    if (n.startsWith('Mesa_Comedor') || n.startsWith('Tablecloth_') || n.startsWith('Dining_Chair') || n.startsWith('Dining_Vase') || n.startsWith('Dining_Rose')) return 'mesa-comedor';
    if (n.startsWith('Cuadro_')) return 'cuadros';
    if (n.startsWith('Pasaplatos_')) return 'pasaplatos';
    if (n.startsWith('Iluminacion_Arana') || n.startsWith('Chand_') || n.startsWith('Lampara_')) return 'iluminacion';
    cur = cur.parent;
  }
  return null;
}

const loader = new GLTFLoader();
loader.load(
  './models/living_comedor.glb',
  (gltf) => {
    const root = gltf.scene;
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      const name = obj.name || '';

      // Shadows: keep window glass & sheer curtain shadow-free so natural daylight enters cleanly
      const noShadow =
        name.includes('Window_Glass') ||
        name.includes('Sheer_Curtain') ||
        name.includes('Exterior_');
      obj.castShadow = !noShadow;
      obj.receiveShadow = !name.includes('Exterior_');

      // Bind dynamic TV screen canvas
      if (name === 'TV_Screen') {
        tvScreenMat = new THREE.MeshStandardMaterial({
          map: tvController.texture,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: tvController.texture,
          emissiveIntensity: 0.0,
          roughness: 0.14,
          metalness: 0.2,
        });
        obj.material = tvScreenMat;
      }

      // Collect lamp / exterior materials for smooth Day/Night transitions
      const matName = obj.material?.name || '';
      if (matName.startsWith('Lamp_Bulb')) {
        bulbMats.push(obj.material);
      } else if (matName.startsWith('Lamp_Shade_Cream')) {
        shadeMat = obj.material;
      } else if (matName.startsWith('Exterior_Sky')) {
        exteriorSkyMat = obj.material;
      } else if (matName.startsWith('Sheer_Voile')) {
        sheerCurtainMat = obj.material;
        obj.material.transparent = true;
        obj.material.opacity = 0.48;
      } else if (matName.startsWith('Window_Glass') || matName.startsWith('Frosted_Shade')) {
        obj.material.transparent = true;
      }

      const hotspotId = resolveHotspotFromAncestors(obj);
      if (hotspotId) {
        obj.userData.hotspotId = hotspotId;
        interactiveMeshes.push(obj);
      }
    });

    scene.add(root);
    hud.setActiveZone(TOUR_ZONES[0]);
    hud.hideLoading();
  },
  undefined,
  (err) => {
    console.error('Error cargando living_comedor.glb:', err);
  }
);

// ==========================================================
// Day / Night & TV States
// ==========================================================
let nightMode = false;
let nightMix = 0;

function toggleDayNight() {
  nightMode = !nightMode;
  return nightMode;
}

function toggleTV() {
  const next = !tvController.isOn;
  tvController.setOn(next);
  if (tvScreenMat) tvScreenMat.emissiveIntensity = next ? 1.15 : 0.0;
  tvGlowLight.intensity = next ? 1.35 : 0.0;
  return next;
}

function updateLighting(dt) {
  const targetMix = nightMode ? 1 : 0;
  nightMix = THREE.MathUtils.lerp(nightMix, targetMix, Math.min(1, dt * 4));

  sunLight.intensity = THREE.MathUtils.lerp(1.45, 0.08, nightMix);
  windowAreaLight.intensity = THREE.MathUtils.lerp(1.45, 0.14, nightMix);
  hemiLight.intensity = THREE.MathUtils.lerp(0.72, 0.24, nightMix);
  windowBounce.intensity = THREE.MathUtils.lerp(0.65, 0.1, nightMix);
  diningBounce.intensity = THREE.MathUtils.lerp(0.55, 0.28, nightMix);
  kitchenLight.intensity = THREE.MathUtils.lerp(0.95, 0.72, nightMix);
  scene.environmentIntensity = THREE.MathUtils.lerp(0.4, 0.18, nightMix);

  chandelierLight.intensity = THREE.MathUtils.lerp(0.0, 2.4, nightMix);
  floorLampLight.intensity = THREE.MathUtils.lerp(0.0, 1.5, nightMix);
  readLampLight.intensity = THREE.MathUtils.lerp(0.0, 1.1, nightMix);

  for (const bm of bulbMats) {
    bm.emissiveIntensity = THREE.MathUtils.lerp(0.25, 1.85, nightMix);
  }
  if (shadeMat) {
    shadeMat.emissive = new THREE.Color(0xffba6b);
    shadeMat.emissiveIntensity = THREE.MathUtils.lerp(0.0, 0.45, nightMix);
  }
  if (exteriorSkyMat) {
    const dayCol = new THREE.Color(0xc2ddf2);
    const nightCol = new THREE.Color(0x1b263b);
    exteriorSkyMat.emissive.lerpColors(dayCol, nightCol, nightMix);
    exteriorSkyMat.emissiveIntensity = THREE.MathUtils.lerp(0.85, 0.25, nightMix);
  }
  if (sheerCurtainMat) {
    sheerCurtainMat.emissive = new THREE.Color(0xfff8ed);
    sheerCurtainMat.emissiveIntensity = THREE.MathUtils.lerp(0.06, 0.0, nightMix);
  }
}

// ==========================================================
// HUD & Hybrid Navigation
// ==========================================================
let navigation;
const hud = createHud({
  onSelectZone: (zoneId) => {
    hud.hideHotspot();
    navigation.goToZone(zoneId);
  },
  onFocusHotspot: (hotspot) => {
    if (!hotspot) {
      markers.setActive(null);
      return;
    }
    markers.setActive(hotspot.id);
    navigation.glideTo(hotspot.focusPos, hotspot.focusLookAt, 0.95);
  },
  onToggleDayNight: toggleDayNight,
  onToggleHotspots: (visible) => {
    markers.setVisible(visible);
  },
  onToggleTV: toggleTV,
  onTouchMove: (dir, active) => {
    navigation.setTouchMove(dir, active);
  },
});

navigation = createNavigationController({
  camera,
  domElement: canvas,
  scene,
  colliders: ROOM_COLLIDERS,
  onZoneChange: (zone) => hud.setActiveZone(zone),
  onSelectHotspot: (hotspotId) => hud.showHotspot(hotspotId),
  onHoverObject: (hit) => {
    markers.setHovered(hit?.type === 'hotspot' ? hit.id : null);
    hud.setHoverTooltip(hit);
  },
  getRaycastTargets: () =>
    markers.isVisible()
      ? interactiveMeshes
      : interactiveMeshes.filter((m) => !m.userData.isPin),
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  ssaoPass.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  navigation.update(dt, elapsed);
  markers.update(elapsed, camera);
  tvController.update(elapsed);
  updateLighting(dt);

  composer.render();
}

animate();
