# Cat Jelly — Material Laboratory

A static, interactive Three.js press experiment. Pick Mochi, Pudding, Soda or Orange Tabby; lift a local point on the cat, release it, or hold the hydraulic press to explore deformation and fracture.

Both `/` and `/press.html` run the same shared application. No build step, runtime CDN, npm install or API key is required.

```sh
python3 -m http.server 8765
```

Open the served page in a WebGL-capable browser. Public deployment remains at `https://dankezo.github.io/cat-jelly/`; the V3 feature branch is not a statement that production has been updated.

## Controls

- Select one of the four specimens. Jelly is the default material.
- Drag the cat to grab a simulated particle; lift and release to impart motion. Click it to poke. Fragments can also be dragged and thrown.
- Hold the red button or Space to lower the plate; release to retract. Raise also retracts it.
- Drag empty space to orbit; use the wheel to zoom, within safe limits.
- Reset (R) clears fragments and wet effects and reconstructs the current specimen with the same fracture seed.
- Laboratory settings offers five gel formulations, four quality levels plus adaptive mode, slow motion, diagnostics, studio/workshop scenes, and photo mode. Escape exits photo mode.
- EN / VI / ES / ZH switches language. Sound begins only after a user gesture. Reduced-motion preferences disable blinking and decorative machine animation.
- The existing glass, iron, diamond, brick and toy-brick materials, vacuum economy and fantasy machines remain available. Those rigid-material simulations use the legacy model.

## What changed in V3

The jelly and liquid-shell bodies use a 179-particle, 352-tetrahedron XPBD cage. Distance and signed-volume constraints replace bulk group scaling. Skin, facial details, inclusions and crack ribbons share the same tetrahedral embedding. Circular plate contact and floor contact drive deformation; the gauge is a calibrated game approximation, not a force sensor in real bar.

Jelly fracture partitions the actual deformed surface into seven closed regions with matching interior surfaces. It preserves the exterior triangles and enclosed volume at separation. Fragments inherit sampled cage velocities and use lightweight collision proxies afterward. Liquid rupture emits droplets from the simulated shell, with bounded wet effects and surface-clipped puddles.

The default studio removes the old visual clutter, preserves the workshop as an option, and adds direct specimen selection, a restrained control layout, an industrial label and joint fasteners. Rendering remains vendored Three.js r160 / WebGL; software rendering uses an opaque material fallback.

These are substantial foundation changes, not a finished implementation of every V3 aspiration. Self-collision, intact plasticity, FEM, runtime tearing, soft fragment simulation, full fluid dynamics, recorded replay, WebGPU, advanced post-processing and verified native-device frame-rate targets remain outside this release. Cats may roll over while recovering; elastic recovery does not force them upright.

## Tests

```sh
python3 qa/validate.py
node qa/physics.cjs
node qa/fracture.cjs
```

Browser tests require Playwright, installed outside the checkout. Pin `playwright@1.62.1`, then install its Chromium browser. Alternatively set `BROWSER_EXECUTABLE=/usr/bin/chromium` when using a system browser. Test the Pages base path by serving the **parent** of this checkout:

```sh
# From the parent directory containing cat-jelly/
python3 -m http.server 8766 --bind 127.0.0.1
# In another terminal, from cat-jelly/; NODE_PATH may select isolated dependencies
node qa/browser-v3.cjs
node qa/browser-liquid.cjs
node qa/browser-input.cjs
```

`CAT_JELLY_URL` overrides the base URL and `CAT_QA_OUTPUT` selects the evidence directory (default `/tmp/cat-jelly-qa`). The original `qa/browser-smoke.cjs` remains available against port 8765.

See [architecture and technical evaluation](docs/ARCHITECTURE.md), [validation and limitations](docs/QA.md), [research and licenses](docs/RESEARCH.md), and [changes](CHANGELOG.md).

## Tiếng Việt

Chọn Mochi, Pudding, Soda hoặc Tabby. Kéo để nắm một điểm trên mèo, nâng và thả; giữ nút đỏ để ép, thả nút để nâng máy. R đặt lại cả mèo và hiệu ứng. Kéo vùng trống để xoay máy ảnh. Không cần cài đặt hay biên dịch; dùng máy chủ tĩnh như lệnh Python ở trên.

## Español

Elige Mochi, Pudding, Soda o Tabby. Arrastra un punto del gato, levántalo y suéltalo; mantén el botón rojo para prensar y suelta para retraer. R reinicia el gato y los efectos. Arrastra el espacio vacío para girar la cámara. Sin compilación; usa el servidor estático indicado arriba.

## 中文

选择 Mochi、Pudding、Soda 或 Tabby。拖动猫身上的一个模拟点，提起后松开；按住红色按钮下压，松开后回升。R 重置猫与效果。在空白处拖动可旋转视角。无需安装或构建，使用上面的 Python 静态服务器命令即可。

MIT. The vendored Three.js distribution retains its separate [MIT notice](vendor/THREE-LICENSE.txt). Existing artwork is retained from the original repository.
