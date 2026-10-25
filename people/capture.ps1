param(
    [string]$Mitmdump = 'mitmdump.exe',
    [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$captureDir = Join-Path $PSScriptRoot 'captures'
$configDir = Join-Path $PSScriptRoot '.mitmproxy'
New-Item -ItemType Directory -Force -Path $captureDir, $configDir | Out-Null
$dump = Join-Path $captureDir ('plusportal-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.mitm')
Write-Host "Proxy: 127.0.0.1:$Port"
Write-Host "Dump: $dump"
Write-Host 'Stop recording with Ctrl+C.'
& $Mitmdump --listen-host 127.0.0.1 --listen-port $Port --set "confdir=$configDir" --set anticache=true --set store_streamed_bodies=true -w $dump
if ($LASTEXITCODE -ne 0) { throw "mitmdump exited with code $LASTEXITCODE" }
