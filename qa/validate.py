"""Static deployment and syntax checks; numerical behavior lives in physics.cjs."""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
a = (root / 'index.html').read_bytes()
assert a == (root / 'press.html').read_bytes(), 'public routes must share the application'
html = a.decode()
for asset in re.findall(r'(?:src|href)="(\./[^\"]+)"', html):
    assert (root / asset).is_file(), f'missing relative asset: {asset}'
assert 'https://' not in html, 'runtime assets must be local'
app = (root / 'src/app.js').read_text()
assert app.count("var TILE_ART_DATA='./assets/workshop-floor.png';") == 1
assert (root / 'assets/workshop-floor.png').read_bytes().startswith(b'\x89PNG')
assert 'm.scale.set(Math.max(0.12,wid),0.06,1);' in app
assert 'hero.soft.advance(dt,ceilingAt' in app
assert (root / 'vendor/THREE-LICENSE.txt').is_file()
for file in sorted((root / 'src').glob('*.js')):
    subprocess.run(['node', '--check', str(file)], check=True)
print('PASS identical routes, local assets, artwork, water orientation, physics integration, JS syntax')
