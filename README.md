# Cat Jelly Press - R3F project

Multi-file project, NOT a single HTML file. Vite + React + React Three Fiber
+ Drei + Rapier. See `src/` for modular code: game data, i18n, CC0 library,
3D scene, machines, fragments, slime, and UI panels are separate files.
Vite splits three, R3F/Drei, Rapier and React into separate chunks.

## Run

```sh
npm install
npm run build
npm run preview   # serves dist/
```

## Git push plan (for the main agent - do NOT push to main yet)

- Prepare a NEW branch, e.g. `r3f-project`, in repo `dankezo/cat-jelly`.
- Push only this project directory to that branch, or to a new repo if the
  main agent prefers to keep prod untouched.
- GitHub Pages currently serves `main` branch root (index.html + press.html
  single-file export). Serving this Vite build from Pages requires either
  a `gh-pages` branch / `docs/` folder containing `dist/`, or a separate
  Pages site for the branch. Do NOT overwrite `main` until the build is
  verified and the Pages source is switched deliberately.
- After verification, the switch is: build -> copy `dist/*` to the Pages
  source -> commit -> hard reload https://dankezo.github.io/cat-jelly/

## What is NOT yet done

- Downloaded GLB models: the suggestion library is a CC0 catalogue only
  (Kenney, Quaternius, KayKit, all CC0, listed in src/game/library.js).
  No GLB files are embedded or downloaded by this build.
- Real-phone hand test: no device test, no fps measurement, no
  buy/switch with earned session money test has been run on a phone.
- Pages deployment: not deployed; main prod is still the 2026-10-31
  single-file export (head 5643ce5) until the main agent verifies and
  switches it.
- Post-processing: deliberately omitted. Post passes would risk mobile
  performance; the premium look here comes from materials, aura rings,
  shadows and per-material physics, not extra post passes.
- Photo-as-texture uses a canvas-loaded texture for the generated cat;
  the catalogue match is a suggestion, not a 3D model load.
