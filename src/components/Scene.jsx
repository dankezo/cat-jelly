import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import CatMesh from './CatMesh'
import { PressMachine, BlenderMachine, GrinderMachine } from './Machines'
import { Fragment, ChamberWalls } from './Fragments'
import SlimePools from './Slime'
import { CELL_POSITIONS } from '../game/constants'

// Camera lock: fixed camera, no OrbitControls, no rotate/zoom/dblclick.
// Bulk machines get a pulled-back camera so the whole machine is visible.
export default function Scene({ state, onSelectCat }) {
  const isBulk = state.machineType !== 'press'
  const cam = isBulk ? [0, 7.5, 14.5] : [0, 6, 10.5]
  return (
    <Canvas shadows camera={{ position: cam, fov: 42 }} style={{ height: '62vh', background: '#f3ead8' }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={1.1} castShadow />
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]}>
          {/* Floor + bed, fixed colliders so nothing falls through. */}
          <RigidBody type="fixed" colliders={false} position={[0, -0.2, 0]}>
            <CuboidCollider args={[12, 0.2, 12]} />
          </RigidBody>
          <mesh position={[0, -0.2, 0]} receiveShadow>
            <boxGeometry args={[24, 0.4, 24]} />
            <meshStandardMaterial color="#d8c9a8" />
          </mesh>
          <mesh position={[0, 0.01, 0]} receiveShadow>
            <boxGeometry args={[7.2, 0.08, 4.4]} />
            <meshStandardMaterial color="#8a8f96" metalness={0.6} roughness={0.35} />
          </mesh>

          {state.machineType === 'press' && <PressMachine tier={state.tier} platenY={state.platenY} />}
          {state.machineType === 'blender' && <BlenderMachine tier={state.tier} active={state.holding} spin={6 + state.tier.speed * 4} />}
          {state.machineType === 'grinder' && <GrinderMachine tier={state.tier} active={state.holding} />}
          {isBulk && <ChamberWalls />}

          {state.cats.map((cat, i) => (
            <CatMesh
              key={cat.id}
              cat={cat}
              position={CELL_POSITIONS[i]}
              squash={state.machineType === 'press' ? state.squash : 0}
              wobble={state.holding && state.machineType !== 'press' ? 1 : 0}
              onClick={() => onSelectCat(cat.id)}
              photoTexture={cat.photoTexture}
            />
          ))}
          {state.fragments.map((f) => <Fragment key={f.id} f={f} />)}
        </Physics>
        <SlimePools pools={state.slimePools} />
      </Suspense>
    </Canvas>
  )
}
