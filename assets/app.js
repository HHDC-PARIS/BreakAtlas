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
  setDoc, 
  onSnapshot, 
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection as firestoreCollection, // Renamed to avoid collision with global 'collections'
  query,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";


// === INJECTED FIREBASE CONFIG ===
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

// === FIREBASE INITIALIZATION ===
let app, auth, db, userId;
let userDocRef;
let userUnsubscribe = () => {}; // Function to detach onSnapshot listener

// Application State (Now defaults, overwritten by Firebase)
let map;
let markers = [];
let currentView = "dashboard";
let userFavorites = [];
let userCollections = {}; // { id: { name, description, spotIds: [] } }
let userActivityFeed = [];
let userAchievements = [];
let themeColor = localStorage.getItem("themeColor") || "#ff9f1c";
let chartType = localStorage.getItem("chartType") === 'pie'; // true for pie, false for bar

// Logging Level
setLogLevel('Debug');


/* --- FIREBASE AUTH & DATA LOADING --- */

/**
 * Initializes Firebase, authenticates the user, and sets up real-time data listener.
 */
async function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // Authenticate using custom token or anonymously
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        // Set up the listener for auth state changes
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                document.getElementById('userIdDisplay').textContent = `User ID: ${userId}`;
                userDocRef = doc(db, "artifacts", appId, "users", userId, "profile", "data");
                
                // Load user data in real-time
                userUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        userFavorites = data.favorites || [];
                        userCollections = data.collections || {};
                        userActivityFeed = data.activityFeed || [];
                        userAchievements = data.achievements || [];
                    } else {
                        // Initialize user document if it doesn't exist
                        setDoc(userDocRef, {
                            favorites: userFavorites,
                            collections: userCollections,
                            activityFeed: userActivityFeed,
                            achievements: userAchievements
                        }, { merge: true });
                    }
                    // Re-render all elements dependent on user data
                    renderSpotCards(spots);
                    renderProfileView();
                    renderLeaderboard();
                    renderHallOfFame();
                }, (error) => {
                    console.error("Error listening to user data:", error);
                });

            } else {
                // Should not happen in Canvas environment but useful for debugging
                userId = 'anonymous';
                document.getElementById('userIdDisplay').textContent = `User ID: Anonymous`;
                userUnsubscribe(); // Stop listening if user logs out/changes
            }
        });

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        document.getElementById('userIdDisplay').textContent = `Error: Cannot connect to DB`;
    }
}


/**
 * Saves the current user data state to Firestore.
 */
function saveUserData() {
    if (!userId || !userDocRef) {
        console.warn("Attempted to save data before Firebase was ready.");
        return;
    }
    updateDoc(userDocRef, {
        favorites: userFavorites,
        collections: userCollections,
        activityFeed: userActivityFeed,
        achievements: userAchievements
    }).catch(error => {
        console.error("Error saving user data:", error);
    });
}


/* --- THEME & UTILITIES --- */

function initTheme() {
    const picker = document.getElementById("themeColorPicker");
    const mobilePicker = document.getElementById("mobileThemeColorPicker");
    
    // Set initial theme color
    document.documentElement.style.setProperty("--accent", themeColor);
    document.documentElement.style.setProperty("--accent-hover", adjustColor(themeColor, 20));

    // Event listeners
    const handleColorChange = (e) => {
        themeColor = e.target.value;
        const hoverColor = adjustColor(themeColor, 20);
        document.documentElement.style.setProperty("--accent", themeColor);
        document.documentElement.style.setProperty("--accent-hover", hoverColor);
        localStorage.setItem("themeColor", themeColor);
        logActivity(`Changed theme color to ${themeColor}`);
        // Keep both pickers in sync
        if (picker) picker.value = themeColor;
        if (mobilePicker) mobilePicker.value = themeColor;
    };

    if (picker) {
        picker.value = themeColor;
        picker.addEventListener("input", handleColorChange);
    }
    if (mobilePicker) {
        mobilePicker.value = themeColor;
        mobilePicker.addEventListener("input", handleColorChange);
    }
}

/**
 * Adjusts a hex color (lightens/darkens).
 * @param {string} hex - The hex color string.
 * @param {number} amount - Amount to lighten (positive) or darken (negative).
 * @returns {string} The new hex color string.
 */
