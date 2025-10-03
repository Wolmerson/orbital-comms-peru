// map.js (versión mejorada con fallback de fecha cuando GIBS no tiene tiles del día)
const peruBounds = [[-18.5, -81.5], [1.0, -68.0]];
const piuraBounds = [[-5.3, -80.75], [-5.1, -80.55]];
const today = new Date().toISOString().split('T')[0];

// Utilidades de fecha
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

// Plantillas WMTS (EPSG:3857)
function modisTemplate(time) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}
function imergTemplate(time) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/${time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
}
function sstAnomalyTemplate(time) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Sea_Surface_Temperature_Anomalies_L4_MUR25/default/${time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
}

// Comprueba si un tile de ejemplo existe (HEAD request) para la plantilla y fecha dadas.
// Devuelve true si el servidor responde OK (200..299) y el contenido parece una imagen.
async function checkTileAvailable(templateFunc, dateStr, sampleZ = 3, sampleX = 4, sampleY = 2, timeoutMs = 6000) {
  const template = templateFunc(dateStr);
  const url = template.replace('{z}', sampleZ).replace('{x}', sampleX).replace('{y}', sampleY);
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    // HEAD es ligero y GIBS suele soportarlo. Si falla, cae al catch.
    const resp = await fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal });
    clearTimeout(id);
    if (!resp.ok) {
      console.debug(`Tile check ${url} -> status ${resp.status}`);
      return false;
    }
    const ct = resp.headers.get('content-type') || '';
    // Aceptamos image/* o application/octet-stream (por seguridad)
    if (ct.startsWith('image') || ct.includes('octet-stream') || ct === '') {
      return true;
    }
    // si content-type es texto/html probablemente es una página de error
    return false;
  } catch (err) {
    console.debug('Tile check error for', url, err && err.name ? err.name : err);
    return false;
  }
}

// Encuentra la primera fecha disponible entre dateStr y dateStr - (maxBack-1) días
async function getAvailableDate(templateFunc, dateStr, maxBack = 5) {
  for (let i = 0; i < maxBack; i++) {
    const candidate = dateMinusDays(dateStr, i);
    const ok = await checkTileAvailable(templateFunc, candidate);
    if (ok) {
      if (i > 0) console.info(`Fallback: usando fecha ${candidate} (retrocedimos ${i} días)`);
      return candidate;
    } else {
      console.debug(`No hay tiles para ${candidate}`);
    }
  }
  // si no encontramos, devolvemos la original (y el UI verá tiles vacíos)
  console.warn(`No se encontró fecha con tiles en los últimos ${maxBack} días a partir de ${dateStr}`);
  return dateStr;
}

