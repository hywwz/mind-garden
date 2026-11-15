package app.mindgarden.personal;
import java.io.*;
import java.util.*;
import java.util.zip.*;

public final class BackupArchive {
  public static boolean validId(String id){return id!=null&&id.matches("[A-Za-z0-9_-]{1,120}");}
  public static void copy(InputStream in,OutputStream out,long limit)throws IOException{byte[] b=new byte[32768];long total=0;int n;while((n=in.read(b))!=-1){total+=n;if(total>limit)throw new IOException("备份过大");out.write(b,0,n);}}
  public static void write(File vault,Iterable<String> ids,OutputStream stream)throws IOException{
    try(ZipOutputStream out=new ZipOutputStream(new BufferedOutputStream(stream))){add(out,new File(vault,"records.json"),"records.json");Set<String> seen=new HashSet<>();for(String id:ids){if(!validId(id))throw new IOException("文件编号不完整");if(seen.add(id))add(out,new File(vault,"files/"+id),"files/"+id);}}
  }
  private static void add(ZipOutputStream zip,File file,String name)throws IOException{if(!file.isFile())throw new IOException("有文件尚未保存，请稍后重试");zip.putNextEntry(new ZipEntry(name));try(InputStream in=new FileInputStream(file)){copy(in,zip,150L*1024*1024);}zip.closeEntry();}
  public static void extract(InputStream source,File stage)throws IOException{
    if(!stage.mkdirs()&&!stage.isDirectory())throw new IOException("无法准备恢复空间");Set<String> seen=new HashSet<>();long total=0;int count=0;
    try(ZipInputStream in=new ZipInputStream(new BufferedInputStream(source))){ZipEntry e;while((e=in.getNextEntry())!=null){String name=e.getName();if(e.isDirectory()||!(name.equals("records.json")||(name.startsWith("files/")&&validId(name.substring(6)))))throw new IOException("不是完整的心之林备份");if(!seen.add(name)||++count>3000)throw new IOException("备份内容重复或过多");File file=new File(stage,name);File parent=file.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("无法恢复文件");long fileSize=0;try(OutputStream out=new FileOutputStream(file)){byte[] b=new byte[32768];int n;while((n=in.read(b))!=-1){fileSize+=n;total+=n;if(fileSize>26L*1024*1024||total>150L*1024*1024)throw new IOException("备份过大");out.write(b,0,n);}}in.closeEntry();}}
    if(!new File(stage,"records.json").isFile())throw new IOException("备份缺少内容");
  }
}
