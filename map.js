// map.js — Versión mejorada con SST correcto y animación arrastrable

const peruBounds = [[-18.5, -81.5], [1.0, -68.0]];
const piuraBounds = [[-5.3, -80.75], [-5.1, -80.55]];

// Fecha 3 días atrás (delay de procesamiento NASA GIBS)
const dateObj = new Date();
dateObj.setUTCDate(dateObj.getUTCDate() - 3);
const today = dateObj.toISOString().split('T')[0];

/* ===========================
   DATOS DE PREDICCIÓN
=========================== */

const zonasRiesgo = {
  piura: {
    name: "Piura",
    bounds: [[-5.5, -81], [-4.8, -80.3]],
    riesgo: "ALTO",
    precipitacion: "350-450 mm/mes",
    probabilidad: 85,
    recomendaciones: [
      "Evitar zonas bajas propensas a inundación",
      "Preparar kit de emergencia familiar",
      "Monitorear alertas de SENAMHI",
      "Reforzar techos y drenajes"
    ]
  },
  tumbes: {
    name: "Tumbes",
    bounds: [[-4.5, -80.8], [-3.2, -80]],
    riesgo: "ALTO",
    precipitacion: "300-400 mm/mes",
    probabilidad: 82,
    recomendaciones: [
      "Riesgo de desborde de ríos",
      "Evacuar zonas costeras bajas",
      "Almacenar agua potable y alimentos",
      "Identificar rutas de evacuación"
    ]
  },
  lambayeque: {
    name: "Lambayeque",
    bounds: [[-7.2, -80.2], [-5.9, -79.2]],
    riesgo: "MODERADO-ALTO",
    precipitacion: "200-300 mm/mes",
    probabilidad: 70,
    recomendaciones: [
      "Monitorear cauces de ríos",
      "Preparar sistemas de drenaje",
      "Revisar estado de infraestructura",
      "Estar atento a alertas locales"
    ]
  },
  laLibertad: {
    name: "La Libertad",
    bounds: [[-8.5, -79.5], [-7.0, -78.2]],
    riesgo: "MODERADO",
    precipitacion: "150-250 mm/mes",
    probabilidad: 60,
    recomendaciones: [
      "Vigilar quebradas secas",
      "Preparar plan familiar de emergencia",
      "Revisar seguros de vivienda",
      "Evitar construcciones en laderas"
    ]
  },
  lima: {
    name: "Lima",
    bounds: [[-12.5, -77.5], [-11.5, -76.5]],
    riesgo: "BAJO-MODERADO",
    precipitacion: "50-100 mm/mes",
    probabilidad: 35,
    recomendaciones: [
      "Impacto menor en costa",
      "Posibles huaicos en zonas altas",
      "Mantener limpieza de desagües",
      "Revisar estado de viviendas precarias"
    ]
  }
};

/* ===========================
   PLANTILLAS WMTS
=========================== */

function imergTemplate(time) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/${time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
}

