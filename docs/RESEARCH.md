# Technical research and licenses

Inspected 2026-11-01 (Asia/Bangkok). All four requested projects were successfully cloned read-only and inspected. No source code or assets were copied from them.

| Reference | Inspected revision | Relevant observation / reuse decision |
| --- | --- | --- |
| [Hydraxon91/zummi-gummi](https://github.com/Hydraxon91/zummi-gummi) | `64936b13778aa241638498a70818fc10aa9422b8` | MIT. `src/app.js` combines shape-matching/volume-inspired forces and contact-driven deformation. Useful comparison for separating artistic secondary motion from bulk simulation. |
| [fab34/soft-matter-jelly-lab](https://github.com/fab34/soft-matter-jelly-lab) | `88f67596c882c5e36822c67b8d553279fc7fcb87` | `lib/jelly-physics.ts` has tetrahedral signed-volume and distance constraints. No top-level reuse license was found; no code reused. |
| [tachibanayu24/jiggly-delight-logo](https://github.com/tachibanayu24/jiggly-delight-logo) | `7a1c43c03fe3cb835957d5ea2a8727075412dd2a` | JS and optional AssemblyScript/WASM volumetric XPBD, cage binding and contact handling. No explicit reuse license found; no code reused. |
| [awu7/jelly-cat](https://github.com/awu7/jelly-cat) | `10ead1dcaf1b6d920ef053b4c05a2f50cb28461f` | A Q5 2D node/edge toy, not an installable 3D soft-body engine. No code reused. |

The solver is an original implementation of the standard [XPBD compliance formulation (Macklin et al., 2016)](https://matthias-research.github.io/pages/publications/XPBD.pdf): accumulated constraint multipliers, compliance / h² and signed tetrahedral volume gradients. The paper's host was inaccessible through this environment's network policy; that URL is a citation, not a claim of successful remote retrieval.

## Rapier proof of concept

The published `@dimforge/rapier3d-compat@0.21.0` package **does** expose soft bodies, deformable collision surfaces, volume/cell models, shape matching, plasticity and tearing-related APIs in its type declarations. A real Node/WASM proof created a 27-particle / 40-cell cuboid, added a floor and stepped it 240 times with finite particle positions. See `qa/rapier-poc.cjs`.

Only that small cuboid test ran. Stability of Rapier's tearing, cutting, plasticity, skinned cats, press stacks and browser performance was **not** established. The small POC is not evidence that those features are production-ready for this application. The engine is Apache-2.0; no Rapier runtime is redistributed here.

A custom cage was chosen to integrate incrementally with the existing SDF surface and static synchronous startup, avoid shipping an additional WASM runtime, and make the required constraints independently testable. This is a scope/architecture choice, not a claim that Rapier lacks the APIs.

Reproduce the optional evaluation by installing the pinned package outside the checkout and exposing it through `NODE_PATH`, then running `node qa/rapier-poc.cjs`. `CAT_RAPIER_PACKAGE` can instead point to an unpacked package directory.

## Rendering references

Inspected the actual [Three.js physical transmission example](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_materials_physical_transmission.html), including thickness, attenuation and environment lighting. Kept the existing PMREM and ACES pipeline, refined material settings, and preserved r160. The original embedded distribution was extracted to `vendor/three.min.js` with the official r160 MIT notice in `vendor/THREE-LICENSE.txt`.

The requested [WebGPU renderer](https://threejs.org/manual/pages/webgpurenderer), [post-processing](https://threejs.org/manual/pages/webgpu-postprocessing.html), [Three.js documentation](https://threejs.org/docs/) and [Rapier soft-body guide](https://rapier.rs/docs/user_guides/javascript/soft_bodies/) are relevant follow-up references. Direct requests to threejs.org and rapier.rs were denied by the proxy; no successful inspection of those web pages or WebGPU proof is claimed. The published Rapier package and permitted GitHub sources supplied the executable evidence above.
