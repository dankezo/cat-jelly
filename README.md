# 🐱 Cat Jelly

> **Drag, poke and throw jelly cats.**
> Transparent 3D jelly cats with real spring physics - open it and play right away, no install needed.

**Languages:** English (main) - [Tiếng Việt](#tiếng-việt) - [Español](#español) - [中文](#中文)

**Live demo:** https://dankezo.github.io/cat-jelly/ - **Repo:** https://github.com/dankezo/cat-jelly

## English - Quick start

Open `index.html` in a browser. No `npm install`, no build step.

- **Drag and drop:** hold a cat, drag it around town, drop it and it falls and bounces.
- **Poke:** double-click a cat to make it bounce.
- **Cat rain:** press the Cat rain button to drop 6 more cats at once.
- **Wobble:** use the Wobble slider to make the physics softer or firmer.
- **Languages:** use the EN / VI / ES / ZH buttons in the top-left card.

## Tiếng Việt

> **Kéo thả mèo thạch. Chọc để nảy. Ném để bay.**
> Mèo 3D trong suốt, rung rinh bằng vật lý lò xo thật - mở lên là chơi được ngay, không cần cài đặt.

Mở `index.html` bằng trình duyệt là chơi được ngay. Không cần `npm install`, không cần build.

- **Kéo thả:** giữ mèo, kéo đi khắp thị trấn, thả ra là mèo rơi và nảy.
- **Chọc:** double-click vào mèo để nó bật lên.
- **Mưa mèo:** bấm nút Mưa mèo để thả thêm 5 bé cùng lúc.
- **Rung:** kéo thanh Rung để chỉnh độ rung rinh.
- **Ngôn ngữ:** bấm nút EN / VI / ES / ZH ở thẻ góc trái.

## Español

> **Arrastra, toca y lanza gatos de gelatina.**
> Gatos 3D transparentes con fisica de resorte real - abre el archivo y juega al instante, sin instalar nada.

Abre `index.html` en un navegador. Sin `npm install`, sin compilacion.

- **Arrastrar:** mantén un gato, arrástralo por el pueblo, suéltalo y rebotará.
- **Tocar:** doble clic en un gato para hacerlo saltar.
- **Lluvia de gatos:** pulsa el botón para soltar 5 gatos más a la vez.
- **Temblor:** usa el control para ajustar la fisica.
- **Idiomas:** usa los botones EN / VI / ES / ZH en la tarjeta superior izquierda.

## 中文

> **拖动、戳和扔果冻猫。**
> 透明 3D 果冻猫, 使用真实弹簧物理 - 打开就能玩, 不需要安装。

在浏览器中打开 `index.html` 即可游玩。不需要 `npm install`, 不需要构建。

- **拖动:** 按住猫咪, 在小镇里拖动, 松手后它会掉落并弹跳。
- **戳:** 双击猫咪让它跳起来。
- **猫咪雨:** 点击按钮一次掉落 5 只猫。
- **晃动:** 用滑块调整晃动程度。
- **语言:** 点击左上角卡片上的 EN / VI / ES / ZH 按钮。

<p>
  <a href="https://github.com/dankezo/cat-jelly"><img src="https://img.shields.io/github/stars/dankezo/cat-jelly?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/dankezo/cat-jelly"><img src="https://img.shields.io/github/forks/dankezo/cat-jelly?style=social" alt="GitHub forks"></a>
  <img src="https://img.shields.io/badge/Three.js-r160-000000?logo=three.js" alt="Three.js">
  <img src="https://img.shields.io/badge/No%20build%20step-100%25%20vanilla-ff8fb3" alt="No build step">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT">
</p>

## ✨ Demo nhanh

Mở `index.html` bằng trình duyệt là chơi được ngay. Không cần `npm install`, không cần build.

| Hành động | Cách chơi |
|---|---|
| **Kéo thả** | Giữ chuột vào mèo, kéo đi khắp thị trấn, thả ra là mèo rơi và nảy |
| **Chọc** | Double-click vào mèo để nó bật lên kèm hiệu ứng rung |
| **Mưa mèo** | Bấm **🌧 Mưa mèo** để thả thêm 6 bé cùng lúc |
| **Chỉnh rung** | Kéo thanh **Rung** để tăng/giảm độ rung rinh |

## 🐈 3 dạng mèo

| Mèo | Kiểu dáng | Màu thạch |
|---|---|---|
| 🍓 **Mochi Tròn** | Tròn, mũm mĩm | Dâu sữa |
| 🍮 **Pudding Dẹt** | Dẹt, bẹt ra khi đáp đất | Caramel |
| 🌿 **Soda Cao** | Cao, thon, rung dài hơn | Bạc hà |

## 🧪 Vật lý jelly, không phải animation giả

- **Spring + squash & stretch:** mèo đáp đất thì dẹt ra, rồi rung bần bật và hồi lại hình dáng gốc.
- **Drag & throw:** kéo mèo đi, thả ra với vận tốc rơi, nảy lại theo độ đàn hồi.
- **Trong suốt:** vật liệu `MeshPhysicalMaterial` với `transmission` + `clearcoat`, nhìn xuyên như thạch thật.
- **Thị trấn thạch:** nhà mái vòm trong suốt, cây jelly, mặt đất tối để mèo nổi bật.

## 🚀 Chạy local

```bash
# Cách 1: mở file trực tiếp
open index.html

# Cách 2: serve tĩnh (khuyên dùng để Three.js load ổn định)
npx serve .
# hoặc
python3 -m http.server 8000
```

## 🗺 Roadmap cộng đồng

- [ ] Thêm mèo mới do cộng đồng gợi ý: mèo đen, mèo trắng, mèo cam
- [ ] Âm thanh pop khi chọc, tiếng meo khi thả
- [ ] Chế độ đêm / hoàng hôn cho thị trấn
- [ ] Lưu đội mèo yêu thích vào localStorage
- [ ] Mobile: pinch-zoom, kéo thả bằng cảm ứng

Góp ý bằng Issue hoặc Pull Request - mọi ý tưởng mèo mới đều được chào đón! 🐾

## 🙏 Cảm hứng

Dự án này học hỏi kỹ thuật từ cộng đồng jelly mã nguồn mở, không copy code của họ:

- [Hydraxon91/zummi-gummi](https://github.com/Hydraxon91/zummi-gummi) - translucent jelly-bear sandbox, Three.js + soft-body trên Box3D/WASM
- [fab34/soft-matter-jelly-lab](https://github.com/fab34/soft-matter-jelly-lab) - Three.js jelly lab với WebGPU và soft-body physics
- [tachibanayu24/jiggly-delight-logo](https://github.com/tachibanayu24/jiggly-delight-logo) - grab, throw, crush squishy jelly logo, Three.js + WASM soft-body
- [awu7/jelly-cat](https://github.com/awu7/jelly-cat) - soft body physics simulation, đúng tên jelly-cat
- [roundyyy/Jelly-Mesh-System](https://github.com/roundyyy/Jelly-Mesh-System) - Unity component thêm jelly physics cho bất kỳ mesh nào

## 📄 License

MIT - cứ dùng, sửa, chia sẻ thoải mái, nhớ giữ lại credit là được.
