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

## Visual revision after V3 feedback

- Rebuilt Mochi's continuous cheek/ear silhouette and face proportions; Tabby inherits the revised anatomy.
- Removed floating decorative toppings and constrained internal bubbles to the actual source volume.
- Replaced the bright studio with a charcoal/teal environment and a software-compatible contact shadow.
- Replaced the large right-side control panel with a compact bottom dock and an expandable material/physics drawer.
- Added contact-linked rim illumination, a short fracture light pulse, illuminated fresh cut faces, and compression-linked eye narrowing.
