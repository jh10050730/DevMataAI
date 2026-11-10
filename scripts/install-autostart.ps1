param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'DevMata AI.lnk'
$launcher = Join-Path $PSScriptRoot 'launch-hidden.vbs'
$wscript = Join-Path $env:WINDIR 'System32\wscript.exe'
$nodeExe = (Get-Command node.exe).Source
$shell = New-Object -ComObject WScript.Shell
if (Test-Path -LiteralPath $shortcutPath) {
    $existing = $shell.CreateShortcut($shortcutPath)
    if ($existing.TargetPath -ne $wscript -or -not $existing.Arguments.Contains($launcher)) { throw 'A different DevMata AI shortcut already exists.' }
}
$runtime = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
if ($Remove) {
    if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }
    Remove-Item -LiteralPath (Join-Path $runtime 'autostart.json') -ErrorAction SilentlyContinue
    Write-Output 'DevMata AI login startup removed.'
} else {
    if (-not (Test-Path (Join-Path $projectRoot 'apps\api\dist\main.js')) -or -not (Test-Path (Join-Path $projectRoot 'apps\web\dist\index.html'))) { throw 'Run npm run build before installing startup.' }
    $link = $shell.CreateShortcut($shortcutPath)
    $link.TargetPath = $wscript
    $link.Arguments = '//B //Nologo "' + $launcher + '" "' + $nodeExe + '"'
    $link.WorkingDirectory = $projectRoot
    $link.Description = 'DevMata AI local server at Windows login'
    $link.Save()
    @{ shortcut = $shortcutPath; installedAt = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtime 'autostart.json') -Encoding UTF8
    Write-Output ('Startup installed: ' + $shortcutPath)
}
