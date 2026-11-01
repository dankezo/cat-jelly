import React from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { MATERIALS } from '../game/constants'

// Realistic fragments only: shards, chunks, grains, powder, gel pieces.
// Never mini-cat clones. Rapier handles bounce/friction/mass per material.
export function Fragment({ f }) {
  const m = MATERIALS[f.material]
  const geo = f.shape === 'shard'
    ? <coneGeometry args={[f.r, f.r * 2, 4]} />
    : f.shape === 'grain'
    ? <boxGeometry args={[f.r * 2, f.r * 1.2, f.r * 2]} />
    : <sphereGeometry args={[f.r, 12, 10]} />
  return (
    <RigidBody
      colliders={f.shape === 'grain' ? 'cuboid' : 'ball'}
      position={f.pos}
      linearVelocity={f.vel}
      angularVelocity={f.ang}
      restitution={m.bounce}
      friction={m.friction}
      linearDamping={f.material === 'slime' ? 2.5 : 0.2}
      angularDamping={0.5}
    >
      <mesh castShadow>
        {geo}
        <meshStandardMaterial color={m.color} transparent={m.opacity < 1} opacity={m.opacity} roughness={0.35} />
      </mesh>
    </RigidBody>
  )
}

// Containment walls for the bulk chamber. Without these, a spinning blade
// flings pieces out (the bug reported 2026-11-01). Walls are fixed Rapier
// bodies, so pieces bounce/tumble INSIDE the jar instead of leaving it.
export function ChamberWalls({ radius = 2.3, height = 3.6 }) {
  const wall = (pos, args) => (
    <RigidBody type="fixed" colliders={false} position={pos}>
      <CuboidCollider args={args} restitution={0.4} friction={0.3} />
    </RigidBody>
  )
  return (
    <group>
      {wall([0, -0.1, 0], [radius, 0.2, radius])}
      {wall([radius, height / 2, 0], [0.2, height / 2, radius])}
      {wall([-radius, height / 2, 0], [0.2, height / 2, radius])}
      {wall([0, height / 2, radius], [radius, height / 2, 0.2])}
      {wall([0, height / 2, -radius], [radius, height / 2, 0.2])}
    </group>
  )
}
