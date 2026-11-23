# Exact-app WebView2 debugging for the elevated, disposable Actions guest.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Executable)
$ErrorActionPreference='Stop'
function Assert-HostedGuest {
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows' -or $env:GITHUB_REPOSITORY -ne 'nimalekyt-bit/woods-island' -or [string]::IsNullOrWhiteSpace($env:RUNNER_TRACKING_ID) -or [string]::IsNullOrWhiteSpace($env:RUNNER_TEMP) -or $PSVersionTable.PSEdition -ne 'Core' -or -not [Environment]::Is64BitProcess) {
    throw 'Runtime hosted debugging is restricted to the disposable x64 GitHub Windows guest.'
  }
}
Assert-HostedGuest
$taskExe=(Resolve-Path -LiteralPath $Executable).Path
$taskPort=if ($env:WOODS_TEST_CDP_PORT) { $env:WOODS_TEST_CDP_PORT } else { '9334' }
$taskRoot=Join-Path $env:RUNNER_TEMP ('woods-runtime-ui-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskRoot | Out-Null
$taskPolicyRoot='HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2'
$taskPolicies=@{AdditionalBrowserArguments="--remote-debugging-port=$taskPort";UserDataFolder=(Join-Path $taskRoot 'webview')}
$taskNames=@('woods-island.exe','woods-island','Woods Island','com.woods.island',$taskExe)
$taskSnapshots=[Collections.Generic.List[object]]::new()
$taskEnvironment=@{}
foreach ($taskKey in @('WEBVIEW2_USER_DATA_FOLDER','WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS','WOODS_HOSTED_WEBVIEW_DEBUG')) {
  $taskEnvironment[$taskKey]=[Environment]::GetEnvironmentVariable($taskKey,'Process')
}
$taskExit=1
try {
  foreach ($taskKind in $taskPolicies.Keys) {
    $taskPolicyKey=Join-Path $taskPolicyRoot $taskKind
    foreach ($taskName in $taskNames) {
      $taskExisting=Get-Item -LiteralPath $taskPolicyKey -ErrorAction SilentlyContinue
      $taskExisted=$taskExisting -and $taskName -in $taskExisting.GetValueNames()
      $taskSnapshots.Add([pscustomobject]@{Key=$taskPolicyKey;Name=$taskName;Existed=[bool]$taskExisted;Value=if ($taskExisted) {$taskExisting.GetValue($taskName,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)} else {$null};Kind=if ($taskExisted) {$taskExisting.GetValueKind($taskName).ToString()} else {'String'}})
      if (-not $taskExisting) {New-Item -Path $taskPolicyKey -Force | Out-Null}
      New-ItemProperty -LiteralPath $taskPolicyKey -Name $taskName -Value $taskPolicies[$taskKind] -PropertyType String -Force | Out-Null
    }
  }
  $env:WEBVIEW2_USER_DATA_FOLDER=$null
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$null
  $env:WOODS_HOSTED_WEBVIEW_DEBUG='1'
  & node (Join-Path $PSScriptRoot 'verify-runtime.cjs') $taskExe
  $taskExit=$LASTEXITCODE
} finally {
  foreach ($taskEntry in $taskSnapshots) {
    Assert-HostedGuest
    if ($taskEntry.Existed) {New-ItemProperty -LiteralPath $taskEntry.Key -Name $taskEntry.Name -Value $taskEntry.Value -PropertyType $taskEntry.Kind -Force | Out-Null}
    else {Remove-ItemProperty -LiteralPath $taskEntry.Key -Name $taskEntry.Name -ErrorAction SilentlyContinue}
  }
  foreach ($taskKey in $taskEnvironment.Keys) {[Environment]::SetEnvironmentVariable($taskKey,$taskEnvironment[$taskKey],'Process')}
}
exit $taskExit
