import React from 'react'
import { TIERS, MATERIALS, MATERIAL_IDS, catMassKg, requiredBar } from '../../game/constants'

// Physics HUD: reads the SAME constants the solvers use, updated live.
// Compare: all 7 materials side by side; tapping one applies it to the cat.
export function PhysicsHUD({ t, cat }) {
  if (!cat) return null
  const m = MATERIALS[cat.material]
  return (
    <div className="hud">
      <div><strong>{cat.name}</strong> · {cat.material}</div>
      <div>{t.crack}: {m.crack} · {t.hardness}: {m.hardness}/10</div>
      <div>{t.bounce}: {Math.round(m.bounce * 100)}% · {t.mass}: {catMassKg(cat)} kg</div>
      <div>{t.needs}: {requiredBar(cat)} {t.bar} · {t.damage}: {Math.round(cat.damage * 100)}%</div>
      <div className="bar"><i style={{ width: `${m.hardness * 10}%` }} /></div>
    </div>
  )
}

export function ComparePanel({ t, onApply, onClose }) {
  return (
    <div className="panel">
      <button className="close" onClick={onClose}>×</button>
      <h3>{t.compare}</h3>
      {MATERIAL_IDS.map((id) => {
        const m = MATERIALS[id]
        return (
          <button key={id} className="compare-row" onClick={() => onApply(id)}>
            <strong>{id}</strong><span>{m.crack}</span><span>{m.hardness}/10</span>
            <span>{Math.round(m.bounce * 100)}%</span><span>{m.needBar} {t.bar}</span>
          </button>
        )
      })}
    </div>
  )
}

// Backpack filtered to the CURRENT machine type only. Each type remembers
// its own selected tier in App state, so switching never resets to basic.
export function Backpack({ t, machineType, owned, selectedTier, money, onBuy, onSelect, onClose }) {
  return (
    <div className="panel">
      <button className="close" onClick={onClose}>×</button>
      <h3>{t.backpack} · {t.money}: ${money}</h3>
      {TIERS[machineType].map((tier) => {
        const isOwned = owned.includes(tier.id)
        const isSel = selectedTier.id === tier.id
        return (
          <div key={tier.id} className="tier-row">
            <strong>{tier.label}</strong>
            <span>{tier.price === 0 ? 'Free' : `$${tier.price}`}</span>
            {isOwned
              ? <button disabled={isSel} onClick={() => onSelect(tier)}>{isSel ? '✓' : 'Use'}</button>
              : <button disabled={money < tier.price} onClick={() => onBuy(tier)}>Buy</button>}
          </div>
        )
      })}
    </div>
  )
}
