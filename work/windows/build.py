from pathlib import Path
import shutil,subprocess,zipfile,re,struct,math,os

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
OUT=PROJECT/'outputs'
if not OUT.is_dir():OUT=ROOT/'outputs'
OUT.mkdir(exist_ok=True)
BUILD=ROOT/'build'
DIST=BUILD/'app'
DIST.mkdir(parents=True,exist_ok=True)
ASSETS=DIST/'assets'
ASSETS.mkdir(exist_ok=True)
SDK=Path(os.environ.get('MIND_GARDEN_WEBVIEW2_SDK','B:/Development Tools/VS2026/Common7/IDE/PrivateAssemblies'))
if not SDK.is_dir():SDK=ROOT/'vendor'
FRAME=Path('C:/Windows/Microsoft.NET/Framework64/v4.0.30319')
CSC=FRAME/'csc.exe'

web_source=OUT/'mind_garden.html'
if not web_source.exists():web_source=ROOT/'web-source.html'
SYNC=PROJECT/'work/sync'
if not SYNC.is_dir():SYNC=ROOT/'sync'
html=web_source.read_text(encoding='utf-8')
a=html.index('const seeds=()=>');b=html.index('let db;try',a)
html=html[:a]+'const seeds=()=>({goals:[],ideas:[],evidence:[]});\n'+html[b:]
html=html.replace('<script>','<script>\n'+(ROOT/'desktop-bootstrap.js').read_text(encoding='utf-8')+'\n</script>\n<script>',1)
html=html.replace('(() => {','(async () => {\nawait window.desktopBoot;',1)
html=html.replace('localStorage.setItem(KEY,JSON.stringify(db));','localStorage.setItem(KEY,JSON.stringify(db));window.queueDesktopSave?.();window.queueGardenSync?.();')
html=html.replace('const out={...value,version:2};','const out={...value,version:2};delete out.attachments;')
html=html.replace("e.target.closest('.map-controls')","e.target.closest('.map-controls,.desktop-life-menu,.desktop-life-empty')")
html=html.replace('</style>',(ROOT/'desktop.css').read_text(encoding='utf-8')+'\n'+(SYNC/'ui.css').read_text(encoding='utf-8')+'\n</style>')
html=html.replace('<script>','<script>\n'+(SYNC/'core.js').read_text(encoding='utf-8')+'\n'+(SYNC/'engine.js').read_text(encoding='utf-8')+'\n</script>\n<script>',1)
# Reuse the same data-only clear/undo operations as Android, without its phone arrangement.
phone_source=PROJECT/'work/android/phone-layout.js'
if not phone_source.exists():phone_source=ROOT/'android-clear-source.js'
phone=phone_source.read_text(encoding='utf-8')
clear_functions=phone[phone.index('function clearPhoneLife'):phone.index('function initPhoneLayout')]
html=html.replace('initTaskSorting();\nrender();\n})();',clear_functions+'\n'+(ROOT/'desktop.js').read_text(encoding='utf-8')+'\n'+(SYNC/'ui.js').read_text(encoding='utf-8')+'\ninitTaskSorting();\nrender();\nawait initDesktop();\ninstallSemanticMap();\nawait initGardenSync();\n})();')
assert 'await initDesktop()' in html and 'await window.desktopBoot' in html
(ASSETS/'index.html').write_text(html,encoding='utf-8')
for index,script in enumerate(re.findall(r'<script>(.*?)</script>',html,re.S)):
    path=BUILD/f'script-{index}.js';path.write_text(script,encoding='utf-8');subprocess.run(['node','--check',str(path)],check=True)
font_source=PROJECT/'work/android/GardenSans.otf'
if not font_source.exists():font_source=ROOT/'assets/GardenSans.otf'
license_source=PROJECT/'work/android/FONT-LICENSE.txt'
if not license_source.exists():license_source=ROOT/'FONT-LICENSE.txt'
shutil.copy2(font_source,ASSETS/'GardenSans.otf')
shutil.copy2(license_source,DIST/'字体许可.txt')
for name in ['Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.Wpf.dll','WebView2Loader.dll']:
    shutil.copy2(SDK/name,DIST/name)
size=64;pixels=bytearray()
for y in reversed(range(size)):
    for x in range(size):
        dx=x-31.5;dy=y-31.5;angle=math.atan2(dy,dx);radius=math.hypot(dx,dy)
        leaf=radius < 7+15*max(0,math.cos(angle*8))
        red,green,blue=(193,220,166) if leaf else (25,72,59)
        alpha=255 if abs(dx)<20 or abs(dy)<20 or math.hypot(abs(dx)-20,abs(dy)-20)<11 else 0
        pixels.extend((blue,green,red,alpha))
