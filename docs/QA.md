# V3 validation and release record

Date: 2026-11-01, Asia/Bangkok. Baseline commit: `05f2bdc8d0261b24489f89976347e275ea841055`. Implementation branch: `feat/next-gen-v3`. Implementation commit: `f889833afef2124b02bb316c6e0acda755ada3ed`.

## Executed checks

| Check | Observed outcome |
| --- | --- |
| `python3 qa/validate.py` | Passed: identical routes, relative assets, artwork, shader syntax/integration, JS syntax and license file |
| `node qa/physics.cjs` | Passed: four preset sphere tests; signed volume, lateral spread, plate/floor bounds, no inverted cells, elastic recovery, exact rest embedding, bounded backlog, 30/144 FPS step equivalence; all four production SDF cages compressed, recovered, lifted and dropped |
| `node qa/fracture.cjs` | Passed for all four cats: seven closed manifold pieces, every exterior triangle preserved once, matching cut faces, signed enclosed volume conserved |
| Rapier 0.21.0 optional POC | Passed: real WASM world, 27 particles / 40 cells, 240 steps, finite positions |
| `qa/browser-v3.cjs` | Passed at 1440×900 and touch-enabled 390×844 CSS viewports; screenshots use DPR 0.5 to keep software rendering tractable |
| `qa/browser-liquid.cjs` | Passed: all seven legacy surface selections, liquid rupture, droplets into bounded wet effects, complete wet reset, no console errors |
| Focused keyboard/capture check | Passed: focused HOLD button Space down/up and lost pointer capture safely disengage motor |
| Static server | Both HTML routes and local assets resolve under `/cat-jelly/`; no runtime CDN required |

Desktop browser acceptance exercised all four selections, local grabbing/release, source rendering, actual press contact, compression, early release/recovery, fracture, aftermath, eight reset cycles, all four languages, quality choices, slow motion, diagnostics, photo mode, resize and focus cancellation. Mobile exercised specimen selection, controls, translations, quality settings, photo mode, touch-style press cancellation, portrait/landscape resize and overflow checks. The complete physical fracture sequence was run on desktop; it was not separately repeated for every material/character on a mobile device.

The sampled compression state had volume ratio **0.9812**, maximum edge strain **0.2993**, and **zero inverted cells**. The seven fragments' enclosed source and fragment volumes both measured **5.4967524436** in local application units. Across eight seeded resets, renderer-reported geometries stayed **56 → 56** and textures **3 → 3**; fragments and droplets returned to zero. This establishes bounded counts for that exercised sequence, not a general GPU-memory proof.

The liquid check observed 12 puddles, 5 streams, 0 waterfalls and 0 remaining droplets after impact, within the configured limits (12 / 22 / 4 / 150). Reset cleared all four collections. Puddle accumulation, finite trajectories and cleanup ran; physical liquid mass conservation is not claimed.

Earlier recovery checks failed because upright height was used as a rest-shape proxy, and screenshot readback kept the press held long enough to fracture. A Node reproduction showed recovered rest lengths/volume with a rotated body. The corrected browser test releases the press atomically at its measured compression state and checks recovery through edge strain and volume. No simulation assertions were disabled.

Final focused checks also passed for smooth exterior fragment normals, real emulated touch taps on all four selectors, non-overlapping mobile controls, and all five formulation selections. See [mobile capture](screenshots/mobile.png), [fracture capture](screenshots/fragments.png), and the [browser results](browser-results.json). Captures use software WebGL; the fracture image uses DPR 0.5 and predates the final studio-background adjustment.

## Performance evidence

Environment: managed Linux cloud container, Python 3.12.14, Node 24.19.0, Playwright 1.62.1, system Chromium 154.0.8037.57, ANGLE/SwiftShader software WebGL. No native desktop GPU or physical mobile device was available.

A short, matched 20-frame sample at 1440×900, DPR 1, adaptive rendering compared the original saved HTML and the upgraded app in the same browser:

| Sample | Mean measured FPS | Median frame | Slowest / p95 of 20 |
| --- | --- | --- | --- |
| Original main | 1.00 | 966.6 ms | 3250.0 ms |
| V3 studio | 1.87 | 400.0 ms | 1700.5 ms |

These results came before the last small input, wet-effect and fragment-normal refinements. They demonstrate the severe limitations of this software renderer and are **not** a release-quality native-GPU benchmark. Physics samples varied with cloud contention; they must not be presented as stable per-frame budgets. The diagnostics overlay uses uncapped real frame delta; physics uses a separately bounded accumulator.