function adjustColor(hex, amount) {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = Math.min(255, R + amount);
    G = Math.min(255, G + amount);
    B = Math.min(255, B + amount);

    const RR = ((R.toString(16).length == 1) ? "0" + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length == 1) ? "0" + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length == 1) ? "0" + B.toString(16) : B.toString(16));

    return "#" + RR + GG + BB;
}

// Make global
// window.showView = function(viewId) {
// MODIFICATION: Removed window. assignment
function showView(viewId) {
    document.querySelectorAll(".view").forEach(view => {
        view.style.display = "none";
    });
    const view = document.getElementById(viewId);
    if (view) {
        view.style.display = "block";
        currentView = viewId;
    }
    // Re-render the profile view if we switch to it
    if (viewId === 'profile') {
        renderProfileView();
    }
    // Re-render icons on view change for robustness
    lucide.createIcons();
    toggleMenu(true); // Close mobile menu if open
}

// window.toggleMenu = function(forceClose = false) {
// MODIFICATION: Removed window. assignment
function toggleMenu(forceClose = false) {
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (forceClose) {
        mobileMenu.classList.add('hidden');
    } else {
        // Toggle mobile menu visibility
        const isHidden = mobileMenu.classList.contains('hidden');
        if (isHidden) {
            mobileMenu.classList.remove('hidden');
        } else {
            mobileMenu.classList.add('hidden');
        }
    }
}


/**
 * Logs an activity entry to the user's activity feed in Firestore.
 * @param {string} message - The message to log.
 */
function logActivity(message) {
    const timestamp = new Date().toISOString();
    const newActivity = { message, timestamp };
    
    // Add to local state (will be refreshed by onSnapshot, but useful for immediate feedback)
    userActivityFeed.unshift(newActivity);
    
    // Limit to 20 activities
    userActivityFeed = userActivityFeed.slice(0, 20);

    saveUserData();
    
    // Re-render profile view to update the feed immediately
    if (currentView === 'profile') {
        renderProfileView();
    }
}


/* --- MAP LOGIC --- */

function initMap() {
    if (map) map.remove(); // Remove existing map if re-initializing

    map = L.map('map').setView([48.85, 2.35], 5); // Centered on Paris, moderate zoom

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    renderMapMarkers(spots);
}

function renderMapMarkers(spotList) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    spotList.forEach(spot => {
        const marker = L.marker([spot.lat, spot.lng]).addTo(map);
        marker.on('click', () => showSpotModal(spot.id));
        markers.push(marker);
    });
}


/* --- DASHBOARD LOGIC --- */

function bindDashboardEvents() {
    document.getElementById('spotSearch').addEventListener('input', filterSpots);
    document.getElementById('spotFilter').addEventListener('change', filterSpots);
}

function filterSpots() {
    const searchTerm = document.getElementById('spotSearch').value.toLowerCase();
    const filterType = document.getElementById('spotFilter').value;

    const filteredSpots = spots.filter(spot => {
        const matchesSearch = spot.name.toLowerCase().includes(searchTerm) ||
                              spot.city.toLowerCase().includes(searchTerm) ||
                              spot.country.toLowerCase().includes(searchTerm) ||
                              spot.crew.toLowerCase().includes(searchTerm);
        
        const matchesType = filterType === 'all' || spot.type === filterType;

        return matchesSearch && matchesType;
    });

    renderSpotCards(filteredSpots);
    renderMapMarkers(filteredSpots);
}

