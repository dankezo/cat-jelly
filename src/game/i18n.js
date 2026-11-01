// Short, equivalent labels only. Short dashes only, never long dashes.
// No instruction walls: one short line per control, per language.
export const LANGS = ['en', 'vi', 'es', 'zh']
export const T = {
  en: { tag: 'Jelly cat pressing research', press: 'Press', grinder: 'Grind', blender: 'Blend', hold: 'HOLD', blendBtn: 'BLEND', grindBtn: 'GRIND', gen: 'Gen cat', vacuum: 'Vacuum', backpack: 'Backpack', compare: 'Compare', full: 'Full', ready: 'READY WHEN YOU ARE.', readySub: 'Hold the red button. The cat has made its peace.', money: 'Money', surface: 'Surface', size: 'Size', density: 'Density', bar: 'bar', damage: 'Damage', hardness: 'Hardness', bounce: 'Bounce', mass: 'Mass', needs: 'Needs', crack: 'Crack', photo: 'Photo', machines: 'MACHINES', catsPopped: 'CATS POPPED' },
  vi: { tag: 'Nghiên cứu ép mèo jelly', press: 'Ép', grinder: 'Nghiền', blender: 'Xay', hold: 'GIỮ', blendBtn: 'XAY', grindBtn: 'NGHIỀN', gen: 'Gen mèo', vacuum: 'Hút', backpack: 'Balo', compare: 'So sánh', full: 'Đầy', ready: 'SẴN SÀNG KHI ANH SẴN SÀNG.', readySub: 'Giữ nút đỏ. Bé mèo đã chấp nhận số phận.', money: 'Tiền', surface: 'Chất liệu', size: 'Cỡ', density: 'Mật độ', bar: 'bar', damage: 'Hư hại', hardness: 'Độ cứng', bounce: 'Độ nảy', mass: 'Khối lượng', needs: 'Cần', crack: 'Kiểu nứt', photo: 'Ảnh', machines: 'MÁY', catsPopped: 'MÈO ĐÃ NỔ' },
  es: { tag: 'Investigación del prensado de gatos de gelatina', press: 'Prensa', grinder: 'Molino', blender: 'Licuadora', hold: 'MANTENER', blendBtn: 'LICUAR', grindBtn: 'MOLER', gen: 'Gen gato', vacuum: 'Aspirar', backpack: 'Mochila', compare: 'Comparar', full: 'Lleno', ready: 'LISTO CUANDO TÚ LO ESTÉS.', readySub: 'Mantén el botón rojo. El gato aceptó su destino.', money: 'Dinero', surface: 'Superficie', size: 'Tamaño', density: 'Densidad', bar: 'bar', damage: 'Daño', hardness: 'Dureza', bounce: 'Rebote', mass: 'Masa', needs: 'Necesita', crack: 'Grieta', photo: 'Foto', machines: 'MÁQUINAS', catsPopped: 'GATOS EXPLOTADOS' },
  zh: { tag: '果冻猫压制研究', press: '压', grinder: '磨', blender: '搅', hold: '按住', blendBtn: '搅拌', grindBtn: '研磨', gen: '生成猫', vacuum: '吸尘', backpack: '背包', compare: '对比', full: '已满', ready: '你准备好就开始。', readySub: '按住红按钮。猫已经接受命运。', money: '金钱', surface: '材质', size: '尺寸', density: '密度', bar: 'bar', damage: '损伤', hardness: '硬度', bounce: '弹跳', mass: '质量', needs: '需要', crack: '裂纹', photo: '照片', machines: '机器', catsPopped: '已压爆猫' },
}
export function detectLang() {
  const q = new URLSearchParams(window.location.search)
  const hint = q.get('lang') || q.get('locale') || q.get('hl')
  if (hint && T[hint]) return hint
  const b = (navigator.language || 'en').slice(0, 2)
  return T[b] ? b : 'en'
}
