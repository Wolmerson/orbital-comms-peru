// map.js (versión final: clases en botones + fallback de fecha + feedback al usuario)
const peruBounds = [[-18.5, -81.5], [1.0, -68.0]];
const piuraBounds = [[-5.3, -80.75], [-5.1, -80.55]];
const today = new Date().toISOString().split('T')[0];

// ---------- UTILIDADES FECHA ----------
function formatDateYYYYMMDD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function dateMinusDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return formatDateYYYYMMDD(d);
}

// ---------- PLANTILLAS WMTS (EPSG:3857) ----------
function modisTemplate(time) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}
function imergTemplate(time) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/${time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
}
function sstAnomalyTemplate(time) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Sea_Surface_Temperature_Anomalies_L4_MUR25/default/${time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
}

// ---------- COMPROBAR TILE (HEAD request) ----------
async function checkTileAvailable(templateFunc, dateStr, sampleZ = 3, sampleX = 4, sampleY = 2, timeoutMs = 6000) {
  const template = templateFunc(dateStr);
  const url = template.replace('{z}', sampleZ).replace('{x}', sampleX).replace('{y}', sampleY);
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal });
    clearTimeout(id);
    if (!resp.ok) {
      console.debug(`Tile check ${url} -> status ${resp.status}`);
      return false;
    }
    const ct = resp.headers.get('content-type') || '';
    if (ct.startsWith('image') || ct.includes('octet-stream') || ct === '') {
      return true;
    }
    return false;
  } catch (err) {
    console.debug('Tile check error for', url, err && err.name ? err.name : err);
    return false;
  }
}

async function getAvailableDate(templateFunc, dateStr, maxBack = 5) {
  for (let i = 0; i < maxBack; i++) {
    const candidate = dateMinusDays(dateStr, i);
    const ok = await checkTileAvailable(templateFunc, candidate);
    if (ok) {
      if (i > 0) console.info(`Fallback: usando fecha ${candidate} (retrocedimos ${i} días)`);
      return candidate;
    }
  }
  console.warn(`No se encontró fecha con tiles en los últimos ${maxBack} días a partir de ${dateStr}`);
  return dateStr;
}

