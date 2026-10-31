# V3 architecture and technical evaluation

The two HTML routes intentionally remain identical. Relative URLs work from the GitHub Pages `/cat-jelly/` prefix and from a local root. The Three.js distribution and artwork were extracted without changing their bytes. No bundler, loader service or new runtime dependency is required.

| Module | Responsibility |
| --- | --- |
| `src/soft-body.js` | Renderer-independent XPBD particles, constraints, embedding, picking, metrics |
| `src/mascot.js` | Shared smooth-union SDF anatomy and radial surface sampling |
| `src/fracture.js` | Closed partition of the deformed star-shaped surface |
| `src/app.js` | Existing scene and effects, cage/render integration, press, interaction, audio, UI, translations |
| `src/style.css` | Responsive studio presentation |
| `vendor/three.min.js` | Original r160 runtime, now shared by both routes |

## Solver

Each cat uses 178 welded boundary samples and one interior point. Its outward boundary triangles form 352 positive rest tetrahedra. The 706 unique edges resist stretch/shear; every tetrahedron has a signed-volume constraint. Per-step XPBD multipliers reset at each fixed 1/120-second substep and accumulate across 12 solver iterations; compliance is divided by timestep squared. The accumulator accepts at most 100 ms of backlog and 12 steps per call. Large pauses slow simulation instead of causing unbounded catch-up.

Presets specify edge and bulk compliance, damping, relative particle density, contact friction, restitution, failure compression and elastic recovery multiplier. Values are application units, not calibrated physical material measurements. Recovery changes edge compliance. The upright frame is not pinned: bodies can rotate or fall over. Tests therefore measure distance strain, volume, contact and finite positions, not an assumed upright pose.

Circular plate/floor callbacks constrain cage particles. The visible skin and attachments are embedded using tetrahedral barycentric coordinates. Rendering additionally clips embedded points at the same circular contact surfaces; this handles visible points outside the coarse boundary. This final clipping is a contact approximation, not an independent deformation animation. Shader ripples and group squash are disabled for the simulated intact jelly shell. Rest-coordinate embedding is limited to star-shaped source volumes; it is not a general tetrahedral mesher.

Picking selects a local cage particle. A compliant positional grab follows a bounded camera-plane target; recovered velocities persist on release. There is no root-object teleport for soft bodies. Pointer cancellation, lost capture, focus loss and generation cancel the grab. Hard material behavior remains in the legacy path.

## Press and effects

The frame, housing, telescoping ram, moving plate and bed are connected mechanically. Motor velocity eases toward descent/retraction targets. Cage contact, compression and strain expose lifecycle states and `catjelly:state` events. Fracture emits `catjelly:fracture`. Existing audio is triggered by interaction/contact/fracture; it never starts before a gesture.

The pressure readout is a documented approximation: a nonlinear function of measured compression, material profile and existing pressure caps, gated by cage contact. It is **not** an SI force integration or a measurement of hydraulic pressure. The legacy overload mechanic remains.

## Fracture and liquid limits

Seven deterministic directional regions own every triangle of the current deformed skin once. Matching cut triangles run from shared region boundaries to the deformed interior point. Each region is closed; shared cut surfaces cancel in the signed-volume sum. This yields source-related wedges, not random replacement blobs, but it is not arbitrary Voronoi cutting or a tearing solver. Sampling the local cage velocity seeds fragment motion; exact angular momentum conservation is not implemented.

After separation, pieces use rigid geometry, actual rotated mesh bounds against the floor/plate, and small sphere proxies for mutual contact. They do not run independent soft-body cages. Exact concave contacts and stable deep fragment stacks are not established. A plate gap smaller than a rigid wedge pushes it outward; this is an approximate contact treatment.

Liquid-filled mode is a soft closed body until rupture. Droplets originate on its deformed cage, inherit sampled velocity and fall into bounded, merging puddles. Puddle area receives equal reservoir shares from those droplets; optional thin rivulets and overflow are artistic approximations. Ripple highlights are event-driven shader modulation, not disconnected ring meshes. Bed puddles clip at the bed radius. There is no SPH, liquid-volume solver or two-way wet friction.

## Before / after

| Area | Previous main | V3 |
| --- | --- | --- |
| Soft body | Scalar squash plus group scale and surface warp | Volumetric cage, signed local volume and edge constraints |
| Face | Approximate independent landmarks | Skin-surface placement and shared tetrahedral embedding |
| Jelly burst | Unrelated blob archetypes at sampled points | Closed regions of the exact deformed source surface |
| Input | Whole-cat horizontal slide | Local particle lifting, dragging and velocity release |
| Camera | Locked every frame | Smoothed bounded orbit and zoom |
| Rendering | Embedded duplicate r160 runtime | Shared local r160, restrained studio, software fallback |
| Reset | Replaced hero but retained debris | Seeded reconstruction and full effect cleanup |
| Quality measurement | FPS calculated from capped simulation delta | Real frame delta; simulation remains separately bounded |

WebGPU, TSL and a Three.js version migration were evaluated as architectural choices, not implemented. They would require a separate optical compatibility and device-performance pass. No dependency upgrade is presented as an achieved visual improvement.
