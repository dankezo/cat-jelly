import React from 'react'

// Exactly 3 options, short labels. Tier selection lives in the backpack,
// filtered to this type, so the left bar never grows into a long list.
export default function LeftBar({ t, machineType, onSelect, tierLabel }) {
  const items = [
    { id: 'press', label: t.press, sub: 'Dragon' },
    { id: 'grinder', label: t.grinder, sub: 'Grinder' },
    { id: 'blender', label: t.blender, sub: 'Blender' },
  ]
  return (
    <div className="leftbar" role="tablist" aria-label={t.machines}>
      <div className="leftbar-title">{t.machines}</div>
      {items.map((it) => (
        <button key={it.id} className={machineType === it.id ? 'active' : ''} onClick={() => onSelect(it.id)}>
          <span className="dot" />
          <strong>{it.label}</strong>
          <small>{machineType === it.id ? tierLabel : it.sub}</small>
        </button>
      ))}
    </div>
  )
}
