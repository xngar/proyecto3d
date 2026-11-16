import * as THREE from 'three';

export const TOUR_ZONES = [
  {
    id: 'general',
    label: 'Vista General',
    pos: [0.35, 1.52, 2.55],
    lookAt: [-0.05, 1.15, -1.4],
    floorMarker: null,
  },
  {
    id: 'comedor',
    label: 'Comedor',
    pos: [0.82, 1.50, -0.40],
    lookAt: [-0.30, 1.05, 1.85],
    floorMarker: [0.58, 0.02, 0.72],
  },
  {
    id: 'living',
    label: 'Zona Sofás',
    pos: [0.0, 1.50, -0.05],
    lookAt: [0.0, 1.12, -2.0],
    floorMarker: [0.0, 0.02, -0.25],
  },
  {
    id: 'tv',
    label: 'Frente al TV',
    pos: [-0.35, 1.50, -1.15],
    lookAt: [1.06, 1.78, -2.86],
    floorMarker: [-0.20, 0.02, -1.45],
  },
  {
    id: 'ventanal',
    label: 'Ventanal',
    pos: [0.0, 1.52, -2.35],
    lookAt: [0.0, 1.20, -3.8],
    floorMarker: [0.0, 0.02, -2.35],
  },
  {
    id: 'pasaplatos',
    label: 'Pasaplatos',
    pos: [0.12, 1.50, 0.45],
    lookAt: [2.25, 1.38, 0.50],
    floorMarker: [0.62, 0.02, 0.48],
  },
];

// AABB collision boxes matching the exact Blender floor plan (z_three = -y_blender)
export const ROOM_COLLIDERS = [
  // Sofa_Principal (3-seat left wall)
  { minX: -1.72, maxX: -0.78, minZ: -2.24, maxZ: -0.24 },
  // Sofa_Secundario (2-seat right wall)
  { minX: 0.78, maxX: 1.72, minZ: -1.90, maxZ: -0.34 },
  // Consola_Multimedia + Schefflera plant (right window corner)
  { minX: 0.90, maxX: 1.72, minZ: -3.15, maxZ: -1.98 },
  // Mesa_Comedor + 4 chairs
  { minX: -1.16, maxX: 0.44, minZ: 0.65, maxZ: 2.25 },
  // Mesita_Izquierda
  { minX: -1.72, maxX: -1.24, minZ: -0.15, maxZ: 0.35 },
  // Mesita_Negra
  { minX: 1.18, maxX: 1.72, minZ: -0.05, maxZ: 0.48 },
  // Lampara_Pie_Comedor
  { minX: -1.62, maxX: -1.16, minZ: 2.30, maxZ: 2.75 },
  // Dining_CornerStand
  { minX: 0.62, maxX: 1.12, minZ: 2.38, maxZ: 2.86 },
];

/**
 * Hybrid navigation controller:
 * - Drag-to-look (mouse & touch)
 * - WASD / Arrow keys & Touch D-Pad walking with AABB collision sliding
 * - Floor waypoint discs + smooth camera glides between zones & hotspots
 */
