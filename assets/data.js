// === STATIC DATA ===

// --- Spots Data (Expanded) ---
const spots = [
  // France
  { id:"spot_boty", name:"Battle of the Year France", city:"Montpellier", country:"France", crew:"Vagabonds Crew", type:"Jam", image:"https://placehold.co/800x500/ff9f1c/111827?text=Jam+BOTY", lat:43.61, lng:3.87, about:"Legendary European breaking championship qualifier.", reviews:[{rating:5,text:"Historic jam."}] },
  { id:"spot_laplace", name:"La Place Hip Hop", city:"Paris", country:"France", crew:"Paris City Breakers", type:"Training", image:"https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat:48.86, lng:2.35, about:"Hip‑hop center with regular breaking sessions.", reviews:[{rating:5,text:"Perfect training spot."}] },
  { id:"spot_centquatre", name:"Centquatre (104)", city:"Paris", country:"France", crew:"Aktuel Force", type:"Training", image:"https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat:48.89, lng:2.37, about:"Public venue with open spaces where breakers train daily.", reviews:[{rating:4,text:"Always cyphers, great energy."}] },

  // Netherlands
  { id:"spot_ibe", name:"The Notorious IBE", city:"Heerlen", country:"Netherlands", crew:"The Ruggeds", type:"Jam", image:"https://placehold.co/800x500/ff9f1c/111827?text=Jam+IBE", lat:50.89, lng:5.98, about:"Festival with battles, cyphers, community sessions.", reviews:[{rating:5,text:"Best community jam."}] },

  // Slovakia
  { id:"spot_outbreak", name:"Outbreak Europe", city:"Banská Bystrica", country:"Slovakia", crew:"The Legits", type:"Jam", image:"https://placehold.co/800x500/ff9f1c/111827?text=Jam+Outbreak", lat:48.74, lng:19.15, about:"Respected jam combining battles, concerts, workshops.", reviews:[{rating:5,text:"Incredible vibe."}] },

  // Switzerland
  { id:"spot_dpc", name:"DPC Jam", city:"Zurich", country:"Switzerland", crew:"DPC Academy", type:"Jam", image:"https://placehold.co/800x500/ff9f1c/111827?text=Jam+DPC", lat:47.37, lng:8.54, about:"International 2vs2 battle with workshops and cyphers.", reviews:[{rating:4,text:"Top‑level battles."}] },
  { id:"spot_rosti", name:"Rösti Summit", city:"Bern", country:"Switzerland", crew:"Breakin Flavors", type:"Cypher", image:"https://placehold.co/800x500/e71d36/111827?text=Cypher+Jam", lat:46.95, lng:7.44, about:"Grassroots cypher‑driven jam uniting Swiss and European breakers.", reviews:[{rating:5,text:"Pure hip‑hop energy."}] },

  // United Kingdom
  { id:"spot_breakinggb", name:"Breaking GB Training Hub", city:"London", country:"UK", crew:"Soul Mavericks", type:"Training", image:"https://placehold.co/800x500/2ec4b6/111827?text=Training+Hub", lat:51.51, lng:-0.13, about:"National training hub supporting UK breakers.", reviews:[{rating:5,text:"Professional facilities."}] },
  { id:"spot_castle_jam", name:"Castle Jam", city:"Newscastle", country:"UK", crew:"Bad Taste Cru", type:"Jam", image:"https://placehold.co/800x500/ff9f1c/111827?text=Jam+Castle", lat:54.97, lng:-1.61, about:"Long-running community jam in the North East.", reviews:[{rating:4,text:"Great vibes."}] },


  // Germany
  { id:"spot_tempel", name:"Tempelhofer Feld Floors", city:"Berlin", country:"Germany", crew:"Berlin Breakers", type:"Training", image:"https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat:52.48, lng:13.40, about:"Smooth open floors and community sessions.", reviews:[{rating:5,text:"Friendly sessions."}] },
  { id:"spot_factory", name:"Munich Urban Factory", city:"Munich", country:"Germany", crew:"Munich City Breakers", type:"Training", image:"https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat:48.14, lng:11.58, about:"Indoor studio with open practice nights and cyphers.", reviews:[{rating:4,text:"Great floors."}] },

  // Italy
  { id:"spot_rome_cyphers", name:"Rome Street Cyphers", city:"Rome", country:"Italy", crew:"Rome City Rockers", type:"Cypher", image:"https://placehold.co/800x500/e71d36/111827?text=Cypher+Jam", lat:41.90, lng:12.50, about:"Open-air cyphers near cultural hubs, weekly sessions.", reviews:[{rating:4,text:"Pure vibe."}] },
  { id:"spot_milanhub", name:"Milan Breaking Hub", city:"Milan", country:"Italy", crew:"Bandits Crew", type:"Training", image:"https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat:45.46, lng:9.19, about:"Community gym with daily practice and weekend cyphers.", reviews:[{rating:5,text:"Solid training schedule."}] },

  // Spain
  { id:"spot_barcelona", name:"Barcelona Beach Cyphers", city:"Barcelona", country:"Spain", crew:"BCN Breakers", type:"Cypher", image:"https://placehold.co/800x500/e71d36/111827?text=Cypher+Jam", lat:41.39, lng:2.17, about:"Sunset cyphers by the beach, summer specials.", reviews:[{rating:5,text:"Unreal atmosphere."}] },
  { id:"spot_madridhub", name:"Madrid Training Hub", city:"Madrid", country:"Spain", crew:"Madrid Rockers", type:"Training", image:"https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat:40.42, lng:-3.70, about:"Central gym with pro floors and weekly battles.", reviews:[{rating:4,text:"Strong local scene."}] },
  
  // Poland
  { id:"spot_warsaw", name:"Warsaw Challenge", city:"Warsaw", country:"Poland", crew:"Polski Funk", type:"Jam", image:"https://placehold.co/800x500/ff9f1c/111827?text=Jam+Warsaw", lat:52.23, lng:21.01, about:"Major international event with high-level battles.", reviews:[{rating:5,text:"Crazy level!"}] },

  // Greece
  { id:"spot_bcone_greece", name:"BC One Cypher Greece", city:"Athens", country:"Greece", crew:"Floor Abduction", type:"Cypher", image:"https://placehold.co/800x500/e71d36/111827?text=Cypher+BC+One", lat:37.98, lng:23.73, about:"The official Red Bull BC One qualifier for Greece.", reviews:[{rating:5,text:"Best breakers in Greece."}] },
  
  // Sweden
  { id:"spot_stockholm", name:"Stockholm Training Spot", city:"Stockholm", country:"Sweden", crew:"Ghost Crew", type:"Training", image:"https://placehold.co/800x500/2ec4b6/111827?text=Training+Spot", lat:59.33, lng:18.07, about:"Open community training spot in the heart of the city.", reviews:[{rating:4,text:"Good floors, good music."}] }
];

// --- Crews Data (New) ---
const crews = [
    { id: "crew_vagabonds", name: "Vagabonds Crew", country: "France", about: "Legendary crew known for their style and BOTY wins." },
    { id: "crew_ruggeds", name: "The Ruggeds", country: "Netherlands", about: "World-renowned for their acrobatic and creative style." },
    { id: "crew_soulmavericks", name: "Soul Mavericks", country: "UK", about: "One of the UK's most dominant and long-standing crews." },
    { id: "crew_bandits", name: "Bandits Crew", country: "Italy", about: "Top Italian crew with a strong presence in the European scene." },
    { id: "crew_legits", name: "The Legits", country: "Slovakia", about: "Organizers of Outbreak Europe, a major force in the scene." },
    { id: "crew_paris_city", name: "Paris City Breakers", country: "France", about: "New generation crew pushing the limits in Paris." }
];

// --- Story Mode Data (Revamped) ---
const storySlidesData = [
  { 
    title: "Welcome to BreakAtlas!", 
    text: "Your ultimate guide to the global breaking scene. Let's explore the key features to get you started on your journey.",
    image: "https://placehold.co/600x300/1f2937/ff9f1c?text=Welcome!"
  },
  { 
    title: "The Dashboard", 
    text: "This is your home base. You can search for spots, see your stats, and explore the interactive map to find jams, cyphers, and training spots near you.",
    image: "https://placehold.co/600x300/1f2937/ff9f1c?text=Dashboard+Map"
  },
  { 
    title: "Save Your Favorites", 
    text: "Found a spot you love? Hit the 'Favorite' button on any card. This saves it to your profile and helps you track your journey.",
    image: "https://placehold.co/600x300/1f2937/ff9f1c?text=Favorite+Spots"
  },
  { 
    title: "Build Your Profile", 
    text: "Your Profile is where you can see all your favorites, create collections, track your achievements, and even change your app's theme color!",
    image: "https://placehold.co/600x300/1f2937/ff9f1c?text=Your+Profile"
  },
  { 
    title: "You're Ready!", 
    text: "That's it! You're all set to explore the world of breaking. Go find your next session!",
    image: "https://placehold.co/600x500/1f2937/ff9f1c?text=Go+Explore!"
  }
];