function sstAnomalyTemplate(time) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies/default/${time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`;
}

/* ===========================
   UTILIDADES
=========================== */

function createToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 450);
  }, duration);
}

function generarDatosAleatorios(cantidad = 200) {
  const puntos = [];
  for (let i = 0; i < cantidad; i++) {
    const lat = (Math.random() * 180) - 90;
    const lon = (Math.random() * 360) - 180;
    const intensidad = Math.random();
    puntos.push([lat, lon, intensidad]);
  }
  return puntos;
}

function generarPrediccionesFuturas(cantidad = 100) {
  const puntos = [];
  for (let i = 0; i < cantidad; i++) {
    const lat = -5 + Math.random() * 0.3;
    const lon = -80.75 + Math.random() * 0.2;
    const intensidad = Math.random();
    puntos.push([lat, lon, intensidad]);
  }
  return puntos;
}

/* ===========================
   BUSCADOR DE LUGARES
=========================== */

function setupGeocoder(map) {
  const searchContainer = document.createElement('div');
  searchContainer.id = 'geocoder';
  searchContainer.innerHTML = `
    <input type="text" id="searchInput" placeholder="🔍 Buscar lugar..." />
    <div id="searchResults"></div>
  `;
  document.body.appendChild(searchContainer);

  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  let searchMarker = null;
  let debounceTimer;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    
    if (query.length < 3) {
      searchResults.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=pe`
        );
        const results = await response.json();
        
        if (results.length === 0) {
          searchResults.innerHTML = '<div class="search-item">No se encontraron resultados</div>';
          searchResults.style.display = 'block';
          return;
        }

        searchResults.innerHTML = results.map(result => `
          <div class="search-item" data-lat="${result.lat}" data-lon="${result.lon}">
            <strong>${result.display_name.split(',')[0]}</strong>
            <br><small>${result.display_name}</small>
          </div>
        `).join('');
        
        searchResults.style.display = 'block';

        document.querySelectorAll('.search-item').forEach(item => {
          item.addEventListener('click', () => {
            const lat = parseFloat(item.dataset.lat);
            const lon = parseFloat(item.dataset.lon);
            
            map.setView([lat, lon], 13);
            
            if (searchMarker) map.removeLayer(searchMarker);
            searchMarker = L.marker([lat, lon]).addTo(map)
              .bindPopup(`<b>${item.querySelector('strong').textContent}</b>`)
              .openPopup();
            
            searchResults.style.display = 'none';
            searchInput.value = item.querySelector('strong').textContent;
            
            createToast('Ubicación encontrada', 'success', 3000);
          });
        });
      } catch (error) {
        console.error('Error en búsqueda:', error);
        searchResults.innerHTML = '<div class="search-item">Error en la búsqueda</div>';
        searchResults.style.display = 'block';
      }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
      searchResults.style.display = 'none';
    }
  });
}

/* ===========================
   INICIALIZACIÓN
=========================== */

