// BreakAtlas dataset — European breaking jams, cyphers & training spots
// Consistent placeholders are used for images so GitHub Pages loads reliably.

const spots = [
  // France
  { id:"spot_boty", name:"Battle of the Year France", city:"Montpellier", country:"France", crew:"Vagabonds Crew", type:"Jam", image:"https://placehold.co/800x500?text=Jam+Image", lat:43.61, lng:3.87, about:"Legendary European breaking championship.", reviews:[{rating:5,text:"Historic jam."}] },
  { id:"spot_laplace", name:"La Place Hip Hop", city:"Paris", country:"France", crew:"Paris City Breakers", type:"Training Spot", image:"https://placehold.co/800x500?text=Training+Spot", lat:48.86, lng:2.35, about:"Hip‑hop center with regular breaking sessions.", reviews:[{rating:5,text:"Perfect training spot."}] },
  { id:"spot_centquatre", name:"Centquatre", city:"Paris", country:"France", crew:"Aktuel Force", type:"Training Spot", image:"https://placehold.co/800x500?text=Training+Spot", lat:48.89, lng:2.37, about:"Public venue with open spaces where breakers train daily.", reviews:[{rating:4,text:"Always cyphers, great energy."}] },

  // Netherlands
  { id:"spot_ibe", name:"The Notorious IBE", city:"Heerlen", country:"Netherlands", crew:"The Ruggeds", type:"Jam", image:"https://placehold.co/800x500?text=Jam+Image", lat:50.89, lng:5.98, about:"Festival with battles, cyphers, community sessions.", reviews:[{rating:5,text:"Best community jam."}] },

  // Slovakia
  { id:"spot_outbreak", name:"Outbreak Europe", city:"Banská Bystrica", country:"Slovakia", crew:"The Legits", type:"Jam", image:"https://placehold.co/800x500?text=Jam+Image", lat:48.74, lng:19.15, about:"Respected jam combining battles, concerts, workshops.", reviews:[{rating:5,text:"Incredible vibe."}] },

  // Switzerland
  { id:"spot_dpc", name:"DPC Jam", city:"Zurich", country:"Switzerland", crew:"DPC Academy", type:"Jam", image:"https://placehold.co/800x500?text=Jam+Image", lat:47.37, lng:8.54, about:"International 2vs2 battle with workshops and cyphers.", reviews:[{rating:4,text:"Top‑level battles."}] },
  { id:"spot_rosti", name:"Rösti Summit", city:"Bern", country:"Switzerland", crew:"Breakin Flavors", type:"Cypher Jam", image:"https://placehold.co/800x500?text=Cypher+Image", lat:46.95, lng:7.44, about:"Grassroots cypher‑driven jam uniting Swiss and European breakers.", reviews:[{rating:5,text:"Pure hip‑hop energy."}] },

  // United Kingdom
  { id:"spot_breakinggb", name:"Breaking GB Training Hub", city:"London", country:"UK", crew:"Soul Mavericks", type:"Training Spot", image:"https://placehold.co/800x500?text=Training+Spot", lat:51.51, lng:-0.13, about:"National training hub supporting UK breakers.", reviews:[{rating:5,text:"Professional facilities."}] },

  // Germany
  { id:"spot_tempel", name:"Tempelhofer Feld Floors", city:"Berlin", country:"Germany", crew:"Berlin Breakers", type:"Training Spot", image:"https://placehold.co/800x500?text=Training+Spot", lat:52.48, lng:13.40, about:"Smooth open floors and community sessions.", reviews:[{rating:5,text:"Friendly sessions."}] },
  { id:"spot_factory", name:"Munich Urban Factory", city:"Munich", country:"Germany", crew:"Munich City Breakers", type:"Training Spot", image:"https://placehold.co/800x500?text=Training+Spot", lat:48.14, lng:11.58, about:"Indoor studio with open practice nights and cyphers.", reviews:[{rating:4,text:"Great floors."}] },

  // Italy
  { id:"spot_rome_cyphers", name:"Rome Street Cyphers", city:"Rome", country:"Italy", crew:"Rome City Rockers", type:"Cypher Jam", image:"https://placehold.co/800x500?text=Cypher+Image", lat:41.90, lng:12.50, about:"Open-air cyphers near cultural hubs, weekly sessions.", reviews:[{rating:4,text:"Pure vibe."}] },
  { id:"spot_milanhub", name:"Milan Breaking Hub", city:"Milan", country:"Italy", crew:"Bandits Crew", type:"Training Spot", image:"https://placehold.co/800x500?text=Training+Spot", lat:45.46, lng:9.19, about:"Community gym with daily practice and weekend cyphers.", reviews:[{rating:5,text:"Solid training schedule."}] },

  // Spain
  { id:"spot_barcelona", name:"Barcelona Beach Cyphers", city:"Barcelona", country:"Spain", crew:"BCN Breakers", type:"Cypher Jam", image:"https://placehold.co/800x500?text=Cypher+Image", lat:41.39, lng:2.17, about:"Sunset cyphers by the beach, summer specials.", reviews:[{rating:5,text:"Unreal atmosphere."}] },
  { id:"spot_madridhub", name:"Madrid Training Hub", city:"Madrid", country:"Spain", crew:"Madrid Rockers", type:"Training Spot", image:"https://placehold.co/800x500?text=Training+Spot", lat:40.42, lng:-3.70, about:"Central gym with pro floors and weekly battles.", reviews:[{rating:4,text:"Strong local scene."}] }
];