// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  updateDoc,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// === INJECTED FIREBASE CONFIG ===
// These variables are globally available in the environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

// === FIREBASE INITIALIZATION ===
let app, auth, db, userId;
let userDocRef;
let userUnsubscribe = () => {}; // Function to detach onSnapshot listener

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase Initialized");
} catch (e) {
    console.error("Error initializing Firebase:", e);
    document.getElementById('authStatus').textContent = 'Firebase Init Error';
}

// === AUTHENTICATION ===
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userId = user.uid;
    document.getElementById('authStatus').textContent = 'Authenticated';
    document.getElementById('userIdDisplay').textContent = userId;
    
    // --- User Document Setup ---
    // Path: /artifacts/{appId}/users/{userId}/profile/data
    const userDocPath = `artifacts/${appId}/users/${userId}/profile/data`;
    userDocRef = doc(db, userDocPath);

    // Check if doc exists, if not, create it
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
      await setDoc(userDocRef, {
        favorites: [],
        collections: {},
        activityFeed: [{ text: "Joined BreakAtlas", time: new Date().toISOString() }],
        achievements: [],
        themeColor: "#ff9f1c",
        profileAvatar: "https://placehold.co/128x128/374151/f3f4f6?text=User"
      });
      console.log("Created new user profile document");
    }
    
    // Detach any existing listener before attaching a new one
    userUnsubscribe();
    
    // --- REAL-TIME DATA SYNC ---
    // Listen for changes to the user's profile document
    userUnsubscribe = onSnapshot(userDocRef, (doc) => {
        const data = doc.data();
        if (data) {
            console.log("Received profile update from Firestore");
            // Sync local state with Firestore
            favorites = data.favorites || [];
            collections = data.collections || {};
            activityFeed = data.activityFeed || [];
            achievements = data.achievements || [];
            themeColor = data.themeColor || "#ff9f1c";
            
            // Update UI based on new data
            initTheme(data.themeColor);
            document.getElementById('profileAvatar').src = data.profileAvatar || "https://placehold.co/128x128/374151/f3f4f6?text=User";
            
            // Re-render components that depend on this data
            if (currentView === "dashboard") {
                renderSpots(spots); // Refresh cards for favorite status
            } else if (currentView === "profile") {
                renderProfileView(); // Full refresh of profile
            }
            renderLeaderboard(); // Based on favorites
            renderChallenges(); // Based on state
        }
    });

  } else {
    // No user is signed in.
    document.getElementById('authStatus').textContent = 'Not Authenticated';
    document.getElementById('userIdDisplay').textContent = 'N/A';
    userUnsubscribe(); // Detach listener
    // Sign in anonymously or with custom token
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with Custom Token");
        } else {
            await signInAnonymously(auth);
            console.log("Signed in Anonymously");
        }
    } catch (error) {
        console.error("Authentication Error:", error);
        document.getElementById('authStatus').textContent = 'Auth Error';
    }
  }
});


// === APP STATE (Local) ===
let map;
let markers = [];
let currentView = "dashboard";
let themeColor = "#ff9f1c"; // Default, will be overwritten by Firestore
let spotToCollect = null; // Temp state for modal

// --- Firestore-Synced State (Defaults) ---
// These are populated by the onSnapshot listener
let favorites = [];
let collections = {};
let activityFeed = [];
let achievements = [];

// === DOM READY ===
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons(); // Render icons
  
  // Wait for Firebase auth to be ready before rendering
  const authReadyCheck = setInterval(() => {
      if (userId) {
          clearInterval(authReadyCheck);
          console.log("Auth ready, rendering app.");
          // Initial render functions
          initMap();
          renderSpots(spots);
          bindDashboardEvents();
          bindProfileEvents();
          bindStoryModeEvents();
          bindNavEvents();
          renderLeaderboard();
          renderHallOfFame();
          renderGlobalStats();
          renderChallenges();
      }
  }, 100);
});

// === FIRESTORE HELPER FUNCTIONS ===

/**
 * Updates a field in the user's profile document on Firestore.
 * Uses 'updateDoc' for performance.
 * @param {object} payload - An object with fields to update (e.g., { favorites: newArray })
 */
