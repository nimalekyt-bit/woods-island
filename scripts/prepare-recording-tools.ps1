$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$resourceDir = Join-Path $projectRoot 'src-tauri\resources\bin'
function Confirm-RecordingTool([string]$toolPath) {
    $expectedToolHash = if ((Split-Path -Leaf $toolPath) -eq 'ffmpeg.exe') {
        '3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec'
    } else { 'f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52' }
    if ((Get-FileHash -LiteralPath $toolPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedToolHash) {
        throw 'Recording tool checksum differs from the pinned distribution.'
    }
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
try {
    Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile $archive -TimeoutSec 180
} catch { Write-Output 'Upstream download unavailable; checking the pinned Woods Island distribution.' }
if (-not (Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    $archive = Join-Path $toolTemp 'verified-portable.zip'
    $expected = 'ffe1577debb1390dfb51f6b065277d0fa8d04e673951d38069d84eee8f766d61'
    Invoke-WebRequest -Uri 'https://github.com/nimalekyt-bit/woods-island/releases/download/v1.1.1/Woods-Island-1.1.1-windows-x64-portable.zip' -OutFile $archive -TimeoutSec 180
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    throw 'Archive checksum differs from verified FFmpeg 9.0.2. Review upstream version and provenance before updating the pinned checksum.'
}
$expanded = Join-Path $toolTemp 'expanded'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archive)
try {
    New-Item -ItemType Directory -Path $expanded -Force | Out-Null
    foreach ($program in @('ffmpeg.exe', 'ffprobe.exe')) {
        $entries = @($zip.Entries | Where-Object { $_.FullName -match ('(^|/)bin/' + [regex]::Escape($program) + '$') })
        if ($entries.Count -ne 1) { throw "Expected one $program in verified archive" }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entries[0], (Join-Path $expanded $program))
    }
} finally { $zip.Dispose() }
New-Item -ItemType Directory -Path $resourceDir -Force | Out-Null
foreach ($program in @('ffmpeg.exe', 'ffprobe.exe')) {
    $programFilesFound = @(Get-ChildItem -LiteralPath $expanded -Recurse -File -Filter $program)
    if ($programFilesFound.Count -ne 1) { throw "Expected one $program in verified archive" }
    Copy-Item -LiteralPath $programFilesFound[0].FullName -Destination (Join-Path $resourceDir $program)
    Confirm-RecordingTool (Join-Path $resourceDir $program)
}
Write-Output 'Recording tools verified and prepared; files remain outside Git.'
