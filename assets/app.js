// ------------------------------
// Data bootstrap (demo)
// ------------------------------
const spots = [
  { name: "Berlin Wall", city: "Berlin", country: "Germany", crew: "Crew A", image: "https://picsum.photos/seed/berlin/600/400", lat: 52.5, lng: 13.4, about: "Historic graffiti spot", reviews: [] },
  { name: "Paris Metro", city: "Paris", country: "France", crew: "Crew B", image: "https://picsum.photos/seed/paris/600/400", lat: 48.86, lng: 2.35, about: "Underground art", reviews: [] },
  { name: "Shoreditch", city: "London", country: "UK", crew: "Crew C", image: "https://picsum.photos/seed/london/600/400", lat: 51.52, lng: -0.07, about: "Street art hotspot", reviews: [] },
];

let currentUser = JSON.parse(localStorage.getItem("gx_user")) || {
  name: "Sidy",
  follows: { countries: ["Germany"], cities: ["Berlin"], crews: ["Crew A"] },
  favorites: [],
  collections: [], // [{name, spots:[spotName,...]}]
  activities: [],
  achievements: [],
  themeColor: "#444",
  avatar: ""
};

let markers = [];
let map;

// ------------------------------
// Init
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Theme
  document.body.style.setProperty("--theme-color", currentUser.themeColor || "#444");

  // Tabs
  const dashboard = document.getElementById("dashboard");
  const profileView = document.getElementById("profile");
  const leaderboardView = document.getElementById("leaderboardView");
  const storyView = document.getElementById("storyMode");
  const tabs = {
    tabDashboard: () => showView(dashboard),
    tabProfile: () => showView(profileView),
    tabLeaderboard: () => showView(leaderboardView),
    tabStory: () => showView(storyView)
  };
  Object.keys(tabs).forEach(id =>
    document.getElementById(id).addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.getElementById(id).classList.add("active");
      tabs[id]();
    })
  );
  showView(dashboard);

  // Map
  map = L.map("map").setView([48.86, 2.35], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  // Render initial UI
  renderSpots(spots);
  renderProfile();
  renderLeaderboard(demoUsers());
  renderHallOfFame(demoUsers());
  renderGlobalStats();
  renderChallenges();

  // Search
  document.getElementById("searchBar").addEventListener("input", onSearch);

  // Reset filter
  document.getElementById("resetFilterBtn").addEventListener("click", () => {
    renderSpots(spots);
    document.getElementById("filterSummary").style.display = "none";
    document.getElementById("resetFilterBtn").style.display = "none";
    document.getElementById("searchBar").value = "";
  });

  // Profile controls
  document.getElementById("avatarUpload").addEventListener("change", handleAvatarUpload);
  document.getElementById("themeColorPicker").addEventListener("input", handleThemeChange);
  document.getElementById("createCollectionBtn").addEventListener("click", createCollection);

  // Story mode
  document.getElementById("prevSlide").addEventListener("click", prevSlide);
  document.getElementById("nextSlide").addEventListener("click", nextSlide);
  document.getElementById("exitStory").addEventListener("click", exitStory);

  // Chart
  setupChart();
});

// ------------------------------
// Views
// ------------------------------
function showView(el) {
  document.querySelectorAll(".view").forEach(v => (v.style.display = "none"));
  el.style.display = "block";
}

// ------------------------------
// Render spots + map sync
// ------------------------------
function renderSpots(list = spots) {
  const container = document.getElementById("cards");
  container.innerHTML = "";

  // Clear markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  list.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.id = `card-${s.name.replace(/\s+/g, "-")}`;

    const avgRating = s.reviews.length
      ? (s.reviews.reduce((a, r) => a + r.rating, 0) / s.reviews.length).toFixed(1)
      : "—";

    card.innerHTML = `
      <img src="${s.image}" alt="${s.name}" />
      <h3>${s.name}</h3>
      <p class="muted">${s.city}, ${s.country} • Crew: ${s.crew}</p>
      <p>${s.about}</p>
      <p class="muted">Avg rating: ${avgRating} (${s.reviews.length} reviews)</p>
      <div class="actions">
        <button onclick="toggleFavorite('${s.name}')">⭐ Favorite</button>
        <button onclick="shareSpot('${s.name}')">📣 Share</button>
        <button onclick="zoomToSpot('${s.name}')">Zoom on map</button>
        <button onclick="openModal('${s.name}')">Review / Details</button>
        <button onclick="followCity('${s.city}')">Follow city</button>
        <button onclick="followCountry('${s.country}')">Follow country</button>
        <button onclick="followCrew('${s.crew}')">Follow crew</button>
        <button onclick="addToCollectionPrompt('${s.name}')">Add to collection</button>
      </div>
    `;
    container.appendChild(card);

    const marker = L.marker([s.lat, s.lng]).addTo(map);
    marker.bindTooltip(
      `<div style="text-align:center;">
        <img src="${s.image}" alt="${s.name}" style="width:90px;height:70px;object-fit:cover;border-radius:4px;" />
        <div style="margin-top:4px;font-weight:bold;">${s.name}</div>
      </div>`,
      { direction: "top", offset: [0, -10] }
    );
    marker.on("click", () => highlightCard(s.name));
    marker.on("dblclick", () => openModal(s.name));
    markers.push(marker);
  });

  // Fit bounds
  if (markers.length) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2));
  }

  updateMapLayers();
}

