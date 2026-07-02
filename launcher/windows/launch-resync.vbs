' Launch ReSync without showing a terminal window
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c start-resync.bat", 0, False
Set shell = Nothing
