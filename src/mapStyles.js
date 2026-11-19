// The looks of the base map: colours of every map layer, the untitled garages, the sky, the light and the shadows.
// Titled garages keep their title colours and the ribbon stays cobalt in every style.
//   bg: sky / background · ground: the land everywhere · green, parking, site (the garage yard), road, lane, path, tram
//   home, other, garage: buildings (homes, other buildings, garages outside the site)
//   empty: garages without a title · shell: garages cleared for the ribbon
//   hemi: soft light from the sky [sky colour, ground colour, strength] · sun: [colour, strength] · shadows: on or off
//   flat: the map is drawn without light and shade, like a printed plan
export const MAP_STYLES = {
  current: {
    name: 'Current',
    note: 'The light, neutral model as it was.',
    bg: '#eef3f5', ground: '#e8e5dc', green: '#c4d4a8', parking: '#d2d0ca', site: '#d9d3c3',
    road: '#b1b0ac', lane: '#c6c3ba', path: '#f1eee6', tram: '#b5484a',
    home: '#f3f1ec', other: '#dfe2e5', garage: '#cfccc4', empty: '#dcd8cf', shell: '#ddd7cb',
    hemi: ['#ffffff', '#c9c3b5', 1.15], sun: ['#fff6e6', 2.4], shadows: true,
  },
  realistic: {
    name: 'Realistic',
    note: 'Grass, asphalt, paving, plaster and concrete under a summer sky.',
    bg: '#b9d3ea', ground: '#a9a58f', green: '#6f9a4a', parking: '#7d7d7a', site: '#8f8a7f',
    road: '#4a4c50', lane: '#66676a', path: '#c8bfae', tram: '#6b5d52',
    home: '#efe6d4', other: '#c7c4bd', garage: '#a8a398', empty: '#b5afa3', shell: '#a8a296',
    hemi: ['#dcecff', '#6f6a58', 1.0], sun: ['#fff1d6', 3.0], shadows: true,
  },
  nolli: {
    name: 'Nolli',
    note: 'Figure and ground: buildings black, all open public space white.',
    bg: '#ffffff', ground: '#ffffff', green: '#eef1e9', parking: '#ffffff', site: '#ffffff',
    road: '#ffffff', lane: '#ffffff', path: '#ffffff', tram: '#e30613',
    home: '#141414', other: '#141414', garage: '#141414', empty: '#262626', shell: '#262626',
    hemi: ['#ffffff', '#ffffff', 1.6], sun: ['#ffffff', 1.2], shadows: false, flat: true,
  },
  beige: {
    name: 'Beige',
    note: 'One warm palette of sand and cream tones.',
    bg: '#f4ede1', ground: '#ece2cf', green: '#dccfb2', parking: '#e2d6bf', site: '#e6dac3',
    road: '#d3c4a7', lane: '#dacdb3', path: '#f6efe2', tram: '#b89e7a',
    home: '#f8f2e7', other: '#efe5d3', garage: '#e3d5bb', empty: '#e8dbc4', shell: '#e0d1b6',
    hemi: ['#fffaf0', '#cdbb9a', 1.15], sun: ['#fff1dc', 2.2], shadows: true,
  },
  white: {
    name: 'White model',
    note: 'Everything white, like a card model: only light and shadow show the form.',
    bg: '#f2f2f0', ground: '#f7f7f5', green: '#ededea', parking: '#f3f3f1', site: '#f5f5f3',
    road: '#e6e6e3', lane: '#ebebe8', path: '#fafaf8', tram: '#d9d9d5',
    home: '#ffffff', other: '#ffffff', garage: '#fbfbf9', empty: '#fdfdfb', shell: '#f6f6f4',
    hemi: ['#ffffff', '#d8d8d4', 1.1], sun: ['#ffffff', 2.6], shadows: true,
  },
  grey: {
    name: 'Grey plan',
    note: 'Quiet greys, so the cobalt ribbon and the titles stand out most.',
    bg: '#e9eaeb', ground: '#dcdddd', green: '#cdd0cb', parking: '#d3d4d4', site: '#d6d6d5',
    road: '#bdbebf', lane: '#c8c9c9', path: '#e9e9e8', tram: '#9a9b9c',
    home: '#a9aaab', other: '#b4b5b6', garage: '#a2a3a4', empty: '#c4c5c5', shell: '#bdbebe',
    hemi: ['#ffffff', '#b9babb', 1.15], sun: ['#ffffff', 2.2], shadows: true,
  },
  night: {
    name: 'Night',
    note: 'A dark map, for presentations on screen.',
    bg: '#14181f', ground: '#1d222b', green: '#1f2a24', parking: '#232831', site: '#262b33',
    road: '#2f3540', lane: '#2a303a', path: '#3a404b', tram: '#8c3a3d',
    home: '#3b414c', other: '#343a44', garage: '#30353e', empty: '#4a505b', shell: '#454b56',
    hemi: ['#8ea2c4', '#1a1d24', 0.9], sun: ['#c9d6ff', 1.3], shadows: true,
  },
}
export const MAP_STYLE_IDS = Object.keys(MAP_STYLES)