document.addEventListener('DOMContentLoaded', () => {
  
  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.value = today;

  const map = L.map('map', {
    zoomSnap: 0.5,
    worldCopyJump: false,
    maxBounds: [[-30, -90], [10, -60]],
    maxBoundsViscosity: 0.65,
    minZoom: 3,
    maxZoom: 18
  }).setView([-9.2, -75], 5);

  const commonOptions = {
    tileSize: 256,
    minZoom: 2,
    errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
    noWrap: true,
    detectRetina: false
  };

  let currentDate = today;

  /* ===========================
     CAPAS BASE Y OVERLAYS
  =========================== */

  const esri = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { 
      attribution: 'Tiles © Esri', 
      minZoom: 1, 
      maxZoom: 19 
    }
  ).addTo(map);

  let imergLayer = L.tileLayer(imergTemplate(currentDate), {
    ...commonOptions,
    maxZoom: 12,
    opacity: 0.65,
    attribution: "NASA EOSDIS GIBS — IMERG Precipitation"
  });

  let sstLayer = L.tileLayer(sstAnomalyTemplate(currentDate), {
    ...commonOptions,
    maxZoom: 12,
    opacity: 0.75,
    attribution: "NASA GHRSST — SST Anomalies (MUR L4)"
  });

  let streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    opacity: 0.7,
    minZoom: 1,
    maxZoom: 19
  });

  let heatPiura = L.heatLayer(generarDatosAleatorios(), {
    radius: 25,
    blur: 15,
    minOpacity: 0.5,
    max: 1.0,
    gradient: { 0.0: 'blue', 0.4: 'cyan', 0.6: 'yellow', 0.8: 'orange', 1.0: 'red' }
  });

  let heatPeru = L.heatLayer(generarDatosAleatorios(), {
    radius: 30,
    blur: 20,
    minOpacity: 0.5,
    max: 1.0,
    gradient: { 0.0: 'blue', 0.4: 'cyan', 0.6: 'yellow', 0.8: 'orange', 1.0: 'red' }
  });

  let heatFuturo = L.heatLayer(generarPrediccionesFuturas(), {
    radius: 25,
    blur: 15,
    minOpacity: 0.5,
    max: 1.0,
    gradient: { 0.0: 'blue', 0.4: 'cyan', 0.6: 'yellow', 0.8: 'orange', 1.0: 'red' }
  });

  /* ===========================
     PANEL DE CAPAS
  =========================== */

  const layerPanel = document.getElementById('layerPanel');
  const layerList = document.getElementById('layerList');
  const closePanel = document.getElementById('closePanel');
  const togglePanel = document.getElementById('togglePanel');
  const resetLayers = document.getElementById('resetLayers');

  const layersConfig = [
    { name: 'Esri World Imagery', layer: esri, defaultOn: true, locked: true },
    { name: 'Anomalías SST (El Niño)', layer: sstLayer, defaultOn: false, special: 'sst' },
    { name: 'Lluvia IMERG', layer: imergLayer, defaultOn: false },
    { name: 'Calles OSM', layer: streetLayer, defaultOn: false },
    { name: 'Mapa calor Piura', layer: heatPiura, defaultOn: false },
    { name: 'Mapa calor Perú', layer: heatPeru, defaultOn: false },
    { name: 'Predicción inundaciones', layer: heatFuturo, defaultOn: false }
  ];

  function createLayerControls() {
    layerList.innerHTML = '';
    layersConfig.forEach((cfg, idx) => {
      const row = document.createElement('div');
      row.className = 'layer-row';
      if (cfg.special === 'sst') row.classList.add('sst-special');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `layer-${idx}`;
      checkbox.checked = cfg.defaultOn;
      if (cfg.locked) checkbox.disabled = true;

      const label = document.createElement('label');
      label.htmlFor = `layer-${idx}`;
      label.innerHTML = cfg.name;
      if (cfg.locked) label.innerHTML += ' <span style="font-size:10px;color:#999;">(Base)</span>';

      row.appendChild(checkbox);
      row.appendChild(label);
      layerList.appendChild(row);

      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          cfg.layer.addTo(map);
          if (cfg.special === 'sst') {
            mostrarAnalisisNino();
            createToast('SST Anomalies activado', 'info', 3000);
          }
        } else {
          map.removeLayer(cfg.layer);
        }
      });
    });
  }

  createLayerControls();

  function mostrarAnalisisNino() {
    const fenomenoPane = document.getElementById('fenomenoPane');
    if (fenomenoPane && fenomenoPane.style.display !== 'block') {
      document.querySelectorAll('.tabContent').forEach(t => t.style.display = 'none');
      fenomenoPane.style.display = 'block';
      document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
      const ninoBtn = document.querySelector('.tabBtn[data-tab="fenomenoPane"]');
      if (ninoBtn) ninoBtn.classList.add('active');
    }
  }

  if (togglePanel) {
    togglePanel.addEventListener('click', () => {
      const hidden = layerPanel.getAttribute('aria-hidden') === 'true';
      layerPanel.setAttribute('aria-hidden', hidden ? 'false' : 'true');
    });
  }

  if (closePanel) {
    closePanel.addEventListener('click', () => {
      layerPanel.setAttribute('aria-hidden', 'true');
    });
  }

  if (resetLayers) {
    resetLayers.addEventListener('click', () => {
      layersConfig.forEach((cfg, idx) => {
        const checkbox = document.getElementById(`layer-${idx}`);
        if (checkbox && !cfg.locked) {
          checkbox.checked = cfg.defaultOn;
          if (cfg.defaultOn) {
            cfg.layer.addTo(map);
          } else {
            map.removeLayer(cfg.layer);
          }
        }
      });
      createToast('Capas reseteadas', 'success', 3000);
    });
  }

  // Panel arrastrable
  let isDragging = false;
  let offsetX, offsetY;

  const panelHeader = layerPanel.querySelector('.panelHeader');
  
  panelHeader.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - layerPanel.offsetLeft;
    offsetY = e.clientY - layerPanel.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      layerPanel.style.left = (e.clientX - offsetX) + 'px';
      layerPanel.style.top = (e.clientY - offsetY) + 'px';
      layerPanel.style.right = 'auto';
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  /* ===========================
     NAVEGACIÓN
  =========================== */

  const fitPeruBtn = document.getElementById('fitPeru');
  if (fitPeruBtn) {
    fitPeruBtn.addEventListener('click', () => {
      map.fitBounds(peruBounds, { padding: [20, 20] });
    });
  }

  const fitPiuraBtn = document.getElementById('fitPiura');
  if (fitPiuraBtn) {
    fitPiuraBtn.addEventListener('click', () => {
      map.fitBounds(piuraBounds, { padding: [20, 20] });
      map.setZoom(13);
    });
  }

  /* ===========================
     PREDICCIÓN POR ZONA
  =========================== */

  let prediccionMarker = null;
  let prediccionPanel = null;

  map.on('click', function (e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    
    const coordsEl = document.getElementById('coords');
    if (coordsEl) {
      coordsEl.innerHTML = `Lat: <strong>${lat.toFixed(6)}</strong>, Lon: <strong>${lon.toFixed(6)}</strong>`;
    }

    let zonaEncontrada = null;
    for (let key in zonasRiesgo) {
      const zona = zonasRiesgo[key];
      const [[minLat, minLon], [maxLat, maxLon]] = zona.bounds;
      if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
        zonaEncontrada = zona;
        break;
      }
    }

    if (zonaEncontrada) {
      mostrarPrediccion(zonaEncontrada, lat, lon);
    } else {
      if (prediccionPanel) {
        prediccionPanel.remove();
        prediccionPanel = null;
      }
    }

    if (prediccionMarker) map.removeLayer(prediccionMarker);
    prediccionMarker = L.marker([lat, lon]).addTo(map);
  });

  function mostrarPrediccion(zona, lat, lon) {
    if (prediccionPanel) prediccionPanel.remove();

    prediccionPanel = document.createElement('div');
    prediccionPanel.style.cssText = `
      position: absolute;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2000;
      background: rgba(255, 255, 255, 0.98);
      color: #111;
      padding: 16px 20px;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      max-width: 420px;
      min-width: 320px;
      font-size: 14px;
    `;

    const riesgoColor = zona.riesgo.includes('ALTO') ? '#e74c3c' : zona.riesgo.includes('MODERADO') ? '#f39c12' : '#27ae60';

    prediccionPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; color: ${riesgoColor};">Predicción: ${zona.name}</h3>
        <button id="closePred" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">×</button>
      </div>
      <div style="background: ${riesgoColor}22; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px;">
        <strong>Nivel de Riesgo:</strong> <span style="color: ${riesgoColor}; font-weight: 700;">${zona.riesgo}</span>
        <br>
        <strong>Probabilidad:</strong> ${zona.probabilidad}%
      </div>
      <div style="margin-bottom: 10px;">
        <strong>Precipitación esperada:</strong> ${zona.precipitacion}
      </div>
      <div>
        <strong>Recomendaciones:</strong>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          ${zona.recomendaciones.map(r => `<li style="margin: 4px 0;">${r}</li>`).join('')}
        </ul>
      </div>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        Coordenadas: ${lat.toFixed(4)}, ${lon.toFixed(4)}
      </div>
    `;

    document.body.appendChild(prediccionPanel);

    document.getElementById('closePred').addEventListener('click', () => {
      prediccionPanel.remove();
      prediccionPanel = null;
    });

    createToast(`Predicción generada para ${zona.name}`, 'success', 3000);
  }

  /* ===========================
     ANIMACIÓN TEMPORAL SST
  =========================== */

  let animationState = {
    playing: false,
    currentIndex: 0,
    dates: [],
    interval: null,
    speed: 1000
  };

  function getDateDaysAgo(days) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().split('T')[0];
  }

  function generateDateRange(start, end) {
    const dates = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }
    return dates;
  }

  function setupAnimationControls() {
    const animPanel = document.createElement('div');
    animPanel.id = 'animationPanel';
    animPanel.setAttribute('data-minimized', 'false');
    animPanel.innerHTML = `
      <div class="animPanelHeader" id="animDragHandle">
        <strong>Animación Temporal SST</strong>
        <div class="animHeaderButtons">
          <button id="minimizeAnim" class="headerBtn" title="Minimizar">−</button>
          <button id="closeAnim" class="headerBtn" title="Cerrar">×</button>
        </div>
      </div>
      <div id="animContent" class="animControls">
        <div class="dateRange">
          <label>Desde:</label>
          <input type="date" id="animStartDate" value="${getDateDaysAgo(30)}" />
          <label>Hasta:</label>
          <input type="date" id="animEndDate" value="${today}" />
        </div>
        <div class="playControls">
          <button id="playBtn" class="animBtn">▶ Reproducir</button>
          <button id="pauseBtn" class="animBtn" style="display:none;">⏸ Pausar</button>
          <button id="stopBtn" class="animBtn">⏹ Detener</button>
        </div>
        <div class="speedControl">
          <label>Velocidad:</label>
          <select id="speedSelect">
            <option value="2000">Lenta (2s)</option>
            <option value="1000" selected>Normal (1s)</option>
            <option value="500">Rápida (0.5s)</option>
            <option value="250">Muy rápida (0.25s)</option>
          </select>
        </div>
        <div class="progressContainer">
          <div class="progressBar">
            <div id="progressFill" class="progressFill"></div>
          </div>
          <div id="currentDateDisplay" class="currentDateDisplay">Fecha: ${today}</div>
        </div>
      </div>
    `;
    document.body.appendChild(animPanel);

    // Drag functionality
    let isDraggingAnim = false;
    let animOffsetX, animOffsetY;
    const dragHandle = document.getElementById('animDragHandle');
    
    dragHandle.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('headerBtn')) return;
      isDraggingAnim = true;
      animOffsetX = e.clientX - animPanel.offsetLeft;
      animOffsetY = e.clientY - animPanel.offsetTop;
      dragHandle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (isDraggingAnim) {
        animPanel.style.left = (e.clientX - animOffsetX) + 'px';
        animPanel.style.top = (e.clientY - animOffsetY) + 'px';
        animPanel.style.bottom = 'auto';
        animPanel.style.transform = 'none';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDraggingAnim) {
        isDraggingAnim = false;
        dragHandle.style.cursor = 'grab';
      }
    });

    // Minimize/Maximize
    document.getElementById('minimizeAnim').addEventListener('click', () => {
      const content = document.getElementById('animContent');
      const isMinimized = animPanel.getAttribute('data-minimized') === 'true';
      
      if (isMinimized) {
        content.style.display = 'flex';
        animPanel.setAttribute('data-minimized', 'false');
        document.getElementById('minimizeAnim').textContent = '−';
      } else {
        content.style.display = 'none';
        animPanel.setAttribute('data-minimized', 'true');
        document.getElementById('minimizeAnim').textContent = '+';
      }
    });

    // Close
    document.getElementById('closeAnim').addEventListener('click', () => {
      stopAnimation();
      animPanel.style.display = 'none';
    });

    // Event listeners
    document.getElementById('playBtn').addEventListener('click', startAnimation);
    document.getElementById('pauseBtn').addEventListener('click', pauseAnimation);
    document.getElementById('stopBtn').addEventListener('click', stopAnimation);
    document.getElementById('speedSelect').addEventListener('change', (e) => {
      animationState.speed = parseInt(e.target.value);
      if (animationState.playing) {
        stopAnimation();
        startAnimation();
      }
    });
  }

  function startAnimation() {
    const startDate = document.getElementById('animStartDate').value;
    const endDate = document.getElementById('animEndDate').value;
    
    if (!startDate || !endDate) {
      createToast('Selecciona rango de fechas válido', 'error', 3000);
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      createToast('La fecha inicial debe ser anterior a la final', 'error', 3000);
      return;
    }

    animationState.dates = generateDateRange(startDate, endDate);
    animationState.currentIndex = 0;
    animationState.playing = true;

    document.getElementById('playBtn').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'inline-block';

    const sstCheckbox = document.getElementById('layer-1');
    if (sstCheckbox && !sstCheckbox.checked) {
      sstCheckbox.checked = true;
      sstLayer.addTo(map);
      createToast('Capa SST activada', 'info', 2000);
    }

    createToast(`Animación: ${animationState.dates.length} días`, 'success', 3000);
    playNextFrame();
  }

  function playNextFrame() {
    if (!animationState.playing || animationState.currentIndex >= animationState.dates.length) {
      stopAnimation();
      return;
    }

    const currentDate = animationState.dates[animationState.currentIndex];
    
    if (map.hasLayer(sstLayer)) map.removeLayer(sstLayer);
    
    sstLayer = L.tileLayer(sstAnomalyTemplate(currentDate), {
      ...commonOptions,
      maxZoom: 12,
      opacity: 0.75,
      attribution: "NASA GHRSST — SST Anomalies (MUR L4)"
    }).addTo(map);

    layersConfig[1].layer = sstLayer;

    const progress = ((animationState.currentIndex + 1) / animationState.dates.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('currentDateDisplay').textContent = `Fecha: ${currentDate} (${animationState.currentIndex + 1}/${animationState.dates.length})`;
    
    if (dateInput) dateInput.value = currentDate;

    animationState.currentIndex++;
    animationState.interval = setTimeout(playNextFrame, animationState.speed);
  }

  function pauseAnimation() {
    animationState.playing = false;
    if (animationState.interval) clearTimeout(animationState.interval);
    document.getElementById('playBtn').style.display = 'inline-block';
    document.getElementById('pauseBtn').style.display = 'none';
    createToast('Animación pausada', 'info', 2000);
  }

  function stopAnimation() {
    animationState.playing = false;
    animationState.currentIndex = 0;
    if (animationState.interval) clearTimeout(animationState.interval);
    document.getElementById('playBtn').style.display = 'inline-block';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
    
    if (animationState.dates.length > 0) {
      createToast('Animación detenida', 'info', 2000);
    }
  }

  /* ===========================
     APLICAR FECHA
  =========================== */

  const goDateBtn = document.getElementById('goDate');
  if (goDateBtn) {
    goDateBtn.addEventListener('click', () => {
      const d = dateInput ? dateInput.value : null;
      if (!d) {
        alert('Elige una fecha.');
        return;
      }

      currentDate = d;

      if (map.hasLayer(imergLayer)) map.removeLayer(imergLayer);
      if (map.hasLayer(sstLayer)) map.removeLayer(sstLayer);

      imergLayer = L.tileLayer(imergTemplate(currentDate), {
        ...commonOptions,
        maxZoom: 12,
        opacity: 0.65,
        attribution: "NASA EOSDIS GIBS — IMERG Precipitation"
      });

      sstLayer = L.tileLayer(sstAnomalyTemplate(currentDate), {
        ...commonOptions,
        maxZoom: 12,
        opacity: 0.75,
        attribution: "NASA GHRSST — SST Anomalies (MUR L4)"
      });

      layersConfig[1].layer = sstLayer;
      layersConfig[2].layer = imergLayer;

      const checkbox1 = document.getElementById('layer-1');
      const checkbox2 = document.getElementById('layer-2');

      if (checkbox1 && checkbox1.checked) sstLayer.addTo(map);
      if (checkbox2 && checkbox2.checked) imergLayer.addTo(map);

      heatPiura.setLatLngs(generarDatosAleatorios());
      heatPeru.setLatLngs(generarDatosAleatorios());
      heatFuturo.setLatLngs(generarPrediccionesFuturas());

      const layerInfoEl = document.getElementById('layerInfo');
      if (layerInfoEl) {
        layerInfoEl.innerText = `Fecha actualizada: ${currentDate}`;
      }

      createToast(`Fecha actualizada a ${currentDate}`, 'success', 3000);
    });
  }

  /* ===========================
     PESTAÑAS
  =========================== */

  const tabBtns = document.querySelectorAll('.tabBtn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      const tab = document.getElementById(tabId);
      if (!tab) return;

      if (tab.style.display === 'block') {
        tab.style.display = 'none';
        btn.classList.remove('active');
      } else {
        document.querySelectorAll('.tabContent').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
        tab.style.display = 'block';
        btn.classList.add('active');
      }
    });
  });

  /* ===========================
     GRÁFICOS
  =========================== */

  try {
    new Chart(document.getElementById('rainChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
        datasets: [{
          label: 'Precipitación (mm)',
          data: [120, 180, 420, 200, 80, 40],
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'mm' } },
          x: { title: { display: true, text: 'Meses' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  } catch (e) {
    console.warn('rainChart no disponible', e);
  }

  try {
    new Chart(document.getElementById('cropChart').getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['Arroz', 'Maíz', 'Algodón'],
        datasets: [{
          label: 'Reducción (%)',
          data: [35, 25, 20],
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)'
          ],
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Impacto en cultivos' }
        }
      }
    });
  } catch (e) {
    console.warn('cropChart no disponible', e);
  }

  setupGeocoder(map);
  setupAnimationControls();

  map.fitBounds(peruBounds, { padding: [20, 20] });
  L.control.scale().addTo(map);

  createToast('Mapa cargado correctamente', 'success', 4000);

});