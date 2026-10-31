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

## Material fracture and dynamics revision

- Lowered exposure, environment luminance, key/fill lights and platform reflections; the floor and press bed now remain dark.
- Added a fixed 64-instance optical-glint pool triggered by actual first contact, landings and rupture; bounded lifetimes and floor collision are tested.
- Fragment separation strength follows strain/density, with angular motion sampled from cage velocity.
- Removed diamond's pixel texture and snapped grid; introduced real flat-normal facets and a pale violet optical profile distinct from the dark studio.
- Glass has fine branching stress cracks, fired clay has wider stepped fissures, and diamond has fewer straight cleavage-style paths. Removed pre-painted glass cracks and brick wallpaper mortar.
- Glass, brick and diamond now also fracture from the original closed source surface, into 19, 11 and 9 regions respectively. These are procedural closed partitions, not a simulation of crystallographic cleavage or arbitrary cutting.
