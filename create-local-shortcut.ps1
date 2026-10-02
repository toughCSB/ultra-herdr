$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'local-settings.cmd'
if (!(Test-Path -LiteralPath $launcher)) { throw 'local-settings.cmd is missing' }
$desktop = [Environment]::GetFolderPath('Desktop')
$path = Join-Path $desktop 'ultra-herdr Local Settings.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($path)
if ((Test-Path -LiteralPath $path) -and
    ($shortcut.TargetPath -ne $env:ComSpec -or $shortcut.Arguments -notlike '*local-settings.cmd*')) {
  throw "An unrelated shortcut already exists: $path"
}
$shortcut.TargetPath = $env:ComSpec
$shortcut.Arguments = '/d /c ""' + $launcher + '""'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = 'ultra-herdr settings on this PC, independent of remote workspaces'
$shortcut.WindowStyle = 1
$shortcut.Save()
Write-Output $path
