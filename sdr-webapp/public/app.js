document.addEventListener('DOMContentLoaded', () => {
    // Contenedores
    const flightsContainer = document.getElementById('flights-container');
    const historyContainer = document.getElementById('history-container');
    
    // Elementos de UI
    const updateTimeElement = document.getElementById('update-time');
    const searchButton = document.getElementById('search-history-btn');
    const deleteButton = document.getElementById('delete-history-btn');

    const livePollInterval = 5000; // 5 segundos

    // --- Lógica para la Vista en Vivo ---

    async function fetchAndDisplayLiveFlights() {
        try {
            const response = await fetch('/api/flights');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            renderFlightCards(flightsContainer, data.flights, 'No se están rastreando vuelos actualmente.');
            updateTimeElement.textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            console.error("Error al obtener los datos de vuelos en vivo:", error);
            flightsContainer.innerHTML = '<p>No se pudieron cargar los datos de los vuelos. Verifique que el servidor SDR esté funcionando.</p>';
        }
    }

    // --- Lógica para el Historial ---

    async function searchHistory() {
        const date = document.getElementById('history-date').value;
        const callsign = document.getElementById('history-callsign').value;

        if (!date) {
            alert('Por favor, seleccione una fecha para la búsqueda.');
            return;
        }

        let url = `/api/history?date=${date}`;
        if (callsign) {
            url += `&callsign=${callsign}`;
        }

        try {
            historyContainer.innerHTML = '<p>Buscando...</p>';
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            renderFlightCards(historyContainer, data.flights, 'No se encontraron vuelos para los criterios seleccionados.');

        } catch (error) {
            console.error("Error al buscar en el historial:", error);
            historyContainer.innerHTML = '<p>Ocurrió un error al realizar la búsqueda.</p>';
        }
    }

    // --- Lógica para Borrar Datos ---

    async function deleteHistory() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        if (!startDate || !endDate) {
            alert('Por favor, seleccione un rango de fechas (Desde y Hasta) para borrar.');
            return;
        }

        const confirmation = confirm(`¿Está seguro de que desea borrar permanentemente los registros entre ${startDate} y ${endDate}? Esta acción no se puede deshacer.`);

        if (!confirmation) return;

        try {
            const response = await fetch('/api/history', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ startDate, endDate }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error desconocido');
            }
            
            alert(result.message);
            historyContainer.innerHTML = '<p>Utilice el formulario para buscar en el historial de vuelos.</p>'; // Limpiar resultados

        } catch (error) {
            console.error("Error al borrar el historial:", error);
            alert(`No se pudieron borrar los registros: ${error.message}`);
        }
    }

    // --- Función Auxiliar de Renderizado ---

    function renderFlightCards(container, flights, emptyMessage) {
        container.innerHTML = ''; // Limpiar contenedor
        if (flights && flights.length > 0) {
            flights.forEach(flight => {
                const card = document.createElement('div');
                card.className = 'flight-card';
                const callsign = flight.callsign && flight.callsign.trim() !== 'N/A' ? flight.callsign.trim() : flight.modes;
                const lastSeen = new Date(flight.last_seen * 1000).toLocaleString();

                card.innerHTML = `
                    <h2>${callsign}</h2>
                    <p><strong>Visto por última vez:</strong> ${lastSeen}</p>
                    <p><strong>ModeS:</strong> ${flight.modes}</p>
                    <p><strong>Altitud:</strong> ${flight.altitude} ft</p>
                    <p><strong>Velocidad:</strong> ${flight.speed} kts</p>
                    <p><strong>Latitud:</strong> ${flight.lat.toFixed(4)}</p>
                    <p><strong>Longitud:</strong> ${flight.lon.toFixed(4)}</p>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `<p>${emptyMessage}</p>`;
        }
    }

    // --- Event Listeners ---
    searchButton.addEventListener('click', searchHistory);
    deleteButton.addEventListener('click', deleteHistory);

    // Iniciar el ciclo de actualización para la vista en vivo
    fetchAndDisplayLiveFlights();
    setInterval(fetchAndDisplayLiveFlights, livePollInterval);
});