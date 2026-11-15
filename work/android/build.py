from pathlib import Path
import subprocess,zipfile,json,secrets,shutil,os
ROOT=Path(__file__).resolve().parent
WORK=ROOT/'build';WORK.mkdir(exist_ok=True)
OUT=ROOT.parents[1]/'outputs';OUT.mkdir(exist_ok=True)
HB=Path(os.environ.get('MIND_GARDEN_HBUILDER_PLUGINS','B:/Development Tools/HBuilderX/plugins'))
JAVA=Path(os.environ.get('MIND_GARDEN_JAVA_BIN','B:/Development Tools/jdk-17.0.2/bin'))
ANDROID=HB/'uniapp-runextension/lib/android_36.jar'
AAPT=HB/'uts-development-android/static/win/aapt2.exe'
R8=HB/'uniapp-runextension/utsServer_jar/r8-8.10.21.jar'
SIGNER=HB/'app-safe-pack/apksigner.jar'
ALIGN=HB/'app-safe-pack/zipalign/zipalign.exe'
def run(*args):
    subprocess.run([str(a) for a in args],cwd=ROOT,check=True)
assets=ROOT/'assets';assets.mkdir(exist_ok=True)
web_source=OUT/'mind_garden.html'
if not web_source.exists():web_source=ROOT/'web-source.html'
html=web_source.read_text(encoding='utf-8')
SYNC=ROOT.parent/'sync'
if not SYNC.is_dir():SYNC=ROOT/'sync'
bootstrap=(ROOT/'phone-bootstrap.js').read_text(encoding='utf-8')
phone=(ROOT/'phone-layout.js').read_text(encoding='utf-8')+'\n'+(ROOT/'phone.js').read_text(encoding='utf-8')
a=html.index('const seeds=()=>');b=html.index('let db;try',a);html=html[:a]+"const seeds=()=>({goals:[],ideas:[],evidence:[]});\n"+html[b:]
html=html.replace('<script>','<script>\n'+bootstrap+'\n</script>\n<script>',1)
html=html.replace('localStorage.setItem(KEY,JSON.stringify(db));','localStorage.setItem(KEY,JSON.stringify(db));window.queuePhoneSave?.();window.queueGardenSync?.();')
html=html.replace('const out={...value,version:2};','const out={...value,version:2};delete out.attachments;')
html=html.replace('initTaskSorting();\nrender();\n})();',phone+'\n'+(SYNC/'ui.js').read_text(encoding='utf-8')+'\ninitTaskSorting();\nrender();\ninitPhoneApp();\ninitPhoneLayout();\ninstallSemanticMap();\ninitGardenSync();\n})();')
html=html.replace('</style>',(ROOT/'phone.css').read_text(encoding='utf-8')+'\n'+(ROOT/'mobile-layout.css').read_text(encoding='utf-8')+'\n'+(SYNC/'ui.css').read_text(encoding='utf-8')+'\n</style>')
html=html.replace('<script>','<script>\n'+(SYNC/'core.js').read_text(encoding='utf-8')+'\n'+(SYNC/'engine.js').read_text(encoding='utf-8')+'\n</script>\n<script>',1)
html=html.replace("else{mapView.x=drag.viewX+dx", "else{phoneAutoBounds=false;mapView.x=drag.viewX+dx")
html=html.replace("e.target.closest('.map-controls')", "e.target.closest('.map-controls,.phone-map-actions,.phone-life-empty')")
html=html.replace("ra=a.depthRole==='background'?28:a.depthRole==='ancestor'?20:90,rb=b.depthRole==='background'?28:b.depthRole==='ancestor'?20:90", "ra=a.depthRole==='background'?24:a.depthRole==='ancestor'?16:a.type==='root'?72:62,rb=b.depthRole==='background'?24:b.depthRole==='ancestor'?16:b.type==='root'?72:62")
needle="const separating=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(separating>0){a.vx+=nx*separating*wa/total;a.vy+=ny*separating*wa/total;b.vx-=nx*separating*wb/total;b.vy-=ny*separating*wb/total}}"
html=html.replace(needle,needle+"constrainPhoneNodes(points);")
font=ROOT/'GardenSans.otf'
if not font.exists():shutil.copyfile('C:/Windows/Fonts/Noto Sans SC (TrueType).otf',font)
shutil.copyfile(font,assets/'GardenSans.otf')
shutil.copyfile(ROOT/'FONT-LICENSE.txt',assets/'FONT-LICENSE.txt')
(assets/'index.html').write_text(html,encoding='utf-8')
(WORK/'asset-script.js').write_text(html[html.index('(() => {'):html.rindex('</script>')],encoding='utf-8')
run('node','--check',WORK/'asset-script.js')
run(AAPT,'compile','--dir',ROOT/'res','-o',WORK/'resources.zip')
gen=WORK/'gen';gen.mkdir(exist_ok=True)
run(AAPT,'link','-I',HB/'uts-development-android/static/android.jar','--manifest',ROOT/'AndroidManifest.xml','-o',WORK/'resources.apk','--java',gen,'-A',assets,WORK/'resources.zip')
classes=WORK/'classes';classes.mkdir(exist_ok=True)
sources=list((ROOT/'src').rglob('*.java'))+list(gen.rglob('*.java'))
run(JAVA/'javac.exe','-encoding','UTF-8','-source','8','-target','8','-Xlint:-options','-classpath',ANDROID,'-d',classes,*sources)
jar=WORK/'classes.jar'
with zipfile.ZipFile(jar,'w',zipfile.ZIP_DEFLATED) as z:
    for p in (classes/'app').rglob('*.class'):z.write(p,p.relative_to(classes).as_posix())
