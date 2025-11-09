let map;
let markers = [];

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  renderSpots(spots);
});

function initMap() {
  map = L.map("map").setView([50, 10], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
}

function renderSpots(list) {
  const container = document.getElementById("cards");
  container.innerHTML = "";
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  list.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${s.image}" alt="${s.name}" />
      <h3>${s.name}</h3>
      <p>${s.city}, ${s.country} • ${s.type}</p>
      <p>${s.about}</p>
      <div class="card-actions">
        <button onclick="zoomToSpot(${i})">Zoom</button>
        <button onclick="shareSpot(${i})">Share</button>
      </div>
    `;
    container.appendChild(card);

    const marker = L.marker([s.lat, s.lng]).addTo(map);
    marker.bindPopup(`<strong>${s.name}</strong><br>${s.city}, ${s.country}`);
    markers.push(marker);
  });
}

function zoomToSpot(i) { map.setView([spots[i].lat, spots[i].lng], 13); }

function shareSpot(i) {
  const s = spots[i];
  const text = `Check this out on BreakAtlas: ${s.name} — ${s.city