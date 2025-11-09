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
  arrayRemove,
  collection,
  query,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// === EXTERNAL LIBRARIES ===
// FIX: Leaflet object 'L' is loaded globally by a non-module script in index.html.
// We grab it from the window scope to ensure access within this module,
// resolving the 'L.divIcon is not a function' error.
const L = window.L; 

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
    console.log("Firebase initialized.");
    // Set Firestore debug level
    // setLogLevel('Debug'); // Uncomment for debugging
    
    // Auth Listener and Sign-in
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            console.log("User signed in with UID:", userId);
            
            // 1. Load user data from Firestore
            userDocRef = doc(db, `artifacts/${appId}/users/${userId}/data`, "profile");
            await loadUserData();

            // 2. Start all real-time listeners and render views
            startListenersAndRender();

        } else {
            console.log("User signed out or not authenticated.");
            // If sign-in failed or user is signed out, use an anonymous session
            // and a random UUID as fallback, but only Firestore functions
            // will work for the 'public' path based on security rules.
            userId = crypto.randomUUID();
            userDocRef = null;
            
            // Still try to render based on static data/local data
            startListenersAndRender(); 
        }

        // Only run initial sign-in logic if a token exists and we don't have a user yet
        if (!user && initialAuthToken) {
            try {
                // If custom token exists, sign in
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Signed in with custom token.");
            } catch (error) {
                console.error("Custom token sign-in failed. Signing in anonymously.", error);
                await signInAnonymously(auth);
            }
        } else if (!user && !initialAuthToken) {
            // No custom token, sign in anonymously for a unique userId
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        }
    });

} catch (e) {
    console.error("Firebase initialization failed:", e);
}


/* Global App State and Constants */
let map;
let markers = [];
let currentView = "dashboard";
let globalUserData = {
    favorites: [], // spotId array
    collections: {}, // { name: [spotId, ...] }
    activityFeed: [], // [{ timestamp, message }]
    achievements: [], // [achievementId, ...]
    globalStats: { // Calculated or stored stats
        jamsVisited: 0,
        cyphersAttended: 0,
        uniqueCities: 0,
        uniqueCountries: 0,
        totalReviews: 0,
    }
};

const STAT_LABELS = {
    jamsVisited: "Jams Visited",
    cyphersAttended: "Cyphers Attended",
    uniqueCities: "Unique Cities",
    uniqueCountries: "Unique Countries",
    totalReviews: "Total Reviews",
};

// Color settings (read from local storage/theme logic)
let themeColor = localStorage.getItem("themeColor") || "#ff9f1c";
// Update the :root variable for themeing
document.documentElement.style.setProperty("--accent", themeColor);
// A slightly darker hover state for primary buttons
document.documentElement.style.setProperty("--accent-hover", adjustColor(themeColor, -20));


/* ====================================
   DATA & STORAGE (FIREBASE/FIRESTORE)
   ==================================== */

// Helper to calculate initial stats from current data
function calculateInitialStats(userData) {
    const favorites = userData.favorites || [];
    const visitedSpotIds = new Set(favorites); // Assuming favoriting means "visiting" for stats
    
    let stats = {
        jamsVisited: 0,
        cyphersAttended: 0,
        uniqueCities: new Set(),
        uniqueCountries: new Set(),
        totalReviews: 0,
    };

    visitedSpotIds.forEach(id => {
        const spot = spots.find(s => s.id === id);
        if (spot) {
            if (spot.type === 'Jam') {
                stats.jamsVisited++;
            } else if (spot.type === 'Cypher Jam') {
                stats.cyphersAttended++;
            }
            stats.uniqueCities.add(spot.city);
            stats.uniqueCountries.add(spot.country);
        }
    });

    // Count reviews
    spots.forEach(spot => {
        spot.reviews.forEach(review => {
            // Assuming for a real app, reviews would be linked to the current user's ID
            // Here, we just count them if a user has favorited the spot.
            if (favorites.includes(spot.id)) {
                stats.totalReviews++;
            }
        });
    });

    return {
        jamsVisited: stats.jamsVisited,
        cyphersAttended: stats.cyphersAttended,
        uniqueCities: stats.uniqueCities.size,
        uniqueCountries: stats.uniqueCountries.size,
        totalReviews: stats.totalReviews,
    };
}


/**
 * Loads user data from Firestore and sets globalUserData.
 */
async function loadUserData() {
    if (!userDocRef) {
        console.warn("Cannot load user data: userDocRef is null.");
        return;
    }
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("User data loaded from Firestore:", data);
            globalUserData = {
                favorites: data.favorites || [],
                collections: data.collections || {},
                activityFeed: data.activityFeed || [],
                achievements: data.achievements || [],
                globalStats: data.globalStats || calculateInitialStats(data),
            };
        } else {
            // Document does not exist, create it with initial data
            console.log("No user document found. Creating initial profile.");
            globalUserData.globalStats = calculateInitialStats(globalUserData);
            await setDoc(userDocRef, globalUserData);
        }
    } catch (e) {
        console.error("Error loading user data:", e);
    }
}

/**
 * Persists current globalUserData to Firestore.
 */
async function saveUserData() {
    if (!userDocRef) {
        console.warn("Cannot save user data: userDocRef is null.");
        return;
    }
    try {
        // Recalculate stats before saving
        globalUserData.globalStats = calculateInitialStats(globalUserData);
        await setDoc(userDocRef, globalUserData, { merge: true });
        console.log("User data saved to Firestore.");
    } catch (e) {
        console.error("Error saving user data:", e);
    }
}

