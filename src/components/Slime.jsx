import React from 'react'
import { SLIME_CAPS } from '../game/constants'

// Slime residue only: capped, merged pools, no flow streams, no waterfall,
// no infinite spreading. Radius is clamped at render time as a second guard.
export default function SlimePools({ pools }) {
  const capped = pools.slice(0, SLIME_CAPS.maxPools)
  return (
    <group>
      {capped.map((p) => {
        const r = Math.min(p.onFloor ? SLIME_CAPS.floorRadius : SLIME_CAPS.bedRadius, p.r)
        return (
          <mesh key={p.id} position={[p.x, 0.04, p.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[1 + p.jig * 0.05, 1 - p.jig * 0.03, 1]}>
            <circleGeometry args={[r, 24]} />
            <meshPhysicalMaterial color="#7fe08a" transparent opacity={0.75} roughness={0.15} />
          </mesh>
        )
      })}
    </group>
  )
}