async function updateUserDoc(payload) {
  if (!userDocRef) {
      console.error("User doc ref not ready!");
      return;
  }
  try {
      await updateDoc(userDocRef, payload);
      // console.log("User doc updated:", payload);
  } catch (e) {
      console.error("Error updating user doc:", e);
  }
}

/**
 * Logs an activity to the activity feed in Firestore.
 * @param {string} text - The log message.
 */
async function logActivity(text) {
  if (!userDocRef) return;
  
  const entry = { text, time: new Date().toISOString() };
  // Keep feed capped at 20 entries
  const newFeed = [entry, ...activityFeed.slice(0, 19)]; 
  
  // We update the local state immediately for responsiveness
  activityFeed = newFeed;
  renderActivityFeed();
  
  // Then sync with Firestore
  await updateUserDoc({ activityFeed: newFeed });
}

// === THEME HANDLING ===
function initTheme(color) {
  const picker = document.getElementById("themeColorPicker");
  if (!color) color = themeColor; // Use state if no color passed
  
  if (picker) {
    picker.value = color;
    // This listener is now for Firestore updates
    picker.addEventListener("input", (e) => {
      themeColor = e.target.value;
      document.documentElement.style.setProperty("--accent", themeColor);
    });
    
    picker.addEventListener("change", (e) => {
        // Only update Firestore on 'change' (when user is done)
        logActivity(`Changed theme color to ${e.target.value}`);
        updateUserDoc({ themeColor: e.target.value });
    });
  }
  document.documentElement.style.setProperty("--accent", color);
}

// === MAP INITIALIZATION ===
function initMap() {
  map = L.map("map", {
      zoomControl: false // Disable default zoom control
  }).setView([50, 10], 4);
  
  // Use a dark tile layer
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Add zoom control to bottom right
  L.control.zoom({
      position: 'bottomright'
  }).addTo(map);
  
  // Add custom icons
  const iconJam = L.icon({ iconUrl: 'https://placehold.co/32x32/ff9f1c/ff9f1c.png', iconSize: [25, 25] });
  const iconCypher = L.icon({ iconUrl: 'https://placehold.co/32x32/e71d36/e71d36.png', iconSize: [25, 25] });
  const iconTraining = L.icon({ iconUrl: 'https://placehold.co/32x32/2ec4b6/2ec4b6.png', iconSize: [25, 25] });
  const iconFavorite = L.icon({ iconUrl: 'https://placehold.co/32x32/ffffff/ffffff.png', iconSize: [25, 25] });
  
  window.mapIcons = {
      Jam: iconJam,
      Cypher: iconCypher,
      Training: iconTraining,
      Favorite: iconFavorite
  };
}

/**
 * Gets the appropriate map icon for a spot type.
 * @param {string} type - The spot type (e.g., "Jam", "Cypher")
 * @returns {L.Icon} A Leaflet Icon object
 */
function getIconForType(type) {
    if (type.includes('Jam')) return window.mapIcons.Jam;
    if (type.includes('Cypher')) return window.mapIcons.Cypher;
    if (type.includes('Training')) return window.mapIcons.Training;
    return window.mapIcons.Jam; // Default
}

