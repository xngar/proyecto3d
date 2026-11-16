import { HOTSPOTS } from '../interactions/hotspots.js';
import { TOUR_ZONES } from '../controls/navigation.js';

/**
 * Manages the translucent HUD overlay: zone dock, hotspot info card,
 * Day/Night & hotspot visibility toggles, hover tooltips, touch D-pad, and help modal.
 */
export function createHud({
  onSelectZone,
  onFocusHotspot,
  onToggleDayNight,
  onToggleHotspots,
  onToggleTV,
  onTouchMove,
}) {
  const zoneLabel = document.getElementById('current-zone-label');
  const zoneDock = document.getElementById('zone-dock');
  const btnDayNight = document.getElementById('btn-day-night');
  const dayNightIcon = document.getElementById('day-night-icon');
  const dayNightLabel = document.getElementById('day-night-label');
  const btnToggleHotspots = document.getElementById('btn-toggle-hotspots');
  const btnHelp = document.getElementById('btn-help');
  const helpModal = document.getElementById('help-modal');
  const btnCloseHelp = document.getElementById('btn-close-help');
  const btnStartTour = document.getElementById('btn-start-tour');

  const hoverTooltip = document.getElementById('hover-tooltip');
  const infoCard = document.getElementById('info-card');
  const infoCategory = document.getElementById('info-category');
  const infoTitle = document.getElementById('info-title');
  const infoDescription = document.getElementById('info-description');
  const infoExtraActions = document.getElementById('info-extra-actions');
  const infoCounter = document.getElementById('info-counter');
  const btnCloseCard = document.getElementById('btn-close-card');
  const btnPrevHotspot = document.getElementById('btn-prev-hotspot');
  const btnNextHotspot = document.getElementById('btn-next-hotspot');
  const touchPad = document.getElementById('touch-pad');

  let activeHotspotIndex = -1;
  let isNightMode = false;
  let isTVOn = false;
  let hotspotsVisible = true;

  // Render bottom zone buttons
  const zoneButtons = new Map();
  for (const zone of TOUR_ZONES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'zone-btn' + (zone.id === 'general' ? ' active' : '');
    btn.textContent = zone.label;
    btn.addEventListener('click', () => {
      setActiveZone(zone);
      onSelectZone?.(zone.id);
    });
    zoneDock.appendChild(btn);
    zoneButtons.set(zone.id, btn);
  }

  function setActiveZone(zone) {
    zoneLabel.textContent = zone.label;
    for (const [id, btn] of zoneButtons.entries()) {
      btn.classList.toggle('active', id === zone.id);
    }
  }

  function renderExtraActions(hotspot) {
    infoExtraActions.innerHTML = '';
    if (!hotspot.actionType) {
      infoExtraActions.classList.add('hidden');
      return;
    }

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'action-pill';

    if (hotspot.actionType === 'toggle-tv') {
      actionBtn.textContent = isTVOn ? '📺 Apagar televisor' : '📺 Encender televisor';
      actionBtn.addEventListener('click', () => {
        isTVOn = onToggleTV?.();
        actionBtn.textContent = isTVOn ? '📺 Apagar televisor' : '📺 Encender televisor';
      });
    } else if (hotspot.actionType === 'toggle-daynight') {
      actionBtn.textContent = isNightMode ? '☀️ Cambiar a Modo Día' : '🌙 Encender luces (Modo Noche)';
      actionBtn.addEventListener('click', () => {
        isNightMode = onToggleDayNight?.();
        syncDayNightButton();
        actionBtn.textContent = isNightMode ? '☀️ Cambiar a Modo Día' : '🌙 Encender luces (Modo Noche)';
      });
    }

    infoExtraActions.appendChild(actionBtn);
    infoExtraActions.classList.remove('hidden');
  }

  function showHotspot(hotspotId) {
    const idx = HOTSPOTS.findIndex((h) => h.id === hotspotId);
    if (idx === -1) return;
    activeHotspotIndex = idx;
    const hs = HOTSPOTS[idx];

    infoCategory.textContent = hs.category;
    infoTitle.textContent = hs.title;
    infoDescription.textContent = hs.description;
    infoCounter.textContent = `${idx + 1} / ${HOTSPOTS.length}`;
    renderExtraActions(hs);
    infoCard.classList.remove('hidden');
    onFocusHotspot?.(hs);
  }

  function hideHotspot() {
    activeHotspotIndex = -1;
    infoCard.classList.add('hidden');
    onFocusHotspot?.(null);
  }

  function syncDayNightButton() {
    dayNightIcon.textContent = isNightMode ? '🌙' : '☀️';
    dayNightLabel.textContent = isNightMode ? 'Modo Noche' : 'Modo Día';
    btnDayNight.classList.toggle('active', isNightMode);
  }

  btnDayNight.addEventListener('click', () => {
    isNightMode = onToggleDayNight?.();
    syncDayNightButton();
    if (activeHotspotIndex >= 0) {
      renderExtraActions(HOTSPOTS[activeHotspotIndex]);
    }
  });

  btnToggleHotspots.addEventListener('click', () => {
    hotspotsVisible = !hotspotsVisible;
    btnToggleHotspots.classList.toggle('active', hotspotsVisible);
    onToggleHotspots?.(hotspotsVisible);
  });

  btnCloseCard.addEventListener('click', hideHotspot);

  btnPrevHotspot.addEventListener('click', () => {
    const nextIdx = activeHotspotIndex <= 0 ? HOTSPOTS.length - 1 : activeHotspotIndex - 1;
    showHotspot(HOTSPOTS[nextIdx].id);
  });

  btnNextHotspot.addEventListener('click', () => {
    const nextIdx = (activeHotspotIndex + 1) % HOTSPOTS.length;
    showHotspot(HOTSPOTS[nextIdx].id);
  });

  // Help Modal
  const closeHelp = () => helpModal.classList.add('hidden');
  btnHelp.addEventListener('click', () => helpModal.classList.remove('hidden'));
  btnCloseHelp.addEventListener('click', closeHelp);
  btnStartTour.addEventListener('click', closeHelp);
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) closeHelp();
  });

  // Touch D-Pad
  for (const btn of touchPad.querySelectorAll('.pad-btn')) {
    const dir = btn.dataset.move;
    const start = (e) => {
      e.preventDefault();
      onTouchMove?.(dir, true);
    };
    const end = (e) => {
      e.preventDefault();
      onTouchMove?.(dir, false);
    };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
    btn.addEventListener('pointerleave', end);
  }

  return {
    setActiveZone,
    showHotspot,
    hideHotspot,
    setHoverTooltip(hit) {
      if (!hit) {
        hoverTooltip.classList.add('hidden');
        return;
      }
      if (hit.type === 'hotspot') {
        const hs = HOTSPOTS.find((h) => h.id === hit.id);
        if (!hs) return;
        hoverTooltip.textContent = hs.title;
      } else if (hit.type === 'zone') {
        const zone = TOUR_ZONES.find((z) => z.id === hit.id);
        if (!zone) return;
        hoverTooltip.textContent = `Ir a ${zone.label}`;
      }
      hoverTooltip.style.left = `${hit.x}px`;
      hoverTooltip.style.top = `${hit.y}px`;
      hoverTooltip.classList.remove('hidden');
    },
    hideLoading() {
      const loading = document.getElementById('loading-screen');
      if (loading) {
        loading.classList.add('fade-out');
        setTimeout(() => loading.remove(), 500);
      }
    },
  };
}
