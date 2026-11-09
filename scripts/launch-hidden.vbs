Option Explicit
Dim shell, fso, folder, nodePath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
If WScript.Arguments.Count <> 1 Then WScript.Quit 1
nodePath = WScript.Arguments(0)
shell.CurrentDirectory = fso.GetParentFolderName(folder)
shell.Run Chr(34) & nodePath & Chr(34) & " " & Chr(34) & folder & "\serve.mjs" & Chr(34), 0, False
