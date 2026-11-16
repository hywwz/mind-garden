"""Pinned D8 with Kotlin 2.4 support for the optional on-device model runtime."""
from pathlib import Path
import urllib.request, hashlib, json
root=Path(__file__).resolve().parents[1]/'work/android/vendor/voice'
root.mkdir(parents=True,exist_ok=True)
version='9.5.32'
url=f'https://dl.google.com/dl/android/maven2/com/android/tools/r8/{version}/r8-{version}.jar'
target=root/f'r8-{version}.jar'
if not target.is_file():
 with urllib.request.urlopen(url,timeout=90) as response:data=response.read()
 part=target.with_suffix('.part');part.write_bytes(data);part.replace(target)
(root/'build-tools.json').write_text(json.dumps({'r8':version,'url':url,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()},indent=2),encoding='utf-8')
print('Pinned Android build tool ready:',version)