// ------------------------------
// Favorites
// ------------------------------
function toggleFavorite(spotName) {
  const spot = spots.find(sp => sp.name === spotName);
  const exists = currentUser.favorites.find(f => f.name === spotName);
  if (exists) {
    currentUser.favorites = currentUser.favorites.filter(f => f.name !== spotName);
    logActivity(`Removed favorite: ${spotName}`);
  } else {
    currentUser.favorites.push({ name: spotName });
    logActivity(`Added favorite: ${spotName}`);
  }
  saveUser();
  renderProfile();
}

// ------------------------------
// Share
// ------------------------------
function shareSpot(spotName) {
  const spot = spots.find(sp => sp.name === spotName);
  const shareText = `Check out ${spot.name} in ${spot.city}, ${spot.country}!`;
  if (navigator.share) {
    navigator.share({ title: spot.name, text: shareText, url: location.href });
  } else {
    navigator.clipboard.writeText(`${shareText} ${location.href}`);
    alert("Spot info copied to clipboard!");
  }
  logActivity(`Shared spot: ${spot.name}`);
}

// ------------------------------
// Reviews
// ------------------------------
function openModal(spotName) {
  const spot = spots.find(sp => sp.name === spotName);
  const rating = prompt(`Leave a rating (1-5) for ${spot.name}:`);
  if (!rating) return;
  const r = parseInt(rating, 10);
  if (isNaN(r) || r < 1 || r > 5) return alert("Please enter a number between 1 and 5.");
  const text = prompt("Write a short review (optional):") || "";
  spot.reviews.push({ rating: r, text });
  logActivity(`Reviewed ${spot.name} (${r} stars)`);
  renderSpots(spots);
  renderGlobalStats();
  saveUser();
}

// ------------------------------
// Follow
// ------------------------------
function followCity(city) {
  if (!currentUser.follows.cities.includes(city)) {
    currentUser.follows.cities.push(city);
    logActivity(`Followed city: ${city}`);
    saveUser();
    renderProfile();
  }
}
function followCountry(country) {
  if (!currentUser.follows.countries.includes(country)) {
    currentUser.follows.countries.push(country);
    logActivity(`Followed country: ${country}`);
    saveUser();
    renderProfile();
  }
}
function followCrew(crew) {
  if (!currentUser.follows.crews.includes(crew)) {
    currentUser.follows.crews.push(crew);
    logActivity(`Followed crew: ${crew}`);
    saveUser();
    renderProfile();
  }
}

// ------------------------------
// Map interactions
// ------------------------------
function zoomToSpot(spotName) {
  const s = spots.find(sp => sp.name === spotName);
  if (!s) return;
  map.setView([s.lat, s.lng], 14);
}

function highlightCard(spotName) {
  const id = `card-${spotName.replace(/\s+/g, "-")}`;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("highlight");
  setTimeout(() => el.classList.remove("highlight"), 1500);
}

// Layers toggle
["layerFavorites","layerCrews","layerCountries","layerCities"].forEach(id =>
  document.getElementById(id).addEventListener("change", updateMapLayers)
);

