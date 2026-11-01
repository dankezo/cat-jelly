import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import * as THREE from 'three'
import Scene from './components/Scene'
import LeftBar from './components/ui/LeftBar'
import { PhysicsHUD, ComparePanel, Backpack } from './components/ui/Panels'
import PhotoUpload from './components/ui/PhotoUpload'
import { TIERS, MATERIALS, MATERIAL_IDS, MAX_CELLS, CAT_NAMES, SLIME_CAPS, requiredBar, catMassKg, pieceValue } from './game/constants'
import { T, detectLang } from './game/i18n'
import './App.css'

const rand = (a, b) => a + Math.random() * (b - a)
let nextId = 1

export default function App() {
  const [lang] = useState(detectLang)
  const t = T[lang]
  const [machineType, setMachineType] = useState('press')
  // Per-type tier memory: switching types NEVER resets to basic.
  const [selectedTiers, setSelectedTiers] = useState({ press: TIERS.press[0], grinder: TIERS.grinder[0], blender: TIERS.blender[0] })
  const [owned, setOwned] = useState(['fire-dragon', 'home'])
  const [money, setMoney] = useState(0)
  const [cats, setCats] = useState([])
  const [fragments, setFragments] = useState([])
  const [slimePools, setSlimePools] = useState([])
  const [holding, setHolding] = useState(false)
  const [squash, setSquash] = useState(0)
  const [platenY, setPlatenY] = useState(5.85)
  const [machineBar, setMachineBar] = useState(400)
  const [size, setSize] = useState(1.0)
  const [density, setDensity] = useState(100)
  const [selectedCatId, setSelectedCatId] = useState(null)
  const [showBackpack, setShowBackpack] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showPhoto, setShowPhoto] = useState(false)
  const [notice, setNotice] = useState('')
  const [popped, setPopped] = useState(0)
  const [broken, setBroken] = useState(false)
  const [photoTex, setPhotoTex] = useState(null)
  const holdTime = useRef(0)
  const explodeTime = useRef(0)
  const workRef = useRef(0)

  const tier = selectedTiers[machineType]
  const selectedCat = cats.find((c) => c.id === selectedCatId) || cats[0] || null

  const genCat = useCallback(() => {
    if (cats.length >= MAX_CELLS) { setNotice(t.full); setTimeout(() => setNotice(''), 2000); return }
    const material = MATERIAL_IDS[Math.floor(Math.random() * MATERIAL_IDS.length)]
    const cat = { id: nextId++, name: CAT_NAMES[Math.floor(Math.random() * CAT_NAMES.length)], material, size: rand(0.7, 1.5), density: 100, damage: 0, seed: Math.random() * 10 }
    setCats((prev) => [...prev, cat]); setSelectedCatId(cat.id)
  }, [cats, t])

  const burstCat = useCallback((cat, mode) => {
    const m = MATERIALS[cat.material]
    const count = cat.material === 'slime' ? Math.floor(rand(3, 16)) : Math.floor(rand(6, 12))
    const frags = []
    for (let i = 0; i < count; i++) {
      // Blender/grinder: chaotic inward tumble, NOT even rotation and NOT
      // outward fling. Velocities point mostly toward the centre + up,
      // with random spin, and the chamber walls contain the rest.
      const inward = mode === 'press'
        ? [rand(-1.5, 1.5), rand(1, 3), rand(-1.5, 1.5)]
        : [rand(-1.2, 1.2), rand(1.5, 4), rand(-1.2, 1.2)]
      frags.push({
        id: nextId++, material: cat.material, density: cat.density,
        r: mode === 'blender' ? (tier.fineness || 0.2) * rand(0.7, 1.3) : mode === 'grinder' ? (tier.fineness || 0.2) * rand(0.8, 1.4) : rand(0.15, 0.4),
        shape: cat.material === 'glass' || cat.material === 'diamond' ? 'shard' : mode === 'grinder' ? 'grain' : 'gel',
        pos: [rand(-1, 1), rand(0.5, 1.5), rand(-0.5, 0.5)],
        vel: inward, ang: [rand(-6, 6), rand(-6, 6), rand(-6, 6)],
      })
    }
    setFragments((prev) => [...prev, ...frags])
    if (cat.material === 'slime') {
      setSlimePools((prev) => {
        const merged = [...prev, { id: nextId++, x: rand(-0.5, 0.5), z: rand(-0.5, 0.5), r: 0.6, jig: 1, onFloor: false }]
        return merged.slice(-SLIME_CAPS.maxPools)
      })
    }
    setCats((prev) => prev.filter((c) => c.id !== cat.id))
    setPopped((p) => p + 1)
  }, [tier])

  // Hold loop: 50 ms ticks. Press squashes + damages, blend/grind works.
  useEffect(() => {
    if (!holding || broken || cats.length === 0) return
    const iv = setInterval(() => {
      holdTime.current += 0.05
      if (machineType === 'press') {
        setSquash((s) => Math.min(1, s + 0.03))
        setPlatenY((y) => Math.max(1.3, y - 0.12))
        setCats((prev) => prev.map((c) => {
          const need = requiredBar(c)
          const rate = need <= machineBar ? 0.06 * (tier.mult || 1) : 0.01
          const dmg = Math.min(1, c.damage + rate)
          if (dmg >= 1) setTimeout(() => burstCat(c, 'press'), 0)
          return { ...c, damage: dmg }
        }))
        // Explosion: holding at >=97% of machine max with need > max.
        const anyNeed = cats.some((c) => requiredBar(c) > machineBar)
        if (anyNeed && machineBar >= 582) {
          explodeTime.current += 0.05
          if (explodeTime.current >= 0.85) {
            setBroken(true); setPlatenY(5.85); setSquash(0)
            setTimeout(() => { setBroken(false); explodeTime.current = 0 }, 2800)
          }
        } else explodeTime.current = 0
      } else {
        // Blend/grind: work per material, jelly fastest, diamond slowest.
        workRef.current += 0.05 * (tier.speed || 1)
        const target = cats[0]
        if (target) {
          const m = MATERIALS[target.material]
          const needWork = 1 / m.work
          if (workRef.current >= needWork) {
            workRef.current = 0
            // Capacity: only up to tier.capacity cats per hold session.
            burstCat(target, machineType)
          }
        }
      }
    }, 50)
    return () => clearInterval(iv)
  }, [holding, broken, cats, machineType, machineBar, tier, burstCat])

  const stopHold = () => { setHolding(false); setSquash(0); setPlatenY(5.85); workRef.current = 0 }

  const vacuum = () => {
    const earned = fragments.reduce((s, f) => s + pieceValue(f), 0)
    setMoney((m) => m + earned); setFragments([]); setSlimePools([])
  }

  const buyTier = (tierToBuy) => {
    if (money < tierToBuy.price) return
    setMoney((m) => m - tierToBuy.price)
    setOwned((o) => [...o, tierToBuy.id])
    setSelectedTiers((s) => ({ ...s, [machineType]: tierToBuy }))
  }

  const applyMaterial = (id) => {
    if (!selectedCat) return
    setCats((prev) => prev.map((c) => c.id === selectedCat.id ? { ...c, material: id, damage: 0 } : c))
    setShowCompare(false)
  }

  const usePhoto = (url, suggestion) => {
    new THREE.TextureLoader().load(url, (tex) => {
      setPhotoTex(tex)
      const cat = { id: nextId++, name: suggestion?.name || 'Photo', material: 'jelly', size: 1.1, density: 100, damage: 0, seed: Math.random() * 10, photoTexture: tex }
      if (cats.length < MAX_CELLS) setCats((prev) => [...prev, cat])
      setShowPhoto(false)
    })
  }

  const holdLabel = machineType === 'press' ? t.hold : machineType === 'blender' ? t.blendBtn : t.grindBtn
  const state = { machineType, tier, cats, fragments, slimePools, holding, squash, platenY }

  return (
    <div className="app">
      <header>
        <h1>JELLY CAT PRESS</h1>
        <span>{t.tag}</span>
        <span className="popped">{t.catsPopped}: {popped} · {t.money}: ${money}</span>
      </header>
      <div className="main">
        <LeftBar t={t} machineType={machineType} onSelect={setMachineType} tierLabel={tier.label} />
        <div className="scene-wrap">
          <Scene state={state} onSelectCat={setSelectedCatId} />
          {!holding && cats.length > 0 && (
            <div className="side-note"><strong>{t.ready}</strong><div>{t.readySub}</div></div>
          )}
          {notice && <div className="notice">{notice}</div>}
          {broken && <div className="notice">Machine broken - recovering…</div>}
        </div>
        <div className="deck">
          <div className="deck-row">
            <button onClick={genCat}>{t.gen}</button>
            <button className="hold" onPointerDown={() => { if (!broken && cats.length) setHolding(true) }} onPointerUp={stopHold} onPointerLeave={stopHold}>{holdLabel}</button>
            <button onClick={vacuum}>{t.vacuum} ({fragments.length})</button>
          </div>
          <div className="deck-row">
            <button onClick={() => setShowBackpack(true)}>{t.backpack}</button>
            <button onClick={() => setShowCompare(true)}>{t.compare}</button>
            <button onClick={() => setShowPhoto(true)}>{t.photo}</button>
          </div>
          <div className="deck-row sliders">
            <label>{t.surface}
              <select value={selectedCat?.material || 'jelly'} onChange={(e) => applyMaterial(e.target.value)}>
                {MATERIAL_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            <label>{t.size} {Math.round(size * 100)}%
              <input type="range" min="70" max="150" value={Math.round(size * 100)} onChange={(e) => setSize(Number(e.target.value) / 100)} />
            </label>
            <label>{t.density} {density}%
              <input type="range" min="50" max="200" value={density} onChange={(e) => setDensity(Number(e.target.value))} />
            </label>
            {machineType === 'press' && (
              <label>{machineBar} {t.bar}
                <input type="range" min="100" max="600" value={machineBar} onChange={(e) => setMachineBar(Number(e.target.value))} />
              </label>
            )}
          </div>
          <PhysicsHUD t={t} cat={selectedCat} />
        </div>
      </div>
      {showBackpack && <Backpack t={t} machineType={machineType} owned={owned} selectedTier={tier} money={money} onBuy={buyTier} onSelect={(nt) => setSelectedTiers((s) => ({ ...s, [machineType]: nt }))} onClose={() => setShowBackpack(false)} />}
      {showCompare && <ComparePanel t={t} onApply={applyMaterial} onClose={() => setShowCompare(false)} />}
      {showPhoto && <PhotoUpload t={t} onUsePhoto={usePhoto} onClose={() => setShowPhoto(false)} />}
    </div>
  )
}