export function createNavigationController({
  camera,
  domElement,
  scene,
  colliders = ROOM_COLLIDERS,
  onZoneChange,
  onSelectHotspot,
  onHoverObject,
  getRaycastTargets,
}) {
  const EYE_HEIGHT = 1.52;
  const PLAYER_RADIUS = 0.25;
  const MOVE_SPEED = 2.25;

  camera.rotation.order = 'YXZ';
  const state = {
    yaw: 0,
    pitch: 0,
    keys: new Set(),
    touchMove: { forward: false, backward: false, left: false, right: false },
    isDragging: false,
    dragDistance: 0,
    lastPointer: { x: 0, y: 0 },
    glide: null,
  };

  // Floor waypoint rings
  const waypointGroup = new THREE.Group();
  const waypointMeshes = [];
  const outerGeo = new THREE.RingGeometry(0.15, 0.20, 28);
  const innerGeo = new THREE.CircleGeometry(0.075, 20);

  for (const zone of TOUR_ZONES) {
    if (!zone.floorMarker) continue;
    const holder = new THREE.Group();
    holder.position.set(...zone.floorMarker);

    const outer = new THREE.Mesh(
      outerGeo,
      new THREE.MeshBasicMaterial({
        color: 0xf7efe4,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
      })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.userData.zoneId = zone.id;

    const inner = new THREE.Mesh(
      innerGeo,
      new THREE.MeshBasicMaterial({
        color: 0xe09f67,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
      })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.002;
    inner.userData.zoneId = zone.id;

    holder.add(outer, inner);
    waypointGroup.add(holder);
    waypointMeshes.push(outer, inner);
  }
  scene.add(waypointGroup);

  function setCameraPose(pos, lookAt) {
    camera.position.set(pos[0], pos[1], pos[2]);
    const dir = new THREE.Vector3(lookAt[0] - pos[0], lookAt[1] - pos[1], lookAt[2] - pos[2]).normalize();
    state.yaw = Math.atan2(-dir.x, -dir.z);
    state.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -0.95, 0.95));
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
  }

  function glideTo(pos, lookAt, duration = 0.95) {
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(...pos);

    const dir = new THREE.Vector3(lookAt[0] - pos[0], lookAt[1] - pos[1], lookAt[2] - pos[2]).normalize();
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    const targetPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -0.95, 0.95));

    let deltaYaw = targetYaw - state.yaw;
    while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
    while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;

    state.glide = {
      elapsed: 0,
      duration,
      startPos,
      endPos,
      startYaw: state.yaw,
      targetYaw: state.yaw + deltaYaw,
      startPitch: state.pitch,
      targetPitch,
    };
  }

  function goToZone(zoneId) {
    const zone = TOUR_ZONES.find((z) => z.id === zoneId);
    if (!zone) return;
    glideTo(zone.pos, zone.lookAt, 0.9);
    onZoneChange?.(zone);
  }

  setCameraPose(TOUR_ZONES[0].pos, TOUR_ZONES[0].lookAt);

  function isColliding(x, z) {
    // Navigable main room bounds (x: -1.45..1.45, z: -2.95..2.58) + hallway opening
    const inMain = x >= -1.45 && x <= 1.45 && z >= -2.95 && z <= 2.58;
    const inHallway = x >= 0.85 && x <= 2.45 && z >= 1.45 && z <= 3.75;
    if (!inMain && !inHallway) return true;

    for (const box of colliders) {
      if (
        x + PLAYER_RADIUS > box.minX &&
        x - PLAYER_RADIUS < box.maxX &&
        z + PLAYER_RADIUS > box.minZ &&
        z - PLAYER_RADIUS < box.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  function castAtClientPoint(clientX, clientY) {
    const rect = domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);

    const targets = [...getRaycastTargets(), ...waypointMeshes];
    const hits = raycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      if (hit.object.userData.hotspotId) {
        return { type: 'hotspot', id: hit.object.userData.hotspotId, x: clientX, y: clientY };
      }
      if (hit.object.userData.zoneId) {
        return { type: 'zone', id: hit.object.userData.zoneId, x: clientX, y: clientY };
      }
    }
    return null;
  }

  const onKeyDown = (e) => {
    const code = e.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      state.keys.add(code);
      state.glide = null;
    }
  };
  const onKeyUp = (e) => {
    state.keys.delete(e.code);
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    state.isDragging = true;
    state.dragDistance = 0;
    state.lastPointer = { x: e.clientX, y: e.clientY };
    domElement.classList.add('dragging');
  };

  const onPointerMove = (e) => {
    if (state.isDragging) {
      const dx = e.clientX - state.lastPointer.x;
      const dy = e.clientY - state.lastPointer.y;
      state.dragDistance += Math.hypot(dx, dy);
      state.lastPointer = { x: e.clientX, y: e.clientY };

      if (state.dragDistance > 3) {
        state.glide = null;
        const sensitivity = e.pointerType === 'touch' ? 0.0042 : 0.0032;
        state.yaw += dx * sensitivity;
        state.pitch = THREE.MathUtils.clamp(state.pitch + dy * sensitivity, -0.78, 0.82);
        camera.rotation.y = state.yaw;
        camera.rotation.x = state.pitch;
      }
      return;
    }

    const hit = castAtClientPoint(e.clientX, e.clientY);
    domElement.classList.toggle('pointer', Boolean(hit));
    onHoverObject?.(hit);
  };

  const onPointerUp = (e) => {
    if (!state.isDragging) return;
    state.isDragging = false;
    domElement.classList.remove('dragging');

    if (state.dragDistance < 6) {
      const hit = castAtClientPoint(e.clientX, e.clientY);
      if (hit?.type === 'hotspot') {
        onSelectHotspot?.(hit.id);
      } else if (hit?.type === 'zone') {
        goToZone(hit.id);
      }
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {
    glideTo,
    goToZone,
    setTouchMove(dir, active) {
      if (dir in state.touchMove) {
        state.touchMove[dir] = active;
        if (active) state.glide = null;
      }
    },
    update(dt, time) {
      for (let i = 0; i < waypointGroup.children.length; i++) {
        const ringHolder = waypointGroup.children[i];
        const s = 1 + Math.sin(time * 2.4 + i) * 0.06;
        ringHolder.scale.set(s, 1, s);
      }

      if (state.glide) {
        const g = state.glide;
        g.elapsed += dt;
        const rawT = Math.min(g.elapsed / g.duration, 1);
        const t = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        camera.position.lerpVectors(g.startPos, g.endPos, t);
        state.yaw = THREE.MathUtils.lerp(g.startYaw, g.targetYaw, t);
        state.pitch = THREE.MathUtils.lerp(g.startPitch, g.targetPitch, t);
        camera.rotation.y = state.yaw;
        camera.rotation.x = state.pitch;

        if (rawT >= 1) state.glide = null;
        return;
      }

      let moveForward = 0;
      let moveRight = 0;
      if (state.keys.has('KeyW') || state.keys.has('ArrowUp') || state.touchMove.forward) moveForward += 1;
      if (state.keys.has('KeyS') || state.keys.has('ArrowDown') || state.touchMove.backward) moveForward -= 1;
      if (state.keys.has('KeyD') || state.keys.has('ArrowRight') || state.touchMove.right) moveRight += 1;
      if (state.keys.has('KeyA') || state.keys.has('ArrowLeft') || state.touchMove.left) moveRight -= 1;

      if (moveForward !== 0 || moveRight !== 0) {
        const forwardVec = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
        const rightVec = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
        const step = new THREE.Vector3()
          .addScaledVector(forwardVec, moveForward)
          .addScaledVector(rightVec, moveRight)
          .normalize()
          .multiplyScalar(MOVE_SPEED * dt);

        const curX = camera.position.x;
        const curZ = camera.position.z;

        if (!isColliding(curX + step.x, curZ)) camera.position.x = curX + step.x;
        if (!isColliding(camera.position.x, curZ + step.z)) camera.position.z = curZ + step.z;
        camera.position.y = EYE_HEIGHT;
      }
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
  };
}
