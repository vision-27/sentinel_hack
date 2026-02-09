# Keep ngrok running - restarts if it crashes or exits
# Usage: .\scripts\keep-ngrok-running.ps1 [port]
# Default port: 8787 (ElevenLabs webhooks)

param(
    [int]$Port = 8787
)

$ErrorActionPreference = "Continue"
$ngrokProcess = $null

function Start-Ngrok {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Starting ngrok on port $Port..." -ForegroundColor Cyan
    Start-Process -FilePath "ngrok" -ArgumentList "http", $Port
}

function Test-NgrokRunning {
    return Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "  ngrok Keep-Alive Monitor" -ForegroundColor Green
Write-Host "  Port: $Port" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Start ngrok initially
Start-Ngrok
Start-Sleep -Seconds 3  # Give ngrok time to start

while ($true) {
    if (-not (Test-NgrokRunning)) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ngrok stopped - restarting..." -ForegroundColor Yellow
        Start-Ngrok
        Start-Sleep -Seconds 3
    }
    Start-Sleep -Seconds 10  # Check every 10 seconds
}
