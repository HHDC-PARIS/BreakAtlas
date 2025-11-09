// BreakAtlas — full features with modern UI
let map;
let markers = [];
let currentChartType = "bar";
let favorites = JSON.parse(localStorage.getItem("ba_favorites") || "[]");
let collections = JSON.parse(localStorage.getItem("ba_collections") || "[]");
let activity = JSON.parse(localStorage.getItem("ba_activity") || "[]");
let achievements = JSON.parse(localStorage.getItem("ba_achievements") || "[]");
let leaderboardData = JSON.parse(localStorage.getItem("ba_leaderboard") || "[]");
let hallOfFame = JSON.parse(localStorage.getItem("ba_hof") || "[]");
let user = JSON.parse(localStorage.getItem("ba_user") || "null");

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  renderSpots(spots);
  initSearch();
  initProfile();
  initCollections();
  initStats();
  initChallenges();
  initLeaderboard();
  initStoryMode();
  initTheme();
  requestNotificationPermission();
  showView("dashboard");
});

// Map
function initMap() {
  map = L.map("map").setView([50, 10], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
}
function addMarker(s, index) {
  const marker = L.marker([s.lat, s.lng]).addTo(map);
  marker.bindPopup(`<strong>${s.name}</strong><br>${s.city}, ${s.country}<br>${s.type}`);
  marker.on("click", () => highlightCard(index));
  markers.push(marker);
}
function clearMarkers() { markers.forEach(m => map.removeLayer(m)); markers = []; }

// UI Navigation
function toggleMenu() { document.getElementById("navLinks").classList.toggle("show"); }
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.style.display = "none");
  document.getElementById(id).style.display = "block";
}

// Cards / Spots
function renderSpots(list) {
  const container = document.getElementById("cards");
  container.innerHTML = "";
  clearMarkers();

  list.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "card";
    const avgRating = averageRating(s.reviews);
    card.innerHTML = `
      <img src="${s.image}" alt="${s.name}" />
      <h3>${s.name}</h3>
      <p>${s.city}, ${s.country} • ${s.type} • Crew: ${s.crew}</p>
      <p>${s.about}</p>
      <p class="muted">Rating: ${avgRating.toFixed(1)} ★</p>
      <div class="card-actions">
        <button class="btn" onclick="zoomToSpot(${i})">Zoom</button>
        <button class="btn" onclick="toggleFavorite('${s.id}')">⭐ Favorite</button>
        <button class="btn btn-secondary" onclick="shareSpot(${i})">Share</button>
        <button class="btn btn-secondary" onclick="addReview(${i})">Review</button>
        <button class="btn btn-secondary" onclick="addToCollectionPrompt(${i})">Add to collection</button>
      </div>
    `;
    container.appendChild(card);
    addMarker(s, i);
  });

  updateFilterSummary(list);
}
function highlightCard(index) {
  const cards = document.querySelectorAll("#cards .card");
  cards.forEach(c => c.style.outline = "none");
  const card = cards[index];
  if (card) card.style.outline = "2px solid var(--accent-2)";
}
function zoomToSpot(i) { map.setView([spots[i].lat, spots[i].lng], 13); }
function averageRating(reviews = []) {
  if (!reviews.length) return 0;
  return reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length;
}

// Search / Filter
function initSearch() {
  const input = document.getElementById("searchBar");
  const resetBtn = document.getElementById("resetFilterBtn");
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    const filtered = spots.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q) ||
      s.crew.toLowerCase().includes(q) ||
      (s.type || "").toLowerCase().includes(q)
    );
    renderSpots(filtered);
    resetBtn.style.display = q ? "inline-block" : "none";
  });
  resetBtn.addEventListener("click", () => {
    input.value = "";
    renderSpots(spots);
    resetBtn.style.display = "none";
  });
}
function updateFilterSummary(list) {
  const sum = document.getElementById("filterSummary");
  sum.style.display = "block";
  sum.textContent = `${list.length} result(s)`;
}

