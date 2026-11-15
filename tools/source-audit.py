"""Check exactly the Git index before publishing, without printing any matches."""
from pathlib import Path
import re, subprocess

ROOT=Path(__file__).resolve().parents[1]
files=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().strip('\0').split('\0')
deny=['/signing/','.p12','.keystore','password.txt','/dist/','/sources/','/vendor/','/assets/','本地保留','发给姐姐','publication','profile','backup.json','test-processes']
secrets=[rb'github_pat_[A-Za-z0-9_]{30,}',rb'gh[pousr]_[A-Za-z0-9]{30,}',rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----']
private_patterns=[rb'appgprj_[a-z0-9]{20,}',rb'[a-z0-9-]+\.chatgpt\.site',rb'net-[a-f0-9]{8}-[RD][0-9]{2}',rb'C:[/\\]+Users[/\\]+[^/\\\s\x27\x22]+']
problems=[]
for name in files:
    if any(term in '/'+name for term in deny):problems.append(name+': excluded path')
    data=subprocess.check_output(['git','show',':'+name],cwd=ROOT)
    if any(re.search(pattern,data) for pattern in secrets):problems.append(name+': credential pattern')
    if any(re.search(pattern,data) for pattern in private_patterns):problems.append(name+': private workspace identifier')
if problems:
    raise SystemExit('\n'.join(problems))
print('Checked '+str(len(files))+' staged source files: no excluded data paths, signing files, token patterns or known private workspace identifiers.')
