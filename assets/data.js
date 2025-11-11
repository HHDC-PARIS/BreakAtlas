// Improved sample dataset for BreakAtlas
// Keep this file small and extendable — used by app.js


const BREAKS = [
{
id: 'BRT001',
name: 'La Pointe (Sample)',
country: 'France',
region: 'Europe',
lat: 48.6636,
lon: -2.0269,
description: 'Long pointbreak, reliable swell in autumn — best at mid-tide. Rocky bottom.',
rating: 4.2,
popularity: 78,
tags: ['point', 'rocky', 'intermediate'],
photos: [],
},
{
id: 'BRT002',
name: 'Hidden Bay',
country: 'Portugal',
region: 'Europe',
lat: 37.0179,
lon: -8.9048,
description: 'Sheltered bay break with mellow waves; family friendly.',
rating: 3.8,
popularity: 46,
tags: ['beach', 'beginner'],
photos: [],
},
{
id: 'BRT003',
name: 'South Reef',
country: 'Morocco',
region: 'Africa',
lat: 30.5412,
lon: -9.6846,
description: 'Powerful reef break, for experienced surfers only.',
rating: 4.7,
popularity: 90,
tags: ['reef','advanced','powerful'],
photos: [],
}
];


// Expose to window for simple inclusion
if (typeof window !== 'undefined') window.BREAKS = BREAKS;
export { BREAKS };