function updateMapLayers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  spots.forEach(s => {
    const showFav = document.getElementById("layerFavorites").checked
      ? currentUser.favorites.some(f => f.name === s.name)
      : true;
    const showCrew = document.getElementById("layerCrews").checked
      ? currentUser.follows.crews.includes(s.crew)
      : true;
    const showCountry = document.getElementById("layerCountries").checked
      ? currentUser.follows.countries.includes(s.country)
      : true;
    const showCity = document.getElementById("layerCities").checked
      ? currentUser.follows.cities.includes(s.city)
      : true;

    if (showFav && showCrew && showCountry && showCity) {
      const marker = L.marker([s.lat, s.lng]).addTo(map);
      marker.bindTooltip(`<strong>${s.name}</strong>`);
      marker.on("click", () => highlightCard(s.name));
      marker.on("dblclick", () => openModal(s.name));
      markers.push(marker);
    }
  });
}

// ------------------------------
// Search + filter integration
// ------------------------------
function onSearch(e) {
  const q = e.target.value.toLowerCase().trim();
  const filtered = spots.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.city.toLowerCase().includes(q) ||
    s.crew.toLowerCase().includes(q)
  );
  renderSpots(filtered);
  if (q) {
    document.getElementById("filterSummary").textContent = `Search filter: "${q}"`;
    document.getElementById("filterSummary").style.display = "block";
    document.getElementById("resetFilterBtn").style.display = "inline-block";
  } else {
    document.getElementById("filterSummary").style.display = "none";
    document.getElementById("resetFilterBtn").style.display = "none";
  }
}

// ------------------------------
// Chart (bar/pie) + click-to-filter
// ------------------------------
let chartMode = "bar";
let chartSegments = [];

function setupChart() {
  const canvas = document.getElementById("statsChart");
  const ctx = canvas.getContext("2d");

  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    chartSegments = [];
    const counts = {
      Countries: currentUser.follows.countries.length,
      Cities: currentUser.follows.cities.length,
      Crews: currentUser.follows.crews.length
    };
    const keys = Object.keys(counts);
    const colors = { Countries: "#4caf50", Cities: "#2196f3", Crews: "#ff9800" };
    document.getElementById("chartLegend").innerHTML = keys.map(k =>
      `<span class="legend-item"><span class="legend-color" style="background:${colors[k]};"></span>${k} (${counts[k]})</span>`
    ).join(" ");

    if (chartMode === "bar") {
      const w = 100, gap = 40, baseY = 220, maxH = 160;
      const maxVal = Math.max(...keys.map(k => counts[k])) || 1;
      keys.forEach((k, idx) => {
        const h = Math.round((counts[k]/maxVal) * maxH);
        const x = 50 + idx*(w+gap), y = baseY - h;
        ctx.fillStyle = colors[k];
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#eee";
        ctx.fillText(k, x+20, baseY+16);
        chartSegments.push({ mode: "bar", label: k, x, y, w, h });
      });
    } else {
      const total = keys.reduce((a,k) => a+counts[k], 0) || 1;
      const cx = 250, cy = 130, r = 90;
      let start = 0;
      keys.forEach(k => {
        const angle = (counts[k]/total) * Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start+angle);
        ctx.closePath();
        ctx.fillStyle = colors[k];
        ctx.fill();
        chartSegments.push({
          mode: "pie", label: k, centerX: cx, centerY: cy,
          radius: r, startAngle: start, endAngle: start+angle
        });
        start += angle;
      });
    }
  }

  draw();

  document.getElementById("toggleChartBtn").addEventListener("click", () => {
    chartMode = chartMode === "bar" ? "pie" : "bar";
    draw();
  });

  canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let clicked = null;
    chartSegments.forEach(seg => {
      if (seg.mode === "bar") {
        if (x >= seg.x && x <= seg.x+seg.w && y >= seg.y && y <= seg.y+seg.h) clicked = seg;
      } else {
        const dx = x - seg.centerX, dy = y - seg.centerY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx); const a = angle < 0 ? angle + 2*Math.PI : angle;
        if (dist <= seg.radius && a >= seg.startAngle && a <= seg.endAngle) clicked = seg;
      }
    });
    if (clicked) filterByCategory(clicked.label);
  });
}

function filterByCategory(label) {
  let filtered = [];
  if (label === "Countries") {
    filtered = spots.filter(s => currentUser.follows.countries.includes(s.country));
    document.getElementById("searchBar").value = "Followed Countries";
  } else if (label === "Cities") {
    filtered = spots.filter(s => currentUser.follows.cities.includes(s.city));
    document.getElementById("searchBar").value = "Followed Cities";
  } else if (label === "Crews") {
    filtered = spots.filter(s => currentUser.follows.crews.includes(s.crew));
    document.getElementById("searchBar").value = "Followed Crews";
  }
  if (!filtered.length) alert(`No spots found for your followed ${label.toLowerCase()}.`);
  renderSpots(filtered);
  document.getElementById("filterSummary").textContent = `Showing spots from your followed ${label}`;
  document.getElementById("filterSummary").style.display = "block";
  document.getElementById("resetFilterBtn").style.display = "inline-block";
}