// === SPOT RENDERING ===
function renderSpots(list, filterType = null) {
  const container = document.getElementById("cards");
  if (!container) return;
  container.innerHTML = "";

  // Clear old markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  
  const layerToggles = {
      jam: document.getElementById('layerJams').checked,
      cypher: document.getElementById('layerCyphers').checked,
      training: document.getElementById('layerTraining').checked,
      favorite: document.getElementById('layerFavorites').checked,
  };

  let visibleSpots = 0;
  list.forEach((s) => {
    const isFav = favorites.includes(s.id);
    const spotTypeLower = s.type.toLowerCase();
    
    // --- Layer Filtering ---
    let showOnMap = false;
    if (layerToggles.jam && spotTypeLower.includes('jam')) showOnMap = true;
    if (layerToggles.cypher && spotTypeLower.includes('cypher')) showOnMap = true;
    if (layerToggles.training && spotTypeLower.includes('training')) showOnMap = true;
    
    // Favorite layer overrides others
    if (layerToggles.favorite && isFav) showOnMap = true;
    
    // --- Card Filtering (from search) ---
    // If a filterType is passed (from search), we only show matching cards.
    // If no filterType, show all cards (respecting map toggle)
    let showCard = true;
    if (filterType && !spotTypeLower.includes(filterType)) {
        showCard = false;
    }
    
    // Render card
    if (showCard) {
        visibleSpots++;
        const card = document.createElement("div");
        card.className = "card bg-gray-800 rounded-lg shadow-lg overflow-hidden";
        card.innerHTML = `
          <img src="${s.image}" alt="${s.name}" class="w-full h-40 object-cover" />
          <div class="p-4">
            <h3 class="text-xl font-semibold mb-1">${s.name}</h3>
            <p class="text-sm text-gray-400 mb-2">${s.city}, ${s.country} • <span class="font-medium" style="color:var(--accent);">${s.type}</span></p>
            <p class="text-sm text-gray-300 mb-4 h-12 overflow-hidden">${s.about}</p>
            <div class="card-actions flex gap-2 flex-wrap">
              <button class="btn-secondary flex-1 text-sm py-2" onclick="window.zoomToSpot('${s.id}')"><i data-lucide="map-pin" class="w-4 h-4 mr-1 inline-block"></i>Zoom</button>
              <button class="btn-secondary flex-1 text-sm py-2" onclick="window.shareSpot('${s.id}')"><i data-lucide="share-2" class="w-4 h-4 mr-1 inline-block"></i>Share</button>
              <button class="btn-secondary flex-1 text-sm py-2 ${isFav ? 'text-yellow-400' : ''}" onclick="window.toggleFavorite('${s.id}')">
                <i data-lucide="star" class="w-4 h-4 mr-1 inline-block ${isFav ? 'fill-current' : ''}"></i>${isFav ? "Saved" : "Save"}
              </button>
              <button class="btn-secondary flex-1 text-sm py-2" onclick="window.openCollectionModal('${s.id}')"><i data-lucide="plus-square" class="w-4 h-4 mr-1 inline-block"></i>Add</button>
            </div>
          </div>
        `;
        container.appendChild(card);
    }

    // Render marker (respects map toggles)
    if (showOnMap) {
        const icon = (layerToggles.favorite && isFav) ? window.mapIcons.Favorite : getIconForType(s.type);
        const marker = L.marker([s.lat, s.lng], { icon: icon }).addTo(map);
        marker.bindPopup(`<strong>${s.name}</strong><br>${s.city}, ${s.country}`);
        marker.spotId = s.id;
        markers.push(marker);
    }
  });
  
  if (visibleSpots === 0 && container.innerHTML === "") {
      container.innerHTML = `<p class="text-gray-400 p-4">No spots found. Try adjusting your search or filters.</p>`;
  }

  lucide.createIcons(); // Re-render icons in new cards
}

// === MAP & CARD ACTIONS ===
window.zoomToSpot = (spotId) => {
  const s = spots.find(sp => sp.id === spotId);
  if (s) {
    map.setView([s.lat, s.lng], 13);
    // Find marker and open popup
    const marker = markers.find(m => m.spotId === spotId);
    if (marker) {
        marker.openPopup();
    }
  }
}

window.shareSpot = (spotId) => {
  const s = spots.find(sp => sp.id === spotId);
  if (!s) return;
  
  const text = `Check this out on BreakAtlas: ${s.name} — ${s.city}, ${s.country} (${s.type}).`;
  const url = location.href;

  if (navigator.share) {
    navigator.share({ title: "BreakAtlas", text, url }).catch(() => {});
    return;
  }

  // Fallback popup
  const popup = document.getElementById("sharePopup");
  const linksEl = document.getElementById("sharePopupLinks");
  linksEl.innerHTML = `
    <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener" class="text-blue-400 hover:underline">Share on Twitter</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" class="text-blue-400 hover:underline">Share on Facebook</a>
    <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(text)}%20${encodeURIComponent(url)}" target="_blank" rel="noopener" class="text-blue-400 hover:underline">Share on WhatsApp</a>
    <a href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}" target="_blank" rel="noopener" class="text-blue-400 hover:underline">Share on Telegram</a>
  `;
  popup.classList.remove("hidden");
}

window.closeSharePopup = () => {
  document.getElementById("sharePopup").classList.add("hidden");
}

