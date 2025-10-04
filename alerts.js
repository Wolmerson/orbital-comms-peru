const apiKey = "e3422927e34572dc6ebf82a6c161606e"; // 👈 pega aquí tu clave de OpenWeather

// Lista de ciudades/zonas del mundo 🌍
const ciudades = [
  { nombre: "Lima, Perú", lat: -12.0464, lon: -77.0428 },
  { nombre: "Tokio, Japón", lat: 35.6762, lon: 139.6503 },
  { nombre: "Miami, EE.UU.", lat: 25.7617, lon: -80.1918 },
  { nombre: "Madrid, España", lat: 40.4168, lon: -3.7038 },
  { nombre: "Sídney, Australia", lat: -33.8688, lon: 151.2093 }
];

async function cargarAlertasGlobales() {
  const contenedor = document.getElementById("alerts-container");
  contenedor.innerHTML = "<p>Cargando alertas...</p>";

  for (const ciudad of ciudades) {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/3.0/onecall?lat=${ciudad.lat}&lon=${ciudad.lon}&appid=${apiKey}&lang=es&units=metric`
      );
      const data = await res.json();

      const card = document.createElement("div");
      card.className = "card story-block";
      card.innerHTML = `<h3>🌍 ${ciudad.nombre}</h3>`;

      if (data.alerts && data.alerts.length > 0) {
        data.alerts.forEach(alerta => {
          card.innerHTML += `
            <p><strong>${alerta.event}</strong></p>
            <p>${alerta.description}</p>
            <p><small>⏰ ${new Date(alerta.start * 1000).toLocaleString()} - ${new Date(alerta.end * 1000).toLocaleString()}</small></p>
          `;
        });
      } else {
        card.innerHTML += "<p>✅ No hay alertas activas</p>";
      }

      contenedor.appendChild(card);
    } catch (err) {
      console.error("Error cargando alertas para", ciudad.nombre, err);
      const errorCard = document.createElement("div");
      errorCard.className = "card story-block";
      errorCard.innerHTML = `<h3>🌍 ${ciudad.nombre}</h3><p>❌ Error al cargar alertas.</p>`;
      contenedor.appendChild(errorCard);
    }
  }
}

// Cargar al inicio y actualizar cada 10 minutos
cargarAlertasGlobales();
setInterval(cargarAlertasGlobales, 600000);