// Favorites
function toggleFavorite(id) {
  const exists = favorites.includes(id);
  favorites = exists ? favorites.filter(x => x !== id) : [...favorites, id];
  localStorage.setItem("ba_favorites", JSON.stringify(favorites));
  logActivity(`${exists ? "Removed" : "Added"} favorite: ${getSpotById(id).name}`);
  notify(`${exists ? "Removed from" : "Added to"} favorites`);
  renderProfileFavorites();
}
function getSpotById(id) { return spots.find(s => s.id === id); }
function renderProfileFavorites() {
  const ul = document.getElementById("profileFavorites");
  ul.innerHTML = "";
  favorites.map(getSpotById).filter(Boolean).forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name} • ${s.city}, ${s.country}`;
    ul.appendChild(li);
  });
  recalcAchievements();
  recalcGlobalStats();
}

// Share (multi-platform)
function shareSpot(i) {
  const s = spots[i];
  const text = `Check this out on BreakAtlas: ${s.name} — ${s.city}, ${s.country} (${s.type}).`;
  const url = encodeURIComponent(location.href);
  const msg = encodeURIComponent(text);

  if (navigator.share) {
    navigator.share({ title: "BreakAtlas", text, url: location.href }).catch(() => {});
    return;
  }

  const links = {
    twitter: `https://twitter.com/intent/tweet?text=${msg}&url=${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    whatsapp: `https://api.whatsapp.com/send?text=${msg}%20${url}`,
    telegram: `https://t.me/share/url?url=${url}&text=${msg}`
  };

  for (const key in links) {
    window.open(links[key], "_blank");
  }

  notify("Shared on social platforms");
  logActivity(`Shared ${s.name} on social platforms`);
}

// Reviews
function addReview(i) {
  const s = spots[i];
  const rating = parseInt(prompt("Rate 1–5:"), 10);
  const text = prompt("Your review:");
  if (!rating || rating < 1 || rating > 5) return;
  s.reviews = s.reviews || [];
  s.reviews.push({ rating, text });
  logActivity(`Reviewed ${s.name} (${rating}★)`);
  notify("Thanks for your review");
  renderSpots(spots);
}

// Collections
function initCollections() {
  document.getElementById("createCollectionBtn").addEventListener("click", createCollection);
  renderCollections();
}
function createCollection() {
  const name = document.getElementById("newCollectionName").value.trim();
  if (!name) return;
  const id = `col_${Date.now()}`;
  collections.push({ id, name, items: [] });
  localStorage.setItem("ba_collections", JSON.stringify(collections));
  logActivity(`Created collection: ${name}`);
  document.getElementById("newCollectionName").value = "";
  renderCollections();
}
function renderCollections() {
  const wrap = document.getElementById("profileCollections");
  wrap.innerHTML = "";
  collections.forEach(c => {
    const div = document.createElement("div");
    div.className = "collection";
    div.innerHTML = `
      <h4>${c.name}</h4>
      <div>${c.items.map(id => getSpotById(id)?.name).filter(Boolean).join(", ") || "<span class='muted'>Empty</span>"}</div>
      <div class="collection-actions">
        <button class="btn btn-secondary" onclick="shareCollection('${c.id}')">Share</button>
        <button class="btn btn-secondary" onclick="deleteCollection('${c.id}')">Delete</button>
      </div>
    `;
    wrap.appendChild(div);
  });
}
function addToCollectionPrompt(i) {
  const s = spots[i];
  const names = collections.map(c => c.name).join(", ");
  const name = prompt(`Add "${s.name}" to which collection?\nExisting: ${names}\nOr type a new name:`);
  if (!name) return;
  let col = collections.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!col) {
    col = { id: `col_${Date.now()}`, name, items: [] };
    collections.push(col);
  }
  if (!col.items.includes(s.id)) col.items.push(s.id);
  localStorage.setItem("ba_collections", JSON.stringify(collections));
  logActivity(`Added ${s.name} to collection "${col.name}"`);
  renderCollections();
}
function shareCollection(id) {
  const c = collections.find(x => x.id === id);
  if (!c) return;
  const text = `BreakAtlas collection "${c.name}": ${c.items.map(getSpotById).filter(Boolean).map(s => s.name).join(", ")}`;
  navigator.clipboard.writeText(text);
  notify("Collection copied");
}
function deleteCollection(id) {
  collections = collections.filter(c => c.id !== id);
  localStorage.setItem("ba_collections", JSON.stringify(collections));
  logActivity("Deleted a collection");
  renderCollections();
}