window.toggleFavorite = async (spotId) => {
  const s = spots.find(sp => sp.id === spotId);
  if (!s) return;
  
  const idx = favorites.indexOf(spotId);
  if (idx >= 0) {
    // Remove favorite
    await updateUserDoc({ favorites: arrayRemove(spotId) });
    logActivity(`Removed ${s.name} from favorites`);
  } else {
    // Add favorite
    await updateUserDoc({ favorites: arrayUnion(spotId) });
    logActivity(`Added ${s.name} to favorites`);
    checkAchievement("fav_1");
    checkAchievement("fav_5");
  }
  // UI updates are handled by the onSnapshot listener
}

// === MODAL MANAGEMENT ===
function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}
window.closeModal = (modalId) => {
  document.getElementById(modalId).classList.add('hidden');
}

// --- Collection Modal ---
window.openCollectionModal = (spotId) => {
  spotToCollect = spotId;
  const s = spots.find(sp => sp.id === spotId);
  if (!s) return;
  
  document.getElementById('collectionModalSpotName').textContent = s.name;
  const listEl = document.getElementById('collectionModalList');
  listEl.innerHTML = "";
  
  if (Object.keys(collections).length === 0) {
      listEl.innerHTML = `<p class="text-gray-400 text-sm">No collections yet. Create one below!</p>`;
  } else {
      for (const name in collections) {
          const spotIds = collections[name] || [];
          const alreadyAdded = spotIds.includes(spotId);
          listEl.innerHTML += `
            <button 
              onclick="window.addSpotToCollection('${name}')" 
              class="w-full text-left p-3 rounded-lg ${alreadyAdded ? 'bg-gray-600 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}"
              ${alreadyAdded ? 'disabled' : ''}
            >
              ${name} <span class="text-xs text-gray-400">(${spotIds.length} spots) ${alreadyAdded ? '- Added' : ''}</span>
            </button>
          `;
      }
  }
  
  openModal('collectionModal');
}

document.getElementById('collectionModalCreateBtn').onclick = () => {
    const nameInput = document.getElementById('collectionModalNewName');
    const name = nameInput.value.trim();
    if (!name) return;
    
    const newCollections = { ...collections, [name]: [spotToCollect] };
    updateUserDoc({ collections: newCollections });
    
    logActivity(`Created collection "${name}" and added ${spots.find(s=>s.id === spotToCollect).name}`);
    checkAchievement("col_1");
    checkAchievement("col_3");

    nameInput.value = "";
    closeModal('collectionModal');
};

window.addSpotToCollection = (name) => {
    if (!collections[name] || collections[name].includes(spotToCollect)) return;
    
    const newSpotIds = [...collections[name], spotToCollect];
    const newCollections = { ...collections, [name]: newSpotIds };
    
    updateUserDoc({ collections: newCollections });
    logActivity(`Added ${spots.find(s=>s.id === spotToCollect).name} to "${name}"`);
    closeModal('collectionModal');
};

// --- Rename Modal ---
let oldCollectionName = null;
window.openRenameModal = (name) => {
    oldCollectionName = name;
    document.getElementById('renameModalInput').value = name;
    openModal('renameModal');
}
document.getElementById('renameModalSaveBtn').onclick = () => {
    const newName = document.getElementById('renameModalInput').value.trim();
    if (!newName || newName === oldCollectionName || collections[newName]) {
        // Handle error (e.g., show a message)
        console.error("Invalid new name or name already exists");
        return;
    }
    
    const newCollections = { ...collections };
    newCollections[newName] = newCollections[oldCollectionName];
    delete newCollections[oldCollectionName];
    
    updateUserDoc({ collections: newCollections });
    logActivity(`Renamed collection "${oldCollectionName}" to "${newName}"`);
    closeModal('renameModal');
};

// --- Delete Modal ---
let collectionToDelete = null;
window.openDeleteModal = (name) => {
    collectionToDelete = name;
    document.getElementById('deleteModalCollectionName').textContent = name;
    openModal('deleteModal');
}
document.getElementById('deleteModalConfirmBtn').onclick = () => {
    if (!collectionToDelete) return;
    
    const newCollections = { ...collections };
    delete newCollections[collectionToDelete];
    
    updateUserDoc({ collections: newCollections });
    logActivity(`Deleted collection "${collectionToDelete}"`);
    collectionToDelete = null;
    closeModal('deleteModal');
};