// ---------- INICIALIZACIÓN PRINCIPAL ----------
document.addEventListener('DOMContentLoaded', async () => {
  // Si existe input fecha, inicializar
  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.value = today;

  // Asegurar que los botones de la barra superior tengan la clase .btn (si existen)
  function ensureButtonClass(id, extraClass = '') {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('btn');
    if (extraClass) el.classList.add(extraClass);
    // accesibilidad
    if (!el.getAttribute('role')) el.setAttribute('role', 'button');
  }
  ensureButtonClass('goDate', 'secondary');
  ensureButtonClass('fitPeru', '');
  ensureButtonClass('fitPiura', '');
  // otros botones que puedas tener: agregar aquí ensureButtonClass('miBoton')

  // Crear mapa
  const map = L.map('map', { zoomSnap: 0.5, worldCopyJump: false }).setView([-9.2, -75], 5);

  // fallback base layer (Esri)
  const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri' });

  // opciones comunes GIBS
  const commonOptions = {
    tileSize: 256,
    minZoom: 2,
    errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
    noWrap: true,
    detectRetina: false
  };

  // comprobar fecha disponible (evita negro)
  const maxBackDays = 7; // si quieres buscar más, aumenta este número
  const checkedModisDate = await getAvailableDate(modisTemplate, today, maxBackDays);
  const checkedImergDate = await getAvailableDate(imergTemplate, today, maxBackDays);

  let currentDate = checkedModisDate || today;

  // crear capas iniciales con fechas verificadas
  let modisLayer = L.tileLayer(modisTemplate(currentDate), Object.assign({}, commonOptions, { maxZoom: 9, attribution: "NASA EOSDIS GIBS — MODIS Terra True Color" }));
  let imergLayer = L.tileLayer(imergTemplate(checkedImergDate), Object.assign({}, commonOptions, { maxZoom: 6, opacity: 0.65, attribution: "NASA EOSDIS GIBS — IMERG Precipitation Rate (30min)" }));
  let sstLayer = L.tileLayer(sstAnomalyTemplate(currentDate), Object.assign({}, commonOptions, { maxZoom: 6, opacity: 0.75, attribution: "NASA EOSDIS GIBS — Sea Surface Temperature Anomalies" }));
  let streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'&copy; OpenStreetMap contributors', opacity:0.8 });

  // heatmaps (placeholders)
  function generarDatosAleatorios(cantidad=200){
    const puntos=[];
    for(let i=0;i<cantidad;i++){
      const lat=(Math.random()*180)-90;
      const lon=(Math.random()*360)-180;
      const intensidad=Math.random();
      puntos.push([lat,lon,intensidad]);
    }
    return puntos;
  }
  let heatPiura = L.heatLayer(generarDatosAleatorios(), { radius:35, blur:10, maxZoom:15, opacity:0.8, gradient:{0.0:'blue',0.5:'yellow',1.0:'red'} });
  let heatPeru  = L.heatLayer(generarDatosAleatorios(), { radius:45, blur:15, maxZoom:10, opacity:0.8, gradient:{0.0:'blue',0.5:'yellow',1.0:'red'} });
  function generarPrediccionesFuturas(cantidad=100){
    const puntos=[];
    for(let i=0;i<cantidad;i++){
      const lat=-5+Math.random()*0.3;
      const lon=-80.75+Math.random()*0.2;
      const intensidad=Math.random();
      puntos.push([lat,lon,intensidad]);
    }
    return puntos;
  }
  let heatFuturo = L.heatLayer(generarPrediccionesFuturas(), { radius:35, blur:10, maxZoom:15, opacity:0.7, gradient:{0.0:'blue',0.5:'yellow',1.0:'red'} });

  // añadir capas por defecto
  modisLayer.addTo(map);
  imergLayer.addTo(map);

  // control de capas
  let layerControl = L.control.layers({"MODIS True Color (NASA)": modisLayer, "Esri World Imagery (fallback)": esri}, {
    "Lluvia IMERG (NASA)": imergLayer,
    "Evento El Niño (SST NASA)": sstLayer,
    "Calles OSM (zoom > 10)": streetLayer,
    "Mapa de calor Piura": heatPiura,
    "Mapa de calor Perú": heatPeru,
    "Predicción futura inundaciones": heatFuturo
  }, { collapsed:false }).addTo(map);

  // mostrar calles según zoom
  function updateStreets(){
    if(map.getZoom() > 10){
      if(!map.hasLayer(streetLayer)) streetLayer.addTo(map);
    } else {
      if(map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
    }
  }
  map.on('zoomend', updateStreets);

  // botones "Ir a"
  const fitPeruBtn = document.getElementById('fitPeru');
  if (fitPeruBtn) fitPeruBtn.addEventListener('click', () => { map.fitBounds(peruBounds, { padding:[20,20] }); });

  const fitPiuraBtn = document.getElementById('fitPiura');
  if (fitPiuraBtn) fitPiuraBtn.addEventListener('click', () => {
    map.fitBounds(piuraBounds, { padding:[20,20] });
    map.setZoom(13);
    if(!map.hasLayer(imergLayer)) imergLayer.addTo(map);
    if(!map.hasLayer(heatPiura)) heatPiura.addTo(map);
    updateStreets();
  });

  // ---- función para recrear capas con fecha segura ----
  async function recreateLayersForDate(requestedDate) {
    // feedback visual: informamos al usuario
    const layerInfoEl = document.getElementById('layerInfo');
    if (layerInfoEl) layerInfoEl.innerText = 'Comprobando disponibilidad de tiles...';

    // buscar fechas disponibles
    const availableModis = await getAvailableDate(modisTemplate, requestedDate, maxBackDays);
    const availableImerg = await getAvailableDate(imergTemplate, requestedDate, maxBackDays);

    currentDate = availableModis; // se usa como referencia en labels

    // eliminar capas antiguas
    try { if(map.hasLayer(modisLayer)) map.removeLayer(modisLayer); } catch(e){}
    try { if(map.hasLayer(imergLayer)) map.removeLayer(imergLayer); } catch(e){}
    try { if(map.hasLayer(sstLayer)) map.removeLayer(sstLayer); } catch(e){}

    // crear nuevas capas con fechas encontradas
    modisLayer = L.tileLayer(modisTemplate(availableModis), Object.assign({}, commonOptions, { maxZoom:9, attribution:"NASA EOSDIS GIBS — MODIS Terra True Color" }));
    imergLayer = L.tileLayer(imergTemplate(availableImerg), Object.assign({}, commonOptions, { maxZoom:6, opacity:0.65, attribution:"NASA EOSDIS GIBS — IMERG Precipitation Rate (30min)" }));
    sstLayer = L.tileLayer(sstAnomalyTemplate(availableModis), Object.assign({}, commonOptions, { maxZoom:6, opacity:0.75, attribution:"NASA EOSDIS GIBS — SST Anomalies" }));

    // añadir al mapa
    modisLayer.addTo(map);
    imergLayer.addTo(map);

    // reconstruir control de capas (para evitar referencias a capas antiguas)
    try { map.removeControl(layerControl); } catch(e){}
    layerControl = L.control.layers({"MODIS True Color (GIBS)": modisLayer, "Esri World Imagery (fallback)": esri}, {
      "IMERG Precipitación (30min)": imergLayer,
      "Evento El Niño (SST NASA)": sstLayer,
      "Calles OSM (zoom > 10)": streetLayer,
      "Mapa de calor Piura": heatPiura,
      "Mapa de calor Perú": heatPeru,
      "Predicción futura inundaciones": heatFuturo
    }, { collapsed:false }).addTo(map);

    // actualizar label con la fecha real usada (si hubo fallback se verá diferente a la solicitada)
    if (layerInfoEl) {
      if (availableModis !== requestedDate) {
        layerInfoEl.innerText = `Capa: MODIS — Fecha usada: ${availableModis} (fallback)`;
      } else {
        layerInfoEl.innerText = `Capa: MODIS — Fecha: ${currentDate}`;
      }
    }

    // adjuntar handlers para depuración
    modisLayer.on('tileerror', (e) => console.warn('MODIS tile error', e));
    imergLayer.on('tileerror', (e) => console.warn('IMERG tile error', e));
  }

  // botón "Aplicar fecha"
  const goDateBtn = document.getElementById('goDate');
  if (goDateBtn) {
    goDateBtn.addEventListener('click', async () => {
      const d = dateInput ? dateInput.value : null;
      if (!d) { alert('Elige una fecha.'); return; }
      goDateBtn.disabled = true;
      const prevText = goDateBtn.innerText;
      goDateBtn.innerText = 'Comprobando...';
      try {
        await recreateLayersForDate(d);
        // regenerar heatmaps como placeholder
        heatPiura.setLatLngs(generarDatosAleatorios()).addTo(map);
        heatPeru.setLatLngs(generarDatosAleatorios()).addTo(map);
        heatFuturo.setLatLngs(generarPrediccionesFuturas()).addTo(map);
        updateStreets();
      } catch (err) {
        console.error('Error actualizando capas:', err);
        alert('No se pudo actualizar las capas. Revisa la consola.');
      } finally {
        goDateBtn.disabled = false;
        goDateBtn.innerText = prevText || 'Aplicar fecha';
      }
    });
  }

  // clic en mapa -> coordenadas y marcador
  let marker = null;
  map.on('click', function(e) {
    const lat = Number(e.latlng.lat).toFixed(6);
    const lon = Number(e.latlng.lng).toFixed(6);
    const coordsEl = document.getElementById('coords');
    if (coordsEl) coordsEl.innerHTML = `Lat: <strong>${lat}</strong>, Lon: <strong>${lon}</strong>`;
    if(marker) map.removeLayer(marker);
    marker = L.marker([lat, lon]).addTo(map);
  });

  // fit Perú al inicio y escala
  map.fitBounds(peruBounds, { padding:[20,20] });
  L.control.scale().addTo(map);

  // pestañas + charts (sin cambios funcionales)
  const tabBtns = document.querySelectorAll('.tabBtn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      const tab = document.getElementById(tabId);
      if (!tab) return;
      if(tab.style.display==='block'){
        tab.style.display='none';
        btn.classList.remove('active');
      } else {
        document.querySelectorAll('.tabContent').forEach(t => t.style.display='none');
        document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
        tab.style.display='block';
        btn.classList.add('active');
      }
    });
  });

  // Charts (mantengo lo que ya tenías — si faltan canvas, no romperá)
  try {
    new Chart(document.getElementById('rainChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Ene','Feb','Mar','Abr','May','Jun'],
        datasets: [{
          label: 'Precipitación (mm)',
          data: [120, 180, 420, 200, 80, 40],
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: { responsive: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'mm' } }, x: { title: { display: true, text: 'Meses' } } }, plugins: { legend: { display: false } } }
    });
  } catch(e) { console.warn('rainChart no disponible o error', e); }

  try {
    new Chart(document.getElementById('cropChart').getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['Arroz','Maíz','Algodón'],
        datasets: [{
          label: 'Reducción de producción (%)',
          data: [35, 25, 20],
          backgroundColor: ['rgba(255, 99, 132, 0.6)','rgba(255, 206, 86, 0.6)','rgba(75, 192, 192, 0.6)'],
          borderColor: '#fff',
          borderWidth: 1
        }]
      },
      options: { responsive: false, plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Impacto en cultivos' } } }
    });
  } catch(e) { console.warn('cropChart no disponible o error', e); }

}); // end DOMContentLoaded