function renderSpotCards(spotList) {
    const grid = document.getElementById('spotGrid');
    if (!grid) return;
    grid.innerHTML = '';

    spotList.forEach(spot => {
        const isFavorite = userFavorites.includes(spot.id);
        const favIcon = isFavorite ? 'heart-handshake' : 'heart';
        const card = document.createElement('div');
        card.className = 'spot-card bg-white p-4 rounded-xl shadow-lg border border-gray-200 flex flex-col hover:border-accent cursor-pointer';
        card.innerHTML = `
            <img src="${spot.image}" onerror="this.onerror=null;this.src='https://placehold.co/800x500/e5e7eb/9ca3af?text=Image+Unavailable'" alt="${spot.name}" class="w-full h-32 object-cover rounded-lg mb-4">
            <h3 class="text-xl font-semibold mb-1 truncate text-gray-900">${spot.name}</h3>
            <p class="text-sm text-gray-500 mb-3">${spot.city}, ${spot.country} (${spot.type})</p>
            <p class="text-gray-700 text-sm flex-grow mb-4 line-clamp-3">${spot.about}</p>
            <div class="flex justify-between items-center mt-auto">
                <button class="btn-secondary py-1.5 px-3 text-sm flex items-center space-x-1 spot-details-btn" data-spot-id="${spot.id}">
                    <i data-lucide="info" class="w-4 h-4"></i> <span>Details</span>
                </button>
                <button class="text-gray-500 hover:text-red-500 transition spot-favorite-btn" data-spot-id="${spot.id}">
                    <i data-lucide="${favIcon}" class="w-5 h-5 ${isFavorite ? 'text-red-500 fill-red-500' : ''}"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    // MODIFICATION: Add event listeners for new buttons
    grid.querySelectorAll('.spot-details-btn').forEach(btn => {
        btn.addEventListener('click', () => showSpotModal(btn.dataset.spotId));
    });
    grid.querySelectorAll('.spot-favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleFavorite(btn.dataset.spotId, e));
    });


    lucide.createIcons(); // Re-render icons after adding cards
}

// Make global
// window.toggleFavorite = function(spotId, event) {
// MODIFICATION: Removed window. assignment, added function keyword
function toggleFavorite(spotId, event) {
    event.stopPropagation(); // Prevent the card click/modal from triggering
    const index = userFavorites.indexOf(spotId);
    let action = '';

    if (index > -1) {
        userFavorites.splice(index, 1);
        action = 'unfavorited';
    } else {
        userFavorites.push(spotId);
        action = 'favorited';
        // Check for 'First Favorite' achievement
        if (userFavorites.length === 1 && !userAchievements.includes('First Favorite')) {
             userAchievements.push('First Favorite');
             logActivity(`Achieved: First Favorite!`);
        }
    }

    const spot = spots.find(s => s.id === spotId);
    logActivity(`${action} the spot: ${spot.name}`);

    saveUserData();
}


/* --- MODAL LOGIC --- */

// Make global
// window.showModal = function(id) {
// MODIFICATION: Removed window. assignment, added function keyword
function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
}

// Make global
// window.closeModal = function(id) {
// MODIFICATION: Removed window. assignment, added function keyword
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
}

// Make global
// window.showSpotModal = function(spotId) {
// MODIFICATION: Removed window. assignment, added function keyword
function showSpotModal(spotId) {
    const spot = spots.find(s => s.id === spotId);
    if (!spot) return;

    // Update main spot details
    document.getElementById('spotModalTitle').textContent = spot.name;
    document.getElementById('spotModalImage').src = spot.image;
    document.getElementById('spotModalDetails').textContent = spot.about;
    document.getElementById('spotModalType').textContent = spot.type;
    document.getElementById('spotModalCrew').textContent = spot.crew;

    // Update favorite button state
    const isFavorite = userFavorites.includes(spotId);
    const favBtn = document.getElementById('spotModalFavoriteBtn');
    favBtn.dataset.spotId = spotId;
    favBtn.innerHTML = isFavorite 
        ? `<i data-lucide="heart-handshake" class="w-5 h-5 fill-red-500"></i> <span>Favorited</span>` 
        : `<i data-lucide="heart" class="w-5 h-5"></i> <span>Favorite</span>`;
    favBtn.onclick = (e) => {
        toggleFavorite(spotId, e);
        closeModal('spotModal'); // Close after favoriting
    };

    // Update share button
    const shareBtn = document.getElementById('spotModalShareBtn');
    shareBtn.dataset.spotId = spotId;
    shareBtn.onclick = () => shareSpot(spotId);

    // Render reviews
    const reviewList = document.getElementById('spotModalReviews');
    reviewList.innerHTML = spot.reviews.map(r => `
        <li class="p-3 bg-gray-100 rounded-lg border border-gray-200">
            <div class="text-yellow-500 text-lg">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <p class="text-sm mt-1 text-gray-800">${r.text}</p>
        </li>
    `).join('');
    if (spot.reviews.length === 0) {
        reviewList.innerHTML = '<li class="text-gray-500 italic">No reviews yet.</li>';
    }

    // Render 'Add to Collection' buttons
    const collectionAddButtons = document.getElementById('collectionAddButtons');
    collectionAddButtons.innerHTML = '';
    
    Object.entries(userCollections).forEach(([id, collection]) => {
        const isSpotInCollection = collection.spotIds.includes(spotId);
        const btn = document.createElement('button');
        btn.className = isSpotInCollection ? 'btn-primary py-1.5 px-3 text-xs' : 'btn-secondary py-1.5 px-3 text-xs';
        btn.textContent = isSpotInCollection ? `${collection.name} (Added)` : collection.name;
        btn.disabled = isSpotInCollection;
        btn.onclick = () => toggleSpotInCollection(spotId, id, true);
        collectionAddButtons.appendChild(btn);
    });

    // Add listener for collection button click
    lucide.createIcons();
    showModal('spotModal');
}

function shareSpot(spotId) {
    const spot = spots.find(s => s.id === spotId);
    if (!spot) return;
    const shareText = `Check out this breaking spot: ${spot.name} in ${spot.city}, ${spot.country}! Details: ${spot.about}`;

    if (navigator.share) {
        navigator.share({
            title: 'BreakAtlas Spot',
            text: shareText,
            url: window.location.href // Use current URL as a fallback/context
        }).then(() => {
            logActivity(`Shared spot: ${spot.name}`);
        }).catch((error) => {
            console.error('Sharing failed', error);
        });
    } else {
        // Fallback for browsers without Web Share API (like Canvas)
        showSharePopup(spot.name, shareText);
    }
}

function showSharePopup(title, text) {
    const popup = document.getElementById('sharePopup');
    const linksDiv = document.getElementById('sharePopupLinks');
    linksDiv.innerHTML = `
        <p class="text-sm text-gray-500">Copy the text below:</p>
        <textarea class="w-full h-24 p-2 bg-gray-100 rounded-lg text-gray-800 border border-gray-300" readonly>${text}</textarea>
        <button id="copyShareLinkBtn" class="btn-primary w-full text-sm">Copy Link Text</button>
    `;
    // MODIFICATION: Add event listener for copy button
    document.getElementById('copyShareLinkBtn').addEventListener('click', () => copyToClipboard(text.replace(/'/g, "\\'")));
    popup.classList.remove('hidden');
}

// Make global
// window.closeSharePopup = function() {
// MODIFICATION: Removed window. assignment, added function keyword
function closeSharePopup() {
    document.getElementById('sharePopup').classList.add('hidden');
}

// Make global
// window.copyToClipboard = function(text) {
// MODIFICATION: Removed window. assignment, added function keyword
function copyToClipboard(text) {
    // Standard clipboard API not reliable in all iframes, so use execCommand fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        alertUser('Copied to clipboard!', 'success'); // Simple user feedback
    } catch (err) {
        console.error('Failed to copy text', err);
        alertUser('Failed to copy text.', 'error');
    }
    document.body.removeChild(textarea);
}

function alertUser(message, type = 'info') {
    // Since we cannot use alert(), this is a placeholder for a better UI notification system
    console.log(`[Alert] ${type.toUpperCase()}: ${message}`);
}

/* --- COLLECTION MANAGEMENT (MODAL INTEGRATION) --- */

// Make global
// window.showCollectionModal = function(mode, collectionId = null) {
// MODIFICATION: Removed window. assignment, added function keyword
function showCollectionModal(mode, collectionId = null) {
    const titleEl = document.getElementById('collectionModalTitle');
    const nameInput = document.getElementById('collectionNameInput');
    const descInput = document.getElementById('collectionDescriptionInput');
    const idInput = document.getElementById('collectionIdInput');
    const confirmBtn = document.getElementById('collectionModalConfirmBtn');

    if (mode === 'create') {
        titleEl.textContent = 'Create New Collection';
        nameInput.value = '';
        descInput.value = '';
        idInput.value = '';
        confirmBtn.textContent = 'Create Collection';
        confirmBtn.onclick = () => handleCollectionAction('create');
    } else if (mode === 'edit' && collectionId) {
        const collection = userCollections[collectionId];
        if (!collection) return;
        titleEl.textContent = `Edit Collection: ${collection.name}`;
        nameInput.value = collection.name;
        descInput.value = collection.description || '';
        idInput.value = collectionId;
        confirmBtn.textContent = 'Save Changes';
        confirmBtn.onclick = () => handleCollectionAction('edit', collectionId);
    }

    showModal('collectionModal');
}

// Make global
// window.showDeleteModal = function(collectionId) {
// MODIFICATION: Removed window. assignment, added function keyword
function showDeleteModal(collectionId) {
    const collection = userCollections[collectionId];
    if (!collection) return;

    document.getElementById('deleteModalCollectionName').textContent = collection.name;
    const confirmBtn = document.getElementById('deleteModalConfirmBtn');
    confirmBtn.onclick = () => handleCollectionAction('delete', collectionId);

    showModal('deleteModal');
}

function handleCollectionAction(action, collectionId = null) {
    const nameInput = document.getElementById('collectionNameInput');
    const descInput = document.getElementById('collectionDescriptionInput');

    if (action === 'create' || action === 'edit') {
        const name = nameInput.value.trim();
        const description = descInput.value.trim();

        if (!name) {
            alertUser('Collection name cannot be empty.', 'error');
            return;
        }

        if (action === 'create') {
            const newId = crypto.randomUUID(); // Generate unique ID
            userCollections[newId] = {
                name: name,
                description: description,
                spotIds: [],
                createdAt: new Date().toISOString()
            };
            logActivity(`Created collection: ${name}`);
        } else if (action === 'edit' && collectionId) {
            userCollections[collectionId].name = name;
            userCollections[collectionId].description = description;
            logActivity(`Edited collection: ${name}`);
        }
    } else if (action === 'delete' && collectionId) {
        const name = userCollections[collectionId]?.name || 'Unknown Collection';
        delete userCollections[collectionId];
        logActivity(`Deleted collection: ${name}`);
    } else {
        return;
    }

    saveUserData();
    closeModal('collectionModal');
    closeModal('deleteModal');
    renderProfileView(); // Re-render collections section
}

/**
 * Adds or removes a spot from a collection. Called from spot modal.
 */
function toggleSpotInCollection(spotId, collectionId) {
    const collection = userCollections[collectionId];
    if (!collection) return;

    const index = collection.spotIds.indexOf(spotId);
    let action = '';

    if (index > -1) {
        collection.spotIds.splice(index, 1);
        action = 'Removed from';
    } else {
        collection.spotIds.push(spotId);
        action = 'Added to';
    }
    
    // Update local state (which is then saved)
    userCollections[collectionId] = collection; 
    
    const spot = spots.find(s => s.id === spotId);
    logActivity(`${action} collection: ${collection.name} spot: ${spot.name}`);

    saveUserData();
    
    // Update the spot modal buttons and close
    closeModal('spotModal');
}


/* --- PROFILE VIEW RENDERING --- */

function renderProfileView() {
    renderCollections();
    renderActivityFeed();
    renderChart();
    renderAchievements();
}

function renderCollections() {
    const container = document.getElementById('profileCollections');
    const noMessage = document.getElementById('noCollectionsMessage');
    container.innerHTML = '';
    
    const collectionEntries = Object.entries(userCollections);

    if (collectionEntries.length === 0) {
        noMessage.classList.remove('hidden');
        return;
    }
    noMessage.classList.add('hidden');

    collectionEntries.sort(([, a], [, b]) => new Date(b.createdAt) - new Date(a.createdAt));

    collectionEntries.forEach(([id, collection]) => {
        const card = document.createElement('div');
        card.className = 'collection-card bg-gray-50 p-4 rounded-xl shadow-md border border-gray-200 space-y-2';
        card.innerHTML = `
            <h4 class="text-lg font-semibold truncate" style="color: var(--accent);">${collection.name}</h4>
            <p class="text-sm text-gray-500">${collection.spotIds.length} Spots</p>
            <p class="text-xs text-gray-600 line-clamp-2">${collection.description || 'No description provided.'}</p>
            <div class="flex justify-end space-x-2 mt-3">
                <button class="text-gray-500 hover:text-gray-900 transition collection-edit-btn" data-id="${id}">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                </button>
                <button class="text-red-500 hover:text-red-700 transition collection-delete-btn" data-id="${id}">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
    // MODIFICATION: Add event listeners for collection buttons
    container.querySelectorAll('.collection-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => showCollectionModal('edit', btn.dataset.id));
    });
    container.querySelectorAll('.collection-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => showDeleteModal(btn.dataset.id));
    });

    lucide.createIcons();
}

