const peruBounds = [[-18.5, -81.5], [1.0, -68.0]];
const piuraBounds = [[-5.3, -80.75], [-5.1, -80.55]];
const dateObj = new Date();
dateObj.setDate(dateObj.getDate() - 3);
const defaultDate = dateObj.toISOString().split('T')[0];

document.addEventListener('DOMContentLoaded', () => { 
  document.getElementById('date').value = defaultDate; 
});

  const map = L.map('map', { zoomSnap: 0.5 }).setView([-9.2, -75], 5);

  function modisTemplate(time) { return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`; }
  function imergTemplate(time) { return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/${time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`; }
  function sstAnomalyTemplate(time) { return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Sea_Surface_Temperature_Anomalies_L4_MUR25/default/${time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`; }

  const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles © Esri' });

  let currentDate = defaultDate;
  let modisLayer = L.tileLayer(modisTemplate(currentDate), { tileSize:256, minZoom:2, maxZoom:9, noWrap:true, attribution:"NASA EOSDIS GIBS — MODIS Terra True Color" });
  let imergLayer = L.tileLayer(imergTemplate(currentDate), { tileSize:256, minZoom:2, maxZoom:6, opacity:0.65, noWrap:true, attribution:"NASA EOSDIS GIBS — IMERG Precipitation Rate (30min)" });
  let sstLayer = L.tileLayer(sstAnomalyTemplate(currentDate), { tileSize:256, minZoom:2, maxZoom:6, opacity:0.75, noWrap:true, attribution:"NASA EOSDIS GIBS — Sea Surface Temperature Anomalies" });
  let streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'&copy; OpenStreetMap contributors', opacity:0.8 });

  modisLayer.addTo(map);
  imergLayer.addTo(map);

  function generarDatosAleatorios(cantidad=200){ const puntos=[]; for(let i=0;i<cantidad;i++){ const lat=(Math.random()*180)-90; const lon=(Math.random()*360)-180; const intensidad=Math.random(); puntos.push([lat,lon,intensidad]); } return puntos; }
  let heatPiura=L.heatLayer(generarDatosAleatorios(), { radius:35, blur:10, maxZoom:15, opacity:0.8, gradient:{0.0:'blue',0.5:'yellow',1.0:'red'} }).addTo(map);
  let heatPeru=L.heatLayer(generarDatosAleatorios(), { radius:45, blur:15, maxZoom:10, opacity:0.8, gradient:{0.0:'blue',0.5:'yellow',1.0:'red'} }).addTo(map);
  function generarPrediccionesFuturas(cantidad=100){ const puntos=[]; for(let i=0;i<cantidad;i++){ const lat=-5+Math.random()*0.3; const lon=-80.75+Math.random()*0.2; const intensidad=Math.random(); puntos.push([lat,lon,intensidad]); } return puntos; }
  let heatFuturo=L.heatLayer(generarPrediccionesFuturas(), { radius:35, blur:10, maxZoom:15, opacity:0.7, gradient:{0.0:'blue',0.5:'yellow',1.0:'red'} });

  const baseLayers = { "MODIS True Color (NASA)": modisLayer, "Esri World Imagery": esri };
  const overlays = { 
    "Lluvia IMERG (NASA)": imergLayer,
    "Evento El Niño (SST NASA)": sstLayer,
    "Calles OSM (zoom > 10)": streetLayer,
    "Mapa de calor Piura": heatPiura,
    "Mapa de calor Perú": heatPeru,
    "Predicción futura inundaciones": heatFuturo
  };
  L.control.layers(baseLayers, overlays, { collapsed:false }).addTo(map);

  function updateStreets(){ if(map.getZoom()>10){ if(!map.hasLayer(streetLayer)) streetLayer.addTo(map);} else{ if(map.hasLayer(streetLayer)) map.removeLayer(streetLayer); } }
  map.on('zoomend', updateStreets);

  document.getElementById('fitPeru').addEventListener('click',()=>{ map.fitBounds(peruBounds,{ padding:[20,20] }); });
  document.getElementById('fitPiura').addEventListener('click',()=>{ map.fitBounds(piuraBounds,{ padding:[20,20] }); map.setZoom(13); if(!map.hasLayer(imergLayer)) imergLayer.addTo(map); if(!map.hasLayer(heatPiura)) heatPiura.addTo(map); updateStreets(); });

  document.getElementById('goDate').addEventListener('click',()=>{ 
    const d=document.getElementById('date').value; 
    if(!d){ alert('Elige una fecha.'); return;} 
    currentDate=d; 
    map.removeLayer(modisLayer); 
    map.removeLayer(imergLayer); 
    map.removeLayer(sstLayer);
    modisLayer=L.tileLayer(modisTemplate(currentDate), { tileSize:256, minZoom:2, maxZoom:9, noWrap:true, attribution:"NASA EOSDIS GIBS — MODIS Terra True Color" }); 
    imergLayer=L.tileLayer(imergTemplate(currentDate), { tileSize:256, minZoom:2, maxZoom:6, opacity:0.65, noWrap:true, attribution:"NASA EOSDIS GIBS — IMERG Precipitation Rate (30min)" }); 
    sstLayer=L.tileLayer(sstAnomalyTemplate(currentDate), { tileSize:256, minZoom:2, maxZoom:6, opacity:0.75, noWrap:true, attribution:"NASA EOSDIS GIBS — Sea Surface Temperature Anomalies" });
    modisLayer.addTo(map); 
    imergLayer.addTo(map);
    heatPiura.setLatLngs(generarDatosAleatorios()).addTo(map); 
    heatPeru.setLatLngs(generarDatosAleatorios()).addTo(map); 
    heatFuturo.setLatLngs(generarPrediccionesFuturas()).addTo(map); 
    document.getElementById('layerInfo').innerText=`Capa: MODIS True Color — Fecha: ${currentDate}`; 
    updateStreets();
  });

  let marker=null;
  map.on('click',function(e){ 
    const lat=Number(e.latlng.lat).toFixed(6); 
    const lon=Number(e.latlng.lng).toFixed(6); 
    document.getElementById('coords').innerHTML=`Lat: <strong>${lat}</strong>, Lon: <strong>${lon}</strong>`; 
    if(marker) map.removeLayer(marker); 
    marker=L.marker([lat,lon]).addTo(map); 
  });

  map.fitBounds(peruBounds,{ padding:[20,20] });
  L.control.scale().addTo(map);

  // === PESTAÑAS ===
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

  // === GRÁFICOS ===
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
});
