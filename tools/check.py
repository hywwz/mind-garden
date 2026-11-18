"""Dependency-free project checks; no personal data or GitHub credentials required."""
from pathlib import Path
import re, subprocess, sys, tempfile

ROOT=Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(ROOT/'tools/build.py'),'--web'],cwd=ROOT,check=True)
for script in ['work/life/model-check.cjs','work/life/capture-check.cjs','work/life/treehole-check.cjs','work/sync/core-check.cjs','work/sync/engine-check.cjs','tools/network-check.cjs']:
    subprocess.run(['node',script],cwd=ROOT,check=True)
for source in (ROOT/'web/dist').glob('*.js'):
    subprocess.run(['node','--check',str(source)],cwd=ROOT,check=True)
html=(ROOT/'outputs/mind_garden.html').read_text(encoding='utf-8')
assert 'const seeds=()=>({goals:[],ideas:[],evidence:[]});' in html
assert (ROOT/'work/life/tree.js').read_text(encoding='utf-8') in html
with tempfile.TemporaryDirectory(prefix='mind-garden-check-') as directory:
    for index,script in enumerate(re.findall(r'<script>(.*?)</script>',html,re.S)):
        path=Path(directory)/f'script-{index}.js';path.write_text(script,encoding='utf-8')
        subprocess.run(['node','--check',str(path)],check=True)
print('Passed: blank start, current hierarchy source, HTML/PWA JavaScript, model, synthetic import and sync.')