/**
 * Initializes real-time listener for user profile.
 */
function startListenersAndRender() {
    // Clear previous listener
    userUnsubscribe(); 

    if (userDocRef) {
        // Set up new listener for real-time updates
        userUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                globalUserData = {
                    favorites: data.favorites || [],
                    collections: data.collections || {},
                    activityFeed: data.activityFeed || [],
                    achievements: data.achievements || [],
                    globalStats: data.globalStats || calculateInitialStats(data),
                };
                console.log("Real-time profile update received.");
                renderAllViews();
            } else {
                 console.log("User document disappeared. Re-initializing.");
                 // Re-create the document if it somehow got deleted
                 saveUserData();
                 renderAllViews();
            }
        }, (error) => {
            console.error("Firestore listen failed:", error);
        });
    } else {
        // If we failed to get a userDocRef (e.g., failed anonymous sign-in, though unlikely)
        console.warn("No user document reference for listener. Rendering views based on current state.");
        renderAllViews();
    }
    
    // Also render the map and spots initially based on static data
    updateMapMarkers(spots);
}


/**
 * Logs an activity message and saves it to Firestore.
 * @param {string} message 
 */
function logActivity(message) {
    const activity = {
        timestamp: Date.now(),
        message: message
    };
    // Use arrayUnion to ensure the activity is only added, not overwritten
    if (userDocRef) {
        updateDoc(userDocRef, {
            activityFeed: arrayUnion(activity)
        }).then(() => {
            console.log("Activity logged:", message);
        }).catch(e => {
            console.error("Error logging activity:", e);
        });
    } else {
        console.warn("Activity not logged (no userDocRef):", message);
    }
}

/**
 * Toggles a spot's favorite status.
 * @param {string} spotId 
 */
function toggleFavorite(spotId) {
    if (!auth.currentUser) {
        showCustomAlert("Authentication Required", "Please ensure you are logged in (even anonymously) to use the favorites feature.");
        return;
    }

    const isFav = globalUserData.favorites.includes(spotId);
    
    const updateAction = isFav ? arrayRemove(spotId) : arrayUnion(spotId);
    const logMsg = isFav ? `Removed ${spotId} from Favorites.` : `Added ${spotId} to Favorites!`;
    
    // Perform update on Firestore
    if (userDocRef) {
        updateDoc(userDocRef, {
            favorites: updateAction
        }).then(() => {
            logActivity(logMsg);
            // State will be updated via onSnapshot listener
        }).catch(e => {
            console.error("Error toggling favorite:", e);
            showCustomAlert("Error", "Could not update favorites in the database.");
        });
    } else {
        showCustomAlert("Error", "User profile not ready or not authenticated.");
    }
}


/* ====================================
   UTILITY FUNCTIONS
   ==================================== */

/**
 * Adjusts color brightness (simple implementation).
 * @param {string} hex - The hex color code.
 * @param {number} percent - Percentage to lighten (positive) or darken (negative).
 * @returns {string} New hex color.
 */
function adjustColor(hex, percent) {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = Math.min(255, R + Math.floor(R * (percent / 100)));
    G = Math.min(255, G + Math.floor(G * (percent / 100)));
    B = Math.min(255, B + Math.floor(B * (percent / 100)));

    const toHex = (c) => c.toString(16).padStart(2, '0');

    return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
}

/**
 * Custom alert/modal system (replaces browser alerts).
 * @param {string} title 
 * @param {string} message 
 */
function showCustomAlert(title, message) {
    const alertModal = document.getElementById('alertModal');
    if (!alertModal) return; // Guard against missing modal

    document.getElementById('alertModalTitle').textContent = title;
    document.getElementById('alertModalMessage').textContent = message;
    alertModal.classList.remove('hidden');
    alertModal.classList.add('flex'); // Show the modal
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden'); // Hide the modal
    }
}

/**
 * Finds a spot by ID.
 * @param {string} id 
 * @returns {object|undefined}
 */
function findSpot(id) {
    return spots.find(spot => spot.id === id);
}

/**
 * Creates a star rating HTML string.
 * @param {number} rating - The rating value (e.g., 4.5).
 * @returns {string} HTML string of star icons.
 */
function createStarRating(rating) {
    const maxRating = 5;
    let stars = '';
    const fullStar = `<i data-lucide="star" class="w-4 h-4 text-yellow-400 fill-yellow-400"></i>`;
    const halfStar = `<i data-lucide="star-half" class="w-4 h-4 text-yellow-400 fill-yellow-400"></i>`;
    const emptyStar = `<i data-lucide="star" class="w-4 h-4 text-gray-600"></i>`;

    for (let i = 1; i <= maxRating; i++) {
        if (rating >= i) {
            stars += fullStar;
        } else if (rating > i - 1 && rating < i) {
            stars += halfStar;
        } else {
            stars += emptyStar;
        }
    }
    // Feather icons need to be dynamically replaced, so we use lucide icons which are similar
    // We will call lucide.createIcons() after updating the DOM.
    return `<span class="flex items-center space-x-0.5">${stars}</span>`;
}

/**
 * Formats a timestamp into a readable date/time string.
 * @param {number} timestamp - Milliseconds since epoch.
 * @returns {string} Formatted date/time.
 */
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}


/* ====================================
   VIEW & DOM RENDERING LOGIC
   ==================================== */

/**
 * Shows the requested view and hides all others.
 * @param {string} viewId - The ID of the view to show (e.g., 'dashboard').
 */
