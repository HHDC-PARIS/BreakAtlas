// app.js — main application logic (ES Module)


import { BREAKS } from './data.js';


const state = {
all: BREAKS.slice(),
filtered: [],
favorites: new Set(JSON.parse(localStorage.getItem('breakatlas.favs') || '[]')),
profile: JSON.parse(localStorage.getItem('breakatlas.profile') || '{}')
};


// DOM
const el = {
search: document.getElementById('searchInput'),
region: document.getElementById('filterRegion'),
sort: document.getElementById('sortSelect'),
breakList: document.getElementById('breakList'),
tpl: document.getElementById('breakItemTpl'),
toggleMapBtn: document.getElementById('toggleMapBtn'),
mapPane: document.getElementById('mapPane'),
mapContainer: document.getElementById('map'),
profileBtn: document.getElementById('profileBtn'),
profileModal: document.getElementById('profileModal'),
profileName: document.getElementById('profileName'),
profileEmail: document.getElementById('profileEmail'),
profileRegion: document.getElementById('profileRegion'),
saveProfileBtn: document.getElementById('saveProfile'),
closeProfileBtn: document.getElementById('closeProfile'),
resetProfileBtn: document.getElementById('resetProfile'),
showFavoritesBtn: document.getElementById('showFavorites'),
exportBtn: document.getElementById('exportBtn'),
importBtn: document.getElementById('importBtn'),
fileInput: document.getElementById('fileInput')
};


// Initialize map
let map, markersLayer;
function initMap(){
map = L.map(el.mapContainer, {zoomControl:true}).setView([20,0],2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '© OpenStreetMap contributors'}).addTo(map);
markersLayer = L.layerGroup().addTo(map);
}


function clearMarkers(){ markersLayer.clearLayers(); }


function addMarkerFor(b){
const m = L.marker([b.lat, b.lon]).addTo(markersLayer);
const popup = `<strong>${escapeHtml(b.name)}</strong><br/>${escapeHtml(b.country)} — ${b.rating} ★`;
m.bindPopup(popup);
m.on('click', ()=>{
// highlight item in list
const li = document.querySelector(`[data-id='${b.id}']`);
if(li){ li.scrollIntoView({behavior:'smooth', block:'center'}); li.classList.add('highlight'); setTimeout(()=>li.classList.remove('highlight'), 1200); }
});
}


function renderList(items){
el.breakList.innerHTML = '';
const tpl = el.tpl.content;
items.forEach(b=>{
const clone = document.importNode(tpl, true);
const li = clone.querySelector('li');
li.dataset.id = b.id;
clone.querySelector('.