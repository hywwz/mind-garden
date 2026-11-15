from pathlib import Path
import re,json,shutil,hashlib,struct,zlib,math,subprocess
ROOT=Path(__file__).resolve().parent
DIST=ROOT/'dist';DIST.mkdir(exist_ok=True)
SRC=ROOT/'sources';SRC.mkdir(exist_ok=True)
PROJECT=ROOT.parent
if (PROJECT/'outputs/mind_garden.html').exists():shutil.copy2(PROJECT/'outputs/mind_garden.html',SRC/'base.html')
SYNC=PROJECT/'work/sync'
if SYNC.is_dir():
    (SRC/'sync').mkdir(exist_ok=True)
    for name in ['core.js','engine.js','ui.js','ui.css']:shutil.copy2(SYNC/name,SRC/'sync'/name)
phone=PROJECT/'work/android/phone-layout.js'
if phone.exists():
    source=phone.read_text(encoding='utf-8');(SRC/'clear.js').write_text(source[source.index('function clearPhoneLife'):source.index('function initPhoneLayout')],encoding='utf-8')
if (PROJECT/'work/android/GardenSans.otf').exists():shutil.copy2(PROJECT/'work/android/GardenSans.otf',SRC/'GardenSans.otf');shutil.copy2(PROJECT/'work/android/FONT-LICENSE.txt',SRC/'FONT-LICENSE.txt')
html=(SRC/'base.html').read_text(encoding='utf-8')
a=html.index('const seeds=()=>');b=html.index('let db;try',a);html=html[:a]+"const seeds=()=>({goals:[],ideas:[],evidence:[]});\n"+html[b:]
html=html.replace('(() => {','(async () => {\nawait window.webBoot;',1)
html=re.sub(r"const save=\(\)=>\{[^\n]*\};", "const save=()=>{const serialized=JSON.stringify(db);try{localStorage.setItem(KEY,serialized)}catch{}window.queueWebSave?.(serialized);window.queueGardenSync?.();};",html,count=1)
html=re.sub(r'function openAttachmentDB\(\)\{[^\n]*\}', 'function openAttachmentDB(){return WebVault.open}',html,count=1)
html=re.sub(r'async function blobRequest\(mode,operation\)\{[^\n]*\}', "async function blobRequest(mode,operation){return WebVault.access('files',mode,operation)}",html,count=1)
html=html.replace("const getBlob=id=>blobRequest('readonly',s=>s.get(id));", "const getBlob=id=>WebVault.file(id);")
html=html.replace('const out={...value,version:2};','const out={...value,version:2};delete out.attachments;')
html=html.replace("e.target.closest('.map-controls')","e.target.closest('.map-controls,.web-life-actions,.web-life-empty')")
html=html.replace('localStorage.setItem(KEY,serialized);db=next;', 'await WebVault.save(serialized);try{localStorage.setItem(KEY,serialized)}catch{}db=next;')
ui=(SRC/'sync/ui.js').read_text(encoding='utf-8').replace('两台设备连接同一个私有仓库。','各设备连接同一个私有仓库。').replace('手机、电脑分别连接一次。','手机、电脑、iPad 分别连接一次。')
html=html.replace('initTaskSorting();\nrender();\n})();',(SRC/'clear.js').read_text(encoding='utf-8')+'\n'+(ROOT/'app.js').read_text(encoding='utf-8')+'\n'+ui+'\ninitTaskSorting();\nrender();\nawait initWebApp();\ninstallSemanticMap();\nawait initGardenSync();\n})();')
assert 'await initWebApp()' in html and 'await window.webBoot' in html
styles=re.findall(r'<style>(.*?)</style>',html,re.S)
css='\n'.join(styles)+'\n'+(ROOT/'ipad.css').read_text(encoding='utf-8')+'\n'+(SRC/'sync/ui.css').read_text(encoding='utf-8')
css=re.sub(r'font-size:\s*(\d+(?:\.\d+)?)px',r'font-size:calc(\1px * var(--font-scale,1))',css)
(DIST/'app.css').write_text(css,encoding='utf-8');html=re.sub(r'<style>.*?</style>','',html,flags=re.S)
scripts=re.findall(r'<script>(.*?)</script>',html,re.S);assert len(scripts)==1
(DIST/'app.js').write_text(scripts[0],encoding='utf-8')
for name in ['core.js','engine.js']:shutil.copy2(SRC/'sync'/name,DIST/name)
for name in ['vault.js','github.js']:shutil.copy2(ROOT/name,DIST/name)
for name in ['GardenSans.otf','FONT-LICENSE.txt']:shutil.copy2(SRC/name,DIST/name)
tags='\n'.join('<script src="./'+name+'"></script>' for name in ['vault.js','core.js','engine.js','github.js','app.js'])
html=re.sub(r'<script>.*?</script>',tags,html,flags=re.S)
html=re.sub(r'<meta name="viewport"[^>]+>','<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',html)
html=html.replace('</head>', '''<meta name="mind-garden-app" content="ipad-v1">
<meta name="application-name" content="心之林">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="心之林">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#eff4ea">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.github.com; img-src 'self' data: blob:; font-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">
<link rel="manifest" href="./manifest.webmanifest" crossorigin="use-credentials">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<link rel="icon" href="./icon-192.png">
<link rel="stylesheet" href="./app.css">
</head>''')
(DIST/'index.html').write_text(html,encoding='utf-8')
manifest={'id':'./','name':'心之林','short_name':'心之林','description':'慢慢靠近，你想要的生活。','lang':'zh-CN','start_url':'./','scope':'./','display':'standalone','background_color':'#eff4ea','theme_color':'#eff4ea','icons':[{'src':'./icon-192.png','sizes':'192x192','type':'image/png'},{'src':'./icon-512.png','sizes':'512x512','type':'image/png','purpose':'any maskable'}]}
(DIST/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
def png(size,path):
    raw=bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            dx=(x+.5)/size-.5;dy=(y+.5)/size-.5;angle=math.atan2(dy,dx);radius=math.hypot(dx,dy)
            leaf=radius<.08+.24*max(0,math.cos(angle*8));raw.extend((193,220,166) if leaf else (25,72,59))
    def chunk(tag,data):return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
for size,name in [(180,'apple-touch-icon.png'),(192,'icon-192.png'),(512,'icon-512.png')]:png(size,DIST/name)
assets=['./','./index.html','./app.css','./vault.js','./core.js','./engine.js','./github.js','./app.js','./GardenSans.otf','./manifest.webmanifest','./apple-touch-icon.png','./icon-192.png','./icon-512.png']
digest=hashlib.sha256(b''.join((DIST/name[2:]).read_bytes() for name in sorted(set(assets)) if name!='./')).hexdigest()[:12]
# A new HTML document must never execute app code from the previous offline cache.
for name in ['app.css','vault.js','core.js','engine.js','github.js','app.js']:
    entry=Path(name);versioned=entry.stem+'.'+digest+entry.suffix
    shutil.copy2(DIST/name,DIST/versioned)
    html=html.replace('./'+name,'./'+versioned)
    assets.append('./'+versioned)
(DIST/'index.html').write_text(html,encoding='utf-8')
sw=(ROOT/'sw-template.js').read_text(encoding='utf-8').replace('__VERSION__',digest).replace('__ASSETS__',json.dumps(assets))
(DIST/'sw.js').write_text(sw,encoding='utf-8')
for name in ['vault.js','github.js','app.js','core.js','engine.js','sw.js']:subprocess.run(['node','--check',str(DIST/name)],check=True)
print('Built iPad PWA:',DIST,'offline version',digest)