// === VIEW SWITCHING ===
function showView(viewId) {
  currentView = viewId;
  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active-view");
    v.classList.add("view");
  });
  const el = document.getElementById(viewId);
  if (el) {
    el.classList.add("active-view");
    el.classList.remove("view");
  }

  // Refresh data on view switch
  if (viewId === "profile") {
    renderProfileView();
  } else if (viewId === "leaderboardView") {
    renderLeaderboard();
    renderHallOfFame();
    renderGlobalStats();
  } else if (viewId === "dashboard") {
    renderSpots(spots);
    renderStatsChart();
    // Invalidate map size to fix rendering issues
    setTimeout(() => { if (map) map.invalidateSize() }, 100);
  } else if (viewId === "storyMode") {
    initStorySlides();
  }
  
  // Close mobile menu
  document.getElementById("mobileMenu").classList.add("hidden");
}

function bindNavEvents() {
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const viewId = e.currentTarget.dataset.view;
      showView(viewId);
    });
  });
}

window.toggleMenu = () => {
  document.getElementById("mobileMenu").classList.toggle("hidden");
}

// === DASHBOARD EVENTS ===
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
      resetBtn.classList.add("hidden");
      summary.classList.add("hidden");
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
    resetBtn.classList.remove("hidden");
    summary.classList.remove("hidden");
    summary.textContent = `Filtered: ${filtered.length} of ${spots.length} for "${q}"`;
  });

  resetBtn.addEventListener("click", () => {
    search.value = "";
    renderSpots(spots);
    resetBtn.classList.add("hidden");
    summary.classList.add("hidden");
    summary.textContent = "";
  });

  toggleChartBtn.addEventListener("click", () => {
    usePie = !usePie;
    toggleChartBtn.innerHTML = usePie 
        ? `<i data-lucide="bar-chart-2" class="w-4 h-4 mr-1 inline-block"></i>Switch to Bar`
        : `<i data-lucide="pie-chart" class="w-4 h-4 mr-1 inline-block"></i>Switch to Pie`;
    lucide.createIcons();
    renderStatsChart(usePie);
  });
  
  // Map layer toggles
  document.querySelectorAll('.map-layer-toggle').forEach(toggle => {
      toggle.addEventListener('change', () => renderSpots(spots));
  });

  // Initial chart render
  renderStatsChart(usePie);
}

// === PROFILE EVENTS ===
function bindProfileEvents() {
  const avatarUpload = document.getElementById("avatarUpload");
  const createCollectionBtn = document.getElementById("createCollectionBtn");

  if (avatarUpload) {
    avatarUpload.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imgData = ev.target.result;
        // Optimistic update for UI
        document.getElementById("profileAvatar").src = imgData;
        // Update Firestore
        updateUserDoc({ profileAvatar: imgData });
        logActivity("Updated profile avatar");
      };
      reader.readAsDataURL(file);
    });
  }

  if (createCollectionBtn) {
    createCollectionBtn.addEventListener("click", () => {
      const nameInput = document.getElementById("newCollectionName");
      const name = nameInput.value.trim();
      if (!name || collections[name]) return;
      
      const newCollections = { ...collections, [name]: [] };
      updateUserDoc({ collections: newCollections });
      
      logActivity(`Created collection "${name}"`);
      checkAchievement("col_1");
      checkAchievement("col_3");
      
      nameInput.value = "";
      // UI update via onSnapshot
    });
  }
}