function renderActivityFeed() {
    const container = document.getElementById('profileActivity');
    const noMessage = document.getElementById('noActivityMessage');
    container.innerHTML = '';

    if (userActivityFeed.length === 0) {
        noMessage.classList.remove('hidden');
        return;
    }
    noMessage.classList.add('hidden');

    userActivityFeed.forEach(activity => {
        const item = document.createElement('li');
        const timeAgo = new Date(activity.timestamp).toLocaleTimeString();
        item.className = 'p-3 bg-gray-50 rounded-lg text-sm flex justify-between items-center border border-gray-200';
        item.innerHTML = `
            <span class="text-gray-700">${activity.message}</span>
            <span class="text-xs text-gray-500">${timeAgo}</span>
        `;
        container.appendChild(item);
    });
}

function renderAchievements() {
    const container = document.getElementById('profileAchievements');
    container.innerHTML = '';
    
    // Define all possible achievements
    const allAchievements = [
        { id: 'First Favorite', name: 'First Favorite', desc: 'Favorited your first spot.', icon: 'award' },
        { id: 'Explorer V', name: 'Explorer V', desc: 'Favorited 5 spots.', icon: 'map-pin' },
        { id: 'Collection Creator', name: 'Collection Creator', desc: 'Created your first collection.', icon: 'folder-open' },
    ];
    
    allAchievements.forEach(ach => {
        const achieved = userAchievements.includes(ach.id);
        const card = document.createElement('div');
        card.className = `p-3 rounded-lg flex items-center space-x-3 transition duration-300 ${achieved ? 'bg-green-100 border-2 border-green-300' : 'bg-gray-100 border-2 border-gray-200'}`;
        card.innerHTML = `
            <i data-lucide="${ach.icon}" class="w-6 h-6 ${achieved ? 'text-green-600' : 'text-gray-400'}"></i>
            <div>
                <h4 class="font-semibold text-sm ${achieved ? 'text-gray-900' : 'text-gray-700'}">${ach.name}</h4>
                <p class="text-xs ${achieved ? 'text-green-700' : 'text-gray-500'}">${ach.desc}</p>
            </div>
        `;
        container.appendChild(card);
    });
    lucide.createIcons();
}