function showView(viewId) {
    currentView = viewId;
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });
    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.style.display = 'block';
    }
    // Close the mobile menu on view change
    document.getElementById('navLinks').classList.remove('flex'); 
    document.getElementById('navLinks').classList.add('hidden'); // Ensure it is hidden

    // Re-render the map view on switch to ensure it initializes correctly
    if (viewId === 'dashboard') {
        if (map) {
            setTimeout(() => { // Small delay often needed for Leaflet to recalculate size
                map.invalidateSize(); 
                updateMapMarkers(spots); // Refresh markers
            }, 50);
        } else {
            initMap();
        }
    }
}

/**
 * Renders all dynamic sections of the app (called after any state update).
 */
function renderAllViews() {
    renderSpots(spots); // Re-renders the map and the card grid
    renderProfile();
    renderLeaderboard();
    renderHallOfFame();
    renderGlobalStats();
    renderChallenges();
}

/**
 * Creates the HTML content for a single spot card.
 * @param {object} spot 
 * @returns {string} HTML string.
 */
function createSpotCard(spot) {
    const isFavorite = globalUserData.favorites.includes(spot.id);
    const favClass = isFavorite ? 'text-red-500 fill-red-500' : 'text-gray-400';
    const avgRating = spot.reviews.length > 0
        ? (spot.reviews.reduce((sum, r) => sum + r.rating, 0) / spot.reviews.length).toFixed(1)
        : 'N/A';

    return `
        <div class="spot-card bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700 transition hover:shadow-2xl">
            <div class="h-40 overflow-hidden relative">
                <img src="${spot.image}" alt="${spot.name}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/800x500/1f2937/d1d5db?text=Image+Not+Found';" />
                <span class="absolute top-2 left-2 px-3 py-1 bg-gray-900/70 text-sm font-semibold rounded-full text-white">${spot.type}</span>
            </div>
            <div class="p-4 space-y-3">
                <h3 class="text-xl font-bold text-white">${spot.name}</h3>
                <p class="text-gray-400 text-sm">${spot.city}, ${spot.country}</p>
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-1 text-sm">
                        ${createStarRating(parseFloat(avgRating) || 0)}
                        <span class="font-semibold text-yellow-400">${avgRating}</span>
                        <span class="text-gray-500">(${spot.reviews.length} reviews)</span>
                    </div>
                    <button 
                        class="p-2 rounded-full hover:bg-gray-700 transition"
                        onclick="toggleFavorite('${spot.id}')"
                        aria-label="Toggle Favorite"
                    >
                        <i data-lucide="heart" class="w-5 h-5 ${favClass}"></i>
                    </button>
                </div>
                <p class="text-gray-300 text-sm line-clamp-2">${spot.about}</p>
                <button 
                    onclick="openSpotModal('${spot.id}')" 
                    class="btn-primary w-full text-sm mt-3"
                >
                    View Details
                </button>
            </div>
        </div>
    `;
}

/**
 * Renders the full list of spot cards based on the search/filter criteria.
 * @param {Array<object>} spotList 
 */
function renderSpots(spotList) {
    const gridElement = document.getElementById('spotsGrid');
    if (!gridElement) return;

    const query = document.getElementById('searchBar')?.value.toLowerCase() || '';
    const filteredSpots = spotList.filter(spot => 
        spot.name.toLowerCase().includes(query) ||
        spot.city.toLowerCase().includes(query) ||
        spot.country.toLowerCase().includes(query) ||
        spot.type.toLowerCase().includes(query)
    );

    gridElement.innerHTML = filteredSpots.map(createSpotCard).join('');
    
    // Important: Render Lucide icons after DOM update
    lucide.createIcons(); 
    
    // Update map markers to match the filtered list
    updateMapMarkers(filteredSpots);
}


/* ====================================
   MAP LOGIC (LEAFLET)
   ==================================== */

/**
 * Initializes the Leaflet map.
 */
function initMap() {
    if (map) {
        map.remove(); // Clear previous map instance if exists
    }
    
    // Check if L and L.map are available
    if (L && typeof L.map === 'function') {
        map = L.map('map').setView([45.0, 10.0], 5); 

        // Add a dark theme tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        console.log("Leaflet map initialized successfully.");
    } else {
        console.error("Leaflet (L) not available. Map initialization failed.");
        // Hide map container or show a fallback message
        document.getElementById('map').innerHTML = '<div class="text-center p-8 text-red-400">Map library not loaded. Check console for details.</div>';
    }
}

/**
 * Creates the HTML content for a Leaflet popup.
 * @param {object} spot 
 * @returns {string} HTML string.
 */
function createPopupContent(spot) {
    const isFavorite = globalUserData.favorites.includes(spot.id);
    const favBtnText = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
    const favBtnClass = isFavorite ? 'btn-secondary' : 'btn-primary';

    return `
        <div class="space-y-3 p-2 w-72">
            <h4 class="text-xl font-bold">${spot.name}</h4>
            <p class="text-sm text-gray-400">${spot.city}, ${spot.country}</p>
            <p class="text-md font-semibold text-yellow-400">${spot.type}</p>
            <p class="text-sm">${spot.about}</p>
            <button onclick="toggleFavorite('${spot.id}')" class="${favBtnClass} text-sm w-full">${favBtnText}</button>
            <button onclick="openSpotModal('${spot.id}')" class="btn-secondary text-sm w-full">View Details</button>
        </div>
    `;
}

/**
 * Updates or creates map markers for the given list of spots.
 * @param {Array<object>} spotsToRender 
 */
