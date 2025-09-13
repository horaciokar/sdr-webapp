import os
import threading
import time
import requests
import sqlite3
import datetime
from flask import Flask, request, jsonify, render_template

# Config (puedes cambiar con variables de entorno)
DB_PATH = os.getenv("DB_PATH", "flights.db")
DUMP1090_URL = os.getenv("DUMP1090_URL", "http://127.0.0.1:8080/data.json")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "30"))  # segundos

# Inicializar DB
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('''
    CREATE TABLE IF NOT EXISTS flights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icao24 TEXT,
        callsign TEXT,
        lat REAL,
        lon REAL,
        altitude REAL,
        track REAL,
        speed REAL,
        squawk TEXT,
        seen_pos INTEGER,
        ts DATETIME
    )''')
    conn.commit()
    conn.close()

# Poller: consulta dump1090 y guarda
def poller():
    while True:
        try:
            resp = requests.get(DUMP1090_URL, timeout=8)
            data = resp.json()
            aircraft = data.get("aircraft", [])
            now = datetime.datetime.utcnow().isoformat(sep=' ')
            if aircraft:
                conn = sqlite3.connect(DB_PATH)
                cur = conn.cursor()
                for ac in aircraft:
                    lat = ac.get("lat")
                    lon = ac.get("lon")
                    # guardamos solo si tiene posición
                    if lat is None or lon is None:
                        continue
                    callsign = (ac.get("flight") or "").strip()
                    cur.execute('''
                        INSERT INTO flights
                        (icao24, callsign, lat, lon, altitude, track, speed, squawk, seen_pos, ts)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        ac.get("hex"),
                        callsign,
                        lat,
                        lon,
                        ac.get("alt_baro"),
                        ac.get("track"),
                        ac.get("speed"),
                        ac.get("squawk"),
                        ac.get("seen_pos"),
                        now
                    ))
                conn.commit()
                conn.close()
        except Exception as e:
            # no romper; solo loguear al stdout (ver journalctl si corre como servicio)
            print("Poller error:", e)
        time.sleep(POLL_INTERVAL)

# Helper para consultas
def query_db(sql, params=()):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

# Flask app
app = Flask(__name__, template_folder="templates", static_folder="static")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/flights", methods=["GET"])
def api_flights():
    callsign = request.args.get("callsign")
    date = request.args.get("date")  # YYYY-MM-DD
    limit = int(request.args.get("limit", "200"))
    sql = "SELECT * FROM flights WHERE 1=1"
    params = []
    if callsign:
        sql += " AND callsign LIKE ?"
        params.append(f"%{callsign}%")
    if date:
        sql += " AND DATE(ts) = ?"
        params.append(date)
    sql += " ORDER BY ts DESC LIMIT ?"
    params.append(limit)
    rows = query_db(sql, tuple(params))
    return jsonify(rows)

@app.route("/api/flights/delete", methods=["POST"])
def api_delete():
    data = request.get_json() or {}
    ids = data.get("ids", [])
    if not ids:
        return jsonify({"deleted": 0})
    placeholders = ",".join("?" for _ in ids)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(f"DELETE FROM flights WHERE id IN ({placeholders})", tuple(ids))
    deleted = cur.rowcount
    conn.commit()
    conn.close()
    return jsonify({"deleted": deleted})

@app.route("/api/recent", methods=["GET"])
def api_recent():
    limit = int(request.args.get("limit", "50"))
    rows = query_db("SELECT * FROM flights ORDER BY ts DESC LIMIT ?", (limit,))
    return jsonify(rows)

if __name__ == "__main__":
    init_db()
    # arrancar poller en thread daemon
    t = threading.Thread(target=poller, daemon=True)
    t.start()
    # levantar flask (para desarrollo)
    app.run(host="0.0.0.0", port=5000)
