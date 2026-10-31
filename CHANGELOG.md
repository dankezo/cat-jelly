# Changelog

## V3 foundation — feature branch, 2026-11-01

- Replaced intact jelly/liquid bulk scaling with a fixed-step tetrahedral XPBD cage.
- Bound face, inclusions, skin and cracks to one deforming coordinate system.
- Added Orange Tabby and direct selection of all four specimen identities.
- Added measurable gel formulations, bounded orbit/zoom, slow motion, photo mode, quality controls and diagnostics.
- Partitioned jelly fracture into seven closed source-surface regions with interior faces and inherited sampled velocity.
- Refined liquid rupture origins, wet-surface clipping, merging and ripple presentation; removed pre-rupture liquid emission.
- Added a quiet studio default while retaining workshop artwork and legacy machines/materials.
- Shared local runtime, geometry definitions, application code and CSS across both public routes.
- Added numerical, topology and browser regression tests; expanded CI to feature branches and shared assets.
- Fixed reset/effect cleanup, shared water-material disposal, canceled grabs, dust-material cleanup and real-delta FPS measurement.

This milestone does not deliver FEM, arbitrary tearing/cutting, soft fragment physics, full fluids, WebGPU, recorded replay or verified native-device performance targets. See `docs/QA.md` for executed checks and release status.
