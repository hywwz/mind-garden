package app.mindgarden.personal;

import com.google.ai.edge.litertlm.*;
import java.io.File;
import java.util.Collections;
import org.json.*;

/** All inference is local. This class never receives a network client or record-store handle. */
final class ModelRunner implements AutoCloseable {
 private Engine engine;
 private volatile Conversation active;
 private String loaded="";
 private final File cache;
 ModelRunner(File cache){this.cache=cache;cache.mkdirs();}
 private void load(File model)throws Exception {
  if(engine!=null&&loaded.equals(model.getAbsolutePath()))return;
  close();
  if(!model.isFile())throw new Exception("请先在本机整理设置中选择模型文件");
  // Native libraries are packaged for arm64; the UI/manual workflow also works on older devices.
  if(android.os.Build.VERSION.SDK_INT<31)throw new Exception("这台手机暂不支持本机模型，可以继续手动收下");
  try{initialize(model,new Backend.GPU());}
  catch(Throwable gpu){close();try{initialize(model,new Backend.CPU());}catch(Throwable cpu){close();throw new Exception("模型未能加载。请确认是支持音频的 Gemma .litertlm 文件，并留出足够内存");}}
  loaded=model.getAbsolutePath();
 }
 private void initialize(File model,Backend backend){
  engine=new Engine(new EngineConfig(model.getAbsolutePath(),backend,null,new Backend.CPU(),16384,null,cache.getAbsolutePath()));
  engine.initialize();
 }
 String run(File model,String instruction,String input,File audio)throws Exception {
  return runInternal(model,instruction,input,audio,audio==null);
 }
 String chat(File model,String instruction,String input)throws Exception{return runInternal(model,instruction,input,null,false);}
 private String runInternal(File model,String instruction,String input,File audio,boolean structured)throws Exception{
  load(model);
  ConversationConfig config=new ConversationConfig(Contents.Companion.of(instruction),Collections.emptyList(),Collections.emptyList(),new SamplerConfig(32,.9,.1,42),false,Collections.emptyList(),Collections.emptyMap(),null,false,4096,new ThinkingConfig(false),structured);
  try(Conversation conversation=engine.createConversation(config)){
   active=conversation;
   Message result=audio==null&&!structured?conversation.sendMessage(input):audio==null?conversation.sendMessage(input,Collections.emptyMap(),null,null,null,null,new ThinkingConfig(false),ResponseFormat.json(schema())):conversation.sendMessage(Contents.Companion.of(new Content.Text(input),new Content.AudioFile(audio.getAbsolutePath())));
   StringBuilder text=new StringBuilder();
   for(Content part:result.getContents().getContents())if(part instanceof Content.Text)text.append(((Content.Text)part).getText());
   String value=text.toString().trim();
   if(value.isEmpty())throw new Exception("没有得到可用结果，原话和录音已保留");
   return value;
  }finally{active=null;}
 }
 private static String schema(){return "{\"type\":\"object\",\"properties\":{\"items\":{\"type\":\"array\",\"maxItems\":40,\"items\":{\"type\":\"object\",\"properties\":{\"id\":{\"type\":\"string\"},\"kind\":{\"type\":\"string\",\"enum\":[\"task\",\"idea\",\"note\"]},\"title\":{\"type\":\"string\"},\"sourceQuote\":{\"type\":\"string\"},\"temporalQuote\":{\"type\":\"string\"},\"conditionQuote\":{\"type\":\"string\"},\"durationMin\":{\"type\":[\"integer\",\"null\"]},\"durationMax\":{\"type\":[\"integer\",\"null\"]},\"afterId\":{\"type\":\"string\"},\"existingId\":{\"type\":\"string\"},\"placementId\":{\"type\":\"string\"},\"operation\":{\"type\":\"string\",\"enum\":[\"add\",\"update\"]}},\"required\":[\"id\",\"kind\",\"title\",\"sourceQuote\",\"temporalQuote\",\"conditionQuote\",\"durationMin\",\"durationMax\",\"afterId\",\"existingId\",\"placementId\",\"operation\"],\"additionalProperties\":false}},\"questions\":{\"type\":\"array\",\"items\":{\"type\":\"string\"}}},\"required\":[\"items\",\"questions\"],\"additionalProperties\":false}";}
 void cancel(){Conversation c=active;if(c!=null)try{c.cancelProcess();}catch(Exception ignored){}}
 @Override public void close(){if(engine!=null){try{engine.close();}catch(Throwable ignored){}engine=null;}loaded="";}
 static JSONObject object(String value)throws Exception {
  String text=value.trim();if(text.startsWith("```")){int first=text.indexOf('\n'),last=text.lastIndexOf("```");if(first>=0&&last>first)text=text.substring(first+1,last).trim();}
  try{return new JSONObject(text);}catch(JSONException e){throw new Exception("整理结果格式不完整，原话已保留，可以重试或手动收下");}
 }
}