// Achievements
function recalcAchievements() {
  achievements = [];
  const favCount = favorites.length;
  if (favCount >= 1) achievements.push("First favorite");
  if (favCount >= 3) achievements.push("Collector");
  if (favCount >= 5) achievements.push("Super fan");
  localStorage.setItem("ba_achievements", JSON.stringify(achievements));
  renderAchievements();
  renderAchievementProgress();
}
function renderAchievements() {
  const wrap = document.getElementById("profileAchievements");
  wrap.innerHTML = "";
  achievements.forEach(a => {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = a;
    wrap.appendChild(b);
  });
}
function renderAchievementProgress() {
  const progress = document.getElementById("achievementProgress");
  progress.innerHTML = "";
  const steps = [1,3,5];
  steps.forEach(step => {
    const pct = Math.min(100, Math.round((favorites.length / step) * 100));
    const wrap = document.createElement("div");
    wrap.className = "progress-bar-wrap";
    const bar = document.createElement("div");
    bar.className = "progress-bar";
    bar.style.width = pct + "%";
    wrap.appendChild(bar);
    progress.appendChild(wrap);
  });
}

// Activity
function logActivity(msg) {
  const e = { t: new Date().toISOString(), msg };
  activity.unshift(e);
  activity = activity.slice(0, 100);
  localStorage.setItem("ba_activity", JSON.stringify(activity));
  renderActivity();
}
function renderActivity() {
  const ul = document.getElementById("profileActivity");
  ul.innerHTML = "";
  activity.forEach(a => {
    const li = document.createElement("li");
    const date = new Date(a.t).toLocaleString();
    li.textContent = `${date} — ${a.msg}`;
    ul.appendChild(li);
  });
}

// Global Stats
function recalcGlobalStats() {
  const byCity = {};
  const favSpots = favorites.map(getSpotById).filter(Boolean);
  favSpots.forEach(s => { byCity[s.city] = (byCity[s.city] || 0) + 1; });
  const topCity = Object.entries(byCity).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";

  const gs = document.getElementById("globalStats");
  gs.innerHTML = "";
  const tiles = [
    { k: "Total spots", v: String(spots.length) },
    { k: "Favorites", v: String(favorites.length) },
    { k: "Top city", v: topCity }
  ];
  tiles.forEach(t => {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `<strong>${t.k}</strong><div class="muted">${t.v}</div>`;
    gs.appendChild(panel);
  });
}

// Challenges
function initChallenges() { renderChallenges(); }
function renderChallenges() {
  const wrap = document.getElementById("challenges");
  wrap.innerHTML = "";
  const tasks = [
    { id: "c1", label: "Favorite 3 spots", goal: 3, progress: favorites.length },
    { id: "c2", label: "Write 2 reviews", goal: 2, progress: countReviews() },
    { id: "c3", label: "Create 1 collection", goal: 1, progress: collections.length }
  ];
  tasks.forEach(t => {
    const pct = Math.min(100, Math.round((t.progress / t.goal) * 100));
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `<strong>${t.label}</strong>
      <div class="muted">${t.progress}/${t.goal}</div>
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>`;
    wrap.appendChild(panel);
  });
}
function countReviews() {
  return spots.reduce((a, s) => a + (s.reviews ? s.reviews.length : 0), 0);
}

// Leaderboard / Hall of Fame (monthly reset)
function initLeaderboard() {
  if (!leaderboardData.length) {
    leaderboardData = [
      { name: "B-Boy Nova", score: 120 },
      { name: "B-Girl Aya", score: 100 },
      { name: "Crew Flux", score: 90 }
    ];
    localStorage.setItem("ba_leaderboard", JSON.stringify(leaderboardData));
  }
  renderLeaderboard();
  renderHallOfFame();
  scheduleMonthlyReset();
}
function renderLeaderboard() {
  const wrap = document.getElementById("leaderboard");
  wrap.innerHTML = "";
  leaderboardData.sort((a,b)=>b.score-a.score).forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "leader";
    row.innerHTML = `<span>${idx+1}. ${p.name}</span><strong>${p.score}</strong>`;
    wrap.appendChild(row);
  });
}
function renderHallOfFame() {
  const wrap = document.getElementById("hallOfFame");
  wrap.innerHTML = "";
  hallOfFame.forEach(entry => {
    const card = document.createElement("div");
    card.className = "hof-card";
    card.innerHTML = `<strong>${entry.month}</strong><div class="muted">${entry.winners.join(", ")}</div>`;
    wrap.appendChild(card);
  });
}
function scheduleMonthlyReset() {
  const lastReset = localStorage.getItem("ba_last_reset");
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;
  if (lastReset !== monthKey) {
    const winners = leaderboardData
      .sort((a,b)=>b.score-a.score)
      .slice(0,3)
      .map(p => p.name);
    hallOfFame.push({ month: monthKey, winners });
    localStorage.setItem("ba_hof", JSON.stringify(hallOfFame));

    leaderboardData = leaderboardData.map(p => ({ ...p, score: Math.floor(p.score * 0.3) }));
    localStorage.setItem("ba_leaderboard", JSON.stringify(leaderboardData));
    localStorage.setItem("ba_last_reset", monthKey);
  }
}