// ------------------------------
// Profile render
// ------------------------------
function renderProfile() {
  // Avatar
  const avatar = document.getElementById("profileAvatar");
  avatar.src = currentUser.avatar || "https://picsum.photos/seed/avatar/200/200";

  // Favorites
  const fav = document.getElementById("profileFavorites");
  fav.innerHTML = currentUser.favorites.length
    ? currentUser.favorites.map(f => `<li>${f.name}</li>`).join("")
    : "<li>None</li>";

  // Collections
  const col = document.getElementById("profileCollections");
  col.innerHTML = currentUser.collections.length
    ? currentUser.collections.map(c => `
      <div class="collection">
        <h4>${c.name}</h4>
        <div class="items">
          ${c.spots.map(n => `<span class="item">${n}</span>`).join("")}
        </div>
        <div class="actions">
          <button onclick="shareCollection('${c.name}')">Share collection</button>
          <button onclick="deleteCollection('${c.name}')">Delete</button>
        </div>
      </div>
    `).join("")
    : "<p class='muted'>No collections yet</p>";

  // Achievements
  const achievements = getAchievements(currentUser);
  document.getElementById("profileAchievements").innerHTML =
    achievements.length
      ? achievements.map(a => `<span class="achievement-badge ${badgeClass(a)}">${a}</span>`).join(" ")
      : "<span class='achievement-badge badge-none'>No achievements yet</span>";

  // Achievement progress
  const p = achievementProgress(currentUser);
  document.getElementById("achievementProgress").innerHTML = `
    <div class="progress-item">
      <span>World Explorer (Countries)</span>
      <div class="progress-bar"><div style="width:${p.countries}%"></div></div>
      <small>${currentUser.follows.countries.length}/5 countries</small>
    </div>
    <div class="progress-item">
      <span>City Hopper (Cities)</span>
      <div class="progress-bar"><div style="width:${p.cities}%"></div></div>
      <small>${currentUser.follows.cities.length}/10 cities</small>
    </div>
    <div class="progress-item">
      <span>Crew Collector (Crews)</span>
      <div class="progress-bar"><div style="width:${p.crews}%"></div></div>
      <small>${currentUser.follows.crews.length}/3 crews</small>
    </div>
    <div class="progress-item">
      <span>Super Fan (Favorites)</span>
      <div class="progress-bar"><div style="width:${p.favorites}%"></div></div>
      <small>${currentUser.favorites.length}/5 favorites</small>
    </div>
  `;

  // Activity
  const act = document.getElementById("profileActivity");
  act.innerHTML = currentUser.activities.length
    ? currentUser.activities.map(a => `<li>${a}</li>`).join("")
    : "<li>No recent activity</li>";
}

function badgeClass(label) {
  if (label.includes("World Explorer")) return "badge-explorer";
  if (label.includes("City Hopper")) return "badge-hopper";
  if (label.includes("Crew Collector")) return "badge-collector";
  if (label.includes("Super Fan")) return "badge-fan";
  return "";
}

// ------------------------------
// Achievements + progress
// ------------------------------
function getAchievements(user) {
  const ach = [];
  if (user.follows.countries.length >= 5) ach.push("🌍 World Explorer");
  if (user.follows.cities.length >= 10) ach.push("🏙️ City Hopper");
  if (user.follows.crews.length >= 3) ach.push("👥 Crew Collector");
  if (user.favorites.length >= 5) ach.push("⭐ Super Fan");
  return ach;
}

function achievementProgress(user) {
  return {
    countries: Math.min((user.follows.countries.length/5)*100, 100),
    cities: Math.min((user.follows.cities.length/10)*100, 100),
    crews: Math.min((user.follows.crews.length/3)*100, 100),
    favorites: Math.min((user.favorites.length/5)*100, 100)
  };
}

// ------------------------------
// Activity + notifications
// ------------------------------
function logActivity(action) {
  const timestamp = new Date().toLocaleString();
  currentUser.activities.unshift(`${timestamp}: ${action}`);
  if (currentUser.activities.length > 50) currentUser.activities.pop();
  saveUser();
  // Example notification prompt
  if (Notification && Notification.permission === "granted") {
    new Notification("Graffiti Explorer", { body: action });
  }
}

