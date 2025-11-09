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
    console.log("Firebase initialized.");
    
    // Set Firestore logging level to debug
    if (typeof firebase.firestore.setLogLevel !== 'undefined') {
      firebase.firestore.setLogLevel('debug');
    }
} catch (e) {
    console.error("Error initializing Firebase:", e);
}

// === APP STATE ===
let map;
let markers = [];
let currentView = "dashboard";
let userProfile = {
    favorites: [],
    collections: {}, // { collectionName: [spotId, ...] }
    activityFeed: [], // [{ timestamp: ..., type: ..., details: ... }]
    achievements: [],
    username: 'Guest'
};
let themeColor = localStorage.getItem("themeColor") || "#ff9f1c";
let statsChartType = localStorage.getItem("statsChartType") || "pie"; // 'pie' or 'bar'

// --- AUTHENTICATION & PROFILE SETUP ---

// Async function to handle sign-in and listener setup
async function setupAuthAndProfile() {
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }
        
        onAuthStateChanged(auth, (user) => {
            userUnsubscribe(); // Detach previous listener

            if (user) {
                userId = user.uid;
                // Use the user's ID for their private data path
                userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
                console.log("User signed in. User ID:", userId);

                // Initialize or fetch user profile data
                userUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        userProfile = docSnap.data();
                        console.log("Profile updated from Firestore:", userProfile);
                    } else {
                        // Document doesn't exist, create it with defaults
                        console.log("User profile not found, creating default.");
                        userProfile = {
                            favorites: [],
                            collections: {},
                            activityFeed: [{ timestamp: Date.now(), type: 'Welcome', details: 'B-boy/B-girl journey started.' }],
                            achievements: ['First Login'],
                            username: `Breaker_${userId.substring(0, 8)}` // Default username
                        };
                        setDoc(userDocRef, userProfile).catch(e => console.error("Error setting initial profile:", e));
                    }
                    // Always re-render components that rely on userProfile after update
                    renderProfile();
                    updateMarkers(spots); // Update map markers based on new favorites
                }, (error) => {
                    console.error("Error listening to profile data:", error);
                });
            } else {
                console.log("User signed out or anonymous sign-in failed.");
                // Fallback for unauthenticated state (should not happen in Canvas environment)
                userId = crypto.randomUUID(); // Fallback identifier
                userProfile.username = 'Guest';
                renderProfile();
            }
        });
    } catch (error) {
        console.error("Authentication Error:", error.code, error.message);
    }
}

// --- FIREBASE WRITE OPERATIONS ---

async function saveUserProfile(updates) {
    if (!userId || !userDocRef) {
        console.error("Cannot save: User ID or document reference is not available.");
        return;
    }
    try {
        await updateDoc(userDocRef, updates);
        console.log("Profile updates saved successfully:", updates);
    } catch (e) {
        console.error("Error saving user profile:", e);
        // If update fails (e.g., initial doc doesn't exist yet, though onSnapshot should handle this), try setDoc
        if (e.code === 'not-found') {
             console.warn("Doc not found during update, attempting set...");
             try {
                // Merge with existing profile data
                await setDoc(userDocRef, { ...userProfile, ...updates }, { merge: true });
                console.log("Profile set/merged successfully.");
             } catch (e2) {
                console.error("Critical error: setDoc also failed:", e2);
             }
        }
    }
}

function logActivity(details) {
    const activity = { timestamp: Date.now(), type: 'Action', details: details };
    saveUserProfile({ activityFeed: arrayUnion(activity) });
}

// --- DOM READY AND INITIALIZATION ---

document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    await setupAuthAndProfile(); // Start auth and profile listener
    initMap(); // Initialize map
    renderSpots(spots); // Render spot cards
    bindDashboardEvents();
    bindProfileEvents();
    bindStoryModeEvents();
    renderGlobalStats();
    renderChallenges();
    renderLeaderboard();
    renderHallOfFame();
    
    // Initial view rendering
    showView(currentView);
    // Bind share modal confirmation once
    document.getElementById('deleteModalConfirmBtn').addEventListener('click', handleDeleteCollection);
});

// --- UI & VIEW MANAGEMENT ---

function showView(viewId) {
    currentView = viewId;
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');

    // Close mobile menu after navigation
    const navMenu = document.getElementById('navMenu');
    if (navMenu && !navMenu.classList.contains('hidden')) {
        navMenu.classList.add('hidden');
    }

    // Special map handling
    if (viewId === 'dashboard') {
        // Force map redraw/re-centering after container becomes visible
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                map.setView([48.8566, 2.3522], 6); // Re-center on Europe
            }
        }, 100);
    }
}

