$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-processes.ps1')

$localLock = $null
$resultCode = 0
try {
    $localLock = Open-LocalLock
    $state = Read-LocalState
    foreach ($name in @('frontend', 'backend')) {
        if ($null -ne $state.$name) {
            Stop-OwnedProcess $state.$name $name
            $state.$name = $null
            Write-LocalState $state
        }
    }
    Write-Host 'Deteniendo PostgreSQL del proyecto...'
    Invoke-LocalDatabase 'stop'
    Write-Host 'Servicios locales detenidos. Se conservaron datos, respaldos y registros.' -ForegroundColor Green
} catch {
    $resultCode = 1
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
} finally {
    if ($null -ne $localLock) { $localLock.Dispose() }
}
exit $resultCode