bitmap=struct.pack('<IiiHHIIiiII',40,size,size*2,1,32,0,len(pixels),0,0,0,0)+pixels+bytes(size*size//8)
(BUILD/'garden.ico').write_bytes(struct.pack('<HHH',0,1,1)+struct.pack('<BBBBHHII',size,size,0,0,1,32,len(bitmap),22)+bitmap)
manifest='''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0"><trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo><application xmlns="urn:schemas-microsoft-com:asm.v3"><windowsSettings><dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware><dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness></windowsSettings></application></assembly>'''
(BUILD/'app.manifest').write_text(manifest,encoding='utf-8')
def compile(output,sources,refs,target='winexe',extra=()):
    subprocess.run([str(CSC),'/nologo','/optimize+','/platform:x64','/target:'+target,'/out:'+str(output),'/win32icon:'+str(BUILD/'garden.ico'),'/win32manifest:'+str(BUILD/'app.manifest'),*['/r:'+str(ref) for ref in refs],*extra,*[str(s) for s in sources]],check=True)
refs=['System.dll','System.Core.dll','System.Net.Http.dll','System.Security.dll','System.Xaml.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Web.Extensions.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll',FRAME/'WPF/PresentationFramework.dll',FRAME/'WPF/PresentationCore.dll',FRAME/'WPF/WindowsBase.dll',SDK/'Microsoft.Web.WebView2.Core.dll',SDK/'Microsoft.Web.WebView2.Wpf.dll']
compile(DIST/'心之林.exe',[ROOT/'App.cs',ROOT/'Storage.cs',ROOT/'GitHubSync.cs'],refs)
(DIST/'心之林.exe.config').write_text('<?xml version="1.0"?><configuration><startup><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8"/></startup></configuration>',encoding='utf-8')
readme='''心之林 · Windows 电脑版\n\n首次使用：双击“心之林.exe”。如果是压缩包，请先解压整个文件夹。\n内容自动保存在这台电脑，关闭和更新程序不会清空内容。\n默认备份位置：文档 → 心之林备份。可在“存档”里更换。\n从手机迁移：把手机的心之林 ZIP 备份传到电脑，再点“存档 → 从备份恢复”。\n可选 GitHub 自动同步：在“同步”里连接同一个私有仓库，手机和电脑各连接一次。打开 App 时会自动同步，离线时先保存在本机。
两边都可以恢复对方的 ZIP 备份。\n首次打开是空白的，可以添加自己的愿望、今日安排和灵感。\n请保留备份；卸载或清理系统前，先另外存一份。\n\n适用于 64 位 Windows 10 / 11，需要 Microsoft Edge WebView2 运行时。\n本程序不需要自建服务器。未连接 GitHub 时保持离线使用；连接后仅通过 GitHub 接口同步所选仓库。\n\n技术组件：Microsoft WebView2 SDK，版权属于 Microsoft，按其许可分发。\n字体：Noto Sans SC，版权及 SIL Open Font License 见“字体许可.txt”。\n'''
(DIST/'使用说明.txt').write_text(readme,encoding='utf-8-sig')
portable=BUILD/'payload.zip'
with zipfile.ZipFile(portable,'w',zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(DIST.rglob('*')):
        if path.is_file():archive.write(path,path.relative_to(DIST).as_posix())
compile(OUT/'心之林-Windows安装.exe',[ROOT/'Installer.cs'],['System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll'],extra=['/resource:'+str(portable)+',payload.zip'])
with zipfile.ZipFile(OUT/'心之林-Windows项目.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(ROOT.iterdir()):
        if path.is_file() and path.name not in {'web-source.html','android-clear-source.js','FONT-LICENSE.txt','使用说明.txt'}:archive.write(path,path.name)
    archive.writestr('web-source.html',web_source.read_bytes())
    archive.writestr('android-clear-source.js',phone)
    for path in ASSETS.iterdir():archive.write(path,'assets/'+path.name)
    for path in SYNC.iterdir():
        if path.is_file():archive.write(path,'sync/'+path.name)
    for name in ['Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.Wpf.dll','WebView2Loader.dll']:archive.write(SDK/name,'vendor/'+name)
    archive.write(license_source,'FONT-LICENSE.txt')
    archive.writestr('使用说明.txt',readme)
print('Windows application and installer built successfully')