/* --- STATS CHART LOGIC --- */

// Make global
// window.toggleChartType = function() {
// MODIFICATION: Removed window. assignment, added function keyword
function toggleChartType() {
    chartType = !chartType;
    localStorage.setItem("chartType", chartType ? 'pie' : 'bar');
    document.getElementById('chartToggleLabel').textContent = chartType ? 'Switch to Bar Chart' : 'Switch to Pie Chart';
    renderChart();
}

function countType(type) {
    // Count how many favorited spots are of a given type
    return userFavorites.filter(spotId => {
        const spot = spots.find(s => s.id === spotId);
        return spot && spot.type === type;
    }).length;
}

function renderChart() {
    const canvas = document.getElementById('typeDistributionChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

    const usePie = chartType;
    
    // Data for the chart
    const data = [
        { label: "Jam", value: countType("Jam"), color: "#ff9f1c" },
        { label: "Cypher", value: countType("Cypher"), color: "#1e88e5" },
        { label: "Training", value: countType("Training"), color: "#2ec4b6" },
    ];
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

    // Chart Settings
    ctx.fillStyle = "#1f2937"; // text-gray-800
    ctx.font = "14px Inter";
    
    if (total === 1) { // Handle case with no favorites
        ctx.textAlign = "center";
        ctx.fillText("Favorite spots to see your stats!", canvas.width / 2, canvas.height / 2);
        return;
    }


    if (!usePie) {
        // Bar chart
        const margin = 40;
        const chartAreaWidth = canvas.width - (2 * margin);
        const barWidth = Math.max(50, (chartAreaWidth / data.length) * 0.6);
        const gap = (chartAreaWidth - (barWidth * data.length)) / (data.length - 1);
        let x = margin;
        const chartHeight = 180;
        const maxVal = Math.max(...data.map(d => d.value)) || 1;
        const scale = chartHeight / maxVal;
        const yBase = 220; // Y coordinate for the base of the bars

        data.forEach(d => {
            const h = d.value * scale;
            
            // Draw bar
            ctx.fillStyle = d.color;
            ctx.fillRect(x, yBase - h, barWidth, h);

            // Draw labels
            ctx.fillStyle = "#1f2937";
            ctx.textAlign = "center";
            ctx.fillText(`${d.label}`, x + barWidth / 2, yBase + 20);
            ctx.fillText(`(${d.value})`, x + barWidth / 2, yBase + 40);
            
            x += barWidth + gap;
        });
    } else {
        // Pie chart
        let start = 0;
        const cx = canvas.width / 2;
        const cy = 130;
        const r = 100;
        let legendY = 240;

        data.forEach(d => {
            if (d.value === 0) return; // Skip slices with zero value
            
            const angle = (d.value / total) * Math.PI * 2;
            
            // Draw arc
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, start, start + angle);
            ctx.closePath();
            ctx.fillStyle = d.color;
            ctx.fill();

            // Calculate mid-point angle for text placement (simplified legend placement for space)
            const midAngle = start + angle / 2;
            const labelX = cx + Math.cos(midAngle) * (r * 0.7);
            const labelY = cy + Math.sin(midAngle) * (r * 0.7);
            
            // Draw legend key
            ctx.fillStyle = d.color;
            ctx.fillRect(cx - 120, legendY - 10, 10, 10);
            
            // Draw legend text
            ctx.fillStyle = "#1f2937";
            ctx.textAlign = "left";
            const percent = ((d.value / total) * 100).toFixed(0);
            ctx.fillText(`${d.label}: ${d.value} (${percent}%)`, cx - 105, legendY);
            legendY += 20;

            start += angle;
        });
    }
}