/**
 * Toggles the visibility of the mobile navigation menu.
 * This function is called via the `onclick` attribute of the hamburger button.
 */
function toggleMenu() {
    const navMenu = document.getElementById('navMenu');
    if (navMenu) {
        // Toggle the 'hidden' class to show/hide the menu on mobile
        navMenu.classList.toggle('hidden');

        // Close any open modals when toggling menu to avoid UI clash
        closeModal('spotModal');
        closeModal('collectionModal');
        closeModal('deleteModal');
        closeModal('reviewModal');
    } else {
        console.error("Navigation menu element with ID 'navMenu' not found.");
    }
}

// --- THEME ---

function initTheme() {
    const root = document.documentElement.style;
    const picker = document.getElementById("themeColorPicker");

    const applyTheme = (color) => {
        root.setProperty("--accent", color);
        // Calculate a slightly darker color for hover effect
        // Simple heuristic: darken by 10%
        const hexToRgb = hex => hex.match(/[A-Za-z0-9]{2}/g).map(v => parseInt(v, 16));
        const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

        try {
            let [r, g, b] = hexToRgb(color.substring(1));
            r = Math.max(0, r - 25);
            g = Math.max(0, g - 25);
            b = Math.max(0, b - 25);
            const darkerColor = rgbToHex(r, g, b);
            root.setProperty("--accent-hover", darkerColor);
        } catch (e) {
            console.error("Theme color parsing failed, using default hover.", e);
            root.setProperty("--accent-hover", "#ffb24a");
        }
    };

    // Apply initial theme
    applyTheme(themeColor);

    if (picker) {
        picker.value = themeColor;
        picker.addEventListener("input", (e) => {
            themeColor = e.target.value;
            applyTheme(themeColor);
            localStorage.setItem("themeColor", themeColor);
            logActivity(`Changed theme color to ${themeColor}`);
        });
    }
}

// --- MODALS (Spot Details, Review, Collection Management) ---

// Modal state
let currentSpotId = null;
let currentCollectionName = null;

function openModal(modalId) {
    document.getElementById(modalId)?.classList.remove('hidden');
    document.body.classList.add('overflow-hidden'); // Prevent background scroll
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    // Clear dynamic content on close if needed
    if (modalId === 'spotModal') {
        currentSpotId = null;
    } else if (modalId === 'deleteModal') {
        currentCollectionName = null;
    }
}

// --- SPOT DETAILS MODAL ---

function showSpotDetails(spotId) {
    const spot = spots.find(s => s.id === spotId);
    if (!spot) {
        console.error('Spot not found:', spotId);
        return;
    }

    currentSpotId = spotId;

    document.getElementById('spotModalName').textContent = spot.name;
    document.getElementById('spotModalImage').src = spot.image;
    document.getElementById('spotModalImage').alt = spot.name;
    document.getElementById('spotModalType').textContent = spot.type;
    document.getElementById('spotModalLocation').textContent = `${spot.city}, ${spot.country}`;
    document.getElementById('spotModalAbout').textContent = spot.about;
    document.getElementById('spotModalCrew').textContent = spot.crew;

    // Favorite button state
    const isFavorite = userProfile.favorites.includes(spotId);
    const favBtn = document.getElementById('favoriteBtn');
    favBtn.textContent = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
    favBtn.classList.toggle('btn-secondary', isFavorite);
    favBtn.classList.toggle('btn-primary', !isFavorite);
    favBtn.onclick = () => toggleFavorite(spotId);

    // Collection dropdown
    const collectionSelect = document.getElementById('collectionSelect');
    collectionSelect.innerHTML = '<option value="">Select a Collection</option>';
    Object.keys(userProfile.collections).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        collectionSelect.appendChild(option);
    });

    // Share button
    document.getElementById('shareSpotBtn').onclick = () => shareSpot(spot);

    // Reviews
    renderReviews(spot.reviews);
    document.getElementById('openReviewModalBtn').onclick = () => openReviewModal(spotId);

    openModal('spotModal');
}

