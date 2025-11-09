/* App state and initialization */
let map;
let markers = [];
let currentView = "dashboard";
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let collections = JSON.parse(localStorage.getItem("collections") || "{}"); // { name: [spotId, ...] }
let activityFeed = JSON.parse(localStorage.getItem("activityFeed") || "[]");
let achievements = JSON.parse(localStorage.getItem("achievements") || "[]");
let themeColor = localStorage.getItem("themeColor") || "#ff9f1c";

/* DOM ready: init map, render cards, bind events */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initMap();
  renderSpots(spots);
  bindDashboardEvents();
  bindProfileEvents();
  bindStoryModeEvents();
  renderLeaderboard();
  renderHallOfFame();
  renderGlobalStats();
  renderChallenges();
});

/* Theme handling */
function initTheme() {
  const picker = document.getElementById("themeColorPicker");
  if (picker) {
    picker.value = themeColor;
    picker.addEventListener("input", (e) => {
      themeColor = e.target.value;
      document.documentElement.style.setProperty("--accent", themeColor);
      localStorage.setItem("themeColor", themeColor);
      logActivity(`Changed theme color to ${themeColor}`);
    });
  }
  // Apply default accent variable
  document.documentElement.style.setProperty("--accent", themeColor);
}

/* Map initialization using Leaflet */
function initMap() {
  map = L.map("map").setView([50, 10], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

/* Render list of spots into cards and markers */
function renderSpots(list) {
  const container = document.getElementById("cards");
  container.innerHTML = "";

  // Clear old markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  list.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "card";
    const isFav = favorites.includes(s.id);
    card.innerHTML = `
      <img src="${s.image}" alt="${s.name}" />
      <h3>${s.name}</h3>
      <p>${s.city}, ${s.country} • ${s.type}</p>
      <p>${s.about}</p>
      <div class="card-actions">
        <button onclick="zoomToSpot(${i})">Zoom</button>
        <button onclick="shareSpot(${i})">Share</button>
        <button onclick="toggleFavorite('${s.id}')">${isFav ? "Unfavorite" : "Favorite"}</button>
        <button onclick="addToCollectionPrompt('${s.id}')">Add to collection</button>
      </div>
    `;
    container.appendChild(card);

    const marker = L.marker([s.lat, s.lng]).addTo(map);
    marker.bindPopup(`<strong>${s.name}</strong><br>${s.city}, ${s.country}`);
    markers.push(marker);
  });

  // Update profile favorites list if profile view already initialized
  renderProfileFavorites();
}

/* Zoom map to a spot */
function zoomToSpot(i) {
  map.setView([spots[i].lat, spots[i].lng], 13);
}

/* Share spot (Web Share API -> social links popup fallback) */
function shareSpot(i) {
  const s = spots[i];
  const text = `Check this out on BreakAtlas: ${s.name} — ${s.city}, ${s.country} (${s.type}).`;
  const url = location.href;

  // Web Share API for supported browsers/devices
  if (navigator.share) {
    navigator.share({ title: "BreakAtlas", text, url }).catch(() => {});
    return;
  }

  // Fallback popup with social links
  const popup = document.getElementById("sharePopup");
  popup.innerHTML = `
    <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Twitter</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">Facebook</a>
    <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(text)}%20${encodeURIComponent(url)}" target="_blank" rel="noopener">WhatsApp</a>
    <a href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}" target="_blank" rel="noopener">Telegram</a>
    <button onclick="closeSharePopup()" class="btn btn-secondary">Close</button>
  `;
  popup.style.display = "flex";
}

/* Close share popup */
function closeSharePopup() {
  document.getElementById("sharePopup").style.display = "none";
}

/* Favorites handling */
function toggleFavorite(spotId) {
  const idx = favorites.indexOf(spotId);
  if (idx >= 0) {
    favorites.splice(idx, 1);
    logActivity(`Removed favorite: ${spotId}`);
  } else {
    favorites.push(spotId);
    logActivity(`Added favorite: ${spotId}`);
  }
  localStorage.setItem("favorites", JSON.stringify(favorites));
  renderSpots(spots); // refresh cards to reflect favorite button text
}

/* Collections handling */
function addToCollectionPrompt(spotId) {
  const name = prompt("Add to which collection? Enter a name:");
  if (!name) return;
  if (!collections[name]) collections[name] = [];
  if (!collections[name].includes(spotId)) collections[name].push(spotId);
  localStorage.setItem("collections", JSON.stringify(collections));
  logActivity(`Added ${spotId} to collection "${name}"`);
  renderCollections();
}

