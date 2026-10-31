# Cat Jelly Press - material / water / performance QA

This change is intentionally isolated on `feat/material-physics-vfx-v1`. Production `main` is untouched until manual visual acceptance.

## Automated checks (standard library, optional Node.js)
Run `python3 qa/validate.py` from repository root. It verifies that `index.html` and `press.html` are byte-identical, the tile is embedded exactly once, the waterfall's width uses the correct axis, and expected material / press invariants remain present. If Node.js is installed it also runs `node --check` on the app script.

## Browser acceptance matrix
- Windows Edge and Chrome: press Mochi, Pudding and Soda; verify each has a different settling profile and the jelly skin does not separate from crack sheens.
- Water: release under pressure, pop at large size, observe drops becoming puddles, streams reaching the rim, and **visible wide waterfall sheets** that face the tangent of the rim. Ensure there are no blue discs or stripes.
- Glass, iron, brick, toy brick, diamond: cracks and fragment silhouettes must match their material; rigid surfaces must not have jelly ripples.
- Press pressure: 100–600 bar slider, density and size alter failure threshold; insufficient pressure triggers the short machine-failure sequence without deleting the cat.
- Input: drag and drop cat and pieces, hold the press button with touch or mouse, release safely outside the button; Gen cat is the only new cat action.
- Perf: 390px mobile portrait, tablet landscape and desktop 1920px; check 30–60 fps subject to device and reduced-motion preferences.

## Boundaries
These are surface rendering and geometric fixes. The existing hero solver uses scalar XPBD-style compression with shape-preserving geometry deformation; it is **not yet** a tetrahedral, volume-constrained full 3D FEM / XPBD soft-body simulation. Fluids remain particle-and-surface approximations, not SPH/FLIP liquid physics.