// Story Mode
let storyIndex = 0;
function initStoryMode() {
  const prev = document.getElementById("prevSlide");
  const next = document.getElementById("nextSlide");
  const exit = document.getElementById("exitStory");
  prev.addEventListener("click", () => changeSlide(-1));
  next.addEventListener("click", () => changeSlide(1));
  exit.addEventListener("click", () => showView("dashboard"));
  renderStorySlide();
}
function renderStorySlide() {
  const wrap = document.getElementById("storySlides");
  wrap.innerHTML = "";
  const s = spots[storyIndex];
  if (!s) return;
  wrap.innerHTML = `
    <div class="card">
      <img src="${s.image}" alt="${s.name}" />
      <h3>${s.name}</h3>
      <p>${s.city}, ${s.country} • ${s.type}</p>
      <p>${s.about}</p>
    </div>
  `;
  map.setView([s.lat, s.lng], 12);
}
function changeSlide(delta) {
  storyIndex = (storyIndex + delta + spots.length) % spots.length;
  renderStorySlide();
}

// Stats / Chart
function initStats() {
  document.getElementById("toggleChartBtn").addEventListener("click", () => {
    currentChartType = currentChartType === "bar" ? "pie" : "bar";
    drawChart();
  });
  drawChart();
}
function drawChart() {
  const canvas = document.getElementById("statsChart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const types = ["Training Spot","Jam","Cypher Jam"];
  const counts = types.map(t => spots.filter(s => s.type === t).length);
  const colors = ["#35d07f","#ff9f1c","#58d5ff"];

  if (currentChartType === "bar") {
    const barWidth = 120, gap = 30, base = 250;
    counts.forEach((c, i) => {
      const h = c * 30;
      ctx.fillStyle = colors[i];
      ctx.fillRect(40 + i*(barWidth+gap), base-h, barWidth, h);
      ctx.fillStyle = "#fff";
      ctx.fillText(`${types[i]}: ${c}`, 60 + i*(barWidth+gap), base + 16);
    });
  } else {
    const total = counts.reduce((a,b)=>a+b,0) || 1;
    let start = 0;
    const cx = 200, cy = 140, r = 100;
    counts.forEach((c, i) => {
      const angle = (c/total)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start+angle);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      start += angle;
      ctx.fillStyle = "#fff";
      ctx.fillText(`${types[i]} (${c})`, 340, 80 + i*20);
    });
  }

  const legend = document.getElementById("chartLegend");
  legend.innerHTML = types.map((t,i)=>`<span class="badge" style="background:${colors[i]};color:#111">${t}</span>`).join(" ");
}

// Profile / Theme
function initProfile() {
  renderProfileFavorites();
  renderActivity();
  renderAchievements();
  renderAchievementProgress();
  recalcGlobalStats();

  document.getElementById("avatarUpload").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById("profileAvatar").src = reader.result;
      localStorage.setItem("ba_avatar", reader.result);
      notify("Avatar updated");
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("themeColorPicker").addEventListener("input", e => {
    const color = e.target.value;
    document.documentElement.style.setProperty("--accent", color);
    localStorage.setItem("ba_theme", color);
  });

  const savedAvatar = localStorage.getItem("ba_avatar");
  if (savedAvatar) document.getElementById("profileAvatar").src = savedAvatar;
}
function initTheme() {
  const saved = localStorage.getItem("ba_theme");
  if (saved) document.documentElement.style.setProperty("--accent", saved);
}

// Login
function login() {
  const uname = document.getElementById("username").value.trim();
  if (!uname) return notify("Enter username");
  user = { name: uname, since: new Date().toISOString() };
  localStorage.setItem("ba_user", JSON.stringify(user));
  logActivity(`User ${uname} logged in`);
  notify(`Welcome ${uname}`);
  showView("dashboard");
}

// Notifications
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}
function notify(action) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("BreakAtlas", { body: action });
  } else {
    console.log("[BreakAtlas]", action);
  }
}