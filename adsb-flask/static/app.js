document.addEventListener('DOMContentLoaded', () => {
  const API_URL_RECENT = '/api/recent';
  const API_URL_SEARCH = '/api/flights';

  const map = document.getElementById('map');
  const flightsTableBody = document.querySelector('#flights-table tbody');
  const refreshButton = document.getElementById('refresh');
  const callsignInput = document.getElementById('callsign');

  // --- Configuración del Mapa ---
  // Define los límites geográficos que quieres que tu mapa represente.
  // Esto es una simplificación. Un mapa real usaría proyecciones más complejas.
  // AJUSTA ESTOS VALORES a la zona que te interesa.
  const MAP_BOUNDS = {
    latMin: 5.65,
    latMax: 6.65,
    lonMin: -76.07,
    lonMax: -75.07,
  };

  // Función para convertir coordenadas Geo a píxeles en el mapa
  function geoToPixel(lat, lon) {
    const mapWidth = map.offsetWidth;
    const mapHeight = map.offsetHeight;

    const lonRange = MAP_BOUNDS.lonMax - MAP_BOUNDS.lonMin;
    const latRange = MAP_BOUNDS.latMax - MAP_BOUNDS.latMin;

    const left = ((lon - MAP_BOUNDS.lonMin) / lonRange) * mapWidth;
    const top = ((MAP_BOUNDS.latMax - lat) / latRange) * mapHeight;

    return { top, left };
  }

  // Función principal para actualizar los datos
  async function updateFlights() {
    const callsign = callsignInput.value.trim();
    let url = API_URL_RECENT;
    if (callsign) {
      url = `${API_URL_SEARCH}?callsign=${encodeURIComponent(callsign)}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Error al contactar la API:", response.statusText);
        return;
      }
      const flights = await response.json();

      // Limpiar mapa y tabla antes de redibujar
      map.innerHTML = '';
      flightsTableBody.innerHTML = '';

      // Procesar solo los vuelos más recientes para cada icao24
      const latestFlights = {};
      for (const flight of flights) {
        if (!latestFlights[flight.icao24] || new Date(flight.ts) > new Date(latestFlights[flight.icao24].ts)) {
          latestFlights[flight.icao24] = flight;
        }
      }

      for (const icao in latestFlights) {
        const flight = latestFlights[icao];
        
        // 1. Dibujar en el mapa
        if (flight.lat != null && flight.lon != null) {
          const { top, left } = geoToPixel(flight.lat, flight.lon);

          // Asegurarse de que el avión está dentro de la vista del mapa
          if (left > 0 && left < map.offsetWidth && top > 0 && top < map.offsetHeight) {
            const aircraftDiv = document.createElement('div');
            aircraftDiv.className = 'aircraft';
            aircraftDiv.style.top = `${top}px`;
            aircraftDiv.style.left = `${left}px`;

            const labelDiv = document.createElement('div');
            labelDiv.className = 'aircraft-label';
            labelDiv.innerText = `${(flight.callsign || 'N/A').trim()}`;
            
            aircraftDiv.appendChild(labelDiv);
            map.appendChild(aircraftDiv);
          }
        }

        // 2. Añadir a la tabla
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${(flight.callsign || 'N/A').trim()}</td>
          <td>${flight.altitude || '--'}</td>
          <td>${flight.speed || '--'}</td>
        `;
        flightsTableBody.appendChild(row);
      }

    } catch (error) {
      console.error("Fallo al actualizar vuelos:", error);
    }
  }

  // --- Event Listeners ---
  refreshButton.addEventListener('click', updateFlights);

  // --- Inicialización ---
  updateFlights(); // Primera carga
  setInterval(updateFlights, 10000); // Actualizar cada 10 segundos
});