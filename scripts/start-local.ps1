$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-processes.ps1')

function Test-LocalPort([int]$Port) {
    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return @($listeners | Where-Object { $_.Port -eq $Port }).Count -gt 0
}

function Test-ApiHealth([int]$Port) {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 3
        return $response.status -eq 'ok' -and $response.database -eq 'postgresql' -and $response.service -eq 'Calidad 360'
    } catch { return $false }
}

function Wait-LocalService($Entry, [string]$Name, [int]$Port) {
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        if ($null -eq (Get-OwnedProcess $Entry)) {
            throw "$Name termino antes de estar disponible. Revisa $LogDirectory\$Name.err.log."
        }
        if (Test-ApiHealth $Port) { return }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "$Name no respondio correctamente en http://127.0.0.1:$Port. Revisa $LogDirectory."
}

$localLock = $null
$resultCode = 0
try {
    $localLock = Open-LocalLock
    $state = Read-LocalState
    $viteEntry = Join-Path $ProjectRoot 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $PythonExecutable)) {
        throw 'Falta el entorno Python backend\.venv. Completa primero la instalacion de dependencias.'
    }
    if (-not (Test-Path -LiteralPath $viteEntry)) {
        throw 'Faltan dependencias de la interfaz. Ejecuta npm.cmd ci en la carpeta del proyecto.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.env'))) {
        throw 'Falta .env. Completa primero la configuracion local de PostgreSQL.'
    }
    $nodeExecutable = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
    foreach ($name in @('backend', 'frontend')) {
        if ($null -eq (Get-OwnedProcess $state.$name)) { $state.$name = $null }
    }
    Write-LocalState $state

    if ($null -eq $state.backend -and (Test-LocalPort 8000)) {
        $description = if (Test-ApiHealth 8000) { 'una API Calidad 360' } else { 'otro servicio' }
        throw "El puerto 8000 esta ocupado por $description que este iniciador no administra. Detenlo en su terminal y vuelve a ejecutar INICIAR_LOCAL.cmd."
    }
    if ($null -eq $state.frontend -and (Test-LocalPort 3000)) {
        $description = if (Test-ApiHealth 3000) { 'una interfaz conectada a Calidad 360' } else { 'una interfaz u otro servicio' }
        throw "El puerto 3000 esta ocupado por $description. Si dejaste Vite o npm run dev abiertos, pulsa Ctrl+C en esa terminal y vuelve a ejecutar INICIAR_LOCAL.cmd."
    }

    Write-Host 'Iniciando PostgreSQL local...'
    Invoke-LocalDatabase 'start'

    if ($null -eq $state.backend) {
        Write-Host 'Actualizando la estructura de la base de datos...'
        Push-Location -LiteralPath (Join-Path $ProjectRoot 'backend')
        try {
            & $PythonExecutable -m alembic upgrade head
            if ($LASTEXITCODE -ne 0) { throw 'No se pudieron aplicar las migraciones de PostgreSQL.' }
        } finally { Pop-Location }
        Write-Host 'Iniciando la API...'
        $state.backend = Start-OwnedProcess 'backend' $PythonExecutable `
            @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') `
            (Join-Path $ProjectRoot 'backend')
        Write-LocalState $state
    }
    Wait-LocalService $state.backend 'backend' 8000

    if ($null -eq $state.frontend) {
        Write-Host 'Iniciando la interfaz...'
        $state.frontend = Start-OwnedProcess 'frontend' $nodeExecutable `
            @(('"{0}"' -f $viteEntry), '--host', '127.0.0.1', '--port', '3000', '--strictPort') `
            $ProjectRoot
        Write-LocalState $state
    }
    Wait-LocalService $state.frontend 'frontend' 3000
    Write-Host ''
    Write-Host 'Calidad 360 esta listo y conectado a PostgreSQL.' -ForegroundColor Green
    Write-Host 'Aplicacion: http://127.0.0.1:3000'
    Write-Host 'API:        http://127.0.0.1:8000/docs'
    Write-Host "Registros:  $LogDirectory"
    Write-Host 'Para detener todo, ejecuta DETENER_LOCAL.cmd.'
} catch {
    $resultCode = 1
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Puedes revisar .local\logs o ejecutar DETENER_LOCAL.cmd para detener los servicios administrados.'
} finally {
    if ($null -ne $localLock) { $localLock.Dispose() }
}
exit $resultCode
