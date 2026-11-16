"""Fetch pinned Google LiteRT-LM runtime and Maven dependencies; no user models."""
from pathlib import Path
import hashlib,json,urllib.request,urllib.error,xml.etree.ElementTree as ET,zipfile
ROOT=Path(__file__).resolve().parents[1]/'work/android/vendor/voice'
ROOT.mkdir(parents=True,exist_ok=True)
GOOGLE='https://dl.google.com/dl/android/maven2/'
CENTRAL='https://repo.maven.apache.org/maven2/'
seen={};records=[]
ns={'m':'http://maven.apache.org/POM/4.0.0'}
def get(url,path):
 if path.exists() and path.stat().st_size:return path.read_bytes()
 with urllib.request.urlopen(url,timeout=90) as response:data=response.read()
 part=path.with_suffix(path.suffix+'.part');part.write_bytes(data);part.replace(path)
 return data
def fetch(group,artifact,version):
 key=group+':'+artifact
 if key in seen:return
 seen[key]=version
 repo=GOOGLE if group.startswith(('com.google.ai.edge','androidx.')) else CENTRAL
 prefix=group.replace('.','/')+'/'+artifact+'/'+version+'/'+artifact+'-'+version
 pom=get(repo+prefix+'.pom',ROOT/(artifact+'-'+version+'.pom'))
 tree=ET.fromstring(pom)
 package=tree.findtext('m:packaging',default='jar',namespaces=ns)
 if package not in ('jar','aar'):package='jar'
 target=ROOT/(artifact+'-'+version+'.'+package)
 data=get(repo+prefix+'.'+package,target)
 records.append({'coordinate':key+':'+version,'file':target.name,'url':repo+prefix+'.'+package,'sha256':hashlib.sha256(data).hexdigest()})
 if package=='aar':
  with zipfile.ZipFile(target) as z:
   (ROOT/(artifact+'-'+version+'-classes.jar')).write_bytes(z.read('classes.jar'))
   for name in z.namelist():
    if name.startswith('jni/arm64-v8a/') and name.endswith('.so'):
     folder=ROOT/'jni/arm64-v8a';folder.mkdir(parents=True,exist_ok=True);(folder/Path(name).name).write_bytes(z.read(name))
 for dep in tree.findall('m:dependencies/m:dependency',ns):
  def val(k,default=''):return dep.findtext('m:'+k,default=default,namespaces=ns)
  if val('scope','compile') not in ('compile','runtime') or val('optional')=='true':continue
  version=val('version')
  if not version or '$' in version:
   props={p.tag.split('}')[-1]:p.text for p in tree.findall('m:properties/*',ns)}
   version=props.get(version[2:-1],version)
  if not version or '$' in version:raise RuntimeError('Unresolved Maven version: '+val('artifactId'))
  fetch(val('groupId'),val('artifactId'),version)
fetch('com.google.ai.edge.litertlm','litertlm-android','0.19.0')
(ROOT/'dependencies.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print('Fetched '+str(len(records))+' pinned runtime artifacts; user models are not downloaded.')
