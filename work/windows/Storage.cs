using System;
using System.IO;
using System.IO.Compression;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;

namespace MindGarden {
public sealed class GardenStore {
    public readonly string Root;
    public string BackupFolder;
    public long LocalSaved, BackupSaved;
    public string BackupError = "";
    public readonly object Gate = new object();
    const int MaxBytes = 150 * 1024 * 1024;
    public GardenStore(string root, string defaultBackup) {
        Root=Path.GetFullPath(root); Directory.CreateDirectory(Root);
        string config=Path.Combine(Root,"backup-folder.txt");
        BackupFolder=File.Exists(config)?File.ReadAllText(config):defaultBackup;
        if(File.Exists(Current)) LocalSaved=new DateTimeOffset(File.GetLastWriteTimeUtc(Current)).ToUnixTimeMilliseconds();
    }
    public string Current { get { return Path.Combine(Root,"current.json"); } }
    public string Previous { get { return Path.Combine(Root,"before-restore.json"); } }
    public static JavaScriptSerializer Serializer() { return new JavaScriptSerializer { MaxJsonLength=MaxBytes, RecursionLimit=200 }; }
    public static Dictionary<string,object> Parse(string text) { return Serializer().Deserialize<Dictionary<string,object>>(text); }
    public static string Json(object value) { return Serializer().Serialize(value); }
    public static IEnumerable<object> Items(object value) { var list=value as IEnumerable; if(list==null||value is string||value is IDictionary) throw new IOException("备份列表不完整");foreach(object item in list) yield return item; }
    public static Dictionary<string,object> Map(object value) { var map=value as Dictionary<string,object>;if(map==null)throw new IOException("备份内容不完整");return map; }
    public static string Text(Dictionary<string,object> map,string key) { object value;return map.TryGetValue(key,out value)?Convert.ToString(value):""; }
    public static bool SafeId(string id) { return !String.IsNullOrEmpty(id)&&id.Length<=128&&id.All(c=>(c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='_'||c=='-'); }
    public static Dictionary<string,byte[]> Validate(Dictionary<string,object> data) {
        if(data==null)throw new IOException("没有读到备份内容");
        foreach(string key in new[]{"goals","ideas","evidence"}) { if(!data.ContainsKey(key))throw new IOException("备份缺少"+key);Items(data[key]).ToArray(); }
        foreach(object goal in Items(data["goals"])) {var g=Map(goal);CheckTitle(g);foreach(object skill in Items(g["skills"])) {var s=Map(skill);CheckTitle(s);foreach(object action in Items(s["actions"]))CheckTitle(Map(action));}}
        var files=new Dictionary<string,byte[]>();object attachmentList;
        if(data.TryGetValue("attachments",out attachmentList))foreach(object attachment in Items(attachmentList)) {var a=Map(attachment);string id=Text(a,"id");if(!SafeId(id)||files.ContainsKey(id))throw new IOException("备份文件编号无效");byte[] bytes;try{bytes=Convert.FromBase64String(Text(a,"data"));}catch{throw new IOException("备份文件损坏");}if(bytes.Length>26*1024*1024)throw new IOException("备份文件过大");files.Add(id,bytes);}
        foreach(object idea in Items(data["ideas"])) {var i=Map(idea);if(!SafeId(Text(i,"id")))throw new IOException("灵感编号无效");object list;if(i.TryGetValue("actions",out list))foreach(object action in Items(list))CheckTitle(Map(action));if(!i.TryGetValue("files",out list))continue;foreach(object file in Items(list)){var f=Map(file);string id=Text(f,"id");if(!SafeId(id)||!files.ContainsKey(id))throw new IOException("缺少文件："+Text(f,"name"));if(f.ContainsKey("size")&&Convert.ToInt64(f["size"])!=files[id].LongLength)throw new IOException("文件没有读完整："+Text(f,"name"));}}
        if(files.Sum(f=>(long)f.Value.Length)>MaxBytes)throw new IOException("备份内容过大");return files;
    }
    static void CheckTitle(Dictionary<string,object> item) { if(!SafeId(Text(item,"id"))||!item.ContainsKey("title")||!(item["title"] is string))throw new IOException("节点内容不完整"); }
    public static void AtomicWrite(string path,string text) {
        string temp=path+".tmp";using(var stream=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None))using(var writer=new StreamWriter(stream,new UTF8Encoding(false))) {writer.Write(text);writer.Flush();stream.Flush(true);}
        if(File.Exists(path))File.Replace(temp,path,null);else File.Move(temp,path);
    }
    public Dictionary<string,object> Load() { lock(Gate) {if(!File.Exists(Current))return null;if(new FileInfo(Current).Length>MaxBytes*2L)throw new IOException("存档过大");var data=Parse(File.ReadAllText(Current));Validate(data);return data;} }
    public void Save(Dictionary<string,object> data) { lock(Gate) {Validate(data);AtomicWrite(Current,Json(data));LocalSaved=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();} }
    public Dictionary<string,object> Status() { return new Dictionary<string,object>{{"localSaved",LocalSaved},{"backupSaved",BackupSaved},{"backupError",BackupError},{"previous",File.Exists(Previous)}}; }
    public void ChooseFolder(string folder) {Directory.CreateDirectory(folder);AtomicWrite(Path.Combine(Root,"backup-folder.txt"),folder);BackupFolder=folder;}
    public static void WriteZip(Dictionary<string,object> data,string path) {
        var files=Validate(data);var metadata=new Dictionary<string,object>(data);metadata.Remove("attachments");
        using(var stream=new FileStream(path,FileMode.CreateNew,FileAccess.Write))using(var zip=new ZipArchive(stream,ZipArchiveMode.Create)) {
            using(var writer=new StreamWriter(zip.CreateEntry("records.json",CompressionLevel.Optimal).Open(),new UTF8Encoding(false)))writer.Write(Json(metadata));
            foreach(var file in files)using(var target=zip.CreateEntry("files/"+file.Key,CompressionLevel.Optimal).Open())target.Write(file.Value,0,file.Value.Length);
        }
    }
    static byte[] ReadEntry(ZipArchiveEntry entry,int limit) {if(entry.Length>limit)throw new IOException("备份内容过大");using(var output=new MemoryStream())using(var input=entry.Open()){byte[] buffer=new byte[65536];int count;while((count=input.Read(buffer,0,buffer.Length))>0){if(output.Length+count>limit)throw new IOException("备份内容过大");output.Write(buffer,0,count);}return output.ToArray();}}
    public static Dictionary<string,object> ReadBackup(string path) {
        if(new FileInfo(path).Length>MaxBytes*2L)throw new IOException("备份过大");
        if(String.Equals(Path.GetExtension(path),".json",StringComparison.OrdinalIgnoreCase)){var value=Parse(File.ReadAllText(path));Validate(value);return value;}
        using(var stream=File.OpenRead(path))using(var zip=new ZipArchive(stream,ZipArchiveMode.Read)) {
            if(zip.Entries.Count>3000)throw new IOException("备份中的文件太多");var seen=new HashSet<string>();Dictionary<string,object> data=null;var files=new Dictionary<string,byte[]>();long total=0;
            foreach(var entry in zip.Entries){if(!seen.Add(entry.FullName))throw new IOException("备份有重复条目");if(entry.FullName=="records.json"){byte[] bytes=ReadEntry(entry,16*1024*1024);total+=bytes.Length;data=Parse(Encoding.UTF8.GetString(bytes));}
                else if(entry.FullName.StartsWith("files/",StringComparison.Ordinal)&&SafeId(entry.FullName.Substring(6))){byte[] bytes=ReadEntry(entry,26*1024*1024);total+=bytes.Length;files.Add(entry.FullName.Substring(6),bytes);}
                else throw new IOException("备份包含无效路径");if(total>MaxBytes)throw new IOException("备份内容过大");}
            if(data==null)throw new IOException("备份缺少内容记录");var attachments=new List<object>();foreach(var file in files)attachments.Add(new Dictionary<string,object>{{"id",file.Key},{"data",Convert.ToBase64String(file.Value)}});data["attachments"]=attachments;Validate(data);return data;
        }
    }
    public void Restore(Dictionary<string,object> data) {lock(Gate){Validate(data);if(File.Exists(Current)){var old=Load();AtomicWrite(Previous,Json(old));}Save(data);} }
    public void UndoRestore() {lock(Gate){if(!File.Exists(Previous))throw new IOException("没有可以撤回的恢复");var previous=Parse(File.ReadAllText(Previous));Validate(previous);Restore(previous);} }
    public void AutomaticBackup() {
        lock(Gate){try{var data=Load();if(data==null||BackupSaved>=LocalSaved)return;Directory.CreateDirectory(BackupFolder);string name="心之林-电脑-"+DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss-fff")+"-"+Guid.NewGuid().ToString("N").Substring(0,4)+".zip";string destination=Path.Combine(BackupFolder,name);string temp=Path.Combine(BackupFolder,".garden-"+Guid.NewGuid().ToString("N")+".tmp");try{WriteZip(data,temp);File.Move(temp,destination);}finally{if(File.Exists(temp))File.Delete(temp);}BackupSaved=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();BackupError="";
            // Only remove paths that this application recorded as its own backups.
            string manifestPath=Path.Combine(Root,"created-backups.json");var owned=new List<string>();if(File.Exists(manifestPath)){try{owned=Serializer().Deserialize<List<string>>(File.ReadAllText(manifestPath));}catch{}}
            owned=owned.Where(p=>File.Exists(p)&&String.Equals(Path.GetDirectoryName(p),BackupFolder,StringComparison.OrdinalIgnoreCase)).ToList();owned.Add(destination);
            var keep=new HashSet<string>(owned.AsEnumerable().Reverse().Take(3));foreach(var daily in owned.GroupBy(p=>Path.GetFileName(p).Substring(7,10)).OrderByDescending(g=>g.Key).Take(7))keep.Add(daily.Last());
            foreach(string old in owned.Where(p=>!keep.Contains(p))){try{File.Delete(old);}catch{keep.Add(old);}}AtomicWrite(manifestPath,Json(owned.Where(keep.Contains).ToArray()));
        }catch(Exception error){BackupError=error.Message;}}
    }
}
}