// Main: inicialización y lógica (async para poder usar await)
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('date').value = today;

  // crear mapa
  const map = L.map('map', { zoomSnap: 0.5, worldCopyJump: false }).setView([-9.2, -75], 5);

  // fallback base layer (esri) para diagnóstico si algún tile falla completamente
  const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri' });

  // opciones comunes para capas GIBS
  const commonOptions = {
    tileSize: 256,
    minZoom: 2,
    errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', // transparente
    noWrap: true,
    detectRetina: false
  };

  // Antes de crear capas, comprobamos qué fecha disponible usar (evita mapas negros)
  // Hacemos check para MODIS (imagen visible) y para IMERG (precipitación)
  const checkedModisDate = await getAvailableDate(modisTemplate, today, 5); // buscar hasta 5 días atrás
  const checkedImergDate = await getAvailableDate(imergTemplate, today, 5);

  let currentDate = checkedModisDate || today;
  // crear capas iniciales (usamos las fechas verificadas)
  let modisLayer = L.tileLayer(modisTemplate(currentDate), Object.assign({}, commonOptions, { maxZoom: 9, attribution: "NASA EOSDIS GIBS — MODIS Terra True Color" }));
  let imergLayer = L.tileLayer(imergTemplate(checkedImergDate), Object.assign({}, commonOptions, { maxZoom: 6, opacity: 0.65, attribution: "NASA EOSDIS GIBS — IMERG Precipitation Rate (30min)" }));
  let sstLayer = L.tileLayer(sstAnomalyTemplate(currentDate), Object.assign({}, commonOptions, { maxZoom: 6, opacity: 0.75, attribution: "NASA EOSDIS GIBS — Sea Surface Temperature Anomalies" }));
  let streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'&copy; OpenStreetMap contributors', opacity:0.8 });

  // Heatmaps y capas vectoriales tal como tenías
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

  // Añadir por defecto las capas visibles
  modisLayer.addTo(map);
  imergLayer.addTo(map);

  // Control de capas
  const baseLayers = { "MODIS True Color (NASA)": modisLayer, "Esri World Imagery (fallback)": esri };
  const overlays = {
    "Lluvia IMERG (NASA)": imergLayer,
    "Evento El Niño (SST NASA)": sstLayer,
    "Calles OSM (zoom > 10)": streetLayer,
    "Mapa de calor Piura": heatPiura,
    "Mapa de calor Perú": heatPeru,
    "Predicción futura inundaciones": heatFuturo
  };
  let layerControl = L.control.layers(baseLayers, overlays, { collapsed:false }).addTo(map);

  // Mostrar calles a zoom > 10
  function updateStreets(){
    if(map.getZoom() > 10){
      if(!map.hasLayer(streetLayer)) streetLayer.addTo(map);
    } else {
      if(map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
    }
  }
  map.on('zoomend', updateStreets);

  // Botones Fit
  document.getElementById('fitPeru').addEventListener('click', () => { map.fitBounds(peruBounds, { padding:[20,20] }); });
  document.getElementById('fitPiura').addEventListener('click', () => {
    map.fitBounds(piuraBounds, { padding:[20,20] });
    map.setZoom(13);
    if(!map.hasLayer(imergLayer)) imergLayer.addTo(map);
    if(!map.hasLayer(heatPiura)) heatPiura.addTo(map);
    updateStreets();
  });

  // Función para (re)crear capas con fecha segura (usa getAvailableDate)
  async function recreateLayersForDate(requestedDate) {
    // comprobar disponibilidad en GIBS (MODIS y IMERG)
    const availableModis = await getAvailableDate(modisTemplate, requestedDate, 7); // buscar hasta 7 días atrás
    const availableImerg = await getAvailableDate(imergTemplate, requestedDate, 7);

    currentDate = availableModis; // usamos MODIS para el label principal

    // eliminar capas viejas si existen
    try { if(map.hasLayer(modisLayer)) map.removeLayer(modisLayer); } catch(e){}
    try { if(map.hasLayer(imergLayer)) map.removeLayer(imergLayer); } catch(e){}
    try { if(map.hasLayer(sstLayer)) map.removeLayer(sstLayer); } catch(e){}

    // crear nuevas capas con las fechas encontradas
    modisLayer = L.tileLayer(modisTemplate(availableModis), Object.assign({}, commonOptions, { maxZoom:9, attribution:"NASA EOSDIS GIBS — MODIS Terra True Color" }));
    imergLayer = L.tileLayer(imergTemplate(availableImerg), Object.assign({}, commonOptions, { maxZoom:6, opacity:0.65, attribution:"NASA EOSDIS GIBS — IMERG Precipitation Rate (30min)" }));
    sstLayer = L.tileLayer(sstAnomalyTemplate(availableModis), Object.assign({}, commonOptions, { maxZoom:6, opacity:0.75, attribution:"NASA EOSDIS GIBS — SST Anomalies" }));

    // añadir al mapa (por defecto mostramos MODIS y IMERG)
    modisLayer.addTo(map);
    imergLayer.addTo(map);

    // reconstruir control de capas (simple y seguro)
    try { map.removeControl(layerControl); } catch(e){}
    layerControl = L.control.layers({"MODIS True Color (GIBS)": modisLayer, "Esri World Imagery (fallback)": esri}, {"IMERG Precipitación (30min)": imergLayer, "Evento El Niño (SST NASA)": sstLayer, "Calles OSM (zoom > 10)": streetLayer, "Mapa de calor Piura": heatPiura, "Mapa de calor Perú": heatPeru, "Predicción futura inundaciones": heatFuturo}, { collapsed:false }).addTo(map);

    document.getElementById('layerInfo').innerText = `Capa: MODIS True Color — Fecha: ${currentDate}`;
    // re-attach tileerror handlers para depuración
    modisLayer.on('tileerror', (e) => console.warn('MODIS tile error', e));
    imergLayer.on('tileerror', (e) => console.warn('IMERG tile error', e));
  }

  // Handler del botón de fecha (usa recreateLayersForDate)
  document.getElementById('goDate').addEventListener('click', async () => {
    const d = document.getElementById('date').value;
    if(!d){ alert('Elige una fecha.'); return; }
    // deshabilitar botón mientras chequeamos para evitar múltiples clicks
    const btn = document.getElementById('goDate');
    btn.disabled = true;
    btn.innerText = 'Comprobando...';
    try {
      await recreateLayersForDate(d);
      // regenerar heatmaps con nuevos datos aleatorios (placeholder)
      heatPiura.setLatLngs(generarDatosAleatorios()).addTo(map);
      heatPeru.setLatLngs(generarDatosAleatorios()).addTo(map);
      heatFuturo.setLatLngs(generarPrediccionesFuturas()).addTo(map);
      updateStreets();
    } catch (err) {
      console.error('Error actualizando capas:', err);
      alert('No se pudo actualizar las capas. Revisa la consola.');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Aplicar fecha';
    }
  });

  // Click en mapa -> coords y marcador
  let marker = null;
  map.on('click', function(e) {
    const lat = Number(e.latlng.lat).toFixed(6);
    const lon = Number(e.latlng.lng).toFixed(6);
    document.getElementById('coords').innerHTML = `Lat: <strong>${lat}</strong>, Lon: <strong>${lon}</strong>`;
    if(marker) map.removeLayer(marker);
    marker = L.marker([lat, lon]).addTo(map);
  });

  // Fit Perú al inicio y añadir escala
  map.fitBounds(peruBounds, { padding:[20,20] });
  L.control.scale().addTo(map);

  // Pestañas + Charts (las mismas que ya tenías)
  const tabBtns = document.querySelectorAll('.tabBtn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      const tab = document.getElementById(tabId);
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

  // Charts (solo recreo lo que tenías, sin cambios funcionales)
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

}); // end DOMContentLoaded