/* Activity feed logging */
function logActivity(text) {
  const entry = { text, time: new Date().toISOString() };
  activityFeed.unshift(entry);
  activityFeed = activityFeed.slice(0, 100); // cap
  localStorage.setItem("activityFeed", JSON.stringify(activityFeed));
  renderActivityFeed();
}

/* View switching */
function showView(viewId) {
  currentView = viewId;
  document.querySelectorAll(".view").forEach(v => v.style.display = "none");
  const el = document.getElementById(viewId);
  if (el) el.style.display = "block";

  // Refresh relevant sections when switching views
  if (viewId === "profile") {
    renderProfileFavorites();
    renderCollections();
    renderAchievements();
    renderActivityFeed();
    renderGlobalStats();
    renderChallenges();
  } else if (viewId === "leaderboardView") {
    renderLeaderboard();
    renderHallOfFame();
  } else if (viewId === "dashboard") {
    renderSpots(spots);
    renderStatsChart();
  } else if (viewId === "storyMode") {
    initStorySlides();
  }
}

/* Navbar menu toggle (mobile) */
function toggleMenu() {
  const nav = document.getElementById("navLinks");
  nav.classList.toggle("show");
}

/* Dashboard events: search, reset, chart toggle */
function bindDashboardEvents() {
  const search = document.getElementById("searchBar");
  const resetBtn = document.getElementById("resetFilterBtn");
  const summary = document.getElementById("filterSummary");
  const toggleChartBtn = document.getElementById("toggleChartBtn");

  let usePie = false;

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    if (!q) {
      renderSpots(spots);
      resetBtn.style.display = "none";
      summary.style.display = "none";
      summary.textContent = "";
      return;
    }
    const filtered = spots.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.crew.toLowerCase().includes(q)
    );
    renderSpots(filtered);
    resetBtn.style.display = "inline-block";
    summary.style.display = "block";
    summary.textContent = `Filtered: ${filtered.length} of ${spots.length} for "${q}"`;
  });

  resetBtn.addEventListener("click", () => {
    search.value = "";
    renderSpots(spots);
    resetBtn.style.display = "none";
    summary.style.display = "none";
    summary.textContent = "";
  });

  toggleChartBtn.addEventListener("click", () => {
    usePie = !usePie;
    toggleChartBtn.textContent = usePie ? "Switch to Bar Chart" : "Switch to Pie Chart";
    renderStatsChart(usePie);
  });

  // Initial chart render
  renderStatsChart(usePie);
}

/* Profile events: avatar upload, create collection */
function bindProfileEvents() {
  const avatarUpload = document.getElementById("avatarUpload");
  const createCollectionBtn = document.getElementById("createCollectionBtn");

  if (avatarUpload) {
    avatarUpload.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = document.getElementById("profileAvatar");
        img.src = ev.target.result;
        localStorage.setItem("profileAvatar", ev.target.result);
        logActivity("Updated profile avatar");
      };
      reader.readAsDataURL(file);
    });

    // Load avatar from storage if exists
    const saved = localStorage.getItem("profileAvatar");
    if (saved) {
      const img = document.getElementById("profileAvatar");
      img.src = saved;
    }
  }

  if (createCollectionBtn) {
    createCollectionBtn.addEventListener("click", () => {
      const name = document.getElementById("newCollectionName").value.trim();
      if (!name) return;
      if (!collections[name]) collections[name] = [];
      localStorage.setItem("collections", JSON.stringify(collections));
      logActivity(`Created collection "${name}"`);
      renderCollections();
      document.getElementById("newCollectionName").value = "";
    });
  }
}

/* Story mode: simple slides engine */
let storyIndex = 0;
const storySlidesData = [
  { title: "Welcome to BreakAtlas", text: "Explore jams, cyphers, and training spots across Europe." },
  { title: "Favorites & Collections", text: "Save your favorite spots and curate custom collections." },
  { title: "Community", text: "See the leaderboard and the hall of fame of iconic events and crews." }
];

function bindStoryModeEvents() {
  const prev = document.getElementById("prevSlide");
  const next = document.getElementById("nextSlide");
  const exit = document.getElementById("exitStory");

  if (prev && next && exit) {
    prev.addEventListener("click", () => changeSlide(-1));
    next.addEventListener("click", () => changeSlide(1));
    exit.addEventListener("click", () => showView("dashboard"));
  }
}

function initStorySlides() {
  storyIndex = 0;
  renderStorySlide();
}

function changeSlide(delta) {
  storyIndex = (storyIndex + delta + storySlidesData.length) % storySlidesData.length;
  renderStorySlide();
}

