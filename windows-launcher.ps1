param([switch]$Open)
$ErrorActionPreference = 'Stop'
$shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Herdr.lnk'
if (-not (Test-Path -LiteralPath $shortcut)) { throw 'Herdr desktop shortcut was not found' }
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
if ([IO.Path]::GetFileName($link.TargetPath) -ne 'wt.exe' -or $link.Arguments -notmatch 'herdr\.exe') {
  throw 'Refusing to change a shortcut that is not the Windows Terminal Herdr launcher'
}
if ($link.Arguments -notmatch '(?i)(?:-p|--profile)\s+"?Herdr(?:[" ]|$)') {
  $backupDir = Join-Path $env:APPDATA 'herdr/ultra-herdr-backups'
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  $backup = Join-Path $backupDir 'Herdr-before-profile-fix.lnk'
  if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $shortcut -Destination $backup }
  if ($link.Arguments -notmatch '(?i)\bnt\b|\bnew-tab\b') { throw 'Herdr launcher has no new-tab command' }
  $link.Arguments = [regex]::Replace($link.Arguments, '(?i)\b(nt|new-tab)\b', '$1 -p Herdr', 1)
  $link.Save()
}
Write-Output ('HERDR_LAUNCHER ' + $link.Arguments)
if ($Open) { Start-Process -FilePath $link.TargetPath -ArgumentList $link.Arguments }