// === STORY MODE ===
let storyIndex = 0;
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
  const dotsContainer = document.getElementById("storyDots");
  const slide = storySlidesData[storyIndex];
  container.innerHTML = `
    <div class="p-6 md:p-10 text-center">
      <img src="${slide.image}" alt="${slide.title}" class="w-full h-48 object-contain mb-6 rounded-lg"/>
      <h3 class="text-2xl font-bold mb-4" style="color:var(--accent);">${slide.title}</h3>
      <p class="text-gray-300 max-w-lg mx-auto">${slide.text}</p>
    </div>
  `;
  
  // Render dots
  dotsContainer.innerHTML = "";
  storySlidesData.forEach((_, i) => {
      dotsContainer.innerHTML += `
        <button class_name="w-3 h-3 rounded-full ${i === storyIndex ? 'bg-white' : 'bg-gray-600'}" onclick="window.setStorySlide(${i})"></button>
      `;
  });
  
  // Update buttons
  document.getElementById('prevSlide').classList.toggle('opacity-50', storyIndex === 0);
  const nextBtn = document.getElementById('nextSlide');
  if (storyIndex === storySlidesData.length - 1) {
      nextBtn.innerHTML = `Finish <i data-lucide="check" class="w-5 h-5 ml-1 inline-block"></i>`;
      nextBtn.onclick = () => showView("dashboard");
  } else {
      nextBtn.innerHTML = `Next <i data-lucide="arrow-right" class="w-5 h-5 ml-1 inline-block"></i>`;
      nextBtn.onclick = () => changeSlide(1);
  }
  lucide.createIcons();
}

window.setStorySlide = (index) => {
    storyIndex = index;
    renderStorySlide();
}


// === LEADERBOARD & STATS ===
function renderLeaderboard() {
  const el = document.getElementById("leaderboard");
  if (!el) return;
  el.innerHTML = "";

  // Example: count favorites by country
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
    el.innerHTML = `<div class="bg-gray-800 p-4 rounded-lg text-gray-400 md:col-span-3">No leaderboard data yet — add favorites to see rankings.</div>`;
    return;
  }

  entries.forEach((e, i) => {
    const card = document.createElement("div");
    card.className = "leader-card bg-gray-800 p-4 rounded-lg flex items-center space-x-4";
    card.innerHTML = `
      <span class="text-3xl font-bold ${i === 0 ? 'text-yellow-400' : (i === 1 ? 'text-gray-300' : 'text-yellow-600')}">#${i + 1}</span>
      <div>
        <h4 class="text-lg font-semibold">${e.country}</h4>
        <p class="text-sm" style="color:var(--accent);">${e.score} Favorites</p>
      </div>
    `;
    el.appendChild(card);
  });
}

function renderHallOfFame() {
  const el = document.getElementById("hallOfFame");
  if (!el) return;
  el.innerHTML = "";
  
  crews.slice(0, 6).forEach(c => {
    const card = document.createElement("div");
    card.className = "fame-card bg-gray-800 p-4 rounded-lg";
    card.innerHTML = `
      <h4 class="text-lg font-semibold">${c.name}</h4>
      <p class="text-sm font-medium mb-2" style="color:var(--accent);">${c.country}</p>
      <p class="text-sm text-gray-400">${c.about}</p>
    `;
    el.appendChild(card);
  });
}

function renderGlobalStats() {
  const el = document.getElementById("globalStats");
  if (!el) return;

  const stats = [
    { title: "Total Spots", value: spots.length, icon: "map" },
    { title: "Jams", value: countType("Jam"), icon: "disc" },
    { title: "Cyphers", value: countType("Cypher"), icon: "radio" },
    { title: "Training", value: countType("dumbbell"), icon: "dumbbell" },
  ];

  el.innerHTML = stats.map(c => `
    <div class="stat-card bg-gray-800 p-4 rounded-lg flex items-center space-x-4">
        <i data-lucide="${c.icon}" class="w-8 h-8" style="color:var(--accent);"></i>
        <div>
            <h4 class="text-2xl font-bold">${c.value}</h4>
            <p class="text-sm text-gray-400">${c.title}</p>
        </div>
    </div>
  `).join('');
  lucide.createIcons();
}

// === PROFILE VIEW RENDERING ===

// This function re-renders the whole profile view
function renderProfileView() {
    renderProfileFavorites();
    renderCollections();
    renderAchievements();
    renderActivityFeed();
    renderChallenges();
}

