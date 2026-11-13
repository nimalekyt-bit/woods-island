# Installer acceptance on disposable GitHub-hosted Windows runners.
# No local install/uninstall, no Windows feature changes, no runtime deletion on the owner's PC.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$InstallerPath,
  [Parameter(Mandatory=$true)][string]$ExpectedExePath,
  [ValidateSet('ExistingRuntime','MissingRuntime')][string]$Scenario='ExistingRuntime',
  [string]$PreviousInstallerPath,
  [string]$PreviousExePath,
  [string]$PreviousVersion,
  [string]$PublishedPortablePath,
  [Parameter(Mandatory=$true)][string]$InstallerManifestPath,
  [string]$WebView2LoaderPath,
  [string]$ApplicationRelativePath='woods-island.exe',
  [string[]]$ToolRelativePaths=@('bin\ffmpeg.exe','bin\ffprobe.exe')
)
$ErrorActionPreference='Stop'
trap {
  if ($env:GITHUB_ACTIONS -eq 'true') {
    $diagnosticMessage=$_.Exception.Message.Replace('%','%25').Replace("`r",'%0D').Replace("`n",'%0A')
    Write-Output ('::error title=Installer acceptance::'+$diagnosticMessage)
  }
  throw
}

function Assert-HostedWindowsRunner {
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows' -or [string]::IsNullOrWhiteSpace($env:RUNNER_TEMP) -or [string]::IsNullOrWhiteSpace($env:RUNNER_TRACKING_ID) -or $env:GITHUB_REPOSITORY -ne 'nimalekyt-bit/woods-island') {
    throw 'Disposable GitHub Windows runner only; local installation and runtime removal are forbidden.'
  }
  if ($PSVersionTable.PSEdition -ne 'Core') { throw 'Use pwsh on the hosted Windows runner.' }
  if (-not [Environment]::Is64BitProcess) { throw 'Use x64 pwsh for the x64 installer and WebView2 SDK probe.' }
}
# This guard runs before resolving payload paths, creating files, loading DLLs or executing anything.
Assert-HostedWindowsRunner

