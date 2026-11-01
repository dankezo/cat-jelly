// Game data, kept in one place so UI, HUD and physics never drift apart.
// Prices and rates are session-only: money is never persisted to a server.

export const MACHINE_TYPES = ['press', 'grinder', 'blender']

export const TIERS = {
  press: [
    { id: 'fire-dragon', price: 0, barBonus: 250, mult: 1.15, label: 'Fire Dragon' },
    { id: 'hell', price: 450, barBonus: 450, mult: 1.30, label: 'Hell' },
    { id: 'angel', price: 1100, barBonus: 750, mult: 1.50, label: 'Angel' },
  ],
  blender: [
    { id: 'home', price: 0, speed: 1.0, fineness: 0.24, capacity: 1, label: 'Home Blender' },
    { id: 'storm', price: 400, speed: 1.3, fineness: 0.14, capacity: 2, label: 'Storm Turbo' },
    { id: 'void', price: 950, speed: 1.55, fineness: 0.075, capacity: 3, label: 'Void Vortex' },
  ],
  grinder: [
    { id: 'workshop', price: 120, speed: 1.0, fineness: 0.20, capacity: 1, label: 'Workshop Grinder' },
    { id: 'industrial', price: 500, speed: 1.35, fineness: 0.115, capacity: 2, label: 'Industrial Grinder' },
    { id: 'diamond-mill', price: 1050, speed: 1.5, fineness: 0.055, capacity: 3, label: 'Diamond Mill' },
  ],
}

// Per-material physics. The numbers below are the ones the HUD reads and
// the solvers use, so what the player sees and what the HUD says agree.
// work: relative blend/grind speed. Jelly 1.45, diamond 0.30 = ~4.8x gap.
export const MATERIALS = {
  glass:  { color: '#e8f7f7', crack: 'radial',    hardness: 5, bounce: 0.55, friction: 0.25, density: 2.5, needBar: 210, work: 0.85, price: 4,  opacity: 0.45 },
  iron:   { color: '#7a7f88', crack: 'fatigue',   hardness: 7, bounce: 0.12, friction: 0.65, density: 7.8, needBar: 350, work: 0.55, price: 6,  opacity: 1.0 },
  diamond:{ color: '#46ecd2', crack: 'cleavage',  hardness: 10, bounce: 0.30, friction: 0.35, density: 3.5, needBar: 490, work: 0.30, price: 25, opacity: 1.0 },
  jelly:  { color: '#ffb3c7', crack: 'tears',     hardness: 1, bounce: 0.62, friction: 0.55, density: 1.0, needBar: 70,  work: 1.45, price: 1,  opacity: 0.92 },
  brick:  { color: '#b0573f', crack: 'mortar',    hardness: 4, bounce: 0.22, friction: 0.80, density: 1.9, needBar: 170, work: 0.70, price: 2,  opacity: 1.0 },
  slime:  { color: '#7fe08a', crack: 'leaks',     hardness: 1, bounce: 0.12, friction: 0.06, density: 1.1, needBar: 70,  work: 1.30, price: 1,  opacity: 0.85 },
  'toy-brick': { color: '#e8c832', crack: 'studs', hardness: 3, bounce: 0.42, friction: 0.50, density: 1.2, needBar: 130, work: 0.90, price: 3, opacity: 1.0 },
}

export const MATERIAL_IDS = Object.keys(MATERIALS)
export const CELL_POSITIONS = [
  [-1.8, 0, 0.4], [0, 0, 0.4], [1.8, 0, 0.4],
  [-1.8, 0, -1.2], [0, 0, -1.2], [1.8, 0, -1.2],
]
export const MAX_CELLS = CELL_POSITIONS.length
export const MAX_PRESS_BAR = 600
export const BASE_MACHINE_BAR = 400
// Slime containment, hard caps from the artifact repair (build e8eb8c88).
export const SLIME_CAPS = { bedRadius: 1.0, floorRadius: 0.8, maxPools: 6, poolLife: 8, maxGlobs: 64, globSize: 0.10, globLife: 4.5 }
export const CAT_NAMES = ['Mochi', 'Pudding', 'Soda']

export function catMassKg(cat) {
  const m = MATERIALS[cat.material]
  return Math.round(m.density * Math.pow(cat.size, 3) * (cat.density / 100) * 10) / 10
}
export function requiredBar(cat) {
  const m = MATERIALS[cat.material]
  return Math.round(m.needBar * Math.pow(cat.size, 3) * (cat.density / 100))
}
export function pieceValue(fragment) {
  const m = MATERIALS[fragment.material]
  return Math.max(1, Math.round(m.price * Math.pow(fragment.r / 0.4, 3) * (fragment.density / 100)))
}
