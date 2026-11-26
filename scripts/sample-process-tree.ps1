param([int]$RootProcessId, [int]$Seconds = 20, [string]$OutFile)
$ErrorActionPreference = 'Stop'
$previous = @{}
$samples = [System.Collections.Generic.List[object]]::new()
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$last = 0.0
$measurementStarted = $false
$gpuCounters = @()
$gpuInitialized = $false
$gpuError = $null
$servicePrevious = @{}
$mediaServiceIds = @(Get-CimInstance Win32_Service -Filter "Name LIKE 'NPSMSvc%'" -ErrorAction SilentlyContinue | Where-Object ProcessId -gt 0 | Select-Object -ExpandProperty ProcessId -Unique)
while ($timer.Elapsed.TotalSeconds -lt $Seconds) {
    $inventory = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
    $ids = [System.Collections.Generic.HashSet[int]]::new()
    [void]$ids.Add($RootProcessId)
    do {
        $added = $false
        foreach ($entry in $inventory) {
            if ($ids.Contains([int]$entry.ParentProcessId) -and $ids.Add([int]$entry.ProcessId)) { $added = $true }
        }
    } while ($added)
    # Expand GPU instance names once per phase, after the WebView2 tree is warm.
    if (-not $gpuInitialized) {
        $gpuInitialized = $true
        try {
            $category = [System.Diagnostics.PerformanceCounterCategory]::new('GPU Engine')
            foreach ($instance in $category.GetInstanceNames()) {
                if ($instance -match '^pid_(\d+)_' -and $ids.Contains([int]$Matches[1])) {
                    $counter = [System.Diagnostics.PerformanceCounter]::new('GPU Engine','Utilization Percentage',$instance,$true)
                    [void]$counter.NextValue()
                    $gpuCounters += $counter
                }
            }
        } catch { $gpuError = $_.Exception.Message }
    }
    $gpuValue = 0.0; $gpuRead = 0
    foreach ($counter in $gpuCounters) {
        try { $value = [double]$counter.NextValue(); if ($value -ge 0 -and -not [double]::IsInfinity($value)) { $gpuValue += $value; $gpuRead++ } } catch { }
    }
    $serviceDelta = 0.0
    foreach ($serviceId in $mediaServiceIds) {
        try {
            $serviceProcess = [System.Diagnostics.Process]::GetProcessById($serviceId)
            $serviceCpu = $serviceProcess.TotalProcessorTime.TotalSeconds
            if ($servicePrevious.ContainsKey($serviceId)) { $delta = $serviceCpu - $servicePrevious[$serviceId]; if ($delta -gt 0) { $serviceDelta += $delta } }
            $servicePrevious[$serviceId] = $serviceCpu
            $serviceProcess.Dispose()
        } catch { }
    }
    $cpuDelta = 0.0; $working = 0L; $private = 0L; $count = 0
    $names = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($id in $ids) {
        try {
            $process = [System.Diagnostics.Process]::GetProcessById($id)
            $cpu = $process.TotalProcessorTime.TotalSeconds
            if ($previous.ContainsKey($id)) {
                # Avoid Math.Max's integer overload truncating fractional CPU seconds.
                $delta = $cpu - $previous[$id]
                if ($delta -gt 0) { $cpuDelta += $delta }
            }
            $previous[$id] = $cpu
            $working += $process.WorkingSet64; $private += $process.PrivateMemorySize64; $count++
            [void]$names.Add($process.ProcessName)
            $process.Dispose()
        } catch { }
    }
    if (-not $measurementStarted) {
        $timer.Restart()
        $measurementStarted = $true
        [Console]::WriteLine('WOODS_PERF_READY')
    }
    $now = $timer.Elapsed.TotalSeconds
    if ($last -gt 0) {
        $samples.Add([pscustomobject]@{
            seconds = $now - $last; cpuSeconds = $cpuDelta
            cpuMachinePercent = 100 * $cpuDelta / ($now - $last) / [Environment]::ProcessorCount
            cpuOneCorePercent = 100 * $cpuDelta / ($now - $last)
            workingBytes = $working; privateBytes = $private; processes = $count; names = @($names)
            gpuEnginePercent = $(if ($gpuRead -gt 0) { $gpuValue } else { $null })
            gpuCounters = $gpuRead; gpuProbeError = $gpuError
            sharedMediaServiceCpuSeconds = $serviceDelta; mediaServicePids = $mediaServiceIds
        })
    }
    $last = $now
    Start-Sleep -Milliseconds 1000
}
foreach ($counter in $gpuCounters) { $counter.Dispose() }
$samples | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $OutFile -Encoding utf8
