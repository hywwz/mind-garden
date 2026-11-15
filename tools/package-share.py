"""Package the already-built installers for independent family use."""
from pathlib import Path
import hashlib, shutil, zipfile
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'发给姐姐';DEST.mkdir(exist_ok=True)
if not (DEST/'先看这里.txt').exists():
    (DEST/'先看这里.txt').write_text('心之林 · 独立使用说明\n\n安卓安装 APK，Windows 安装 EXE。首次打开为空白，各人数据分开保存。\n仅连接同一个私有同步仓库才会共享记录。不要发送个人备份或连接密钥。\n卸载或换设备前，请在设置 → 存档中另外导出完整备份。\n',encoding='utf-8')
names=['心之林-安卓离线版.apk','心之林-Windows安装.exe']
for name in names:
    shutil.copy2(ROOT/'outputs'/name,DEST/name)
hashes='\n'.join(hashlib.sha256((DEST/name).read_bytes()).hexdigest()+'  '+name for name in names)+'\n'
(DEST/'SHA256.txt').write_text(hashes,encoding='utf-8')
archive=DEST/'心之林-分享包-1.13.2.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name in names+['先看这里.txt','SHA256.txt']:
        z.write(DEST/name,name)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert set(z.namelist())==set(names+['先看这里.txt','SHA256.txt'])
print('Share package verified: installers and instructions only.')
