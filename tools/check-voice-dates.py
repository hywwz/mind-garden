"""Run the actual Android date resolver on a JVM using synthetic, fixed-clock examples."""
from pathlib import Path
import subprocess,json,os
root=Path(__file__).resolve().parents[1]
java=Path(os.environ.get('MIND_GARDEN_JAVA_BIN','C:/Program Files/Java/jdk-21.0.11/bin'))
build=root/'work/android/build';vendor=root/'work/android/vendor/voice'
source=build/'DateCheck.java'
source.write_text('import app.mindgarden.personal.VoiceDates; public class DateCheck {public static void main(String[] a){System.out.println(VoiceDates.resolve(a[0],a[1]));}}',encoding='utf-8')
cp=os.pathsep.join(map(str,[build,build/'voice-dates.jar',vendor/'kotlin-stdlib-2.4.0.jar']))
subprocess.run([str(java/'javac.exe'),'-encoding','UTF-8','-cp',cp,'-d',str(build),str(source)],check=True)
cases=[('明天下午三点','2026-11-17','15:00'),('今晚六点','2026-11-16','18:00'),('后天白天','2026-11-18',''),('明天，不对，后天','2026-11-18',''),('','', ''),('明天上午九点','2026-11-17','09:00'),('下午五点','2026-11-16','17:00')]
for phrase,date,time in cases:
 out=subprocess.check_output([str(java/'java.exe'),'-cp',cp,'DateCheck',phrase,'2026-11-16T08:00:00Z'],text=True,encoding='utf-8')
 result=json.loads(out);assert(result['date'],result['time'])==(date,time),(phrase,result)
assert json.loads(subprocess.check_output([str(java/'java.exe'),'-cp',cp,'DateCheck','五点','2026-11-16T08:00:00Z'],text=True))['needsConfirmation']
print('Passed actual Android date resolver: today/tomorrow/day-after-tomorrow, last correction, empty date, explicit hour and ambiguous hour.')
