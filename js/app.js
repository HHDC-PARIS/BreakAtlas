let currentUser = null;
let spots = [...demoSpots];

const map = L.map('map').setView([48.893, 2.388], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function renderSpots(list = spots) {
  document.getElementById('cards').innerHTML = '';
  list.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${s.image}" alt="${s.name}" />
      <h2>${s.name}</h2>
      <p>${s.city}, ${s.country}</p>
      <p><strong>Crew:</strong> ${s.crew}</p>
      <p>${s.about}</p>
      <button onclick="openModal(${i})">View Details</button>
      <button onclick="follow('${s.crew}')">Follow ${s.crew}</button>
    `;
    document.getElementById('cards').appendChild(card);
    L.marker([s.lat, s.lng]).addTo(map).bindPopup(s.name);
  });

  updateFilters();
}

function updateFilters() {
  const countries = [...new Set(spots.map(s => s.country))];
  const cities = [...new Set(spots.map(s => s.city))];

  const countryFilter = document.getElementById('countryFilter');
  countryFilter.innerHTML = `<option value="">All countries</option>`;
  countries.forEach(c => {
    countryFilter.innerHTML += `<option value="${c}">${c}</option>`;
  });

  const cityFilter = document.getElementById('cityFilter');
  cityFilter.innerHTML = `<option value="">All cities</option>`;
  cities.forEach(c => {
    cityFilter.innerHTML += `<option value="${c}">${c}</option>`;
  });
}

document.getElementById('searchBtn').addEventListener('click', () => {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const country = document.getElementById('countryFilter').value;
  const city = document.getElementById('cityFilter').value;

  const filtered = spots.filter(s =>
    (s.name.toLowerCase().includes(query) ||
     s.city.toLowerCase().includes(query) ||
     s.crew.toLowerCase().includes(query)) &&
    (!country || s.country === country) &&
    (!city || s.city === city)
  );

  renderSpots(filtered);
});

function openModal(index) {
  const s = spots[index];
  document.getElementById('modalTitle').textContent = `${s.name} — ${s.city}, ${s.country}`;
  document.getElementById('modalAbout').textContent = s.about;
  document.getElementById('modalLocation').textContent = `${s.lat}, ${s.lng}`;
  document.getElementById('modalSchedule').innerHTML = s.schedule.map(sch => `<li>${sch.day}: ${sch.time}</li>`).join('');
  document.getElementById('modalContacts').innerHTML = s.contacts.map(c => `<li>${c.name} — ${c.phone} — ${c.email}</li>`).join('');
  document.getElementById('modalGallery').innerHTML = s.gallery.map(url => `<img src="${url}" />`).join('');
  document.getElementById('modal').style.display = 'block';
}

document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('modal').style.display = 'none';
});

function follow(crew) {
  if (!currentUser) return alert('Please login first');
  currentUser.follows = currentUser.follows || { crews: [] };
  currentUser.follows.crews.push(crew);
  alert(`You’re now following ${crew}`);
}

document.getElementById('loginBtn').addEventListener('click', () => {
  const name = document.getElementById('userName').value.trim();
  if (!name) return alert('Enter your name');
  currentUser = { name, follows: { countries: [], cities: [], crews: [] } };
  document.getElementById('welcomeMsg').textContent = `Welcome, ${name}`;
  document.getElementById('loginBtn').style.display = 'none';
  document.getElementById('logoutBtn').style.display = 'inline-block';
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  currentUser = null;
  document.getElementById('welcomeMsg').textContent = '';
  document.getElementById('loginBtn').style.display = 'inline-block';
  document.getElementById('logoutBtn').style.display = '