/* --- COMMUNITY VIEWS --- */

// The mock data is used for the community view to give a consistent, full experience.

function renderLeaderboard() {
    const container = document.getElementById('leaderboard');
    if (!container) return;
    container.innerHTML = '';
    
    // Sort mock data by favorites count
    const sortedLeaders = [...mockLeaderboardData].sort((a, b) => b.favoritesCount - a.favoritesCount);

    sortedLeaders.forEach((leader, index) => {
        const card = document.createElement('div');
        card.className = 'p-4 bg-white rounded-xl flex items-center justify-between shadow-md border border-gray-200';
        card.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="text-2xl font-bold" style="color: var(--accent);">${index + 1}.</span>
                <div class="font-medium">
                    <p class="text-lg text-gray-900">${leader.username}</p>
                    <p class="text-sm text-gray-500">Total Favorites</p>
                </div>
            </div>
            <span class="text-2xl font-bold text-gray-900">${leader.favoritesCount}</span>
        `;
        container.appendChild(card);
    });
}

function renderHallOfFame() {
    const container = document.getElementById('hallOfFame');
    if (!container) return;
    container.innerHTML = '';

    // Sort mock data by total favorites
    const sortedFame = [...mockHallOfFame].sort((a, b) => b.favorites - a.favorites);

    sortedFame.forEach((fame, index) => {
        const spot = spots.find(s => s.id === fame.spotId);
        if (!spot) return;

        const card = document.createElement('div');
        card.className = 'p-4 bg-white rounded-xl flex items-center justify-between shadow-md border border-gray-200';
        card.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="text-2xl font-bold" style="color: var(--accent);">${index + 1}.</span>
                <div class="font-medium">
                    <p class="text-lg text-gray-900 truncate max-w-[150px]">${spot.name}</p>
                    <p class="text-sm text-gray-500">${spot.city}</p>
                </div>
            </div>
            <div class="text-right">
                <span class="text-2xl font-bold text-gray-900">${fame.favorites}</span>
                <p class="text-sm text-gray-500">Favs</p>
            </div>
        `;
        container.appendChild(card);
    });
}


