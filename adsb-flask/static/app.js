document.addEventListener('DOMContentLoaded', () => {
  const API_URL_RECENT = '/api/recent';
  const API_URL_SEARCH = '/api/flights';

  const map = document.getElementById('map');
  const sidebar = document.querySelector('.sidebar');
  const resizer = document.getElementById('resizer');
  const flightsTableBody = document.querySelector('#flights-table tbody');
  const searchButton = document.getElementById('search-button');
  const callsignInput = document.getElementById('callsign');
  const dateInput = document.getElementById('date');

  let liveUpdateInterval = null;

  // --- Lógica de redimensión de paneles ---
  const initResizer = () => {
    let startX, startWidth;

    const doDrag = (e) => {
      const newWidth = startWidth - (e.clientX - startX);
      if (newWidth > 350 && newWidth < 800) { // Limitar ancho min/max
        sidebar.style.flexBasis = `${newWidth}px`;
      }
    };

    const stopDrag = () => {
      document.documentElement.removeEventListener('mousemove', doDrag, false);
      document.documentElement.removeEventListener('mouseup', stopDrag, false);
    };

    resizer.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).flexBasis, 10);
      document.documentElement.addEventListener('mousemove', doDrag, false);
      document.documentElement.addEventListener('mouseup', stopDrag, false);
    });
  };

  // --- Configuración del Mapa ---
  const MAP_BOUNDS = {
    latMin: 5.65,
    latMax: 6.65,
    lonMin: -76.07,
    lonMax: -75.07,
  };

  function geoToPixel(lat, lon) {
    const mapWidth = map.offsetWidth;
    const mapHeight = map.offsetHeight;
    const lonRange = MAP_BOUNDS.lonMax - MAP_BOUNDS.lonMin;
    const latRange = MAP_BOUNDS.latMax - MAP_BOUNDS.latMin;
    const left = ((lon - MAP_BOUNDS.lonMin) / lonRange) * mapWidth;
    const top = ((MAP_BOUNDS.latMax - lat) / latRange) * mapHeight;
    return { top, left };
  }

  function renderFlights(flights) {
    map.innerHTML = '';
    flightsTableBody.innerHTML = '';

    const latestFlights = {};
    if (flights) {
        for (const flight of flights) {
            if (!latestFlights[flight.icao24] || new Date(flight.ts) > new Date(latestFlights[flight.icao24].ts)) {
                latestFlights[flight.icao24] = flight;
            }
        }
    }

    for (const icao in latestFlights) {
      const flight = latestFlights[icao];
      
      // 1. Dibujar en el mapa
      if (flight.lat != null && flight.lon != null) {
        const { top, left } = geoToPixel(flight.lat, flight.lon);
        if (left > 0 && left < map.offsetWidth && top > 0 && top < map.offsetHeight) {
          const aircraftDiv = document.createElement('div');
          aircraftDiv.className = 'aircraft';
          aircraftDiv.style.top = `${top}px`;
          aircraftDiv.style.left = `${left}px`;

          const labelDiv = document.createElement('div');
          labelDiv.className = 'aircraft-label';
          const callsign = (flight.callsign || 'N/A').trim();
          const alt = flight.altitude ? `${flight.altitude}ft` : '';
          const speed = flight.speed ? `${flight.speed}kt` : '';
          labelDiv.innerText = `${callsign}\n${alt} ${speed}`;
          
          aircraftDiv.appendChild(labelDiv);
          map.appendChild(aircraftDiv);
        }
      }

      // 2. Añadir a la tabla
      const row = document.createElement('tr');
      const timestamp = new Date(flight.ts).toLocaleTimeString();
      row.innerHTML = `
        <td>${(flight.callsign || 'N/A').trim()}</td>
        <td>${flight.icao24 || '--'}</td>
        <td>${flight.squawk || '--'}</td>
        <td>${flight.altitude || '--'}</td>
        <td>${flight.speed || '--'}</td>
        <td>${flight.track || '--'}</td>
        <td>${timestamp}</td>
      `;
      flightsTableBody.appendChild(row);
    }
  }

  async function performSearch() {
    stopLiveUpdates();
    const callsign = callsignInput.value.trim();
    const date = dateInput.value;

    let url = API_URL_SEARCH;
    const params = new URLSearchParams();
    if (callsign) params.append('callsign', callsign);
    if (date) params.append('date', date);

    if (!callsign && !date) {
      startLiveUpdates();
      return;
    }

    url = `${url}?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Error en la búsqueda:", response.statusText);
        return;
      }
      const flights = await response.json();
      renderFlights(flights);
    } catch (error) {
      console.error("Fallo al buscar vuelos:", error);
    }
  }

  async function fetchRecentFlights() {
    try {
      const response = await fetch(API_URL_RECENT);
      if (!response.ok) {
        console.error("Error al obtener vuelos recientes:", response.statusText);
        return;
      }
      const flights = await response.json();
      renderFlights(flights);
    } catch (error) {
      console.error("Fallo al obtener vuelos recientes:", error);
    }
  }

  function startLiveUpdates() {
    fetchRecentFlights();
    if (!liveUpdateInterval) {
      liveUpdateInterval = setInterval(fetchRecentFlights, 10000);
    }
    callsignInput.value = '';
    dateInput.value = '';
  }

  function stopLiveUpdates() {
    if (liveUpdateInterval) {
      clearInterval(liveUpdateInterval);
      liveUpdateInterval = null;
    }
  }

  // --- Event Listeners ---
  searchButton.addEventListener('click', performSearch);

  // --- Inicialización ---
  initResizer();
  startLiveUpdates();
});