// ------------------------------
// Profile customization
// ------------------------------
function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  currentUser.avatar = url;
  logActivity("Updated avatar");
  saveUser();
  renderProfile();
}
function handleThemeChange(e) {
  const color = e.target.value;
  currentUser.themeColor = color;
  document.body.style.setProperty("--theme-color", color);
  logActivity("Changed theme color");
  saveUser();
}

// ------------------------------
// Collections
// ------------------------------
function createCollection() {
  const name = document.getElementById("newCollectionName").value.trim();
  if (!name) return alert("Enter a collection name.");
  if (currentUser.collections.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    return alert("Collection already exists.");
  }
  currentUser.collections.push({ name, spots: [] });
  logActivity(`Created collection: ${name}`);
  saveUser();
  renderProfile();
  document.getElementById("newCollectionName").value = "";
}

function addToCollectionPrompt(spotName) {
  const name = prompt("Add to which collection? Enter exact name:");
  if (!name) return;
  const col = currentUser.collections.find(c => c.name === name);
  if (!col) return alert("Collection not found.");
  if (!col.spots.includes(spotName)) {
    col.spots.push(spotName);
    logActivity(`Added ${spotName} to collection: ${name}`);
    saveUser();
    renderProfile();
  }
}

function shareCollection(name) {
  const col = currentUser.collections.find(c => c.name === name);
  if (!col) return;
  const text = `My collection "${name}": ${col.spots.join(", ")}`;
  navigator.clipboard.writeText(text);
  alert("Collection copied to clipboard!");
  logActivity(`Shared collection: ${name}`);
}

function deleteCollection(name) {
  currentUser.collections = currentUser.collections.filter(c => c.name !== name);
  logActivity(`Deleted collection: ${name}`);
  saveUser();
  renderProfile();
}

// ------------------------------
// Story mode
// ------------------------------
let currentSlide = 0;

function enterStory() {
  showView(document.getElementById("storyMode"));
  renderSlide();
}

function renderSlide() {
  const s = spots[currentSlide];
  const el = document.getElementById("storySlides");
  el.innerHTML = `
    <h3>${s.name}</h3>
    <p class="muted">${s.city}, ${s.country} • ${s.crew}</p>
    <img src="${s.image}" alt="${s.name}" style="width:100%;max-height:320px;object-fit:cover;border-radius:8px;" />
    <p>${s.about}</p>
  `;
  map.setView([s.lat, s.lng], 13);
}

function prevSlide() {
  currentSlide = (currentSlide - 1 + spots.length) % spots.length;
  renderSlide();
}

function nextSlide() {
  currentSlide = (currentSlide + 1) % spots.length;
  renderSlide();
}

function exitStory() {
  showView(document.getElementById("dashboard"));
}

// Tab button triggers story mode
document.getElementById("tabStory")?.addEventListener("click", enterStory);

