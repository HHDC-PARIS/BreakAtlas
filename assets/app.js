let map;
let markers = [];

document.addEventListener("DOMContentLoaded", () => {
  map = L.map("map").setView([50, 10], 4); // Europe center
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  renderSpots(spots);
});

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
      <button onclick="zoomToSpot(${i})">Zoom</button>
      <button onclick="toggleFavorite('${s.name}')">⭐ Favorite</button>
    `;
    container.appendChild(card);

    const marker = L.marker([s.lat, s.lng]).addTo(map);
    marker.bindTooltip(`<strong>${s.name}</strong>`);
    markers.push(marker);
  });
}

function zoomToSpot(i) {
  const s = spots[i];
  map.setView([s.lat, s.lng], 13);
}

function toggleMenu() {
  document.getElementById("navLinks").classList.toggle("show");
}

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.style.display = "none");
  document.getElementById(id).style.display = "block";
}

function login() {
  const user = document.getElementById("username").value;
  alert(`Welcome ${user} to BreakAtlas`);
  showView("dashboard");
}