function renderReviews(reviews) {
    const reviewsList = document.getElementById('spotModalReviews');
    reviewsList.innerHTML = '';

    if (reviews.length === 0) {
        reviewsList.innerHTML = '<p class="text-gray-400 italic">No reviews yet. Be the first!</p>';
        return;
    }

    // Sort by most recent (assuming reviews don't have a timestamp, sorting by index is simplest)
    reviews.slice().reverse().forEach(review => {
        const li = document.createElement('li');
        li.className = 'p-3 bg-gray-700 rounded-lg mb-2';
        li.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="font-semibold">${review.username || 'Anonymous'}</span>
                <span class="text-yellow-400">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
            </div>
            <p class="text-sm">${review.text}</p>
        `;
        reviewsList.appendChild(li);
    });
}

// --- FAVORITE/COLLECTION LOGIC ---

function toggleFavorite(spotId) {
    if (userProfile.favorites.includes(spotId)) {
        // Remove
        userProfile.favorites = userProfile.favorites.filter(id => id !== spotId);
        logActivity(`Removed ${spots.find(s => s.id === spotId).name} from favorites`);
    } else {
        // Add
        userProfile.favorites.push(spotId);
        logActivity(`Added ${spots.find(s => s.id === spotId).name} to favorites`);
    }
    saveUserProfile({ favorites: userProfile.favorites });
    // Update button text immediately
    document.getElementById('favoriteBtn').textContent = userProfile.favorites.includes(spotId) ? 'Remove from Favorites' : 'Add to Favorites';
}

// Event handler for adding a spot to a collection via the dropdown
document.getElementById('collectionSelect')?.addEventListener('change', (e) => {
    const collectionName = e.target.value;
    if (collectionName && currentSpotId) {
        // Check if spot is already in the collection
        if (!(userProfile.collections[collectionName] || []).includes(currentSpotId)) {
            // Add the spot to the collection array
            const newCollections = {
                ...userProfile.collections,
                [collectionName]: [...(userProfile.collections[collectionName] || []), currentSpotId]
            };
            saveUserProfile({ collections: newCollections });
            logActivity(`Added ${spots.find(s => s.id === currentSpotId).name} to collection "${collectionName}"`);
        }
        // Reset the dropdown after selection
        e.target.value = '';
    }
});

// --- USER REVIEWS ---

function openReviewModal(spotId) {
    const spot = spots.find(s => s.id === spotId);
    if (!spot) return;

    document.getElementById('reviewModalSpotName').textContent = spot.name;
    document.getElementById('reviewRating').value = 5;
    document.getElementById('reviewText').value = '';

    // Set up the submission handler
    document.getElementById('submitReviewBtn').onclick = () => submitReview(spotId);

    closeModal('spotModal'); // Close spot details before opening review
    openModal('reviewModal');
}

function submitReview(spotId) {
    const rating = parseInt(document.getElementById('reviewRating').value);
    const text = document.getElementById('reviewText').value.trim();
    const spot = spots.find(s => s.id === spotId);

    if (!spot || !rating || text.length === 0) {
        console.error("Invalid review data.");
        return;
    }

    const newReview = {
        rating: rating,
        text: text,
        username: userProfile.username // Associate review with username
    };

    // The spots array is static, so we're faking persistence by updating the in-memory object,
    // which is not ideal but works for this single-file app structure without a full backend for spots.
    // In a real app, this would be an API call to update the spot data.
    spot.reviews.push(newReview);

    logActivity(`Reviewed ${spot.name} with ${rating} stars.`);

    closeModal('reviewModal');
    showSpotDetails(spotId); // Re-open details modal to show new review
}

// --- MAP RENDERING ---

function initMap() {
    if (map) map.remove(); // Clean up existing map if re-initializing

    // Initialize map centered on a good starting point (e.g., Central Europe)
    map = L.map('map').setView([48.8566, 2.3522], 6); 

    // Dark-mode friendly tiles (Stamen Toner Lite or similar inverted)
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
    }).addTo(map);

    updateMarkers(spots);
}

function updateMarkers(spotList) {
    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    spotList.forEach(spot => {
        // Create a custom icon (using a simple colored marker for favorites)
        const isFavorite = userProfile.favorites.includes(spot.id);
        const iconHtml = `<div class="marker-pin ${isFavorite ? 'favorite-marker' : 'regular-marker'}" style="background-color: ${isFavorite ? 'var(--accent)' : '#4b5563'};"></div>`;
        
        const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: iconHtml,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const marker = L.marker([spot.lat, spot.lng], { icon: customIcon })
            .addTo(map)
            .bindPopup(`<b>${spot.name}</b><br>${spot.city}, ${spot.country}`)
            .on('click', () => showSpotDetails(spot.id)); // Open modal on click

        markers.push(marker);
    });
}

// --- CARD RENDERING AND FILTERING ---

function renderSpots(spotList) {
    const container = document.getElementById('spotCards');
    if (!container) return;

    container.innerHTML = '';
    
    // Sort spots: Favorites first, then alphabetically
    spotList.sort((a, b) => {
        const aFav = userProfile.favorites.includes(a.id);
        const bFav = userProfile.favorites.includes(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.name.localeCompare(b.name);
    });

    spotList.forEach(spot => {
        const isFavorite = userProfile.favorites.includes(spot.id);
        const card = document.createElement('div');
        card.className = 'spot-card p-4 bg-gray-800 rounded-xl shadow-lg border border-gray-700 hover:border-accent transition duration-300 cursor-pointer';
        card.innerHTML = `
            <img src="${spot.image}" alt="${spot.name}" class="w-full h-32 object-cover rounded-lg mb-3">
            <h3 class="text-xl font-semibold mb-1">${spot.name}</h3>
            <p class="text-sm text-gray-400 mb-2">${spot.city}, ${spot.country} • ${spot.type}</p>
            <div class="flex justify-between items-center">
                <span class="text-yellow-400 text-lg">${'★'.repeat(Math.round(spot.reviews.reduce((sum, r) => sum + r.rating, 0) / spot.reviews.length || 0))}${'☆'.repeat(5 - Math.round(spot.reviews.reduce((sum, r) => sum + r.rating, 0) / spot.reviews.length || 0))}</span>
                <span class="text-gray-400 text-xs">${isFavorite ? '<i data-lucide="heart" class="w-4 h-4 fill-accent stroke-none inline-block"></i>' : ''}</span>
            </div>
        `;
        card.onclick = () => showSpotDetails(spot.id);
        container.appendChild(card);
    });

    // Re-render Lucide icons if any were added dynamically
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

function filterSpots() {
    const query = document.getElementById('searchQuery').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const isFavoriteFilter = document.getElementById('favoriteFilter').checked;

    const filteredSpots = spots.filter(spot => {
        const matchesQuery = spot.name.toLowerCase().includes(query) ||
                             spot.city.toLowerCase().includes(query) ||
                             spot.country.toLowerCase().includes(query);

        const matchesType = typeFilter === '' || spot.type === typeFilter;
        
        const matchesFavorite = !isFavoriteFilter || userProfile.favorites.includes(spot.id);

        return matchesQuery && matchesType && matchesFavorite;
    });

    renderSpots(filteredSpots);
    updateMarkers(filteredSpots);
}

function bindDashboardEvents() {
    document.getElementById('searchQuery')?.addEventListener('input', filterSpots);
    document.getElementById('typeFilter')?.addEventListener('change', filterSpots);
    document.getElementById('favoriteFilter')?.addEventListener('change', filterSpots);
    document.getElementById('toggleChartBtn')?.addEventListener('click', toggleChartType);
}

// --- PROFILE RENDERING AND MANAGEMENT ---

function renderProfile() {
    // Basic User Info
    document.getElementById('profileUsername').textContent = userProfile.username;
    document.getElementById('profileUserId').textContent = `ID: ${userId || 'N/A'}`;
    document.getElementById('editUsernameInput').value = userProfile.username;

    // Stats Chart
    const statsCanvas = document.getElementById('statsChart');
    if (statsCanvas) {
        drawStatsChart(statsCanvas, statsChartType === 'pie');
    }

    // Favorites Count
    document.getElementById('favoritesCount').textContent = userProfile.favorites.length;
    
    // Collections
    renderProfileCollections();

    // Activity Feed
    renderProfileActivity();

    // Achievements (part of static rendering now, only for display)
    renderProfileAchievements();
}

function renderProfileCollections() {
    const container = document.getElementById('profileCollections');
    if (!container) return;

    container.innerHTML = '';
    const collectionNames = Object.keys(userProfile.collections);

    if (collectionNames.length === 0) {
        container.innerHTML = '<p class="col-span-full text-gray-400">No collections created yet. Start organizing your spots!</p>';
    }

    collectionNames.forEach(name => {
        const spotIds = userProfile.collections[name];
        const count = spotIds.length;
        const card = document.createElement('div');
        card.className = 'collection-card p-4 bg-gray-800 rounded-xl border border-gray-700 shadow-lg';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="text-lg font-semibold truncate">${name}</h4>
                    <p class="text-sm text-gray-400">${count} spot${count !== 1 ? 's' : ''}</p>
                </div>
                <button class="text-red-400 hover:text-red-500 transition" onclick="openDeleteCollectionModal('${name}')">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
            ${count > 0 ? `
            <div class="mt-3 flex -space-x-2 overflow-hidden">
                ${spotIds.slice(0, 3).map(id => {
                    const spot = spots.find(s => s.id === id);
                    return spot ? `<img src="${spot.image}" alt="${spot.name}" class="inline-block h-8 w-8 rounded-full ring-2 ring-gray-900 object-cover" title="${spot.name}">` : '';
                }).join('')}
                ${count > 3 ? `<span class="inline-block h-8 w-8 rounded-full ring-2 ring-gray-900 bg-gray-600 flex items-center justify-center text-xs">+${count - 3}</span>` : ''}
            </div>` : ''}
        `;
        // Make the card clickable to show the spots
        card.onclick = (e) => {
            // Only navigate if trash button wasn't clicked
            if (!e.target.closest('button')) {
                showCollectionSpots(name, spotIds);
            }
        };
        container.appendChild(card);
    });

    // Re-render Lucide icons
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

function showCollectionSpots(name, spotIds) {
    // Filter the global spots array down to the collection members
    const collectionSpots = spots.filter(s => spotIds.includes(s.id));
    
    // Switch to dashboard view and render only these spots
    showView('dashboard');
    document.getElementById('dashboardTitle').textContent = `Viewing Collection: ${name}`;
    renderSpots(collectionSpots);
    updateMarkers(collectionSpots);
    
    // Show a "Back to All Spots" button
    let backBtn = document.getElementById('backToAllSpots');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'backToAllSpots';
        backBtn.className = 'btn-secondary text-sm ml-4';
        document.getElementById('dashboardControls').appendChild(backBtn);
    }
    backBtn.textContent = `← Back to All Spots`;
    backBtn.classList.remove('hidden');
    backBtn.onclick = () => {
        document.getElementById('dashboardTitle').textContent = `Explore BreakAtlas`;
        renderSpots(spots); // Render all spots
        updateMarkers(spots); // Update markers to all spots
        backBtn.classList.add('hidden');
    };
}


