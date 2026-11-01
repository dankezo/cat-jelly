import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MATERIALS } from '../game/constants'

// Procedural jelly cat: own geometry, no copied model, no mini-cat clones
// anywhere else in the app. Squash is driven by the press, wobble by time.
export default function CatMesh({ cat, position, squash = 0, wobble = 0, onClick, photoTexture }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    const jig = 1 + Math.sin(t * 6 + cat.seed) * 0.03 * (1 + wobble)
    ref.current.scale.set(1 + squash * 0.9, Math.max(0.18, 1 - squash * 0.82), 1 + squash * 0.9)
    ref.current.scale.multiplyScalar(jig)
    ref.current.rotation.z = Math.sin(t * 2 + cat.seed) * 0.02 * (1 + wobble)
  })
  const m = MATERIALS[cat.material]
  const s = cat.size
  const bodyMat = photoTexture
    ? { map: photoTexture }
    : { color: m.color, transparent: m.opacity < 1, opacity: m.opacity }
  return (
    <group position={position} onClick={onClick}>
      <group ref={ref}>
        <mesh castShadow>
          <sphereGeometry args={[0.9 * s, 24, 20]} />
          <meshPhysicalMaterial {...bodyMat} roughness={0.25} transmission={cat.material === 'glass' ? 0.6 : 0} />
        </mesh>
        {[-0.55, 0.55].map((x) => (
          <mesh key={x} position={[x * s, 0.85 * s, 0]}>
            <coneGeometry args={[0.28 * s, 0.5 * s, 4]} />
            <meshPhysicalMaterial {...bodyMat} roughness={0.25} />
          </mesh>
        ))}
        {[-0.32, 0.32].map((x) => (
          <mesh key={x} position={[x * s, 0.15 * s, 0.82 * s]}>
            <sphereGeometry args={[0.09 * s, 12, 10]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
        ))}
        {/* Crack overlay: a few dark ribbons whose opacity follows damage. */}
        {cat.damage > 0.15 && (
          <mesh position={[0, 0.1 * s, 0.88 * s]} rotation={[0, 0, 0.4]}>
            <planeGeometry args={[0.9 * s * cat.damage, 0.03]} />
            <meshBasicMaterial color="#111111" transparent opacity={Math.min(0.85, cat.damage)} />
          </mesh>
        )}
      </group>
    </group>
  )
}
