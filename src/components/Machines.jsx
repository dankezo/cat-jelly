import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Machine visuals, own code. Bulk machines are deliberately larger than
// the press and the camera is pulled back for them (see Scene camera).
const TIER_STYLE = {
  'fire-dragon': { frame: '#2a1f1a', accent: '#ff5a1f', aura: '#ff7a2a' },
  hell: { frame: '#1d1530', accent: '#a855f7', aura: '#c084fc' },
  angel: { frame: '#e8e0c8', accent: '#67e8f9', aura: '#a5f3fc' },
  home: { frame: '#d8d8d8', accent: '#3a7bd5', aura: '#7fb3d5' },
  storm: { frame: '#223344', accent: '#22d3ee', aura: '#67e8f9' },
  void: { frame: '#1a1028', accent: '#a855f7', aura: '#c084fc' },
  workshop: { frame: '#5a4632', accent: '#f59e0b', aura: '#fbbf24' },
  industrial: { frame: '#333a44', accent: '#f97316', aura: '#fb923c' },
  'diamond-mill': { frame: '#e8e0c8', accent: '#facc15', aura: '#fef08a' },
}

export function PressMachine({ tier, platenY }) {
  const st = TIER_STYLE[tier.id] || TIER_STYLE['fire-dragon']
  return (
    <group>
      {[-1.9, 1.9].map((x) => (
        <mesh key={x} position={[x, 2.2, 0]} castShadow>
          <boxGeometry args={[0.35, 4.4, 0.35]} />
          <meshStandardMaterial color={st.frame} />
        </mesh>
      ))}
      <mesh position={[0, 4.5, 0]} castShadow>
        <boxGeometry args={[4.4, 0.5, 1.4]} />
        <meshStandardMaterial color={st.frame} />
      </mesh>
      {/* Aura ring: the tier VFX, not a parameter change. */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.6, 32]} />
        <meshBasicMaterial color={st.aura} transparent opacity={0.45} />
      </mesh>
      <group position={[0, platenY, 0]}>
        <mesh castShadow>
          <boxGeometry args={[3.4, 0.4, 2.2]} />
          <meshStandardMaterial color={st.accent} metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.9, 16]} />
          <meshStandardMaterial color={st.frame} />
        </mesh>
      </group>
    </group>
  )
}

// Bulk blender: a wide jar, 1.35x the press footprint. The blade spins,
// but fragments are contained by the jar walls (see Scene chamber colliders).
export function BlenderMachine({ tier, active, spin }) {
  const st = TIER_STYLE[tier.id] || TIER_STYLE.home
  const blade = useRef()
  useFrame((_, dt) => { if (blade.current && active) blade.current.rotation.y += dt * spin })
  return (
    <group scale={1.35}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[1.7, 1.4, 3.2, 24, 1, true]} />
        <meshPhysicalMaterial color="#cfe8f5" transparent opacity={0.35} roughness={0.1} side={2} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.3, 24]} />
        <meshStandardMaterial color={st.frame} />
      </mesh>
      <group ref={blade} position={[0, 0.5, 0]}>
        {[0, Math.PI / 2].map((r) => (
          <mesh key={r} rotation={[0, r, 0.3]}>
            <boxGeometry args={[2.4, 0.08, 0.35]} />
            <meshStandardMaterial color={st.accent} metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 3.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.75, 24]} />
        <meshBasicMaterial color={st.aura} transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

export function GrinderMachine({ tier, active }) {
  const st = TIER_STYLE[tier.id] || TIER_STYLE.workshop
  const roller = useRef()
  useFrame((_, dt) => { if (roller.current && active) roller.current.rotation.z += dt * 3 })
  return (
    <group scale={1.3}>
      <mesh position={[0, 3.4, 0]} castShadow>
        <cylinderGeometry args={[1.9, 1.2, 1.6, 4]} />
        <meshStandardMaterial color={st.frame} />
      </mesh>
      <group ref={roller} position={[0, 1.6, 0]}>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.55, 0.55, 2.2, 16]} />
            <meshStandardMaterial color={st.accent} metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[3.2, 0.4, 2.4]} />
        <meshStandardMaterial color={st.frame} />
      </mesh>
    </group>
  )
}
