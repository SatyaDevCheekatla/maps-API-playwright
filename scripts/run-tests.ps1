Param(
    [string]$Suite = "full",
    [switch]$OpenReport
)

$nodeBin = "C:\Users\6saty\AppData\Local\OpenAI\Codex\runtimes\cua_node\1fb7137c46617d50\bin"
$shims = "C:\Users\6saty\AppData\Local\OpenAI\Codex\runtimes\cua_node\1fb7137c46617d50\bin\node_modules\corepack\shims"
$env:PATH = "$nodeBin;$shims;$env:PATH"

switch ($Suite.ToLower()) {
    "smoke" { & npm.cmd run test:smoke }
    "regression" { & npm.cmd run test:regression }
    "report" { & node "scripts\generate-emailable-report.js" }
    Default { & npm.cmd test }
}

if ($OpenReport) {
    $reportPath = Join-Path (Get-Location) "reports\emailable-report.html"
    if (Test-Path $reportPath) {
        Write-Host "Opening emailable report: $reportPath" -ForegroundColor Cyan
        Start-Process $reportPath
    }
}