dex=WORK/'dex';dex.mkdir(exist_ok=True)
run(JAVA/'java.exe','-cp',R8,'com.android.tools.r8.D8','--release','--min-api','26','--lib',ANDROID,'--output',dex,jar)
unsigned=WORK/'unsigned.apk';shutil.copyfile(WORK/'resources.apk',unsigned)
with zipfile.ZipFile(unsigned,'a',zipfile.ZIP_DEFLATED) as z:z.write(dex/'classes.dex','classes.dex')
aligned=WORK/'aligned.apk';run(ALIGN,'-f','4',unsigned,aligned)
keys=ROOT/'signing';keys.mkdir(exist_ok=True)
password_file=keys/'password.txt';key=keys/'mind-garden.p12'
if not password_file.exists():password_file.write_text(secrets.token_urlsafe(28),encoding='utf-8')
if not key.exists():run(JAVA/'keytool.exe','-genkeypair','-keystore',key,'-storetype','PKCS12','-storepass:file',password_file,'-keypass:file',password_file,'-alias','mindgarden','-keyalg','RSA','-keysize','3072','-validity','12000','-dname','CN=Mind Garden Personal, O=Mind Garden, C=CN')
apk=OUT/'心之林-安卓离线版.apk'
run(JAVA/'java.exe','-jar',SIGNER,'sign','--ks',key,'--ks-key-alias','mindgarden','--ks-pass','file:'+str(password_file),'--out',apk,aligned)
run(JAVA/'java.exe','-jar',SIGNER,'verify','--verbose',apk)
run(AAPT,'dump','badging',apk)
with zipfile.ZipFile(OUT/'心之林-安卓项目.zip','w',zipfile.ZIP_DEFLATED) as z:
    for folder in ['src','res','assets']:
        for p in (ROOT/folder).rglob('*'):
            if p.is_file():z.write(p,p.relative_to(ROOT).as_posix())
    for name in ['AndroidManifest.xml','phone.js','phone-bootstrap.js','phone.css','phone-layout.js','mobile-layout.css','GardenSans.otf','FONT-LICENSE.txt','build.py']:
        z.write(ROOT/name,name)
    z.write(web_source,'web-source.html')
    for p in SYNC.iterdir():
        if p.is_file():z.write(p,'sync/'+p.name)
print('Built:',apk)
