using System;
using System.IO;
using System.IO.Compression;
using System.Drawing;
using System.Windows.Forms;
using System.Reflection;
using System.Diagnostics;

[assembly:AssemblyTitle("心之林安装")]
[assembly:AssemblyVersion("1.14.0.0")]
static class Installer {
    [STAThread] static void Main() {
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        var form=new Form{Text="安装心之林",ClientSize=new Size(470,280),FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,StartPosition=FormStartPosition.CenterScreen,BackColor=Color.FromArgb(239,244,234)};
        form.Font=new Font("Microsoft YaHei UI",10);form.Controls.Add(new Label{Text="心之林",Font=new Font("Microsoft YaHei UI",23),ForeColor=Color.FromArgb(27,68,51),AutoSize=true,Location=new Point(28,24)});
        form.Controls.Add(new Label{Text="慢慢靠近，你想要的生活。\n离线使用，内容自动保存在这台电脑。",AutoSize=true,Location=new Point(32,82),ForeColor=Color.FromArgb(66,94,81)});
        var shortcut=new CheckBox{Text="在桌面创建图标",Checked=true,AutoSize=true,Location=new Point(32,153)};form.Controls.Add(shortcut);
        var status=new Label{AutoSize=true,Location=new Point(32,198),MaximumSize=new Size(270,60)};form.Controls.Add(status);
        var install=new Button{Text="安装并打开",Size=new Size(128,40),Location=new Point(306,208),FlatStyle=FlatStyle.Flat,BackColor=Color.FromArgb(191,216,167)};form.Controls.Add(install);
        install.Click+=(s,e)=>{install.Enabled=false;try{
            string folder=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","MindGarden");Directory.CreateDirectory(folder);
            using(var resource=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))using(var zip=new ZipArchive(resource,ZipArchiveMode.Read))foreach(var entry in zip.Entries){if(entry.FullName.EndsWith("/"))continue;string target=Path.GetFullPath(Path.Combine(folder,entry.FullName.Replace('/',Path.DirectorySeparatorChar)));if(!target.StartsWith(folder+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new IOException("安装文件路径无效");Directory.CreateDirectory(Path.GetDirectoryName(target));using(var input=entry.Open())using(var output=new FileStream(target,FileMode.Create,FileAccess.Write))input.CopyTo(output);}
            string executable=Path.Combine(folder,"心之林.exe");Type shellType=Type.GetTypeFromProgID("WScript.Shell");object shell=Activator.CreateInstance(shellType);string startMenu=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),"Programs","心之林.lnk");CreateShortcut(shell,startMenu,executable,folder);if(shortcut.Checked)CreateShortcut(shell,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"心之林.lnk"),executable,folder);
            Process.Start(new ProcessStartInfo(executable){WorkingDirectory=folder,UseShellExecute=true});form.Close();
        }catch(Exception error){status.Text="安装未完成。请先关闭已打开的心之林再试。";MessageBox.Show(error.Message,"心之林");install.Enabled=true;}};
        Application.Run(form);
    }
    static void CreateShortcut(object shell,string path,string target,string folder){object link=shell.GetType().InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{path});Type t=link.GetType();t.InvokeMember("TargetPath",BindingFlags.SetProperty,null,link,new object[]{target});t.InvokeMember("WorkingDirectory",BindingFlags.SetProperty,null,link,new object[]{folder});t.InvokeMember("IconLocation",BindingFlags.SetProperty,null,link,new object[]{target+",0"});t.InvokeMember("Save",BindingFlags.InvokeMethod,null,link,null);}
}