function renderStorySlide() {
  const container = document.getElementById("storySlides");
  const slide = storySlidesData[storyIndex];
  container.innerHTML = `
    <div class="stat-card">
      <h3>${slide.title}</h3>
      <p>${slide.text}</p>
    </div>
  `;
}

/* Leaderboard and Hall of Fame (mock data derived from spots and favorites) */
function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  if (!el) return;
  el.innerHTML = "";

  // Example leaderboard: count favorites by country
  const counts = {};
  favorites.forEach(id => {
    const s = spots.find(sp => sp.id === id);
    if (!s) return;
    counts[s.country] = (counts[s.country] || 0) + 1;
  });

  const entries = Object.keys(counts).map(country => ({ country, score: counts[country] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (entries.length === 0) {
    el.innerHTML = `<div class="leader-card"><p>No leaderboard data yet — add favorites to see rankings.</p></div>`;
    return;
  }

  entries.forEach(e => {
    const card = document.createElement("div");
    card.className = "leader-card";
    card.innerHTML = `<h4>${e.country}</h4><p>Favorites: ${e.score}</p>`;
    el.appendChild(card);
  });
}

function renderHallOfFame() {
  const el = document.getElementById("hallOfFame");
  if (!el) return;
  el.innerHTML = "";

  // Simple hall of fame: top jams by average review rating
  const jamSpots = spots.filter(s => s.type.toLowerCase().includes("jam"));
  const withAvg = jamSpots.map(s => {
    const avg = (s.reviews || []).reduce((sum, r) => sum + (r.rating || 0), 0) / Math.max(1, (s.reviews || []).length);
    return { ...s, avg };
  }).sort((a, b) => b.avg - a.avg).slice(0, 6);

  withAvg.forEach(s => {
    const card = document.createElement("div");
    card.className = "fame-card";
    card.innerHTML = `<h4>${s.name}</h4><p>${s.city}, ${s.country}</p><p>Avg rating: ${s.avg.toFixed(1)}</p>`;
    el.appendChild(card);
  });
}

/* Global stats summary */
function renderGlobalStats() {
  const el = document.getElementById("globalStats");
  if (!el) return;
  el.innerHTML = "";

  const total = spots.length;
  const jams = spots.filter(s => s.type.toLowerCase().includes("jam")).length;
  const cyphers = spots.filter(s => s.type.toLowerCase().includes("cypher")).length;
  const trainings = spots.filter(s => s.type.toLowerCase().includes("training")).length;

  const cards = [
    { title: "Total spots", value: total },
    { title: "Jams", value: jams },
    { title: "Cyphers", value: cyphers },
    { title: "Training spots", value: trainings },
  ];

  cards.forEach(c => {
    const div = document.createElement("div");
    div.className = "stat-card";
    div.innerHTML = `<h4>${c.title}</h4><p>${c.value}</p>`;
    el.appendChild(div);
  });
}

/* Challenges (static examples) */
function renderChallenges() {
  const el = document.getElementById("challenges");
  if (!el) return;
  el.innerHTML = "";

  const list = [
    { title: "Visit 3 jams this month", progress: `${countType("Jam")}/3` },
    { title: "Add 5 favorites", progress: `${favorites.length}/5` },
    { title: "Create 2 collections", progress: `${Object.keys(collections).length}/2` },
  ];

  list.forEach(ch => {
    const div = document.createElement("div");
    div.className = "challenge-card";
    div.innerHTML = `<h4>${ch.title}</h4><p>Progress: ${ch.progress}</p>`;
    el.appendChild(div);
  });
}

function countType(t) {
  return spots.filter(s => s.type.toLowerCase().includes(t.toLowerCase())).length;
}

/* Achievements (simple thresholds) */
function renderAchievements() {
  const el = document.getElementById("profileAchievements");
  const progressEl = document.getElementById("achievementProgress");
  if (!el || !progressEl) return;
  el.innerHTML = "";
  progressEl.innerHTML = "";

  const defs = [
    { id: "fav_3", title: "Collector I", desc: "Add 3 favorites", check: () => favorites.length >= 3 },
    { id: "col_2", title: "Curator I", desc: "Create 2 collections", check: () => Object.keys(collections).length >= 2 },
    { id: "jam_3", title: "Cypher Hunter", desc: "Explore 3 jams", check: () => countType("Jam") >= 3 },
  ];

  defs.forEach(d => {
    const achieved = d.check();
    const card = document.createElement("div");
    card.className = "achievement-card";
    card.innerHTML = `<h4>${d.title}</h4><p>${d.desc}</p><p>Status: ${achieved ? "Unlocked" : "Locked"}</p>`;
    el.appendChild(card);
    if (achieved && !achievements.includes(d.id)) {
      achievements.push(d.id);
      localStorage.setItem("achievements", JSON.stringify(achievements));
      logActivity(`Unlocked achievement: ${d.title}`);
    }
  });

  // Summary
  progressEl.innerHTML = `<p>Achievements unlocked: ${achievements.length}/${defs.length}</p>`;
}

/* Collections display */
function renderCollections() {
  const el = document.getElementById("profileCollections");
  if (!el) return;
  el.innerHTML = "";

  Object.keys(collections).forEach(name => {
    const items = collections[name].map(id => spots.find(s => s.id === id)).filter(Boolean);
    const div = document.createElement("div");
    div.className = "collection-card";
    div.innerHTML = `
      <h4>${name}</h4>
      <p>${items.length} spots</p>
      <button onclick="renameCollection('${name}')">Rename</button>
      <button onclick="deleteCollection('${name}')">Delete</button>
    `;
    el.appendChild(div);
  });
}

function renameCollection(name) {
  const newName = prompt(`Rename collection "${name}" to:`);
  if (!newName || newName === name) return;
  if (collections[newName]) {
    alert("A collection with that name already exists.");
    return;
  }
  collections[newName] = collections[name];
  delete collections[name];
  localStorage.setItem("collections", JSON.stringify(collections));
  logActivity(`Renamed collection "${name}" to "${newName}"`);
  renderCollections();
}

function deleteCollection(name) {
  if (!confirm(`Delete collection "${name}"?`)) return;
  delete collections[name];
  localStorage.setItem("collections", JSON.stringify(collections));
  logActivity(`Deleted collection "${name}"`);
  renderCollections();
}

/* Profile favorites list */
function renderProfileFavorites() {
  const el = document.getElementById("profileFavorites");
  if (!el) return;
  el.innerHTML = "";
  favorites.forEach(id => {
    const s = spots.find(sp => sp.id === id);
    if (!s) return;
    const li = document.createElement("li");
    li.textContent = `${s.name} — ${s.city}, ${s.country}`;
    el.appendChild(li);
  });
}

/* Activity feed list */
function renderActivityFeed() {
  const el = document.getElementById("profileActivity");
  if (!el) return;
  el.innerHTML = "";
  activityFeed.slice(0, 20).forEach(a => {
    const li = document.createElement("li");
    const d = new Date(a.time);
    li.textContent = `[${d.toLocaleString()}] ${a.text}`;
    el.appendChild(li);
  });
}

/* Simple login (demo only) */
function login() {
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value.trim();
  if (u && p) {
    logActivity(`User "${u}" logged in`);
    alert("Logged in (demo)");
    showView("dashboard");
  } else {
    alert("Enter username and password");
  }
}

/* Stats chart rendering (basic custom canvas) */
function renderStatsChart(usePie = false) {
  const canvas = document.getElementById("statsChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const data = [
    { label: "Jams", value: countType("Jam"), color: "#ff9f1c" },
    { label: "Cyphers", value: countType("Cypher"), color: "#2ec4b6" },
    { label: "Training", value: countType("Training"), color: "#e71d36" },
  ];
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

  if (!usePie) {
    // Bar chart
    const barWidth = 120;
    const gap = 40;
    let x = 40;
    const maxVal = Math.max(...data.map(d => d.value)) || 1;
    const scale = 180 / maxVal;
    data.forEach(d => {
      const h = d.value * scale;
      ctx.fillStyle = d.color;
      ctx.fillRect(x, 220 - h, barWidth, h);
      ctx.fillStyle = "#e9eef5";
      ctx.fillText(`${d.label} (${d.value})`, x + 10, 240);
      x += barWidth + gap;
    });
  } else {
    // Pie chart
    let start = 0;
    const cx = 180, cy = 140, r = 100;
    data.forEach(d => {
      const angle = (d.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      start += angle;
    });
    // Labels
    ctx.fillStyle = "#e9eef5";
    let ly = 30;
    data.forEach(d => {
      ctx.fillStyle = d.color;
      ctx.fillRect(320, ly - 10, 12, 12);
      ctx.fillStyle = "#e9eef5";
      ctx.fillText(`${d.label} (${d.value})`, 340, ly);
      ly += 20;
    });
  }

  // Legend HTML
  const legend = document.getElementById("chartLegend");
  if (legend) {
    legend.innerHTML = data.map(d => `<span style="color:${d.color}">${d.label}</span>: ${d.value}`).join(" • ");
  }
}