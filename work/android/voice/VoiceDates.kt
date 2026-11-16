package app.mindgarden.personal

import app.voicetodo.parser.*
import java.time.*
import java.time.format.DateTimeFormatter

/** Dates are resolved only from verbatim speech against an explicit Asia/Shanghai reference. */
object VoiceDates {
 @JvmStatic fun resolve(expression:String,reference:String):String {
  if(expression.isBlank())return "{\"date\":\"\",\"time\":\"\",\"needsConfirmation\":false}"
  val now=Instant.parse(reference).atZone(ZoneId.of("Asia/Shanghai")).toLocalDateTime()
  val cleaned=Disfluency.clean(expression).text
  val parsed=TaskParser().parse(cleaned+" 任务占位",now)
  val dates=parsed.tasks.mapNotNull { it.due }.distinct()
  if(dates.size!=1)return "{\"date\":\"\",\"time\":\"\",\"needsConfirmation\":true}"
  val due=dates.single()
  val clock=Regex("(?:\\d{1,2}点|\\d{1,2}:\\d{2})").containsMatchIn(parsed.normalized)
  val period=Regex("凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|明晚|昨晚|深夜|半夜|明早|今早").containsMatchIn(cleaned)
  val twentyFour=Regex("(?:1[3-9]|2[0-3])(?:点|:)|(?:0\\d|1[0-2]):\\d{2}").containsMatchIn(parsed.normalized)
  val ambiguous=clock&&!period&&!twentyFour
  val warnings=parsed.tasks.flatMap { it.warnings }.isNotEmpty()
  val time=if((clock&&!ambiguous||due.countdown)&&!due.approximate)due.time?.format(DateTimeFormatter.ofPattern("HH:mm"))?:"" else ""
  val confirm=ambiguous||warnings||due.approximate||due.date.isBefore(now.toLocalDate())
  return "{\"date\":\"${due.date}\",\"time\":\"$time\",\"needsConfirmation\":$confirm}"
 }
}
