async function fetchFlights(params="") {
  const res = await fetch("/api/flights" + params);
  const data = await res.json();
  return data;
}

function renderTable(rows) {
  const tbody = document.querySelector("#tbl tbody");
  tbody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" data-id="${r.id}"></td>
      <td>${r.id}</td>
      <td>${r.ts}</td>
      <td>${r.callsign || ""}</td>
      <td>${r.icao24 || ""}</td>
      <td>${r.lat}</td>
      <td>${r.lon}</td>
      <td>${r.altitude || ""}</td>
      <td>${r.track || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById("search").addEventListener("click", async () => {
  const date = document.getElementById("date").value;
  const callsign = document.getElementById("callsign").value.trim();
  let params = "?limit=200";
  if (date) params += "&date=" + encodeURIComponent(date);
  if (callsign) params += "&callsign=" + encodeURIComponent(callsign);
  const rows = await fetchFlights(params);
  renderTable(rows);
});

document.getElementById("refresh").addEventListener("click", async () => {
  const rows = await fetchFlights("?limit=100");
  renderTable(rows);
});

document.getElementById("deleteSelected").addEventListener("click", async () => {
  const checks = Array.from(document.querySelectorAll("#tbl tbody input[type=checkbox]:checked"));
  if (checks.length === 0) { alert("No hay seleccionados"); return; }
  const ids = checks.map(c => Number(c.dataset.id));
  if (!confirm("Eliminar " + ids.length + " registros?")) return;
  const res = await fetch("/api/flights/delete", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ids})
  });
  const data = await res.json();
  alert("Eliminados: " + data.deleted);
  // refrescar
  const rows = await fetchFlights("?limit=100");
  renderTable(rows);
});

// carga inicial
window.addEventListener("load", async () => {
  const rows = await fetchFlights("?limit=100");
  renderTable(rows);
});
