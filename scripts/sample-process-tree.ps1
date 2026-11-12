param([int]$RootProcessId, [int]$Seconds = 20, [string]$OutFile)
$ErrorActionPreference = 'Stop'
$previous = @{}
$samples = [System.Collections.Generic.List[object]]::new()
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$last = 0.0
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
    $now = $timer.Elapsed.TotalSeconds
    if ($last -gt 0) {
        $samples.Add([pscustomobject]@{
            seconds = $now - $last; cpuSeconds = $cpuDelta
            cpuMachinePercent = 100 * $cpuDelta / ($now - $last) / [Environment]::ProcessorCount
            cpuOneCorePercent = 100 * $cpuDelta / ($now - $last)
            workingBytes = $working; privateBytes = $private; processes = $count; names = @($names)
        })
    }
    $last = $now
    Start-Sleep -Milliseconds 1000
}
$samples | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $OutFile -Encoding utf8
