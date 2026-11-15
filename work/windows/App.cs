using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Microsoft.Win32;

[assembly:System.Reflection.AssemblyTitle("心之林")]
[assembly:System.Reflection.AssemblyDescription("慢慢靠近，你想要的生活。")]
[assembly:System.Reflection.AssemblyVersion("1.13.1.0")]
[assembly:System.Reflection.AssemblyFileVersion("1.13.1.0")]
namespace MindGarden {
public sealed class GardenWindow:Window {
    readonly GardenStore store; readonly GitHubSync github; readonly string assets,debugPort; readonly WebView2 browser;
    System.Threading.Timer backupTimer; bool allowClose,closing,loaded; int epoch=1;
    public GardenWindow(string root,string backup,string debug,bool hidden) {
        store=new GardenStore(root,backup);github=new GitHubSync(store);debugPort=debug;assets=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"assets");
        Title="心之林";Width=1280;Height=860;MinWidth=860;MinHeight=620;WindowStartupLocation=WindowStartupLocation.CenterScreen;Background=new SolidColorBrush(Color.FromRgb(23,58,50));
        try{Icon=System.Windows.Interop.Imaging.CreateBitmapSourceFromHIcon(System.Drawing.Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule.FileName).Handle,Int32Rect.Empty,BitmapSizeOptions.FromEmptyOptions());}catch{}
        if(hidden){ShowActivated=false;ShowInTaskbar=false;WindowStartupLocation=WindowStartupLocation.Manual;Left=-15000;Top=-15000;}
        var grid=new Grid();Content=grid;grid.Children.Add(new TextBlock{Text="心之林 · 正在打开",Foreground=Brushes.White,FontSize=21,HorizontalAlignment=HorizontalAlignment.Center,VerticalAlignment=VerticalAlignment.Center});browser=new WebView2();grid.Children.Add(browser);
        Loaded+=async(s,e)=>await Start();Closing+=OnClosing;
    }
    async Task Start() {try{
        string arguments=String.IsNullOrEmpty(debugPort)?"":"--remote-debugging-port="+debugPort;
        var options=new CoreWebView2EnvironmentOptions(arguments);var environment=await CoreWebView2Environment.CreateAsync(null,Path.Combine(store.Root,"webview"),options);await browser.EnsureCoreWebView2Async(environment);
        var core=browser.CoreWebView2;core.Settings.IsStatusBarEnabled=false;core.Settings.AreDevToolsEnabled=!String.IsNullOrEmpty(debugPort);core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsZoomControlEnabled=false;core.Settings.AreBrowserAcceleratorKeysEnabled=false;
        core.SetVirtualHostNameToFolderMapping("mindgarden.local",assets,CoreWebView2HostResourceAccessKind.DenyCors);
        core.NavigationStarting+=(s,e)=>{Uri uri;if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out uri)||uri.Scheme!="https"||uri.Host!="mindgarden.local"){e.Cancel=true;}};
        core.NewWindowRequested+=(s,e)=>{e.Handled=true;Uri uri;if(Uri.TryCreate(e.Uri,UriKind.Absolute,out uri)&&(uri.Scheme=="https"||uri.Scheme=="http"))Process.Start(new ProcessStartInfo(e.Uri){UseShellExecute=true});};
        core.PermissionRequested+=(s,e)=>e.State=CoreWebView2PermissionState.Deny;
        core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);core.WebResourceRequested+=(s,e)=>{Uri uri;if(Uri.TryCreate(e.Request.Uri,UriKind.Absolute,out uri)&&(uri.Scheme=="https"||uri.Scheme=="http")&&uri.Host!="mindgarden.local")e.Response=environment.CreateWebResourceResponse(new MemoryStream(),403,"Offline","");};
        core.WebMessageReceived+=Message;core.ProcessFailed+=(s,e)=>{loaded=false;MessageBox.Show(this,"页面暂时停止了，请重新打开。已经保存的内容仍在电脑里。","心之林");};
        core.Navigate("https://mindgarden.local/index.html");
    }catch(Exception error){MessageBox.Show(this,"暂时无法打开心之林。请确认电脑已安装 Microsoft Edge WebView2 运行时。\n\n"+error.Message,"心之林");allowClose=true;Close();}}
    void ScheduleBackup() {if(backupTimer!=null)backupTimer.Dispose();backupTimer=new System.Threading.Timer(s=>{store.AutomaticBackup();},null,3000,Timeout.Infinite);}
    async void Message(object sender,CoreWebView2WebMessageReceivedEventArgs e) {
        if(!e.Source.StartsWith("https://mindgarden.local/",StringComparison.Ordinal))return;
        Dictionary<string,object> request=null;object id=null;
        try{request=GardenStore.Parse(e.WebMessageAsJson);id=request["id"];string method=GardenStore.Text(request,"method");var payload=GardenStore.Map(request["payload"]);int incoming=Convert.ToInt32(request["epoch"]);object result=null;
            if(method=="load") {Dictionary<string,object> snapshot=null;string error="";try{snapshot=await Task.Run(()=>store.Load());}catch(Exception err){error=err.Message;}loaded=String.IsNullOrEmpty(error);result=new{snapshot=snapshot,epoch=epoch,error=error};}
            else if(method=="status") {lock(store.Gate)result=store.Status();}
            else if(method=="github") {if(GardenStore.Text(payload,"action")=="recover"){string source=github.SafetyPath(GardenStore.Text(payload,"side"));var snapshot=await Task.Run(()=>GardenStore.ReadBackup(source));if(MessageBox.Show(this,"找回同步前保留的这份内容？当前内容会先留一份副本，恢复后的改动也会参与同步。","找回内容",MessageBoxButton.OKCancel)==MessageBoxResult.OK){if(backupTimer!=null)backupTimer.Dispose();await Task.Run(()=>{lock(store.Gate){epoch++;store.Restore(snapshot);}});ScheduleBackup();result=new{reload=true};}else result=false;}else result=await Task.Run(()=>github.Call(payload));}
            else if(method=="save") {var snapshot=GardenStore.Map(payload["snapshot"]);await Task.Run(()=>{lock(store.Gate){if(incoming!=epoch)throw new IOException("内容已切换，请重新打开页面");store.Save(snapshot);}});ScheduleBackup();lock(store.Gate)result=store.Status();}
            else if(method=="theme") {bool day=GardenStore.Text(payload,"theme")=="day";Background=new SolidColorBrush(day?Color.FromRgb(239,244,234):Color.FromRgb(23,58,50));result=true;}
            else if(method=="closeReady") {if(backupTimer!=null)backupTimer.Dispose();await Task.Run(()=>store.AutomaticBackup());allowClose=true;Reply(id,true,null);Close();return;}
            else if(method=="closeFailed") {closing=false;MessageBox.Show(this,"内容还没保存完整，请先备份或稍后再关闭。\n"+GardenStore.Text(payload,"message"),"心之林");result=true;}
            else if(method=="showFolder") {Directory.CreateDirectory(store.BackupFolder);Process.Start(new ProcessStartInfo("explorer.exe",Quote(store.BackupFolder)){UseShellExecute=true});result=true;}
            else if(method=="chooseFolder") {using(var picker=new System.Windows.Forms.FolderBrowserDialog()){picker.Description="选择心之林自动备份的文件夹";picker.SelectedPath=store.BackupFolder;if(picker.ShowDialog()==System.Windows.Forms.DialogResult.OK){store.ChooseFolder(picker.SelectedPath);await Task.Run(()=>store.AutomaticBackup());result=new{message="以后会自动备份到这个文件夹",status=store.Status()};}else result=false;}}
            else if(method=="export") {var picker=new SaveFileDialog{Title="另外存一份备份",Filter="心之林备份 (*.zip)|*.zip",FileName="心之林-电脑备份-"+DateTime.Now.ToString("yyyy-MM-dd")+".zip",DefaultExt=".zip"};if(picker.ShowDialog(this)==true){string temporary=picker.FileName+"."+Guid.NewGuid().ToString("N")+".tmp";try{await Task.Run(()=>GardenStore.WriteZip(store.Load(),temporary));if(File.Exists(picker.FileName))File.Replace(temporary,picker.FileName,null);else File.Move(temporary,picker.FileName);result=new{message="备份已保存"};}finally{if(File.Exists(temporary))File.Delete(temporary);}}else result=false;}
            else if(method=="restore"||method=="undoRestore") {
                string source=null;if(method=="restore"){var picker=new OpenFileDialog{Title="选择手机或电脑的心之林备份",Filter="心之林备份 (*.zip;*.json)|*.zip;*.json"};if(picker.ShowDialog(this)==true)source=picker.FileName;}else source=store.Previous;
                if(source!=null){var snapshot=await Task.Run(()=>GardenStore.ReadBackup(source));if(MessageBox.Show(this,"用这份备份替换当前内容？替换前会留一份副本，可以撤回。","恢复备份",MessageBoxButton.OKCancel,MessageBoxImage.Question)==MessageBoxResult.OK){if(backupTimer!=null)backupTimer.Dispose();await Task.Run(()=>{lock(store.Gate){epoch++;store.Restore(snapshot);}});ScheduleBackup();loaded=true;result=new{reload=true};}else result=false;}else result=false;
            }
            else if(method=="openAttachment") {string fileId=GardenStore.Text(payload,"id");if(!GardenStore.SafeId(fileId))throw new IOException("文件编号无效");var data=store.Load();Dictionary<string,object> metadata=null;foreach(object idea in GardenStore.Items(data["ideas"]))foreach(object file in GardenStore.Items(GardenStore.Map(idea)["files"]))if(GardenStore.Text(GardenStore.Map(file),"id")==fileId)metadata=GardenStore.Map(file);if(metadata==null)throw new IOException("没有找到文件");byte[] bytes=GardenStore.Validate(data)[fileId];string name=Path.GetFileName(GardenStore.Text(metadata,"name"));foreach(char invalid in Path.GetInvalidFileNameChars())name=name.Replace(invalid,'_');string extension=Path.GetExtension(name).ToLowerInvariant();if(new[]{".png",".jpg",".jpeg",".gif",".webp",".pdf",".txt",".md",".docx",".xlsx",".pptx"}.Contains(extension)){string folder=Path.Combine(store.Root,"open-files",fileId);Directory.CreateDirectory(folder);string path=Path.Combine(folder,name);File.WriteAllBytes(path,bytes);Process.Start(new ProcessStartInfo(path){UseShellExecute=true});}else{var picker=new SaveFileDialog{Title="保存文件",FileName=name};if(picker.ShowDialog(this)==true)File.WriteAllBytes(picker.FileName,bytes);}result=true;}
            else throw new IOException("没有找到这个操作");Reply(id,result,null);
        }catch(Exception error){if(id!=null)Reply(id,null,error.Message);}
    }
    static string Quote(string value) { return "\""+value.Replace("\"","")+"\""; }
    void Reply(object id,object result,string error) {if(browser.CoreWebView2!=null)browser.CoreWebView2.PostWebMessageAsJson(GardenStore.Json(new{id=id,result=result,error=error}));}
    async void OnClosing(object sender,CancelEventArgs e) {if(allowClose)return;e.Cancel=true;if(closing)return;closing=true;if(!loaded){if(MessageBox.Show(this,"内容尚未读完整。现在关闭？","心之林",MessageBoxButton.OKCancel)==MessageBoxResult.OK){allowClose=true;Close();}else closing=false;return;}try{await browser.ExecuteScriptAsync("window.prepareDesktopClose ? window.prepareDesktopClose() : window.desktopCall('closeFailed',{message:'页面尚未准备完成'})");}catch{closing=false;MessageBox.Show(this,"保存尚未完成，请稍后再关闭。","心之林");}}
}
public static class Program {
    [STAThread] public static int Main(string[] args) {
        string custom=args.FirstOrDefault(a=>a.StartsWith("--data-dir="));string root=custom==null?Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MindGardenDesktop"):Path.GetFullPath(custom.Substring(11));
        string backup=custom==null?Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"心之林备份"):Path.Combine(root,"backups");
        string debug=args.FirstOrDefault(a=>a.StartsWith("--debug-port="));debug=debug==null?"":debug.Substring(13);if(debug.Any(c=>!Char.IsDigit(c)))return 2;
        bool created;string key=BitConverter.ToString(System.Security.Cryptography.SHA256.Create().ComputeHash(System.Text.Encoding.UTF8.GetBytes(root.ToLowerInvariant()))).Replace("-","");using(var mutex=new Mutex(true,"Local\\MindGardenDesktop_"+key,out created)){if(!created){MessageBox.Show("心之林已经打开，请到任务栏查看。","心之林");return 0;}var app=new Application();app.Run(new GardenWindow(root,backup,debug,args.Contains("--test-hidden")));}return 0;
    }
}
}