function renderProfileFavorites() {
  const el = document.getElementById("profileFavorites");
  if (!el) return;
  el.innerHTML = "";
  
  if (favorites.length === 0) {
      el.innerHTML = `<li class="text-gray-400 text-sm p-3 bg-gray-700 rounded-lg">No favorites added yet.</li>`;
      return;
  }
  
  favorites.forEach(id => {
    const s = spots.find(sp => sp.id === id);
    if (!s) return;
    const li = document.createElement("li");
    li.className = "flex justify-between items-center p-3 bg-gray-700 rounded-lg";
    li.innerHTML = `
        <span>
            <strong class="text-gray-100">${s.name}</strong>
            <span class="text-gray-400 text-sm"> — ${s.city}</span>
        </span>
        <button onclick="window.zoomToSpot('${s.id}')" class="p-1 hover:text-white" style="color:var(--accent);"><i data-lucide="map-pin" class="w-4 h-4"></i></button>
    `;
    el.appendChild(li);
  });
  lucide.createIcons();
}

function renderCollections() {
  const el = document.getElementById("profileCollections");
  if (!el) return;
  el.innerHTML = "";
  
  if (Object.keys(collections).length === 0) {
      el.innerHTML = `<p class="text-gray-400 text-sm p-3 bg-gray-700 rounded-lg md:col-span-2">No collections created yet.</p>`;
      return;
  }

  Object.keys(collections).forEach(name => {
    const items = collections[name] || [];
    const div = document.createElement("div");
    div.className = "collection-card bg-gray-700 p-4 rounded-lg";
    div.innerHTML = `
      <h4 class="text-lg font-semibold mb-2">${name}</h4>
      <p class="text-sm text-gray-400 mb-4">${items.length} spots</p>
      <div class="flex gap-2">
        <button onclick="window.openRenameModal('${name}')" class="btn-secondary text-sm py-1 px-3 flex-1"><i data-lucide="edit-2" class="w-4 h-4 mr-1 inline-block"></i>Rename</button>
        <button onclick="window.openDeleteModal('${name}')" class="btn-secondary text-sm py-1 px-3 flex-1 hover:bg-red-700"><i data-lucide="trash-2" class="w-4 h-4 mr-1 inline-block"></i>Delete</button>
      </div>
    `;
    el.appendChild(div);
  });
  lucide.createIcons();
}

// --- Achievements ---
const achievementDefs = {
    "fav_1": { title: "First Favorite", desc: "Save your first spot", check: () => favorites.length >= 1, icon: "star" },
    "fav_5": { title: "Collector", desc: "Save 5 favorite spots", check: () => favorites.length >= 5, icon: "archive" },
    "col_1": { title: "Curator", desc: "Create your first collection", check: () => Object.keys(collections).length >= 1, icon: "bookmark" },
    "col_3": { title: "Archivist", desc: "Create 3 collections", check: () => Object.keys(collections).length >= 3, icon: "book" },
    "visit_jam": { title: "Jam Explorer", desc: "Explore a Jam (demo)", check: () => false, icon: "disc" }, // Example for future
};

function checkAchievement(id) {
    if (!achievements.includes(id) && achievementDefs[id].check()) {
        const newAchievements = [...achievements, id];
        updateUserDoc({ achievements: newAchievements });
        logActivity(`Unlocked achievement: ${achievementDefs[id].title}`);
    }
}

function renderAchievements() {
  const el = document.getElementById("profileAchievements");
  const progressEl = document.getElementById("achievementProgress");
  if (!el || !progressEl) return;
  el.innerHTML = "";

  Object.keys(achievementDefs).forEach(id => {
    const d = achievementDefs[id];
    const achieved = achievements.includes(id) || d.check();
    
    const card = document.createElement("div");
    card.className = `achievement-card p-4 rounded-lg flex flex-col items-center text-center ${achieved ? 'bg-gray-700' : 'bg-gray-700 opacity-50'}`;
    card.innerHTML = `
        <div class="p-3 rounded-full mb-2" style="background-color: ${achieved ? 'var(--accent)' : '#4b5563'};">
            <i data-lucide="${d.icon}" class="w-6 h-6 ${achieved ? 'text-gray-900' : 'text-gray-400'}"></i>
        </div>
        <h4 class="font-semibold">${d.title}</h4>
        <p class="text-xs text-gray-400">${d.desc}</p>
    `;
    el.appendChild(card);
  });
  
  lucide.createIcons();
  progressEl.innerHTML = `<p>Achievements unlocked: ${achievements.length} / ${Object.keys(achievementDefs).length}</p>`;
}

