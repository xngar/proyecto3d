import * as THREE from 'three';

export const HOTSPOTS = [
  {
    id: 'sofa-principal',
    category: 'Estar · Asiento',
    title: 'Sofá Principal (3 Cuerpos)',
    description:
      'Tapizado en funda beige de textura suave con cojines decorativos en tonos terracota y brocato clásico, orientado frente al área social.',
    pinPos: [-1.05, 0.92, -1.24],
    focusPos: [0.42, 1.48, -1.05],
    focusLookAt: [-1.26, 0.65, -1.24],
  },
  {
    id: 'tv',
    category: 'Tecnología · Multimedia',
    title: 'Televisor Smart TV',
    description:
      'Pantalla plana suspendida desde el techo mediante brazo articulado negro, sobre la consola de dos niveles con equipo de música y orquídea.',
    pinPos: [0.95, 1.50, -2.72],
    focusPos: [-0.35, 1.48, -1.05],
    focusLookAt: [1.06, 1.82, -2.86],
    actionType: 'toggle-tv',
  },
  {
    id: 'mesa-comedor',
    category: 'Comedor · Conjunto',
    title: 'Mesa de Comedor y Sillas',
    description:
      'Mesa compacta vestida con mantel botánico de flores y aves con ribete coral, acompañada por cuatro sillas de madera oscura con tapiz beige y rosas.',
    pinPos: [-0.36, 1.15, 1.45],
    focusPos: [0.85, 1.50, 0.05],
    focusLookAt: [-0.36, 0.85, 1.45],
  },
  {
    id: 'sofa-secundario',
    category: 'Estar · Asiento',
    title: 'Sofá Lateral (2 Cuerpos)',
    description:
      'Sofá compacto en tono crema a juego, complementado con cojín floral oscuro, terracota y manta tejida bicolor sobre el apoyabrazos.',
    pinPos: [1.05, 0.92, -1.12],
    focusPos: [-0.42, 1.48, -1.12],
    focusLookAt: [1.26, 0.65, -1.12],
  },
  {
    id: 'cuadros',
    category: 'Arte · Decoración',
    title: 'Galería de Cuadros',
    description:
      'Paisajes lacustres en tonos azules y verdes sobre los sofás, bodegón de botellas en el comedor y tres láminas verticales en secuencia.',
    pinPos: [-1.52, 1.65, -0.35],
    focusPos: [0.25, 1.50, -0.10],
    focusLookAt: [-1.68, 1.55, -0.20],
  },
  {
    id: 'pasaplatos',
    category: 'Arquitectura · Cocina',
    title: 'Ventana Pasaplatos',
    description:
      'Abertura enmarcada en madera de pino natural que conecta el comedor con la cocina y deja ver el refrigerador, microondas y mesita auxiliar.',
    pinPos: [1.56, 1.48, 0.50],
    focusPos: [0.05, 1.48, 0.45],
    focusLookAt: [2.15, 1.40, 0.50],
  },
  {
    id: 'iluminacion',
    category: 'Ambiente · Luz',
    title: 'Araña y Lámparas de Pie',
    description:
      'Lámpara colgante de cinco brazos con tulipas satinadas sobre el comedor, respaldada por lámpara de pie con esferas de vidrio y foco lector.',
    pinPos: [-0.36, 2.04, 1.45],
    focusPos: [0.78, 1.52, -0.15],
    focusLookAt: [-0.55, 1.98, 1.65],
    actionType: 'toggle-daynight',
  },
];

/**
 * Creates pulsing 3D markers for each interactive hotspot and exposes hit-testable pin meshes.
 */
export function createHotspotMarkers(scene) {
  const group = new THREE.Group();
  const pinMeshes = [];

  const coreGeo = new THREE.SphereGeometry(0.036, 16, 16);
  const ringGeo = new THREE.RingGeometry(0.052, 0.07, 24);

  for (const hs of HOTSPOTS) {
    const marker = new THREE.Group();
    marker.position.set(...hs.pinPos);

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xe09f67,
      transparent: true,
      opacity: 0.94,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.userData.hotspotId = hs.id;
    core.userData.isPin = true;

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.userData.hotspotId = hs.id;
    ring.userData.isPin = true;

    marker.add(core);
    marker.add(ring);
    marker.userData = {
      hotspotId: hs.id,
      baseY: hs.pinPos[1],
      coreMat,
      ring,
      ringMat,
    };

    group.add(marker);
    pinMeshes.push(core, ring);
  }

  scene.add(group);

  let visible = true;
  let activeId = null;
  let hoveredId = null;

  return {
    group,
    pinMeshes,
    setVisible(v) {
      visible = Boolean(v);
      group.visible = visible;
    },
    isVisible() {
      return visible;
    },
    setActive(id) {
      activeId = id;
    },
    setHovered(id) {
      hoveredId = id;
    },
    update(time, camera) {
      if (!visible) return;
      for (let i = 0; i < group.children.length; i++) {
        const marker = group.children[i];
        const { hotspotId, baseY, coreMat, ring, ringMat } = marker.userData;
        const isActive = hotspotId === activeId;
        const isHover = hotspotId === hoveredId;

        marker.position.y = baseY + Math.sin(time * 2.2 + i * 0.9) * 0.028;
        marker.lookAt(camera.position);

        const targetScale = isActive ? 1.26 : isHover ? 1.16 : 1.0;
        const dist = marker.position.distanceTo(camera.position);
        const distFactor = THREE.MathUtils.clamp(dist * 0.34, 0.55, 1.15);
        const finalScale = targetScale * distFactor;
        marker.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), 0.14);

        const pulse = 1 + Math.sin(time * 3.1 + i) * 0.15;
        ring.scale.set(pulse, pulse, 1);

        coreMat.color.setHex(isActive ? 0xffd19c : isHover ? 0xf7b980 : 0xe09f67);
        ringMat.opacity = isActive ? 0.95 : 0.6;
      }
    },
  };
}