// ------------------------------
// Global stats dashboard
// ------------------------------
function renderGlobalStats() {
  const mostFavorited = (() => {
    const counts = {};
    currentUser.favorites.forEach(f => { counts[f.name] = (counts[f.name]||0)+1; });
    let maxKey = null, maxVal = 0;
    Object.keys(counts).forEach(k => { if (counts[k] > maxVal) { maxVal = counts[k]; maxKey = k; }});
    return maxKey ? `${maxKey} (${maxVal})` : "—";
  })();

  const cityCounts = {};
  spots.forEach(s => { cityCounts[s.city] = (cityCounts[s.city]||0)+1; });
  const topCity = Object.entries(cityCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";

  const crewCounts = {};
  spots.forEach(s => { crewCounts[s.crew] = (crewCounts[s.crew]||0)+1; });
  const topCrew = Object.entries(crewCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";

  document.getElementById("globalStats").innerHTML = `
    <p><strong>Most favorited spot:</strong> ${mostFavorited}</p>
    <p><strong>Most represented city:</strong> ${topCity}</p>
    <p><strong>Most represented crew:</strong> ${topCrew}</p>
    <p class="muted">Global stats compute from current dataset.</p>
  `;
}

// ------------------------------
// Challenges
// ------------------------------
const challengeSet = [
  { id: "c1", label: "Follow 2 new cities", target: 2, type: "cities" },
  { id: "c2", label: "Favorite 3 spots", target: 3, type: "favorites" },
  { id: "c3", label: "Write 2 reviews", target: 2, type: "reviews" }
];

function renderChallenges() {
  const html = challengeSet.map(c => {
    const progress = challengeProgress(c);
    const pct = Math.min((progress / c.target) * 100, 100);
    return `
      <div class="challenge">
        <strong>${c.label}</strong>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <small>${progress}/${c.target}</small>
      </div>
    `;
  }).join("");
  document.getElementById("challenges").innerHTML = html;
}

function challengeProgress(c) {
  if (c.type === "cities") return currentUser.follows.cities.length;
  if (c.type === "favorites") return currentUser.favorites.length;
  if (c.type === "reviews") return spots.reduce((a, s) => a + s.reviews.length, 0);
  return 0;
}

// ------------------------------
// Leaderboard + monthly reset + hall of fame (demo users)
// ------------------------------
function demoUsers() {
  // demo community
  const u = [
    { name: "Sidy", follows: currentUser.follows, favorites: currentUser.favorites, reviews: spots.flatMap(s => s.reviews.filter(r => r.text.includes("great"))), achievements: getAchievements(currentUser) },
    { name: "Awa",  follows: { countries:["France","Germany"], cities:["Paris","Berlin","Lyon"], crews:["Crew B"] }, favorites:[{name:"Paris Metro"}], reviews:[{},{},{}], achievements:["🌍 World Explorer"] },
    { name: "Kofi", follows: { countries:["UK"], cities:["London"], crews:["Crew C"] }, favorites:[{name:"Shoreditch"},{name:"Berlin Wall"}], reviews:[{}], achievements:["⭐ Super Fan"] }
  ];
  return u.map(u => ({ ...u, score: calculateScore(u) }));
}

function calculateScore(user) {
  let score = 0;
  score += (user.follows?.countries?.length || 0) * 2;
  score += (user.follows?.cities?.length || 0);
  score += (user.favorites?.length || 0) * 3;
  score += (user.reviews?.length || 0) * 2;
  score += (user.achievements?.length || 0) * 5;
  return score;
}

let leaderboardMonth = new Date().getMonth();

function renderLeaderboard(users) {
  checkLeaderboardReset(users);
  const sorted = users.sort((a,b)=> calculateScore(b) - calculateScore(a));
  document.getElementById("leaderboard").innerHTML = sorted.map((u,i) => `
    <div class="leaderboard-item">
      <span class="rank">#${i+1}</span>
      <span class="name">${u.name}</span>
      <span class="score">${calculateScore(u)} pts</span>
    </div>
  `).join("");
}

function checkLeaderboardReset(users) {
  const currentMonth = new Date().getMonth();
  if (currentMonth !== leaderboardMonth) {
    const winners = users.sort((a,b)=> calculateScore(b)-calculateScore(a)).slice(0,3);
    winners.forEach((u,i) => {
      const badge = i===0 ? "🥇 Gold Explorer" : i===1 ? "🥈 Silver Explorer" : "🥉 Bronze Explorer";
      u.achievements = [...(u.achievements||[]), badge];
      logActivity(`${u.name} earned ${badge} for last month!`);
    });
    users.forEach(u => u.score = 0);
    leaderboardMonth = currentMonth;
  }
}

function renderHallOfFame(users) {
  const hof = users.filter(u => (u.achievements||[]).some(a => a.includes("Explorer")));
  document.getElementById("hallOfFame").innerHTML = hof.length
    ? hof.map(u => `
      <div class="hof-item">
        <span class="name">${u.name}</span>
        <span class="badges">${u.achievements.filter(a => a.includes("Explorer")).join(", ")}</span>
      </div>
    `).join("")
    : "<p class='muted'>No winners yet</p>";
}

// ------------------------------
// Crew profiles (mini)
// ------------------------------
function openCrewProfile(crewName) {
  const crewSpots = spots.filter(s => s.crew === crewName);
  alert(`Crew: ${crewName}\nSpots: ${crewSpots.map(s=>s.name).join(", ") || "None"}`);
}

// ------------------------------
// Persistence
// ------------------------------
function saveUser() {
  localStorage.setItem("gx_user", JSON.stringify(currentUser));
}

// ------------------------------
// Notification permission
// ------------------------------
if (window.Notification && Notification.permission !== "granted" && Notification.permission !== "denied") {
  Notification.requestPermission();
}