function updateMapMarkers(spotsToRender) {
    // Defensive check: Only proceed if L and its required functions are ready
    if (!L || typeof L.divIcon !== 'function' || !map) {
        console.error("Leaflet core functions not ready for markers. (L.divIcon missing)");
        return;
    }
    
    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    spotsToRender.forEach(spot => {
        // Customize icon based on type
        const typeClass = spot.type.toLowerCase().replace(/\s+/g, '-');
        let iconHtml = `<div class="marker-pin ${typeClass}"></div>`;
        
        // Add an icon based on type
        if (spot.type === 'Jam') {
            iconHtml += `<i data-lucide="zap" class="w-5 h-5 text-white"></i>`;
        } else if (spot.type === 'Cypher Jam') {
            iconHtml += `<i data-lucide="users" class="w-5 h-5 text-white"></i>`;
        } else if (spot.type === 'Training') {
            iconHtml += `<i data-lucide="dumbbell" class="w-5 h-5 text-white"></i>`;
        } else {
             iconHtml += `<i data-lucide="map-pin" class="w-5 h-5 text-white"></i>`;
        }


        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="marker-container">${iconHtml}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18] // Center the icon
        });

        const marker = L.marker([spot.lat, spot.lng], { icon: icon })
            .addTo(map)
            .bindPopup(createPopupContent(spot), { className: 'custom-popup' });

        markers.push(marker);
    });
    
    // Important: Render Lucide icons inside the markers after DOM update
    // For simplicity, we call it globally here.
    lucide.createIcons();
}

/**
 * Opens the detailed spot modal.
 * @param {string} spotId 
 */
function openSpotModal(spotId) {
    const spot = findSpot(spotId);
    if (!spot) return;

    const modal = document.getElementById('spotDetailModal');
    if (!modal) return;

    // Set content
    document.getElementById('modalImage').src = spot.image;
    document.getElementById('modalSpotName').textContent = spot.name;
    document.getElementById('modalSpotLocation').textContent = `${spot.city}, ${spot.country}`;
    document.getElementById('modalSpotType').textContent = spot.type;
    document.getElementById('modalSpotAbout').textContent = spot.about;
    document.getElementById('modalToggleFavoriteBtn').onclick = () => toggleFavorite(spot.id);
    document.getElementById('modalShareBtn').onclick = () => shareSpot(spot.id);
    document.getElementById('modalAddCollectionBtn').onclick = () => openCollectionModal(spot.id);
    
    // Render reviews
    const reviewsHtml = spot.reviews.map(review => `
        <div class="bg-gray-700/50 p-3 rounded-lg space-y-1">
            <div class="flex items-center space-x-2">
                ${createStarRating(review.rating)}
                <span class="text-sm font-semibold">${review.rating.toFixed(1)}/5</span>
            </div>
            <p class="text-sm text-gray-300">${review.text}</p>
        </div>
    `).join('');
    document.getElementById('modalReviews').innerHTML = reviewsHtml || '<p class="text-gray-400">No reviews yet.</p>';
    
    // Update favorite button text/icon
    const isFavorite = globalUserData.favorites.includes(spot.id);
    document.getElementById('modalToggleFavoriteBtn').innerHTML = `
        <i data-lucide="heart" class="w-5 h-5 ${isFavorite ? 'text-red-500 fill-red-500' : 'text-gray-400'}"></i>
        <span>${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
    `;

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    lucide.createIcons(); // Re-render Lucide icons
}

/* ====================================
   DASHBOARD / FILTER LOGIC
   ==================================== */

/**
 * Binds search and filter events for the dashboard.
 */
function bindDashboardEvents() {
    const searchBar = document.getElementById('searchBar');
    if (searchBar) {
        searchBar.addEventListener('input', () => renderSpots(spots));
    }
}


/* ====================================
   PROFILE VIEW RENDERING
   ==================================== */

/**
 * Renders the full profile view content.
 */
function renderProfile() {
    // 1. Render User ID
    document.getElementById('profileUserId').textContent = userId || 'Loading...';
    
    // 2. Render Activity Feed
    const activityList = document.getElementById('profileActivity');
    if (activityList) {
        // Sort activity by timestamp descending
        const sortedActivity = [...globalUserData.activityFeed].sort((a, b) => b.timestamp - a.timestamp);
        activityList.innerHTML = sortedActivity.map(activity => `
            <li class="p-3 bg-gray-800 rounded-lg text-sm flex justify-between items-center border border-gray-700">
                <span class="text-gray-300">${activity.message}</span>
                <span class="text-xs text-gray-500">${formatTimestamp(activity.timestamp)}</span>
            </li>
        `).join('');
    }

    // 3. Render Favorites Grid
    const favoritesGrid = document.getElementById('profileFavoritesGrid');
    if (favoritesGrid) {
        const favoriteSpots = spots.filter(spot => globalUserData.favorites.includes(spot.id));
        favoritesGrid.innerHTML = favoriteSpots.map(createSpotCard).join('');
        lucide.createIcons();
    }
    
    // 4. Render Collections
    renderCollections();
    
    // 5. Render Achievements
    renderAchievements();

    // 6. Update Stats/Charts (Handled by renderGlobalStats/renderChallenges below)
}

/**
 * Renders collections (used in both profile and modal).
 */
