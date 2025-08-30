const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Configuración ---
const app = express();
const port = 3000;
const aircrafDataUrl = 'http://192.168.58.107:8754/flights.json'; // Asegúrate que esta IP sea accesible desde donde corras el script
const dbPath = path.resolve(__dirname, 'flights.db');
const pollInterval = 10000; // 10 segundos

// --- Base de Datos ---
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    // Crear la tabla de historial si no existe
    db.run(`CREATE TABLE IF NOT EXISTS flight_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modes TEXT,
      lat REAL,
      lon REAL,
      track INTEGER,
      altitude INTEGER,
      speed INTEGER,
      squawk TEXT,
      callsign TEXT,
      timestamp INTEGER,
      last_seen INTEGER
    )`);
  }
});

// --- Lógica Principal ---

// Función para buscar y guardar datos de aeronaves
async function fetchAndSaveData() {
  try {
    const response = await axios.get(aircrafDataUrl);
    const aircraftData = response.data;
    const now = Math.floor(Date.now() / 1000);

    // Eliminar las propiedades "version" y "stats" si existen
    delete aircraftData.version;
    delete aircraftData.stats;

    const stmt = db.prepare("INSERT INTO flight_history (modes, lat, lon, track, altitude, speed, squawk, callsign, timestamp, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    let aircraftCount = 0;
    for (const key in aircraftData) {
      const ac = aircraftData[key];
      const callsign = ac[16] || 'N/A';
      stmt.run(ac[0], ac[1], ac[2], ac[3], ac[4], ac[5], ac[6], callsign, ac[10], now);
      aircraftCount++;
    }

    stmt.finalize((err) => {
      if (err) {
        console.error('Error saving data:', err.message);
      } else {
        console.log(`Data fetched and saved. Tracking ${aircraftCount} aircraft.`);
      }
    });

  } catch (error) {
    // No mostrar error si es un timeout o error de conexión, puede ser normal si el SDR no está activo
    if (error.code !== 'ECONNRESET' && error.code !== 'ETIMEDOUT' && !error.message.includes('404')) {
        console.error('Error fetching aircraft data:', error.message);
    }
  }
}

// --- API Endpoints ---

// Endpoint para obtener los vuelos ACTUALES (última posición conocida)
app.get('/api/flights', (req, res) => {
  // Esta consulta devuelve solo el registro más reciente para cada aeronave (basado en 'modes')
  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER(PARTITION BY modes ORDER BY last_seen DESC) as rn
      FROM flight_history
    ) WHERE rn = 1
    ORDER BY last_seen DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json({ flights: rows });
  });
});

// Endpoint para buscar en el HISTORIAL por fecha y/o callsign
app.get('/api/history', (req, res) => {
    const { date, callsign } = req.query;
    let sql = "SELECT * FROM flight_history WHERE 1=1";
    const params = [];

    if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
        const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

        sql += " AND last_seen BETWEEN ? AND ?";
        params.push(startTimestamp, endTimestamp);
    }

    if (callsign) {
        sql += " AND callsign LIKE ?";
        params.push(`%${callsign}%`);
    }

    sql += " ORDER BY last_seen DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ "error": err.message });
            return;
        }
        res.json({ flights: rows });
    });
});

// Endpoint para BORRAR registros por rango de fechas
app.delete('/api/history', express.json(), (req, res) => {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: "Se requieren fecha de inicio y fin." });
    }

    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).setHours(23, 59, 59, 999) / 1000);

    const sql = "DELETE FROM flight_history WHERE last_seen BETWEEN ? AND ?";
    db.run(sql, [startTimestamp, endTimestamp], function(err) {
        if (err) {
            return res.status(500).json({ "error": err.message });
        }
        res.json({ message: `Registros borrados con éxito: ${this.changes}` });
    });
});


// --- Servidor ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // Middleware para parsear JSON en requests de borrado

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  // Iniciar el ciclo de sondeo
  fetchAndSaveData();
  setInterval(fetchAndSaveData, pollInterval);
});