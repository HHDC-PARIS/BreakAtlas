// === STATIC DATA ===

// --- Spots Data (Expanded) ---
// Placeholders updated for a light theme (dark text on light background)
const spots = [
  // France
  { id:"spot_boty", name:"Battle of the Year France", city:"Montpellier", country:"France", crew:"Vagabonds Crew", type:"Jam", image:"https://placehold.co/800x500/ff9f1c/111827?text=Jam+BOTY", lat:43.61, lng:3.87, about:"Legendary European breaking championship qualifier.", reviews:[{rating:5,text:"Historic jam, the energy is unmatched."}, {rating:4,text:"Crowded but worth it."}] },
  { id: "spot_laplace", name: "La Place Hip Hop", city: "Paris", country: "France", crew: "Paris City Breakers", type: "Training", image: "https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat: 48.86, lng: 2.35, about: "Hip‑hop center with regular breaking sessions and open practice.", reviews: [{rating: 5, text: "Perfect training spot, great floor."}, {rating: 5, text: "Inspiring atmosphere."}] },
  { id: "spot_centquatre", name: "Centquatre (104)", city: "Paris", country: "France", crew: "Aktuel Force", type: "Training", image: "https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat: 48.89, lng: 2.37, about: "Public venue with open spaces where breakers train daily.", reviews: [{rating: 4, text: "Always cyphers, great energy."}, {rating: 4, text: "Public but spacious."}] },
  
  // Netherlands
  { id: "spot_ibe", name: "The Notorious IBE", city: "Heerlen", country: "Netherlands", crew: "The Ruggeds", type: "Jam", image: "https://placehold.co/800x500/ff9f1c/111827?text=Jam+IBE", lat: 50.88, lng: 5.96, about: "One of the most respected international breaking events.", reviews: [{rating: 5, text: "The pinnacle of breaking culture."}, {rating: 5, text: "Must-attend event."}] },
  { id: "spot_rotterdam_cypher", name: "Rotterdam Cypher Plaza", city: "Rotterdam", country: "Netherlands", crew: "Rotterdam Breakers", type: "Cypher", image: "https://placehold.co/800x500/1e88e5/FFFFFF?text=Cypher+Image", lat: 51.92, lng: 4.47, about: "Regular outdoor cyphers near the central station.", reviews: [{rating: 4, text: "Good variety of dancers."}, {rating: 3, text: "Can get crowded."}] },
  
  // Germany
  { id: "spot_berlin_battles", name: "Berlin Battleground", city: "Berlin", country: "Germany", crew: "Flying Steps", type: "Jam", image: "https://placehold.co/800x500/ff9f1c/111827?text=Jam+Image", lat: 52.52, lng: 13.40, about: "High-level battle event series held quarterly.", reviews: [{rating: 5, text: "Professional setup, great judges."}] },
  { id: "spot_munich_training", name: "Munich Breaking Spot", city: "Munich", country: "Germany", crew: "Southside Rockers", type: "Training", image: "https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat: 48.14, lng: 11.58, about: "Indoor studio with open practice nights and cyphers.", reviews: [{rating: 4, text: "Great floors and mirrors."}] },

  // Italy
  { id: "spot_rome_cyphers", name: "Rome Street Cyphers", city: "Rome", country: "Italy", crew: "Rome City Rockers", type: "Cypher", image: "https://placehold.co/800x500/1e88e5/FFFFFF?text=Cypher+Image", lat: 41.90, lng: 12.50, about: "Open-air cyphers near cultural hubs, weekly sessions.", reviews: [{rating: 4, text: "Pure vibe, real street flavor."}] },
  { id: "spot_milanhub", name: "Milan Breaking Hub", city: "Milan", country: "Italy", crew: "Bandits Crew", type: "Training", image: "https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat: 45.46, lng: 9.19, about: "Community gym with daily practice and weekend cyphers.", reviews: [{rating: 5, text: "Solid training schedule."}] },

  // Spain
  { id: "spot_barcelona", name: "Barcelona Beach Cyphers", city: "Barcelona", country: "Spain", crew: "BCN Breakers", type: "Cypher", image: "https://placehold.co/800x500/1e88e5/FFFFFF?text=Cypher+Image", lat: 41.39, lng: 2.17, about: "Sunset cyphers on Barceloneta beach.", reviews: [{rating: 4, text: "Beautiful location, high tourist traffic."}] },
  { id: "spot_madrid_studio", name: "Madrid Training Studio", city: "Madrid", country: "Spain", crew: "Madrid City Crew", type: "Training", image: "https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat: 40.41, lng: -3.70, about: "Professional studio space available for practice.", reviews: [{rating: 5, text: "Perfect for drilling power moves."}] },
];

// --- Crews Data ---
const crews = [
    { id: "crew_vagabonds", name: "Vagabonds Crew", country: "France", about: "World-renowned crew, multiple BOTY champions." },
    { id: "crew_paris_city", name: "Paris City Breakers", country: "France", about: "New generation crew pushing the limits in Paris." },
    { id: "crew_aktuel_force", name: "Aktuel Force", country: "France", about: "Pioneering French crew from the 90s." },
    { id: "crew_rugged", name: "The Ruggeds", country: "Netherlands", about: "Known for innovative concepts and stage presence." },
    { id: "crew_flying_steps", name: "Flying Steps", country: "Germany", about: "Established German crew, mixing classical arts and breaking." },
    { id: "crew_southside", name: "Southside Rockers", country: "Germany", about: "Veteran crew from Southern Germany." },
];

// --- Story Mode Data (Revamped) ---
const storySlidesData = [
  { 
    title: "Welcome to BreakAtlas!", 
    text: "Your ultimate guide to the global breaking scene. We use Firebase to save your favorite spots, collections, and track your journey.",
    image: "https://placehold.co/600x300/ff9f1c/FFFFFF?text=Welcome!+The+Scene+is+Global"
  },
  { 
    title: "The Dashboard: Interactive Map", 
    text: "Find jams, cyphers, and training spots near you. Click on a marker to get details and add it to your profile.",
    image: "https://placehold.co/600x300/1e88e5/FFFFFF?text=Dashboard+Map+View"
  },
  { 
    title: "The Profile: Your Home Base", 
    text: "This is where your journey is tracked. See your favorite spots, your achievements, and the statistics of the spots you've logged.",
    image: "https://placehold.co/600x300/2ec4b6/111827?text=Profile+Stats"
  },
  { 
    title: "Collections: Organize Your Jams", 
    text: "Found spots for your European tour? Create a collection! You can name, edit, and delete collections right from your profile.",
    image: "https://placehold.co/600x300/ff9f1c/FFFFFF?text=Manage+Collections"
  },
  { 
    title: "Community & Sharing", 
    text: "Check the Leaderboard to see who's logged the most spots and view the Hall of Fame. Share your favorite spots with your crew!",
    image: "https://placehold.co/600x300/1e88e5/FFFFFF?text=Community+Vibes"
  }
];

// --- Global Stats (Mock Data) ---
// This is not stored in Firebase as it's static/global mock data.
const globalStatsData = [
    { label: "Total Spots Mapped", value: spots.length, icon: "map-pin" },
    { label: "Total Crews Tracked", value: crews.length, icon: "users" },
    { label: "Countries Covered", value: new Set(spots.map(s => s.country)).size, icon: "globe" },
];

// --- Leaderboard (Mock Data) ---
// This will be mixed with real user favorite counts for the leaderboard.
const mockLeaderboardData = [
    { username: "Bboy_Phoenix", favoritesCount: 35 },
    { username: "Bgirl_Nova", favoritesCount: 28 },
    { username: "FlexMaster_K", favoritesCount: 19 },
    { username: "Cypher_Queen", favoritesCount: 12 },
];

// --- Hall of Fame (Mock Data) ---
// Based on static spot IDs
const mockHallOfFame = [
    { spotId: "spot_ibe", favorites: 150 },
    { spotId: "spot_boty", favorites: 120 },
    { spotId: "spot_laplace", favorites: 98 },
];