from pathlib import Path
import re, shutil, subprocess, tempfile

root = Path(__file__).resolve().parents[1]
a = (root / 'index.html').read_bytes()
b = (root / 'press.html').read_bytes()
assert a == b, 'index.html and press.html must be byte-identical'
src = a.decode('utf-8')
assert src.count('data:image/png;base64,') == 1, 'tiled artwork must be embedded only once'
for token in (
    'var FORM_PHYS=', 'function deformHeroSurfaces(', 'var TILE_ART_DATA=',
    'function updatePuddles(', 'function updateWaterFx(', 'function spawnWaterfall(',
    'm.scale.set(Math.max(0.12,wid),0.06,1);', 'function explodePress()',
    'var SUBN=4', 'function burst()', 'requestAnimationFrame(animate)'
):
    assert token in src, f'missing invariant: {token}'
assert 'm.scale.set(0.035,0.06,wid);' not in src, 'stale waterfall geometry bug'
assert src.count('<script>') >= 1, 'missing inline app script'
script = src.rsplit('<script>', 1)[1].split('</script>', 1)[0]
if shutil.which('node'):
    with tempfile.NamedTemporaryFile('w', suffix='.js', encoding='utf-8', delete=False) as f:
        f.write(script)
        name = f.name
    try:
        subprocess.run(['node', '--check', name], check=True)
    finally:
        Path(name).unlink(missing_ok=True)
else:
    print('Node.js absent: skipped JavaScript syntax check')
print(f'OK: files identical ({len(a):,} bytes); single wallpaper; material/waterfall checks passed')