**60 FPS desktop and 30 FPS mobile targets remain unverified.** Native transmission, native device thermals, Safari/WebKit, Firefox, device memory growth, long fragment stacks, 20-cat cleanup endurance and full hardware visual acceptance still need independent checks.

## Known boundaries

- Star-shaped coarse cage; no self-collision, FEM, general meshing, intact plasticity or runtime topological tearing.
- Fracture wedges preserve the actual surface but are not arbitrary Voronoi chunks. Post-fracture bodies are rigid approximations with conservative mutual sphere proxies; exact concave contact, strict angular momentum conservation and deformable fragments are not implemented.
- Liquid is a layered reservoir/droplet/wet-film approximation; no internal fluid solver, surface-tension solver or two-way wet friction.
- Legacy rigid materials retain scalar denting and generic fragments. Their selection/rendering was checked; complete fracture/overload behavior for every legacy material was not exhaustively rerun.
- The software fallback deliberately uses opaque optical materials. Native GPU transmission and high/ultra visual quality were not validated on hardware.
- Recorded replay, cinematic event camera effects, WebGPU/TSL, new AO/bloom/DOF and GPU particle compute are deferred.
- A cat may topple or rotate after a strong grab or compression. Reset restores the original upright configuration.

## Deployment and rollback

No production update is implied by passing local tests. The Pages API request through existing GitHub CLI authentication returned `Forbidden`, so Pages settings and deployment runs could not be inspected through that API. Branch push, remote CI, production rollout and live content identity must be reported separately when confirmed.

The existing repository had QA only, scoped to an old feature branch; no Pages deployment workflow was present. V3 expands QA to main and feature branches. It does not change repository Pages settings or silently merge into main.

After native-device release gates pass, merge the reviewed feature branch through the repository's existing workflow and confirm its Pages build succeeds. Verify both production routes and `src/soft-body.js`, including matching content/revision, rather than treating an HTTP 200 as proof of the new release.

Rollback: revert the V3 implementation commit(s) through a normal follow-up commit and redeploy the previous Pages artifact. The unchanged baseline is `05f2bdc8d0261b24489f89976347e275ea841055`. Do not reset or force-push main. No server data or dependency migration is required.

### Confirmed publication status

The feature branch was successfully pushed to `origin/feat/next-gen-v3`, including implementation `f889833` and validation/documentation `6610d41`. The working tree was clean after those commits. A draft PR attempt using the existing CLI and exact saved description failed with `Post https://api.github.com/graphql: Forbidden`. The Pages settings API also returned `Forbidden`, and a read-only request to the production URL returned HTTP 403. Git push access therefore does not imply API or deployment-verification access.

Remote CI results, a PR number, Pages deployment and live V3 content are unconfirmed. Production was not modified. The prepared PR description is in `docs/PULL_REQUEST.md`; Git's push response supplied this creation route: https://github.com/dankezo/cat-jelly/pull/new/feat/next-gen-v3 .

### Midnight visual revision

Following visual feedback, the bright studio was replaced with charcoal/teal, the control panel was reduced to a bottom dock with a collapsible materials drawer, and Mochi/Tabby anatomy and facial proportions were revised. Internal bubble placement now rejects points outside the SDF. Contact shadows, pressure-linked rim lighting, a brief fracture light pulse and fresh-cut illumination were added.

Static validation, all numerical cage tests, all fragment topology tests, desktop/mobile browser acceptance, liquid rupture/cleanup and focused keyboard/capture checks passed again. Screenshots and `browser-results.json` were refreshed from this run. The small additional compression-eye expression uses the existing blink deformation path; no new performance target is claimed.

### Material-specific fracture and dynamic feedback

The darker-lighting revision passed static checks, the numerical physics suite, all four shapes at partition counts 7/9/11/19, and desktop/mobile browser acceptance. A dedicated Chromium run pressed brick, glass and diamond to failure with sufficient machine capacity: all three produced the expected 11/19/9 closed source fragments with equal source/fragment volume and no console errors. `qa/browser-materials.cjs` preserves this regression. The 64-instance glint pool passed bounds, finite trajectories, floor contact, expiry and reset tests in `qa/dynamics.cjs`.

Optical glints represent highlights, not new solid debris mass. Material cracks differ in width, branching and path; the closed partition topology remains a practical approximation rather than material-science fracture. Hardware optical performance remains unverified. The expanded desktop material drawer now moves to the side to keep the specimen visible.
