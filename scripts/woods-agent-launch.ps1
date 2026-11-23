# Woods Island hook launcher. Paths are supplied as PowerShell string literals
# in an encoded command. Forward UTF-8 bytes without invoking another shell.
$ErrorActionPreference = 'Stop'
try {
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [Console]::InputEncoding = $utf8
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $woodsNode
    $start.Arguments = $woodsArguments
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = $utf8
    $start.StandardErrorEncoding = $utf8
    $child = [System.Diagnostics.Process]::new()
    $child.StartInfo = $start
    if (-not $child.Start()) { exit 1 }
    $output = $child.StandardOutput.ReadToEndAsync()
    $errorOutput = $child.StandardError.ReadToEndAsync()
    $payload = $utf8.GetBytes([Console]::In.ReadToEnd())
    $child.StandardInput.BaseStream.Write($payload, 0, $payload.Length)
    $child.StandardInput.Close()
    $child.WaitForExit()
    $result = $utf8.GetBytes($output.Result)
    [Console]::OpenStandardOutput().Write($result, 0, $result.Length)
    exit $child.ExitCode
} catch { exit 1 }