/* --- STORY MODE LOGIC --- */

let currentSlide = 0;

function bindStoryModeEvents() {
    document.getElementById('prevSlide').addEventListener('click', () => changeSlide(-1));
    document.getElementById('nextSlide').addEventListener('click', () => changeSlide(1));
    renderStorySlides();
}

function renderStorySlides() {
    const slidesContainer = document.getElementById('storySlides');
    if (!slidesContainer) return;
    slidesContainer.innerHTML = '';

    storySlidesData.forEach((slide, index) => {
        const slideEl = document.createElement('div');
        slideEl.className = 'story-slide p-6 rounded-lg text-center transition-opacity duration-500 ' + 
                            (index === currentSlide ? 'opacity-100' : 'opacity-0 absolute top-0 w-full');
        slideEl.style.display = index === currentSlide ? 'block' : 'none'; // Initial display control

        slideEl.innerHTML = `
            <img src="${slide.image}" alt="${slide.title}" class="w-full h-48 object-cover rounded-lg mb-6 shadow-xl mx-auto border border-gray-200">
            <h3 class="text-2xl font-bold mb-3 text-gray-900" style="color: var(--accent);">${slide.title}</h3>
            <p class="text-gray-700 text-lg">${slide.text}</p>
        `;
        slidesContainer.appendChild(slideEl);
    });
    
    updateStoryControls();
}

