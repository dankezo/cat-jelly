// CC0 suggestion catalogue. No model files are embedded here and none are
// downloaded by this build; entries are catalogue notes only, with licence.
// Sources checked in the 2026-11-01 library research: Kenney, Quaternius and
// KayKit packs are CC0 and need no account for direct pack downloads.
// Per-file GLB download + a licence manifest remain a follow-up (see README).
export const LIBRARY = [
  { id: 'kenney-apple', name: 'Apple', family: 'Kenney Food Kit', licence: 'CC0', color: '#e23b2e', shape: 'round' },
  { id: 'kenney-banana', name: 'Banana', family: 'Kenney Food Kit', licence: 'CC0', color: '#f2d13d', shape: 'long' },
  { id: 'kenney-burger', name: 'Burger', family: 'Kenney Food Kit', licence: 'CC0', color: '#c98a3a', shape: 'flat' },
  { id: 'kenney-car', name: 'Car', family: 'Kenney Car Kit', licence: 'CC0', color: '#3a7bd5', shape: 'long' },
  { id: 'kenney-chair', name: 'Chair', family: 'Kenney Furniture Kit', licence: 'CC0', color: '#8a5a2b', shape: 'tall' },
  { id: 'kenney-tree', name: 'Tree', family: 'Kenney Nature Kit', licence: 'CC0', color: '#3e8e41', shape: 'tall' },
  { id: 'kenney-house', name: 'House', family: 'Kenney Building Kit', licence: 'CC0', color: '#d97b4f', shape: 'tall' },
  { id: 'kenney-cup', name: 'Cup', family: 'Kenney Food Kit', licence: 'CC0', color: '#e8e8e8', shape: 'tall' },
  { id: 'quaternius-dog', name: 'Dog', family: 'Quaternius Animals', licence: 'CC0', color: '#b08968', shape: 'long' },
  { id: 'quaternius-rabbit', name: 'Rabbit', family: 'Quaternius Animals', licence: 'CC0', color: '#e8dcc8', shape: 'tall' },
  { id: 'quaternius-duck', name: 'Duck', family: 'Quaternius Animals', licence: 'CC0', color: '#f2c233', shape: 'round' },
  { id: 'quaternius-car', name: 'Truck', family: 'Quaternius Vehicles', licence: 'CC0', color: '#c23b2e', shape: 'long' },
  { id: 'quaternius-sword', name: 'Sword', family: 'Quaternius Props', licence: 'CC0', color: '#c0c8d0', shape: 'long' },
  { id: 'quaternius-shield', name: 'Shield', family: 'Quaternius Props', licence: 'CC0', color: '#3a6bd5', shape: 'flat' },
  { id: 'kaykit-mug', name: 'Mug', family: 'KayKit Household', licence: 'CC0', color: '#7fb3d5', shape: 'tall' },
  { id: 'kaykit-lamp', name: 'Lamp', family: 'KayKit Household', licence: 'CC0', color: '#f2d13d', shape: 'tall' },
  { id: 'kaykit-hammer', name: 'Hammer', family: 'KayKit Tools', licence: 'CC0', color: '#8a5a2b', shape: 'long' },
  { id: 'kaykit-wrench', name: 'Wrench', family: 'KayKit Tools', licence: 'CC0', color: '#9aa0a8', shape: 'long' },
  { id: 'kaykit-book', name: 'Book', family: 'KayKit Household', licence: 'CC0', color: '#a83232', shape: 'flat' },
  { id: 'kaykit-bottle', name: 'Bottle', family: 'KayKit Household', licence: 'CC0', color: '#5dade2', shape: 'tall' },
  { id: 'kenney-cake', name: 'Cake', family: 'Kenney Food Kit', licence: 'CC0', color: '#f5b7c4', shape: 'round' },
  { id: 'kenney-donut', name: 'Donut', family: 'Kenney Food Kit', licence: 'CC0', color: '#e89bb0', shape: 'flat' },
  { id: 'quaternius-cat', name: 'Cat', family: 'Quaternius Animals', licence: 'CC0', color: '#ffb3c7', shape: 'round' },
  { id: 'kaykit-phone', name: 'Phone', family: 'KayKit Household', licence: 'CC0', color: '#222222', shape: 'flat' },
]

// Client-side only photo analysis: canvas dominant colour, brightness, aspect.
// Nothing is uploaded, no key, no paid vision API. Returns the closest entry.
export function suggestFromPhoto(canvas) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const data = ctx.getImageData(0, 0, Math.min(w, 64), Math.min(h, 64)).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < data.length; i += 16) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++ }
  r /= n; g /= n; b /= n
  const bright = (r + g + b) / 3
  const aspect = w / h
  const shape = aspect > 1.3 ? 'long' : aspect < 0.75 ? 'tall' : Math.abs(r - g) < 30 && bright > 120 ? 'round' : 'flat'
  const dist = (hex) => {
    const v = parseInt(hex.slice(1), 16)
    return Math.hypot(r - (v >> 16), g - ((v >> 8) & 255), b - (v & 255))
  }
  const sorted = LIBRARY.map((it) => ({ ...it, score: dist(it.color) + (it.shape === shape ? 0 : 60) }))
    .sort((a, b) => a.score - b.score)
  return { dominant: `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`, bright: Math.round(bright), aspect: Math.round(aspect * 100) / 100, shape, top: sorted.slice(0, 3) }
}