function renderCollections() {
    const container = document.getElementById('profileCollections');
    const collectionNames = Object.keys(globalUserData.collections);
    
    if (container) {
        container.innerHTML = collectionNames.map(name => {
            const spotIds = globalUserData.collections[name];
            const count = spotIds.length;
            
            // Get the first spot's image for a visual
            const firstSpotId = spotIds[0];
            const firstSpot = firstSpotId ? findSpot(firstSpotId) : null;
            const imageUrl = firstSpot ? firstSpot.image : 'https://placehold.co/400x200/4b5563/d1d5db?text=Empty+Collection';
            
            return `
                <div class="collection-card bg-gray-800 rounded-xl shadow-lg border border-gray-700 relative overflow-hidden">
                    <div class="h-24 w-full bg-cover bg-center" style="background-image: url('${imageUrl}');"></div>
                    <div class="p-4 space-y-2">
                        <h4 class="text-lg font-bold text-white line-clamp-1">${name}</h4>
                        <p class="text-sm text-gray-400">${count} spot${count === 1 ? '' : 's'}</p>
                        <div class="flex space-x-2">
                            <button onclick="viewCollection('${name}')" class="btn-primary flex-1 text-sm">View</button>
                            <button onclick="openDeleteModal('${name}')" class="p-2 text-gray-400 hover:text-red-500 transition" aria-label="Delete Collection">
                                <i data-lucide="trash-2" class="w-5 h-5"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }
}

/**
 * Opens the modal for adding a spot to a collection.
 * @param {string} spotId - The ID of the spot to add.
 */
function openCollectionModal(spotId) {
    const modal = document.getElementById('collectionModal');
    const list = document.getElementById('collectionList');
    const createInput = document.getElementById('newCollectionName');
    const createBtn = document.getElementById('createCollectionBtn');
    
    if (!modal || !list || !createInput || !createBtn) return;
    
    // Clear previous state
    createInput.value = '';
    
    const collectionNames = Object.keys(globalUserData.collections);
    
    list.innerHTML = collectionNames.map(name => {
        const spotIds = globalUserData.collections[name];
        const isInCollection = spotIds.includes(spotId);
        
        return `
            <li class="flex justify-between items-center p-2 bg-gray-700/50 rounded-lg">
                <span class="text-gray-300">${name} (${spotIds.length} spots)</span>
                <button 
                    onclick="toggleSpotInCollection('${name}', '${spotId}')" 
                    class="btn-primary text-xs px-3 py-1 ${isInCollection ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}"
                >
                    ${isInCollection ? 'Remove' : 'Add'}
                </button>
            </li>
        `;
    }).join('') || '<p class="text-gray-400 p-2">No collections yet. Create one below!</p>';
    
    // Set up create button handler (needs to be inside this function to capture spotId)
    createBtn.onclick = () => createCollection(createInput.value, spotId);

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/**
 * Creates a new collection and adds a spot to it.
 * @param {string} name 
 * @param {string} spotId 
 */
function createCollection(name, spotId) {
    name = name.trim();
    if (!name) {
        showCustomAlert("Error", "Collection name cannot be empty.");
        return;
    }
    if (globalUserData.collections[name]) {
        showCustomAlert("Error", "A collection with this name already exists.");
        return;
    }

    const newCollections = { ...globalUserData.collections, [name]: [spotId] };
    
    if (userDocRef) {
        updateDoc(userDocRef, {
            collections: newCollections
        }).then(() => {
            logActivity(`Created new collection: ${name} and added spot.`);
            closeModal('collectionModal');
        }).catch(e => {
            console.error("Error creating collection:", e);
            showCustomAlert("Error", "Could not create collection in the database.");
        });
    } else {
         showCustomAlert("Error", "User profile not ready or not authenticated.");
    }
}

/**
 * Toggles a spot's presence in a specific collection.
 * @param {string} collectionName 
 * @param {string} spotId 
 */
function toggleSpotInCollection(collectionName, spotId) {
    const spotIds = globalUserData.collections[collectionName] || [];
    const isPresent = spotIds.includes(spotId);
    let newSpotIds;

    if (isPresent) {
        newSpotIds = spotIds.filter(id => id !== spotId);
    } else {
        newSpotIds = [...spotIds, spotId];
    }

    const newCollections = { ...globalUserData.collections, [collectionName]: newSpotIds };
    
    if (userDocRef) {
        updateDoc(userDocRef, {
            collections: newCollections
        }).then(() => {
            const logMsg = isPresent 
                ? `Removed spot from collection: ${collectionName}` 
                : `Added spot to collection: ${collectionName}`;
            logActivity(logMsg);
            // Re-open modal to reflect changes
            openCollectionModal(spotId); 
        }).catch(e => {
            console.error("Error toggling spot in collection:", e);
            showCustomAlert("Error", "Could not update collection in the database.");
        });
    } else {
         showCustomAlert("Error", "User profile not ready or not authenticated.");
    }
}

/**
 * Opens the delete confirmation modal for a collection.
 * @param {string} collectionName 
 */
function openDeleteModal(collectionName) {
    const modal = document.getElementById('deleteModal');
    const nameSpan = document.getElementById('deleteModalCollectionName');
    const confirmBtn = document.getElementById('deleteModalConfirmBtn');

    if (!modal || !nameSpan || !confirmBtn) return;

    nameSpan.textContent = collectionName;
    confirmBtn.onclick = () => deleteCollection(collectionName);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/**
 * Deletes a collection entirely.
 * @param {string} collectionName 
 */
function deleteCollection(collectionName) {
    const newCollections = { ...globalUserData.collections };
    delete newCollections[collectionName];
    
    if (userDocRef) {
        updateDoc(userDocRef, {
            collections: newCollections
        }).then(() => {
            logActivity(`Deleted collection: ${collectionName}`);
            closeModal('deleteModal');
        }).catch(e => {
            console.error("Error deleting collection:", e);
            showCustomAlert("Error", "Could not delete collection from the database.");
        });
    } else {
         showCustomAlert("Error", "User profile not ready or not authenticated.");
    }
}


/**
 * Filters the main grid to show only spots from a specific collection.
 * @param {string} collectionName 
 */
function viewCollection(collectionName) {
    const spotIds = globalUserData.collections[collectionName] || [];
    const collectionSpots = spots.filter(spot => spotIds.includes(spot.id));
    
    document.getElementById('viewTitle').textContent = `Collection: ${collectionName}`;
    showView('dashboard');
    renderSpots(collectionSpots); // Render the filtered spots
    
    // Clear search bar
    document.getElementById('searchBar').value = '';

    // Add a button to reset the view
    const dashboardHeader = document.getElementById('dashboardHeader');
    let resetBtn = document.getElementById('resetViewBtn');
    if (!resetBtn) {
        resetBtn = document.createElement('button');
        resetBtn.id = 'resetViewBtn';
        resetBtn.className = 'btn-secondary text-sm ml-4';
        resetBtn.textContent = 'Show All Spots';
        resetBtn.onclick = resetDashboardView;
        dashboardHeader.appendChild(resetBtn);
    } else {
        resetBtn.style.display = 'inline-block';
    }
}

/**
 * Resets the dashboard view to show all spots.
 */
function resetDashboardView() {
    document.getElementById('viewTitle').textContent = 'Global Spot Atlas';
    document.getElementById('searchBar').value = '';
    renderSpots(spots);
    
    // Hide reset button
    const resetBtn = document.getElementById('resetViewBtn');
    if (resetBtn) {
        resetBtn.style.display = 'none';
    }
}

/**
 * Renders the achievements section.
 */
function renderAchievements() {
    const container = document.getElementById('profileAchievements');
    if (!container) return;

    // Static data from data.js: allAchievements
    container.innerHTML = allAchievements.map(ach => {
        const isEarned = globalUserData.achievements.includes(ach.id);
        const cardClass = isEarned ? 'bg-gray-700 border-green-500' : 'bg-gray-800 border-gray-700 opacity-60';
        const iconClass = isEarned ? 'text-green-400 fill-green-400' : 'text-gray-500';

        return `
            <div class="achievement-card ${cardClass} border-2 space-y-2">
                <div class="flex items-center space-x-3">
                    <i data-lucide="${ach.icon}" class="w-6 h-6 ${iconClass}"></i>
                    <h4 class="text-lg font-bold">${ach.name}</h4>
                </div>
                <p class="text-sm text-gray-400">${ach.description}</p>
                ${isEarned ? `<span class="text-xs text-green-500 font-semibold">ACHIEVED!</span>` : `<span class="text-xs text-gray-500">Locked</span>`}
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

// Simple achievement check function (called after data saves)
function checkAchievements() {
    const stats = globalUserData.globalStats;
    const currentAchievements = globalUserData.achievements;
    let earnedNew = false;
    
    allAchievements.forEach(ach => {
        if (!currentAchievements.includes(ach.id) && ach.condition(stats)) {
            // Earn the achievement!
            if (userDocRef) {
                updateDoc(userDocRef, {
                    achievements: arrayUnion(ach.id)
                }).then(() => {
                    logActivity(`ACHIEVEMENT UNLOCKED: ${ach.name}!`);
                    showCustomAlert("Achievement Unlocked!", `Congratulations! You unlocked: ${ach.name}`);
                    earnedNew = true;
                }).catch(e => {
                    console.error("Error unlocking achievement:", e);
                });
            }
        }
    });

    // If new achievements were earned, the onSnapshot listener will trigger a re-render.
}


/* ====================================
   COMMUNITY VIEW RENDERING
   ==================================== */

/**
 * Renders the Leaderboard (mock data).
 */
function renderLeaderboard() {
    const container = document.getElementById('leaderboard');
    if (!container) return;

    const leaderHtml = mockLeaderboard.map((leader, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-amber-600' : 'text-gray-500';

        return `
            <div class="leader-card bg-gray-800 flex items-center p-3 space-x-4 border border-gray-700 rounded-lg">
                <span class="text-2xl font-bold ${rankClass}">${rank}.</span>
                <div class="flex-1">
                    <h4 class="text-lg font-semibold">${leader.name}</h4>
                    <p class="text-sm text-gray-400">${leader.crew}</p>
                </div>
                <div class="text-right">
                    <p class="text-xl font-bold" style="color: var(--accent);">${leader.points}</p>
                    <p class="text-xs text-gray-500">Points</p>
                </div>
            </div>
        `;
    }).join('');
    container.innerHTML = leaderHtml;
}

/**
 * Renders the Hall of Fame (mock data).
 */
function renderHallOfFame() {
    const container = document.getElementById('hallOfFame');
    if (!container) return;

    const fameHtml = mockHallOfFame.map(famer => `
        <div class="fame-card bg-gray-800 p-3 space-y-2 border border-gray-700 rounded-lg">
            <h4 class="text-xl font-bold text-white">${famer.name}</h4>
            <p class="text-sm text-yellow-400">${famer.title}</p>
            <p class="text-sm text-gray-400">${famer.year}</p>
        </div>
    `).join('');
    container.innerHTML = fameHtml;
}


/* ====================================
   STATS & CHALLENGES RENDERING
   ==================================== */

/**
 * Renders user's global stats and the chart.
 */
function renderGlobalStats() {
    const container = document.getElementById('globalStats');
    if (!container) return;

    const stats = globalUserData.globalStats;

    const statsHtml = Object.keys(stats).map(key => `
        <div class="stat-card bg-gray-800 p-3 space-y-1 border border-gray-700 rounded-lg">
            <h4 class="text-3xl font-bold" style="color: var(--accent);">${stats[key]}</h4>
            <p class="text-sm text-gray-400">${STAT_LABELS[key] || key}</p>
        </div>
    `).join('');
    container.innerHTML = statsHtml;
    
    // Draw the chart
    drawSpotTypeChart(document.getElementById('statsChartCanvas'), false); // Bar chart default
}

/**
 * Renders challenges (mock data for now).
 */
function renderChallenges() {
    const container = document.getElementById('challenges');
    if (!container) return;

    const challengesHtml = mockChallenges.map(challenge => {
        const status = 'In Progress'; // Mock status
        const progress = Math.min(100, Math.floor(Math.random() * 100)); // Mock progress
        
        return `
            <div class="challenge-card bg-gray-800 p-3 space-y-2 border border-gray-700 rounded-lg">
                <h4 class="text-lg font-bold text-white">${challenge.name}</h4>
                <p class="text-sm text-gray-400">${challenge.description}</p>
                <div class="w-full bg-gray-700 rounded-full h-2.5">
                    <div class="h-2.5 rounded-full" style="width: ${progress}%; background-color: var(--accent);"></div>
                </div>
                <p class="text-xs text-gray-500">${status}: ${progress}% complete</p>
            </div>
        `;
    }).join('');
    container.innerHTML = challengesHtml;
}


/**
 * Draws a chart showing the count of different spot types.
 * @param {HTMLCanvasElement} canvas 
 * @param {boolean} usePie - true for pie chart, false for bar chart.
 */
function drawSpotTypeChart(canvas, usePie) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Resize the canvas for responsiveness
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = 300; 

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Filter spots based on favorites for user-specific chart
    const userSpots = spots.filter(spot => globalUserData.favorites.includes(spot.id));
    
    const countType = (type) => userSpots.filter(s => s.type === type).length;

    const data = [
      { label: "Jam", value: countType("Jam"), color: "#ff9f1c" }, // accent
      { label: "Cypher Jam", value: countType("Cypher Jam"), color: "#2ec4b6" }, // teal
      { label: "Training", value: countType("Training"), color: "#e71d36" }, // red
    ];
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

    ctx.fillStyle = "#f3f4f6"; // text-gray-100
    ctx.font = "14px Inter";
    ctx.textAlign = "center";

    if (total === 1) {
        ctx.fillText("Favorite a spot to see stats!", canvas.width / 2, canvas.height / 2);
        return;
    }

    if (!usePie) {
        // Bar chart (Responsive width calculation)
        const totalBarArea = canvas.width - 80; // 40px padding on each side
        const barWidth = Math.max(50, (totalBarArea / data.length) * 0.6);
        const totalGapWidth = totalBarArea - (barWidth * data.length);
        const gap = data.length > 1 ? totalGapWidth / (data.length - 1) : 0;
        let x = 40;
        const maxVal = Math.max(...data.map(d => d.value)) || 1;
        const chartHeight = 180;
        const scale = chartHeight / maxVal;
        const baseLine = canvas.height - 60; // Base line for bars

        data.forEach(d => {
            const h = d.value * scale;
            ctx.fillStyle = d.color;
            // Draw the bar
            ctx.fillRect(x, baseLine - h, barWidth, h);
            
            // Draw text labels
            ctx.fillStyle = "#f3f4f6";
            ctx.fillText(`${d.label}`, x + barWidth / 2, baseLine + 20);
            ctx.fillText(`(${d.value})`, x + barWidth / 2, baseLine + 40);
            
            // Draw the value on top of the bar
            ctx.fillText(`${d.value}`, x + barWidth / 2, baseLine - h - 10);
            
            x += barWidth + gap;
        });
        
        // Draw Y-axis guide (optional, simple line)
        ctx.strokeStyle = "#4b5563"; // gray-600
        ctx.beginPath();
        ctx.moveTo(40, baseLine);
        ctx.lineTo(canvas.width - 40, baseLine);
        ctx.stroke();

    } else {
        // Pie chart
        let start = 0;
        const cx = canvas.width / 2;
        const cy = 130;
        const r = 90;
        let legendY = 240;
        
        data.forEach(d => {
            const angle = (d.value / total) * Math.PI * 2;
            
            // Draw the slice
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.fillStyle = d.color;
            ctx.arc(cx, cy, r, start, start + angle);
            ctx.closePath();
            ctx.fill();
            
            // Draw label near the slice
            const midAngle = start + angle / 2;
            const labelR = r * 0.7; // Position labels slightly inside
            const labelX = cx + labelR * Math.cos(midAngle);
            const labelY = cy + labelR * Math.sin(midAngle);
            
            ctx.fillStyle = "white"; // White labels for contrast
            ctx.fillText(`${d.label} (${d.value})`, labelX, labelY);

            // Draw legend (if needed, but space is limited)
            // ctx.fillStyle = d.color;
            // ctx.fillRect(40, legendY, 10, 10);
            // ctx.fillStyle = "#f3f4f6";
            // ctx.textAlign = "left";
            // ctx.fillText(`${d.label} (${d.value})`, 60, legendY + 8);
            // legendY += 20;

            start += angle;
        });
    }
}


/* ====================================
   STORY MODE / SLIDESHOW
   ==================================== */

let currentSlide = 0;

/**
 * Binds story mode buttons.
 */
function bindStoryModeEvents() {
    document.getElementById('prevSlide')?.addEventListener('click', () => changeSlide(-1));
    document.getElementById('nextSlide')?.addEventListener('click', () => changeSlide(1));
    document.getElementById('exitStory')?.addEventListener('click', () => showView('dashboard'));
    renderStoryMode();
}

/**
 * Changes the current slide and updates the view.
 * @param {number} delta - 1 for next, -1 for previous.
 */
function changeSlide(delta) {
    currentSlide = (currentSlide + delta + storySlidesData.length) % storySlidesData.length;
    renderStoryMode();
}

/**
 * Renders the current story mode slide.
 */
function renderStoryMode() {
    const container = document.getElementById('storySlides');
    if (!container) return;

    const slide = storySlidesData[currentSlide];

    container.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-xl shadow-2xl space-y-4">
            <h3 class="text-3xl font-bold text-white" style="color: var(--accent);">${slide.title}</h3>
            <img src="${slide.image}" alt="${slide.title}" class="w-full h-auto rounded-lg shadow-md" />
            <p class="text-lg text-gray-300">${slide.text}</p>
            <p class="text-sm text-gray-500 mt-4">Slide ${currentSlide + 1} of ${storySlidesData.length}</p>
        </div>
    `;

    // Update buttons
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    if (prevBtn) prevBtn.textContent = currentSlide === 0 ? 'Start Over' : 'Previous';
    if (nextBtn) nextBtn.textContent = currentSlide === storySlidesData.length - 1 ? 'Finish' : 'Next';
}


/* ====================================
   SHARE LOGIC
   ==================================== */

/**
 * Shares a spot using the Web Share API or a fallback popup.
 * @param {string} spotId 
 */
function shareSpot(spotId) {
    const spot = findSpot(spotId);
    if (!spot) return;

    const shareUrl = `${window.location.href.split('#')[0]}?spot=${spotId}`;
    const shareText = `Check out this breaking spot: ${spot.name} in ${spot.city}, ${spot.country}!`;

    if (navigator.share) {
        // Use Web Share API if available
        navigator.share({
            title: 'BreakAtlas Spot',
            text: shareText,
            url: shareUrl,
        }).catch(error => console.error('Error sharing:', error));
    } else {
        // Fallback to custom popup
        const popup = document.getElementById('sharePopup');
        const linksContainer = document.getElementById('sharePopupLinks');

        if (!popup || !linksContainer) return;

        linksContainer.innerHTML = `
            <input id="shareLinkInput" type="text" value="${shareUrl}" readonly class="bg-gray-700 text-gray-100 p-2 rounded-lg w-full" />
            <button onclick="copyToClipboard('shareLinkInput')" class="btn-secondary w-full">Copy Link</button>
            <a href="mailto:?subject=BreakAtlas Spot&body=${encodeURIComponent(shareText + ' ' + shareUrl)}" class="btn-primary text-center" target="_blank">Share via Email</a>
        `;

        // Show popup
        popup.classList.remove('hidden');
    }
}

/**
 * Closes the share popup.
 */
function closeSharePopup() {
    const popup = document.getElementById('sharePopup');
    if (popup) {
        popup.classList.add('hidden');
    }
}

/**
 * Copies text from an input element to the clipboard.
 * @param {string} elementId - ID of the input element.
 */
function copyToClipboard(elementId) {
    const copyText = document.getElementById(elementId);
    if (copyText) {
        copyText.select();
        copyText.setSelectionRange(0, 99999); // For mobile devices
        try {
            document.execCommand('copy');
            showCustomAlert('Copied!', 'The link has been copied to your clipboard.');
        } catch (err) {
            console.error('Could not copy text: ', err);
            showCustomAlert('Error', 'Failed to copy link. Please copy it manually.');
        }
    }
}


/* ====================================
   DOM READY & INITIALIZATION
   ==================================== */

/* DOM ready: init map, render cards, bind events */
document.addEventListener("DOMContentLoaded", () => {
  // Theme color is initialized outside of this block
  
  // Set up events that don't depend on Firebase data immediately
  bindDashboardEvents();
  bindProfileEvents();
  bindStoryModeEvents();
  
  // Render initial static parts
  renderLeaderboard();
  renderHallOfFame();
  renderGlobalStats();
  renderChallenges();

  // Initialize the map immediately, but rendering spots/markers relies on L being fully loaded and then Firebase data
  initMap(); 
  
  // Attach resize listener for chart responsiveness
  window.addEventListener('resize', () => {
    // Only redraw chart if profile/dashboard is visible
    if (currentView === 'profile' || currentView === 'dashboard') {
        renderGlobalStats();
    }
    if (map) {
        map.invalidateSize();
    }
  });

});

// Function to handle hamburger menu toggle
function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.toggle('flex');
        navLinks.classList.toggle('hidden');
    }
}

// Attach the toggleMenu to the global scope for the HTML button
window.toggleMenu = toggleMenu;
window.showView = showView;
window.toggleFavorite = toggleFavorite;
window.openSpotModal = openSpotModal;
window.closeModal = closeModal;
window.shareSpot = shareSpot;
window.closeSharePopup = closeSharePopup;
window.copyToClipboard = copyToClipboard;
window.viewCollection = viewCollection;
window.openCollectionModal = openCollectionModal;
window.toggleSpotInCollection = toggleSpotInCollection;
window.openDeleteModal = openDeleteModal;
window.deleteCollection = deleteCollection;
window.resetDashboardView = resetDashboardView;
window.createCollection = createCollection;
window.showCustomAlert = showCustomAlert; // Expose alert for other parts of the app

// Need to expose initMap for the check in showView
window.initMap = initMap;