// --- Challenges (Dynamic) ---
function renderChallenges() {
  const el = document.getElementById("challenges");
  if (!el) return;

  const list = [
    { title: "Save 5 favorites", current: favorites.length, target: 5 },
    { title: "Create 2 collections", current: Object.keys(collections).length, target: 2 },
    { title: "Favorite 3 Jams", current: favorites.filter(id => spots.find(s=>s.id === id)?.type.includes("Jam")).length, target: 3 },
  ];
  
  el.innerHTML = list.map(ch => {
      const progress = Math.min(100, (ch.current / ch.target) * 100);
      return `
        <div class="challenge-card bg-gray-700 p-3 rounded-lg">
          <div class="flex justify-between items-center mb-1">
              <h4 class="text-sm font-medium">${ch.title}</h4>
              <span class="text-xs text-gray-400">${ch.current}/${ch.target}</span>
          </div>
          <div class="w-full bg-gray-800 rounded-full h-2">
              <div class="h-2 rounded-full" style="width: ${progress}%; background-color: var(--accent);"></div>
          </div>
        </div>
      `;
  }).join('');
}

function renderActivityFeed() {
  const el = document.getElementById("profileActivity");
  if (!el) return;
  el.innerHTML = "";
  
  if (activityFeed.length === 0) {
      el.innerHTML = `<li class="text-gray-400 text-sm p-3 bg-gray-700 rounded-lg">No activity yet.</li>`;
      return;
  }
  
  activityFeed.slice(0, 20).forEach(a => {
    const li = document.createElement("li");
    const d = new Date(a.time);
    li.className = "p-2 bg-gray-700 rounded-lg";
    li.innerHTML = `
        <span class="text-gray-300">${a.text}</span>
        <span class="block text-xs text-gray-500">${d.toLocaleString()}</span>
    `;
    el.appendChild(li);
  });
}

// === DEMO LOGIN ===
window.login = () => {
  const u = document.getElementById("username").value.trim();
  if (u) {
    logActivity(`User "${u}" logged in (demo)`);
    showView("dashboard");
  } else {
    // You can add a custom modal here instead of alert
    console.error("Enter username and password");
  }
}

// === STATS CHART ===
function countType(t) {
  // Access spots from global scope (defined in data.js)
  return spots.filter(s => s.type.toLowerCase().includes(t.toLowerCase())).length;
}

function renderStatsChart(usePie = false) {
  const canvas = document.getElementById("statsChart");
  if (!canvas) return;
  
  // Make canvas responsive
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = 280; // Fixed height
  
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const data = [
    { label: "Jams", value: countType("Jam"), color: "#ff9f1c" },
    { label: "Cyphers", value: countType("Cypher"), color: "#e71d36" },
    { label: "Training", value: countType("Training"), color: "#2ec4b6" },
  ];
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  
  ctx.fillStyle = "#f3f4f6"; // text-gray-100
  ctx.font = "14px Inter";

  if (!usePie) {
    // Bar chart
    const barWidth = Math.max(50, (canvas.width - 80) / data.length * 0.6);
    const gap = (canvas.width - 80 - (barWidth * data.length)) / (data.length - 1);
    let x = 40;
    const maxVal = Math.max(...data.map(d => d.value)) || 1;
    const scale = 180 / maxVal;
    data.forEach(d => {
      const h = d.value * scale;
      ctx.fillStyle = d.color;
      ctx.fillRect(x, 220 - h, barWidth, h);
      ctx.fillStyle = "#f3f4f6";
      ctx.textAlign = "center";
      ctx.fillText(`${d.label}`, x + barWidth / 2, 240);
      ctx.fillText(`(${d.value})`, x + barWidth / 2, 260);
      x += barWidth + gap;
    });
  } else {
    // Pie chart
    let start = 0;
    const cx = canvas.width / 2;
    const cy = 130;
    const r = 100;
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
  }
  
  // Legend HTML
  const legend = document.getElementById("chartLegend");
  if (legend) {
    legend.innerHTML = data.map(d => `
        <span class="flex items-center">
            <span class="w-3 h-3 rounded-full mr-2" style="background-color: ${d.color}"></span>
            ${d.label}: ${d.value}
        </span>
    `).join('');
  }
}