function changeSlide(direction) {
    const slides = document.querySelectorAll('.story-slide');
    if (slides.length === 0) return;

    // Hide current slide
    slides[currentSlide].style.display = 'none';
    slides[currentSlide].classList.remove('opacity-100');
    slides[currentSlide].classList.add('opacity-0');

    currentSlide = (currentSlide + direction + slides.length) % slides.length;

    // Show new slide
    slides[currentSlide].style.display = 'block';
    setTimeout(() => {
        slides[currentSlide].classList.remove('opacity-0');
        slides[currentSlide].classList.add('opacity-100');
    }, 10); // Small delay for transition effect

    updateStoryControls();
}

function updateStoryControls() {
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    
    // Disable/Enable buttons based on slide position
    prevBtn.disabled = currentSlide === 0;
    nextBtn.disabled = currentSlide === storySlidesData.length - 1;

    // Style disabled buttons
    prevBtn.classList.toggle('opacity-50', prevBtn.disabled);
    nextBtn.classList.toggle('opacity-50', nextBtn.disabled);
}


/* --- DOM ready: init map, render cards, bind events --- */
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initFirebase(); // Starts the auth/data flow
    initMap();
    
    // Initial content rendering (will be updated by onSnapshot once Firebase loads)
    renderSpotCards(spots); 
    renderProfileView(); 

    bindDashboardEvents();
    bindStoryModeEvents();
    // MODIFICATION: Call new function to bind all global event listeners
    bindGlobalEventListeners();
    
    // Initial view setup
    showView('dashboard'); 
    
    // Ensure icons are created after everything is initialized
    lucide.createIcons();
});

// MODIFICATION: New function to bind all event listeners previously inline
function bindGlobalEventListeners() {
    // Nav
    document.getElementById('menuToggle').addEventListener('click', () => toggleMenu(false));
    document.querySelectorAll('.nav-trigger').forEach(link => {
        link.addEventListener('click', (e) => showView(e.currentTarget.dataset.view));
    });
    document.querySelectorAll('.mobile-nav-trigger').forEach(link => {
        link.addEventListener('click', (e) => {
            showView(e.currentTarget.dataset.view);
            toggleMenu(true); // Force close
        });
    });

    // Profile
    document.getElementById('toggleChartButton').addEventListener('click', toggleChartType);
    document.getElementById('createCollectionButton').addEventListener('click', () => showCollectionModal('create'));

    // Modals
    document.getElementById('closeSpotModal').addEventListener('click', () => closeModal('spotModal'));
    document.getElementById('closeCollectionModal').addEventListener('click', () => closeModal('collectionModal'));
    document.getElementById('cancelCollectionModal').addEventListener('click', () => closeModal('collectionModal'));
    document.getElementById('cancelDeleteModal').addEventListener('click', () => closeModal('deleteModal'));
    document.getElementById('closeSharePopup').addEventListener('click', closeSharePopup);
}