function Assert-True([bool]$Condition,[string]$Message) { if (-not $Condition) { throw $Message } }
function File-Proof([string]$Path) {
  $item=Get-Item -LiteralPath $Path
  [pscustomobject]@{Path=$item.FullName;Bytes=$item.Length;SHA256=(Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName).Hash.ToLowerInvariant()}
}
function Invoke-CheckedProcess([string]$File,[string[]]$Arguments,[string]$Label,[int]$TimeoutSeconds=600,[int[]]$AllowedExitCodes=@(0)) {
  $process=Start-Process -FilePath $File -ArgumentList $Arguments -PassThru -WindowStyle Hidden
  if (-not $process.WaitForExit($TimeoutSeconds*1000)) { $process.Kill(); throw "$Label timed out" }
  $process.Refresh()
  Assert-True ($process.ExitCode -in $AllowedExitCodes) "$Label returned $($process.ExitCode)"
  [pscustomobject]@{Label=$Label;ExitCode=$process.ExitCode}
}
function Woods-Registrations {
  @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match '^Woods Island(?:\s|$)' } |
    Select-Object PSPath,DisplayName,DisplayVersion,InstallLocation,UninstallString)
}
function Shortcut-Paths {
  $folders=@([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'),[Environment]::GetFolderPath('DesktopDirectory'),[Environment]::GetFolderPath('CommonDesktopDirectory'))
  @($folders | Where-Object { $_ } | ForEach-Object {
    Get-ChildItem -LiteralPath $_ -Filter '*Woods*Island*.lnk' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
  })
}
function Profile-Proofs {
  @('settings.json','woods_island.db','installer-qa-sentinel.json') | ForEach-Object {
    $file=Join-Path $taskDataDir $_
    Assert-True (Test-Path -LiteralPath $file -PathType Leaf) "Profile fixture missing: $_"
    File-Proof $file
  }
}
function Assert-ProfileUnchanged($Before,[string]$Label) {
  foreach ($file in $Before) {
    Assert-True (Test-Path -LiteralPath $file.Path -PathType Leaf) "$Label removed profile file $($file.Path)"
    Assert-True ((File-Proof $file.Path).SHA256 -eq $file.SHA256) "$Label changed profile file $($file.Path)"
  }
  Assert-True ((File-Proof $taskDefaultProfileSentinel).SHA256 -eq $taskDefaultProfileSentinelSha) "$Label changed the default hosted-user profile sentinel"
}
function Assert-InstalledManifest {
  if (-not $taskManifest) { return }
  foreach ($entry in $taskManifest.files) {
    $file=Join-Path $taskInstallDir $entry.name
    Assert-True ([IO.Path]::GetFullPath($file).StartsWith($taskInstallDir+'\',[StringComparison]::OrdinalIgnoreCase)) 'Manifest entry escaped installed directory'
    $proof=File-Proof $file
    Assert-True ($proof.Bytes -eq $entry.bytes -and $proof.SHA256 -eq $entry.sha256) "Installed payload mismatch: $($entry.name)"
  }
}

$taskRepoRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskRunnerRoot=[IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\')
$taskRoot=Join-Path $taskRunnerRoot ('woods-installer-qa-'+[guid]::NewGuid().ToString('N'))
Assert-True ([IO.Path]::GetFullPath($taskRoot).StartsWith($taskRunnerRoot+'\',[StringComparison]::OrdinalIgnoreCase)) 'QA root escaped RUNNER_TEMP'
$taskInstallDir=Join-Path $taskRoot 'InstalledApp'
$taskAppData=Join-Path $taskRoot 'profile\AppData\Roaming'
$taskDataDir=Join-Path $taskAppData 'woods-island'
$taskInstalledExe=Join-Path $taskInstallDir $ApplicationRelativePath
$taskRunKey='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$taskRunValueName='WoodsIsland'
Assert-True ([IO.Path]::GetFullPath($taskInstalledExe).StartsWith($taskInstallDir+'\',[StringComparison]::OrdinalIgnoreCase)) 'ApplicationRelativePath escaped installation directory'
Assert-True ((Woods-Registrations).Count -eq 0) 'Runner already has Woods Island; refusing to overwrite an existing installation'
Assert-True ((Shortcut-Paths).Count -eq 0) 'Runner has Woods Island shortcuts before the test'
Assert-True ([string]::IsNullOrEmpty((Get-ItemProperty -LiteralPath $taskRunKey -Name $taskRunValueName -ErrorAction SilentlyContinue).$taskRunValueName)) 'Runner already has a WoodsIsland Run value'
Assert-True ([string]::IsNullOrWhiteSpace($env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER)) 'Runner has a WebView2 browser-folder override; missing-runtime detection would be misleading'
$taskInstaller=File-Proof (Resolve-Path -LiteralPath $InstallerPath).Path
$taskExpectedExe=File-Proof (Resolve-Path -LiteralPath $ExpectedExePath).Path
$taskVersion=(Get-Content -LiteralPath (Join-Path $taskRepoRoot 'package.json') -Raw | ConvertFrom-Json).version
$taskManifest=if ($InstallerManifestPath) { Get-Content -LiteralPath $InstallerManifestPath -Raw | ConvertFrom-Json } else { $null }
if ($taskManifest) {
  Assert-True ($taskManifest.version -eq $taskVersion -and $taskManifest.installer.sha256 -eq $taskInstaller.SHA256) 'Installer manifest/version mismatch'
}
if ($PreviousInstallerPath -or $PreviousExePath -or $PreviousVersion) {
  Assert-True ([bool]($PreviousInstallerPath -and $PreviousExePath -and $PreviousVersion)) 'Version upgrade requires previous installer, its application EXE and its version'
  Assert-True ($PreviousVersion -ne $taskVersion) 'Same-version reinstall is maintenance, not a version upgrade'
}
New-Item -ItemType Directory -Path $taskRoot,$taskDataDir -Force | Out-Null
# The guest has no owner data. Seed its real default roaming folder too, so
# the custom NSIS default-profile cleanup branch is exercised by silent uninstall.
$taskDefaultProfile=Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'woods-island'
Assert-True (-not (Test-Path -LiteralPath $taskDefaultProfile)) 'Hosted runner already has a default Woods Island profile'
New-Item -ItemType Directory -Path $taskDefaultProfile -Force | Out-Null
$taskDefaultProfileSentinel=Join-Path $taskDefaultProfile 'installer-qa-default-profile.json'
[IO.File]::WriteAllText($taskDefaultProfileSentinel,'{"fixture":"retain-default-profile-on-silent-uninstall"}',[Text.UTF8Encoding]::new($false))
$taskDefaultProfileSentinelSha=(File-Proof $taskDefaultProfileSentinel).SHA256
$taskPortableMigrationSettings='{"autostart":false,"opacityRest":93,"clockSeconds":true,"weatherCity":"QA City"}'
$taskResults=[Collections.Generic.List[object]]::new()
$taskReport=[ordered]@{Scenario=$Scenario;Environment='Disposable GitHub-hosted Windows runner, not clean Windows';RunId=$env:GITHUB_RUN_ID;Commit=$env:GITHUB_SHA;Root=$taskRoot;Version=$taskVersion;Installer=$taskInstaller;ExpectedExe=$taskExpectedExe;Results=$taskResults;Errors=@();VersionUpgrade='not-tested-no-previous-installer'}
$taskReport.PortableMigration='not-tested'; $taskReport.DeleteAppDataGuiOptIn='not-tested-silent-mode-does-not-control-checkbox'
$taskReport.RendererMode='Default application renderer on disposable hosted guest'
$taskReportPath=Join-Path $taskRoot 'installer-acceptance.json'
Write-Output "INSTALLER_QA_ROOT $taskRoot"

function Initialize-WebViewProbe {
  if (-not $script:WebView2LoaderPath) {
    $cargoRoot=if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
    $loaders=@(Get-ChildItem -Path (Join-Path $cargoRoot 'registry\src\*\webview2-com-sys-*\x64\WebView2Loader.dll') -File -ErrorAction SilentlyContinue)
    Assert-True ($loaders.Count -eq 1) 'Provide an explicit x64 WebView2LoaderPath when Cargo has zero or multiple SDK versions'
    $script:WebView2LoaderPath=$loaders[0].FullName
  }
  $loader=(Resolve-Path -LiteralPath $script:WebView2LoaderPath).Path
  $taskReport.WebView2Loader=File-Proof $loader
  $escaped=$loader.Replace('"','""')
  $code=@"
using System; using System.Runtime.InteropServices;
public static class WoodsInstallerQaWebViewProbe {
  [DllImport(@"$escaped", CallingConvention=CallingConvention.StdCall, CharSet=CharSet.Unicode)]
  private static extern int GetAvailableCoreWebView2BrowserVersionString(string folder, out IntPtr version);
  public static string Version() {
    IntPtr version; int hr=GetAvailableCoreWebView2BrowserVersionString(null,out version);
    if(version==IntPtr.Zero) {
      if(hr==0 || hr==unchecked((int)0x80070002) || hr==unchecked((int)0x80070490)) return null;
      Marshal.ThrowExceptionForHR(hr); return null;
    }
    try { if(hr<0) Marshal.ThrowExceptionForHR(hr); return Marshal.PtrToStringUni(version); }
    finally { Marshal.FreeCoTaskMem(version); }
  }
}
"@
  Add-Type -TypeDefinition $code
}
function WebView-Version { [WoodsInstallerQaWebViewProbe]::Version() }
function Remove-RunnerWebViewRuntime {
  Assert-HostedWindowsRunner
  $runtimeRoots=@(
    [pscustomobject]@{Path=(Join-Path ${env:ProgramFiles(x86)} 'Microsoft\EdgeWebView\Application');System=$true},
    [pscustomobject]@{Path=(Join-Path $env:ProgramFiles 'Microsoft\EdgeWebView\Application');System=$true},
    [pscustomobject]@{Path=(Join-Path $env:LOCALAPPDATA 'Microsoft\EdgeWebView\Application');System=$false}
  )
  foreach ($runtimeRoot in $runtimeRoots) {
    if (-not (Test-Path -LiteralPath $runtimeRoot.Path)) { continue }
    $setups=@(Get-ChildItem -LiteralPath $runtimeRoot.Path -Directory | ForEach-Object { Join-Path $_.FullName 'Installer\setup.exe' } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
    foreach ($setup in $setups) {
      if (-not (Test-Path -LiteralPath $setup)) { continue }
      $arguments=@('--uninstall','--msedgewebview','--force-uninstall','--verbose-logging')
      if ($runtimeRoot.System) { $arguments+='--system-level' }
      # Chromium installer status 19 means UNINSTALL_SUCCESSFUL. Keep this
      # exception scoped to Microsoft's runtime remover; our Setup must return 0.
      # The WebView2 API absence assertion below still validates the precondition.
      $taskResults.Add((Invoke-CheckedProcess $setup $arguments 'Official WebView2 uninstall on disposable runner' 600 @(0,19)))
    }
  }
  $deadline=[DateTime]::UtcNow.AddSeconds(45)
  while ((WebView-Version) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
  Assert-True ([string]::IsNullOrWhiteSpace((WebView-Version))) 'Missing-runtime precondition failed: WebView2 API still finds a usable runtime/browser'
  $taskResults.Add([pscustomobject]@{Label='Missing WebView2 API precondition';Passed=$true})
}

function Install-Payload([string]$Setup,[string]$Version,[string]$ExpectedSha,[string]$Label) {
  $taskResults.Add((Invoke-CheckedProcess $Setup @('/S',('/D='+$taskInstallDir)) $Label))
  Assert-True (Test-Path -LiteralPath $taskInstalledExe -PathType Leaf) 'Installed executable missing'
  Assert-True ((File-Proof $taskInstalledExe).SHA256 -eq $ExpectedSha) 'Installed EXE differs from the corresponding packaged build'
  $registrations=@(Woods-Registrations)
  Assert-True ($registrations.Count -eq 1) 'Expected exactly one Woods Island uninstall registration'
  Assert-True ($registrations[0].DisplayVersion -eq $Version) 'Uninstall registration version mismatch'
  if ($registrations[0].InstallLocation) {
    # Tauri NSIS writes this registry value as a quoted path.
    $registeredLocation=[IO.Path]::GetFullPath($registrations[0].InstallLocation.Trim('"')).TrimEnd('\')
    Assert-True ($registeredLocation -eq $taskInstallDir) "InstallLocation ignores /D isolation: $registeredLocation != $taskInstallDir"
  }
  Assert-True ($registrations[0].UninstallString -like ('*'+$taskInstallDir+'*')) 'Uninstaller registration points outside the test install directory'
  $taskReport.Registration=$registrations[0]
  $taskReport.Shortcuts=@(Shortcut-Paths)
  Assert-True ($taskReport.Shortcuts.Count -ge 1) 'Installer created no Woods Island shortcut'
  Assert-True (-not [string]::IsNullOrWhiteSpace((WebView-Version))) 'Installer did not provide a usable WebView2 runtime'
  if ($Version -eq $taskVersion) { Assert-InstalledManifest }
}

function Installed-Smoke([bool]$Legacy=$false,[string]$Executable=$taskInstalledExe) {
  $transportScript=Join-Path $taskRoot 'live-cdp-diagnostic.ps1'
  $transportSource=@'
param([int]$MainPid,[int]$Port)
$processes=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('woods-island.exe','msedgewebview2.exe') } | ForEach-Object {
  $command=$_.CommandLine
  $debugPort=if ($command -match '--remote-debugging-port[= ](\d+)') { $matches[1] } else { '' }
  $kind=if ($command -match '--type=([^\s]+)') { $matches[1] } else { 'browser' }
  @{pid=$_.ProcessId;parent=$_.ParentProcessId;name=$_.Name;kind=$kind;debugPort=$debugPort;commandReadable=[bool]$command;userDataOverride=$command -match '--user-data-dir='}
})
$listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @($Port,($Port+1)) } | Select-Object LocalAddress,LocalPort,OwningProcess)
$window=Get-Process -Id $MainPid -ErrorAction SilentlyContinue | Select-Object Id,SessionId,MainWindowHandle,Responding
$policy=@(foreach ($key in @('HKLM:\SOFTWARE\Policies\Microsoft\Edge','HKCU:\SOFTWARE\Policies\Microsoft\Edge')) {
  $value=Get-ItemProperty -LiteralPath $key -Name RemoteDebuggingAllowed -ErrorAction SilentlyContinue
  if ($value) { @{scope=$key;allowed=$value.RemoteDebuggingAllowed} }
})
@{mainPid=$MainPid;port=$Port;window=$window;processes=$processes;listeners=$listeners;debugPolicy=$policy}|ConvertTo-Json -Depth 5 -Compress
'@
  [IO.File]::WriteAllText($transportScript,$transportSource,[Text.UTF8Encoding]::new($false))
  # Keep the accepted harness and its assertions intact. Generate an ignored adapter
  # that runs the INSTALLED binary directly and shares only the isolated QA data.
  $origin=Join-Path $taskRepoRoot 'scripts\verify-runtime.cjs'
  $source=[IO.File]::ReadAllText($origin)
  $replacements=@(
    @('const root = path\.resolve\(__dirname, ''\.\.''\);','const root = path.resolve(__dirname, ".."); assert(process.env.GITHUB_ACTIONS==="true"&&process.env.RUNNER_ENVIRONMENT==="github-hosted"&&process.env.RUNNER_OS==="Windows"&&process.env.GITHUB_REPOSITORY==="nimalekyt-bit/woods-island"&&process.env.RUNNER_TRACKING_ID&&process.env.RUNNER_TEMP,"Disposable GitHub Windows runner only");'),
    @('(?m)^  const exe = path\.join\(directory, ''woods-island\.exe''\);\r?\n  await fs\.copyFile\(suppliedExe, exe\);','  const exe = path.resolve(suppliedExe);'),
    @('(?m)^  const dataDir = path\.join\(directory, ''data''\);\r?\n  await fs\.mkdir\(dataDir\);','  const dataDir = process.env.WOODS_INSTALLER_QA_DATA; assert(dataDir); await fs.mkdir(dataDir,{recursive:true});'),
    @('APPDATA: path\.join\(directory, ''appdata''\)','APPDATA: process.env.WOODS_INSTALLER_QA_APPDATA'),
    @(', WEBVIEW2_USER_DATA_FOLDER:path\.join\(directory,''webview''\), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=\$\{port\}`',''),
    @('const tempRoot = path\.join\(root, ''src-tauri'', ''target'', ''qa-temp'', ''woodscorp_obs''\);','const tempRoot = path.join(process.env.WOODS_INSTALLER_QA_ROOT, "native");'),
    @('const persisted = new Map\(\);','const persisted = new Map(); const expectedInstallSettings=JSON.parse(process.env.WOODS_INSTALLER_QA_EXPECT_SETTINGS||"{}"); const actualInstallSettings=await main.invoke("settings_get"); for(const [key,value] of Object.entries(expectedInstallSettings))assert.deepEqual(actualInstallSettings[key],value,"Preserved installer setting: "+key);'),
    @('(?m)^  throw new Error\(`WebView2 page did not initialize: \$\{last\}`\);\r?$','  const transport=spawnSync("powershell.exe",["-NoProfile","-NonInteractive","-File",process.env.WOODS_INSTALLER_QA_TRANSPORT_SCRIPT,"-MainPid",String(proc.pid),"-Port",String(port)],{encoding:"utf8",windowsHide:true}); console.error("HOSTED_LIVE_CDP "+transport.stdout.trim()); throw new Error(`WebView2 page did not initialize: ${last}`);')
  )
  foreach ($replacement in $replacements) {
    Assert-True ([regex]::Matches($source,$replacement[0]).Count -eq 1) 'Accepted harness layout changed; inspect adapter instead of silently copying/running another binary'
    $source=[regex]::Replace($source,$replacement[0],$replacement[1])
  }
  $adapter=Join-Path $taskRepoRoot '.qa-temp\verify-installed-runtime.cjs'
  [IO.File]::WriteAllText($adapter,$source,[Text.UTF8Encoding]::new($false))
  & node --check $adapter
  Assert-True ($LASTEXITCODE -eq 0) 'Installed-location harness adapter has a syntax error'
  $keys=@('WOODS_TEST_FILTER','WOODS_TEST_EXPECT_CODEX','WOODS_TEST_EXPECT_AUDIO','WOODS_INSTALLER_QA_ROOT','WOODS_INSTALLER_QA_DATA','WOODS_INSTALLER_QA_APPDATA','WOODS_INSTALLER_QA_EXPECT_SETTINGS','WOODS_INSTALLER_QA_TRANSPORT_SCRIPT','WEBVIEW2_USER_DATA_FOLDER','WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS','TEMP','TMP')
  $saved=@{}; foreach ($key in $keys) { $saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process') }
  $policySnapshots=[Collections.Generic.List[object]]::new()
  try {
    $env:WOODS_INSTALLER_QA_ROOT=$taskRoot; $env:WOODS_INSTALLER_QA_DATA=$taskDataDir; $env:WOODS_INSTALLER_QA_APPDATA=$taskAppData
    $env:WOODS_INSTALLER_QA_EXPECT_SETTINGS=$taskPortableMigrationSettings
    $env:WOODS_INSTALLER_QA_TRANSPORT_SCRIPT=$transportScript
    $env:TEMP=$taskRoot; $env:TMP=$taskRoot
    $env:WOODS_TEST_EXPECT_CODEX=$null; $env:WOODS_TEST_EXPECT_AUDIO=$null
    # The loader examines environment overrides before registry overrides.
    # Use only the supported HKLM route for this elevated guest process.
    $env:WEBVIEW2_USER_DATA_FOLDER=$null; $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$null
    $env:WOODS_TEST_FILTER=if ($Legacy) { '^Main UI mounts$' } else { '^(Main UI mounts|Settings and image editor renderers are absent until requested|Settings UI renders after repeated harmless toggles)$' }
    # Hosted Windows runs elevated. WebView2 ignores WEBVIEW2_* environment
    # overrides for elevated hosts, but honors exact-app HKLM policies.
    # https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/security#for-an-elevated-host-app-use-appropriate-override-flags
    Assert-HostedWindowsRunner
    $qaPort=if ($env:WOODS_TEST_CDP_PORT) { [int]$env:WOODS_TEST_CDP_PORT } else { 9334 }
    Assert-True ($qaPort -ge 1024 -and $qaPort -lt 65535 -and $qaPort -ne 3003 -and ($qaPort+1) -ne 3003) 'Invalid isolated QA debugging port'
    $policyRoot='HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2'
    $policyValues=@{
      AdditionalBrowserArguments="--remote-debugging-port=$qaPort"
      UserDataFolder=(Join-Path $taskRoot ('policy-webview-'+[guid]::NewGuid().ToString('N')))
    }
    foreach ($kind in $policyValues.Keys) {
      $policyKey=Join-Path $policyRoot $kind
      foreach ($appId in @('woods-island.exe','woods-island','Woods Island','com.woods.island',$Executable)) {
        $existingKey=Get-Item -LiteralPath $policyKey -ErrorAction SilentlyContinue
        $existed=$existingKey -and $appId -in $existingKey.GetValueNames()
        $policySnapshots.Add([pscustomobject]@{Key=$policyKey;Name=$appId;Existed=[bool]$existed;Value=if ($existed) { $existingKey.GetValue($appId,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) } else { $null };Kind=if ($existed) { $existingKey.GetValueKind($appId).ToString() } else { 'String' }})
        # New-Item -Force on an existing registry key clears all its values.
        if (-not $existingKey) { New-Item -Path $policyKey -Force | Out-Null }
        New-ItemProperty -LiteralPath $policyKey -Name $appId -Value $policyValues[$kind] -PropertyType String -Force | Out-Null
      }
      $writtenKey=Get-Item -LiteralPath $policyKey
      foreach ($appId in @('woods-island.exe','woods-island','Woods Island','com.woods.island',$Executable)) {
        Assert-True ($writtenKey.GetValue($appId) -eq $policyValues[$kind]) 'Exact-app WebView2 policies were not retained before launch'
      }
    }
    $output=@(& node $adapter $Executable 2>&1); $nativeExit=$LASTEXITCODE
    $log=Join-Path $taskRoot ('installed-smoke-'+[guid]::NewGuid().ToString('N')+'.log')
    $output | ForEach-Object { $_.ToString() } | Set-Content -LiteralPath $log -Encoding utf8
    if ($nativeExit -ne 0) {
      $detail=($output | ForEach-Object { $_.ToString() } | Select-Object -Last 14) -join "`n"
      $detail=$detail.Replace('%','%25').Replace("`r",'%0D').Replace("`n",'%0A')
      Write-Output ('::error title=Installed native smoke output::'+$detail)
      $processSummary=@(Get-Process woods-island,msedgewebview2 -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,SessionId,MainWindowHandle)
      $environmentDetail=(@{userInteractive=[Environment]::UserInteractive;rendererMode=$taskReport.RendererMode;processes=$processSummary}|ConvertTo-Json -Depth 4 -Compress).Replace('%','%25')
      Write-Output ('::error title=Hosted native environment::'+$environmentDetail)
      $browserProcesses=@(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | ForEach-Object {
        $debugPort=if ($_.CommandLine -match '--remote-debugging-port[= ](\d+)') { $matches[1] } else { '' }
        $kind=if ($_.CommandLine -match '--type=([^\s]+)') { $matches[1] } else { 'browser' }
        @{pid=$_.ProcessId;parent=$_.ParentProcessId;kind=$kind;debugPort=$debugPort;software=$_.CommandLine -match '--disable-gpu'}
      })
      $listeners=@(Get-NetTCPConnection -LocalPort 9334,9335 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess)
      $browserDetail=(@{processes=$browserProcesses;listeners=$listeners}|ConvertTo-Json -Depth 4 -Compress).Replace('%','%25')
      Write-Output ('::error title=Hosted WebView2 debug transport::'+$browserDetail)
    }
    Assert-True ($nativeExit -eq 0) "Installed-location native smoke failed; see $log"
    $line=@($output | ForEach-Object { $_.ToString() } | Where-Object { $_ -like 'REPORT *' })
    Assert-True ($line.Count -eq 1) 'Native smoke did not produce exactly one raw report'
    $raw=$line[0].Substring(7); $native=Get-Content -LiteralPath $raw -Raw | ConvertFrom-Json
    Assert-True ([IO.Path]::GetFullPath($native.testedExe) -eq $Executable) 'Native smoke used a copied/unrelated EXE'
    Assert-True ($native.sha256 -eq (File-Proof $Executable).SHA256) 'Native smoke fingerprint differs from the intended executable'
    Assert-True (@($native.results | Where-Object { -not $_.ok }).Count -eq 0) 'Native report contains failures'
    $taskResults.Add([pscustomobject]@{Label=if ($Legacy) { 'Published portable migration baseline' } else { 'Installed-location launch/settings/quit' };Executable=$Executable;Legacy=$Legacy;ExitCode=$nativeExit;Raw=File-Proof $raw;Log=File-Proof $log;Passed=@($native.results | Where-Object { $_.ok -and -not $_.skipped }).Count;Skipped=@($native.results | Where-Object { $_.skipped }).Count;FullNativeSuite=$false;HarnessOrigin=File-Proof $origin;Adapter=File-Proof $adapter})
  } finally {
    foreach ($entry in $policySnapshots) {
      Assert-HostedWindowsRunner
      if ($entry.Existed) { New-ItemProperty -LiteralPath $entry.Key -Name $entry.Name -Value $entry.Value -PropertyType $entry.Kind -Force | Out-Null }
      else { Remove-ItemProperty -LiteralPath $entry.Key -Name $entry.Name -ErrorAction SilentlyContinue }
    }
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key,$saved[$key],'Process') }
  }
}
function Uninstall-Application([string]$ExpectedRunValue,[bool]$ShouldRemoveRunValue,[string]$Label) {
  $before=Profile-Proofs
  New-Item -Path $taskRunKey -Force | Out-Null
  New-ItemProperty -LiteralPath $taskRunKey -Name $taskRunValueName -Value $ExpectedRunValue -PropertyType String -Force | Out-Null
  $uninstaller=Join-Path $taskInstallDir 'uninstall.exe'
  Assert-True (Test-Path -LiteralPath $uninstaller -PathType Leaf) 'NSIS uninstall.exe missing'
  $taskResults.Add((Invoke-CheckedProcess $uninstaller @('/S') $Label))
  $deadline=[DateTime]::UtcNow.AddSeconds(45)
  while ((Test-Path -LiteralPath $taskInstalledExe) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
  Assert-True (-not (Test-Path -LiteralPath $taskInstalledExe)) 'Uninstall left the application executable'
  Assert-True ((Woods-Registrations).Count -eq 0) 'Uninstall left application registration'
  Assert-True ((Shortcut-Paths).Count -eq 0) 'Uninstall left application shortcuts'
  $runValue=(Get-ItemProperty -LiteralPath $taskRunKey -Name $taskRunValueName -ErrorAction SilentlyContinue).$taskRunValueName
  if ($ShouldRemoveRunValue) { Assert-True ([string]::IsNullOrEmpty($runValue)) 'Uninstall left its installed-path Run value' }
  else { Assert-True ($runValue -eq $ExpectedRunValue) 'Uninstall removed or changed an unrelated-path Run value' }
  foreach ($relative in $ToolRelativePaths) { Assert-True (-not (Test-Path -LiteralPath (Join-Path $taskInstallDir $relative))) "Uninstall left recording tool $relative" }
  foreach ($entry in $taskManifest.files) { Assert-True (-not (Test-Path -LiteralPath (Join-Path $taskInstallDir $entry.name))) "Uninstall left manifest payload $($entry.name)" }
  Assert-ProfileUnchanged $before $Label
  $taskResults.Add([pscustomobject]@{Label='Default and override profile retained; Run cleanup scoped to installed path';Passed=$true;ShouldRemoveRunValue=$ShouldRemoveRunValue;PreservedProfile=$before})
}

try {
  Initialize-WebViewProbe
  $taskReport.WebViewBefore=WebView-Version
  if ($Scenario -eq 'MissingRuntime') { Remove-RunnerWebViewRuntime } else { Assert-True (-not [string]::IsNullOrWhiteSpace((WebView-Version))) 'ExistingRuntime precondition failed' }
  [IO.File]::WriteAllText((Join-Path $taskDataDir 'settings.json'),$taskPortableMigrationSettings,[Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText((Join-Path $taskDataDir 'installer-qa-sentinel.json'),'{"fixture":"preserve-isolated-user-profile"}',[Text.UTF8Encoding]::new($false))
  if ($PreviousInstallerPath) {
    $previousSetup=File-Proof (Resolve-Path -LiteralPath $PreviousInstallerPath).Path
    $previousExe=File-Proof (Resolve-Path -LiteralPath $PreviousExePath).Path
    Install-Payload $previousSetup.Path $PreviousVersion $previousExe.SHA256 'Install actual previous version'
    Installed-Smoke $true
    $before=Profile-Proofs
    Install-Payload $taskInstaller.Path $taskVersion $taskExpectedExe.SHA256 'Upgrade previous installer to candidate'
    Assert-ProfileUnchanged $before 'Version upgrade'
    $taskReport.VersionUpgrade='passed-actual-previous-version'
  } else {
    if ($Scenario -eq 'ExistingRuntime') {
      $legacyDir=Join-Path $taskRoot 'PublishedPortable-1.1.0'; New-Item -ItemType Directory -Path $legacyDir | Out-Null
      $legacyExe=Join-Path $legacyDir 'woods-island.exe'
      if ($PublishedPortablePath) { Copy-Item -LiteralPath (Resolve-Path -LiteralPath $PublishedPortablePath).Path -Destination $legacyExe }
      else {
        $release=Invoke-RestMethod -Uri 'https://api.github.com/repos/nimalekyt-bit/woods-island/releases/tags/v1.1.0'
        $asset=@($release.assets | Where-Object { $_.name -like '*.exe' -and $_.digest -eq 'sha256:12fd56dd985c28ad499b3e6caa6373ad24bf60e37ec005739c16d946792c7b4a' })
        Assert-True ($asset.Count -eq 1) 'Published 1.1.0 EXE/digest not found; supply the verified public asset'
        Invoke-WebRequest -Uri $asset[0].browser_download_url -OutFile $legacyExe
      }
      $legacyProof=File-Proof $legacyExe
      Assert-True ($legacyProof.SHA256 -eq '12fd56dd985c28ad499b3e6caa6373ad24bf60e37ec005739c16d946792c7b4a') 'Published portable 1.1.0 SHA mismatch'
      Installed-Smoke $true $legacyExe
      $beforePortableMigration=Profile-Proofs; $taskReport.PublishedPortable=$legacyProof
    }
    Install-Payload $taskInstaller.Path $taskVersion $taskExpectedExe.SHA256 'Install candidate'
    if ($beforePortableMigration) { Assert-ProfileUnchanged $beforePortableMigration 'Published portable to Setup migration' }
    Installed-Smoke
    if ($beforePortableMigration) { $taskReport.PortableMigration='passed-published-1.1.0-to-setup-with-real-shared-settings'; $taskReport.VersionUpgrade='not-applicable-first-installer-portable-migration-tested' }
    $before=Profile-Proofs
    Install-Payload $taskInstaller.Path $taskVersion $taskExpectedExe.SHA256 'Same-version maintenance reinstall'
    Assert-ProfileUnchanged $before 'Maintenance reinstall'
    $taskResults.Add([pscustomobject]@{Label='Installer-to-installer version upgrade';Skipped=$true;Reason='First installer release; published portable migration and same-version maintenance are recorded separately'})
  }
  Installed-Smoke
  foreach ($relative in $ToolRelativePaths) {
    $tool=Join-Path $taskInstallDir $relative
    Assert-True ([IO.Path]::GetFullPath($tool).StartsWith($taskInstallDir+'\',[StringComparison]::OrdinalIgnoreCase)) 'Tool relative path escaped installed directory'
    Assert-True (Test-Path -LiteralPath $tool -PathType Leaf) "Recording tool missing: $relative"
    $taskResults.Add((Invoke-CheckedProcess $tool @('-version') "Installed recording tool $relative" 30))
  }
  $taskReport.WebViewAfter=WebView-Version
  $unrelatedRunValue='"'+(Join-Path $taskRoot 'unrelated-portable\woods-island.exe')+'"'
  Uninstall-Application $unrelatedRunValue $false 'Uninstall while preserving unrelated Run target'
  Install-Payload $taskInstaller.Path $taskVersion $taskExpectedExe.SHA256 'Reinstall for installed-path Run cleanup'
  Installed-Smoke
  Uninstall-Application ('"'+$taskInstalledExe+'"') $true 'Uninstall and remove only installed-path Run target'
  Assert-True ((File-Proof $taskInstaller.Path).SHA256 -eq $taskInstaller.SHA256) 'Original installer changed during acceptance'
  $taskReport.DefaultProfileSentinel=File-Proof $taskDefaultProfileSentinel; $taskReport.Passed=$true
} catch {
  $taskReport.Errors=@($_.Exception.Message); $taskReport.Passed=$false
  throw
} finally {
  $taskReport | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $taskReportPath -Encoding utf8
  Write-Output "INSTALLER_REPORT $taskReportPath"
}