function renderProfileActivity() {
    const list = document.getElementById('profileActivity');
    if (!list) return;

    list.innerHTML = '';
    // Sort descending by timestamp and limit to 10
    const recentActivity = userProfile.activityFeed
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

    if (recentActivity.length === 0) {
        list.innerHTML = '<li class="text-gray-400 italic">No recent activity. Get out there!</li>';
        return;
    }

    recentActivity.forEach(activity => {
        const li = document.createElement('li');
        li.className = 'activity-item p-3 bg-gray-800 rounded-lg border border-gray-700 mb-2 text-sm';
        const date = new Date(activity.timestamp).toLocaleDateString();
        li.innerHTML = `<span class="font-bold text-accent">[${activity.type}]</span> ${activity.details} <span class="text-gray-500 float-right">${date}</span>`;
        list.appendChild(li);
    });
}

function renderProfileAchievements() {
    const container = document.getElementById('profileAchievements');
    if (!container) return;

    container.innerHTML = '';
    
    const allAchievements = [
        { id: 'First Login', name: 'First Steps', description: 'Logged into BreakAtlas.', icon: 'shoe-prints' },
        { id: '5 Favs', name: 'Spot Collector', description: 'Favorited 5 spots.', icon: 'star' },
        { id: '1st Review', name: 'The Critic', description: 'Wrote your first review.', icon: 'message-square' },
        { id: 'Explorer', name: 'Explorer', description: 'Viewed 10 unique spots.', icon: 'globe' },
    ];
    
    allAchievements.forEach(ach => {
        const achieved = userProfile.achievements.includes(ach.id);
        const card = document.createElement('div');
        card.className = `achievement-card p-4 rounded-xl border border-gray-700 shadow-lg ${achieved ? 'bg-green-900/50' : 'bg-gray-800/50 opacity-50'}`;
        card.innerHTML = `
            <div class="flex items-center space-x-3">
                <i data-lucide="${ach.icon}" class="w-6 h-6 ${achieved ? 'text-green-400' : 'text-gray-500'}"></i>
                <div>
                    <h4 class="text-lg font-semibold">${ach.name}</h4>
                    <p class="text-sm text-gray-400">${ach.description}</p>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    // Re-render Lucide icons
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

function bindProfileEvents() {
    // Edit Username Modal
    document.getElementById('editUsernameBtn')?.addEventListener('click', () => {
        document.getElementById('editUsernameInput').value = userProfile.username;
        openModal('editUsernameModal');
    });
    document.getElementById('saveUsernameBtn')?.addEventListener('click', saveUsername);
    
    // New Collection Modal
    document.getElementById('openCollectionModalBtn')?.addEventListener('click', () => {
        document.getElementById('collectionNameInput').value = '';
        openModal('collectionModal');
    });
    document.getElementById('createCollectionBtn')?.addEventListener('click', createCollection);
}

function saveUsername() {
    const newUsername = document.getElementById('editUsernameInput').value.trim();
    if (newUsername && newUsername !== userProfile.username) {
        saveUserProfile({ username: newUsername });
        logActivity(`Changed username from ${userProfile.username} to ${newUsername}`);
    }
    closeModal('editUsernameModal');
}

function createCollection() {
    const newName = document.getElementById('collectionNameInput').value.trim();
    if (newName && !userProfile.collections[newName]) {
        const newCollections = { ...userProfile.collections, [newName]: [] };
        saveUserProfile({ collections: newCollections });
        logActivity(`Created new collection: "${newName}"`);
    } else if (userProfile.collections[newName]) {
        console.warn(`Collection "${newName}" already exists.`);
    }
    closeModal('collectionModal');
}

function openDeleteCollectionModal(name) {
    currentCollectionName = name;
    document.getElementById('deleteModalCollectionName').textContent = name;
    openModal('deleteModal');
}

function handleDeleteCollection() {
    const name = currentCollectionName;
    if (name && userProfile.collections[name]) {
        const newCollections = { ...userProfile.collections };
        delete newCollections[name];
        saveUserProfile({ collections: newCollections });
        logActivity(`Deleted collection: "${name}"`);
    }
    closeModal('deleteModal');
}

// --- STATS CHARTING ---

function countType(type) {
    return spots.filter(s => s.type === type).length;
}

function toggleChartType() {
    statsChartType = statsChartType === 'pie' ? 'bar' : 'pie';
    localStorage.setItem('statsChartType', statsChartType);
    const chartBtn = document.getElementById('toggleChartBtn');
    chartBtn.textContent = statsChartType === 'pie' ? 'View as Bar Chart' : 'View as Pie Chart';
    
    const statsCanvas = document.getElementById('statsChart');
    if (statsCanvas) {
        drawStatsChart(statsCanvas, statsChartType === 'pie');
    }
}

function drawStatsChart(canvas, usePie) {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 280;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = [
        { label: "Jam", value: countType("Jam"), color: "#ff9f1c" },
        { label: "Cypher Jam", value: countType("Cypher Jam"), color: "#2ec4b6" },
        { label: "Training", value: countType("Training"), color: "#e71d36" },
    ];
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;

    // Chart Title
    ctx.fillStyle = "#f3f4f6"; // text-gray-100
    ctx.font = "bold 18px Inter";
    ctx.textAlign = "center";
    ctx.fillText("Spot Types Distribution", canvas.width / 2, 20);
    ctx.font = "14px Inter";

    if (!usePie) {
        // Bar chart
        const margin = 40;
        const availableWidth = canvas.width - (2 * margin);
        const barWidth = Math.max(50, (availableWidth / data.length) * 0.6);
        const gap = (availableWidth - (barWidth * data.length)) / (data.length > 1 ? data.length - 1 : 1);
        
        let x = margin;
        const chartHeight = 180;
        const chartBottomY = 220; // Y position for the bottom of the bars
        const maxVal = Math.max(...data.map(d => d.value)) || 1;
        const scale = chartHeight / maxVal;

        // Draw X-Axis Line
        ctx.strokeStyle = '#4b5563';
        ctx.beginPath();
        ctx.moveTo(margin, chartBottomY);
        ctx.lineTo(canvas.width - margin, chartBottomY);
        ctx.stroke();

        data.forEach(d => {
            const h = d.value * scale;
            
            // Draw bar
            ctx.fillStyle = d.color;
            ctx.fillRect(x, chartBottomY - h, barWidth, h);

            // Draw labels
            ctx.fillStyle = "#f3f4f6";
            ctx.textAlign = "center";
            ctx.fillText(`${d.label}`, x + barWidth / 2, chartBottomY + 20);
            ctx.fillText(`(${d.value})`, x + barWidth / 2, chartBottomY + 40);
            
            x += barWidth + gap;
        });

    } else {
        // Pie chart
        let start = 0;
        const cx = canvas.width / 2;
        const cy = 130;
        const r = 100;
        const legendX = cx > 250 ? cx + r + 30 : 20; // Place legend based on width

        data.forEach((d, index) => {
            const angle = (d.value / total) * Math.PI * 2;
            
            // Draw slice
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, start, start + angle);
            ctx.closePath();
            ctx.fillStyle = d.color;
            ctx.fill();
            
            // Draw label near slice (optional, simplified for space)
            const midAngle = start + angle / 2;
            const textX = cx + (r / 1.5) * Math.cos(midAngle);
            const textY = cy + (r / 1.5) * Math.sin(midAngle);
            
            if (d.value / total > 0.05) { // Only label large slices
                ctx.fillStyle = "#111827"; // Dark text for contrast
                ctx.textAlign = "center";
                ctx.fillText(`${d.value}`, textX, textY + 5);
            }

            // Draw legend dot and text
            const legendY = 40 + index * 25;
            ctx.fillStyle = d.color;
            ctx.fillRect(legendX, legendY, 10, 10);
            ctx.fillStyle = "#f3f4f6";
            ctx.textAlign = "left";
            ctx.fillText(`${d.label} (${d.value})`, legendX + 15, legendY + 10);


            start += angle;
        });
    }
}

// --- COMMUNITY / LEADERBOARD ---

function renderLeaderboard() {
    const container = document.getElementById('leaderboard');
    if (!container) return;

    container.innerHTML = '<!-- Mock Leaderboard -->';
    
    // Mock user data for leaderboard (In a real app, this would be a Firestore query)
    const mockLeaders = [
        { rank: 1, name: "Bboy Cyclone", score: 980, country: "USA" },
        { rank: 2, name: "Bgurl Flash", score: 950, country: "France" },
        { rank: 3, name: "Kid Freeze", score: 920, country: "Japan" },
        { rank: 4, name: "Rocksteady Ryu", score: 890, country: "Germany" },
    ];

    mockLeaders.forEach(leader => {
        const card = document.createElement('div');
        card.className = 'leader-card p-4 bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex items-center space-x-3';
        card.innerHTML = `
            <span class="text-2xl font-bold ${leader.rank <= 3 ? 'text-yellow-400' : 'text-gray-400'}">${leader.rank}.</span>
            <div>
                <h4 class="font-semibold">${leader.name}</h4>
                <p class="text-sm text-gray-400">${leader.score} Pts | ${leader.country}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderHallOfFame() {
    const container = document.getElementById('hallOfFame');
    if (!container) return;

    container.innerHTML = '<!-- Mock Hall of Fame -->';

    // Mock data
    const mockFamers = [
        { name: "Crazy Legs", year: 2000, feat: "Pioneer of Power Moves" },
        { name: "Storm", year: 2005, feat: "Legendary European Choreographer" },
    ];

    mockFamers.forEach(famer => {
        const card = document.createElement('div');
        card.className = 'fame-card p-4 bg-gray-800 rounded-xl border border-gray-700 shadow-lg';
        card.innerHTML = `
            <h4 class="text-lg font-semibold">${famer.name}</h4>
            <p class="text-sm text-gray-400">Inducted: ${famer.year}</p>
            <p class="text-sm mt-1">${famer.feat}</p>
        `;
        container.appendChild(card);
    });
}

function renderGlobalStats() {
    const container = document.getElementById('globalStats');
    if (!container) return;

    container.innerHTML = '<!-- Mock Global Stats -->';

    // Mock data
    const totalSpots = spots.length;
    const totalCountries = [...new Set(spots.map(s => s.country))].length;
    const totalJams = countType('Jam');

    const mockStats = [
        { label: "Total Spots Mapped", value: totalSpots, icon: "map-pin" },
        { label: "Countries Covered", value: totalCountries, icon: "globe" },
        { label: "Major Jams Listed", value: totalJams, icon: "flame" },
    ];

    mockStats.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card p-4 bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex items-center space-x-3';
        card.innerHTML = `
            <i data-lucide="${stat.icon}" class="w-6 h-6 text-accent"></i>
            <div>
                <h4 class="text-2xl font-bold">${stat.value}</h4>
                <p class="text-sm text-gray-400">${stat.label}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderChallenges() {
    const container = document.getElementById('challenges');
    if (!container) return;

    container.innerHTML = '<!-- Mock Challenges -->';
    
    // Mock data
    const mockChallenges = [
        { name: "Europe Traveler", goal: "Visit 3 different countries' spots.", progress: 1, total: 3, done: false },
        { name: "Jam Master", goal: "Find 5 major Jams.", progress: 5, total: 5, done: true },
        { name: "Review King", goal: "Write 3 spot reviews.", progress: 0, total: 3, done: false },
    ];

    mockChallenges.forEach(challenge => {
        const card = document.createElement('div');
        const progressPercent = (challenge.progress / challenge.total) * 100;
        card.className = `challenge-card p-4 rounded-xl border ${challenge.done ? 'border-green-600 bg-green-900/30' : 'border-gray-700 bg-gray-800'}`;
        card.innerHTML = `
            <h4 class="font-semibold">${challenge.name}</h4>
            <p class="text-sm text-gray-400 mb-2">${challenge.goal}</p>
            <div class="w-full bg-gray-700 rounded-full h-2.5">
                <div class="h-2.5 rounded-full ${challenge.done ? 'bg-green-500' : 'bg-accent'}" style="width: ${progressPercent}%"></div>
            </div>
            <p class="text-xs text-right mt-1">${challenge.progress}/${challenge.total} ${challenge.done ? '(Completed)' : ''}</p>
        `;
        container.appendChild(card);
    });
}


// --- STORY MODE SLIDESHOW ---

let currentSlideIndex = 0;

function renderStorySlide(index) {
    const slide = storySlidesData[index];
    const container = document.getElementById('storySlides');
    if (!container || !slide) return;

    container.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700">
            <img src="${slide.image}" alt="Slide image for ${slide.title}" class="w-full h-40 object-cover rounded-lg mb-4">
            <h3 class="text-2xl font-bold text-accent mb-2">${slide.title}</h3>
            <p class="text-gray-300">${slide.text}</p>
        </div>
    `;
    
    // Update button states
    document.getElementById('prevSlide').disabled = index === 0;
    document.getElementById('nextSlide').disabled = index === storySlidesData.length - 1;
}

function bindStoryModeEvents() {
    document.getElementById('prevSlide')?.addEventListener('click', () => {
        currentSlideIndex = Math.max(0, currentSlideIndex - 1);
        renderStorySlide(currentSlideIndex);
    });
    document.getElementById('nextSlide')?.addEventListener('click', () => {
        currentSlideIndex = Math.min(storySlidesData.length - 1, currentSlideIndex + 1);
        renderStorySlide(currentSlideIndex);
    });
    document.getElementById('exitStory')?.addEventListener('click', () => {
        currentSlideIndex = 0; // Reset index
        showView('dashboard');
    });

    // Initial render when view is first shown
    if (currentView === 'storyMode') {
        renderStorySlide(currentSlideIndex);
    }
}

// --- SHARING (Web Share API fallback) ---

function closeSharePopup() {
    document.getElementById('sharePopup').classList.add('hidden');
}

function shareSpot(spot) {
    const shareData = {
        title: `Check out ${spot.name} on BreakAtlas!`,
        text: `The ${spot.type} spot in ${spot.city}, ${spot.country}: ${spot.about}`,
        url: `${window.location.href}?spot=${spot.id}` // Mock URL structure
    };

    if (navigator.share) {
        navigator.share(shareData)
            .then(() => logActivity(`Successfully shared spot: ${spot.name}`))
            .catch((error) => console.error('Error sharing:', error));
    } else {
        // Fallback for browsers without Web Share API
        const popup = document.getElementById('sharePopup');
        const linksContainer = document.getElementById('sharePopupLinks');
        
        linksContainer.innerHTML = `
            <p class="text-sm text-gray-400">Copy the link below:</p>
            <div class="flex items-center space-x-2">
                <input type="text" id="shareLinkInput" value="${shareData.url}" readonly class="flex-grow p-2 bg-gray-700 rounded-lg border border-gray-600 text-sm">
                <button onclick="copyToClipboard('shareLinkInput')" class="btn-primary text-sm p-2 w-20">Copy</button>
            </div>
            <p class="text-sm text-gray-400 mt-2">Or share via:</p>
            <div class="flex space-x-4 mt-2">
                <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.title)}&url=${encodeURIComponent(shareData.url)}" target="_blank" class="text-blue-400 hover:text-blue-300 transition"><i data-lucide="twitter" class="w-6 h-6"></i></a>
                <a href="mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(shareData.text + ' ' + shareData.url)}" class="text-red-400 hover:text-red-300 transition"><i data-lucide="mail" class="w-6 h-6"></i></a>
            </div>
        `;
        
        // Re-render Lucide icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }

        popup.classList.remove('hidden');
    }
}

function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    element.select();
    document.execCommand('copy');
    // Provide visual feedback
    const copyBtn = element.nextElementSibling;
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
        copyBtn.textContent = originalText;
    }, 2000);
}