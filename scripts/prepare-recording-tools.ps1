$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$resourceDir = Join-Path $projectRoot 'src-tauri\resources\bin'
function Confirm-RecordingTool([string]$toolPath) {
    $versionOutput = & $toolPath -version 2>&1
    $versionCode = $LASTEXITCODE
    if ($versionCode -ne 0) { throw "$toolPath cannot start ($versionCode)" }
    $versionOutput | Select-Object -First 1
}
if ((Test-Path -LiteralPath (Join-Path $resourceDir 'ffmpeg.exe')) -and (Test-Path -LiteralPath (Join-Path $resourceDir 'ffprobe.exe'))) {
    Confirm-RecordingTool (Join-Path $resourceDir 'ffmpeg.exe')
    Confirm-RecordingTool (Join-Path $resourceDir 'ffprobe.exe')
    exit 0
}
$toolTemp = Join-Path ([IO.Path]::GetTempPath()) ('woodscorp_obs\ffmpeg-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $toolTemp -Force | Out-Null
$archive = Join-Path $toolTemp 'ffmpeg-release-essentials.zip'
$expected = '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba'
Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $archive -TimeoutSec 180
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    throw 'Archive checksum differs from verified FFmpeg 9.0.2. Review upstream version and provenance before updating the pinned checksum.'
}
$expanded = Join-Path $toolTemp 'expanded'
Expand-Archive -LiteralPath $archive -DestinationPath $expanded
New-Item -ItemType Directory -Path $resourceDir -Force | Out-Null
foreach ($program in @('ffmpeg.exe', 'ffprobe.exe')) {
    $programFilesFound = @(Get-ChildItem -LiteralPath $expanded -Recurse -File -Filter $program)
    if ($programFilesFound.Count -ne 1) { throw "Expected one $program in verified archive" }
    Copy-Item -LiteralPath $programFilesFound[0].FullName -Destination (Join-Path $resourceDir $program)
    Confirm-RecordingTool (Join-Path $resourceDir $program)
}
Write-Output 'Recording tools verified and prepared; files remain outside Git.'
