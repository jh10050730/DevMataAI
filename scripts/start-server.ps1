$ErrorActionPreference = 'Stop'
$nodeExe = (Get-Command node.exe).Source
$serverScript = Join-Path $PSScriptRoot 'serve.mjs'
Start-Process -FilePath $nodeExe -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory (Split-Path -Parent $PSScriptRoot) -WindowStyle Hidden
Write-Output 'DevMata AI server launched. Run npm run server:status to verify.'
