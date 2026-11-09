// The titles you can give a garage, with the colour each one shows in the model.
// To rename one, change `name`. To add one, copy a line and give it a new `id`.
export const TITLES = [
  { id: 'laundry', name: 'LAUNDRY', color: '#4e8fd8' },
  { id: 'kitchen', name: 'KITCHEN/BBQ', color: '#e0612f' },
  { id: 'toolshed', name: 'TOOLSHED', color: '#8a6a45' },
  { id: 'bikestore', name: 'BIKE STORAGE', color: '#2f9e8f' },
  { id: 'lab', name: 'COMPUTER/PRINT LAB', color: '#5b5fc7' },
  { id: 'petwash', name: 'PET WASH BAY', color: '#62b8e0' },
  { id: 'material', name: 'MATERIAL LIBRARY', color: '#b0884a' },
  { id: 'books', name: 'BOOKS', color: '#8d4fb0' },
  { id: 'suitcases', name: 'SUITCASES/CARTS/TENTS', color: '#7d8f3a' },
  { id: 'hosting', name: 'HOSTING CHAIRS/TABLES', color: '#c9a227' },
  { id: 'cinema', name: 'CINEMA', color: '#33384a' },
  { id: 'cowork', name: 'COWORK', color: '#3c7dbf' },
  { id: 'bikerepair', name: 'BIKE REPAIR', color: '#1f7a5c' },
  { id: 'cafe', name: 'CAFE/BAR', color: '#c8453e' },
  { id: 'market', name: 'MARKET', color: '#e39a2d' },
  { id: 'music', name: 'MUSIC ROOMS', color: '#b4407e' },
  { id: 'play', name: 'PLAYROOM/GAMING', color: '#e872a8' },
  { id: 'fitness', name: 'FITNESS STUDIO', color: '#d9502f' },
  { id: 'swap', name: 'SWAPSHOP', color: '#6aa84f' },
  { id: 'picnic', name: 'PICNIC', color: '#9cc25a' },
  { id: 'vending', name: '24/7 VENDING', color: '#6b7a8a' },
  { id: 'toilet', name: 'TOILET', color: '#3fa7b5' },
  // `clear: true` makes the garage see-through in the model.
  { id: 'between', name: 'IN-BETWEEN SPACE', color: '#8fbfd8', clear: true },
]
export const TITLE = Object.fromEntries(TITLES.map((t) => [t.id, t]))
export const EMPTY_COLOR = '#dcd8cf'
