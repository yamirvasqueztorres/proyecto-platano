# Shared process ownership checks for the local Windows launchers.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$LocalDirectory = Join-Path $ProjectRoot '.local'
$LogDirectory = Join-Path $LocalDirectory 'logs'
$StateFile = Join-Path $LocalDirectory 'processes.json'
$PythonExecutable = Join-Path $ProjectRoot 'backend\.venv\Scripts\python.exe'
$DatabaseScript = Join-Path $ProjectRoot 'backend\local_database.py'

function Open-LocalLock {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
    try {
        return [System.IO.File]::Open(
            (Join-Path $LocalDirectory 'start-stop.lock'),
            [System.IO.FileMode]::OpenOrCreate,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
    } catch {
        throw 'Ya hay un inicio o una parada en curso. Espera a que termine e intenta nuevamente.'
    }
}

function Read-LocalState {
    if (-not (Test-Path -LiteralPath $StateFile)) {
        return [PSCustomObject]@{ project_root = $ProjectRoot; backend = $null; frontend = $null }
    }
    $saved = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
    foreach ($field in @('project_root', 'backend', 'frontend')) {
        if ($saved.PSObject.Properties.Name -notcontains $field) {
            throw "El archivo $StateFile no tiene un formato valido. No se modificaron procesos."
        }
    }
    if (-not [String]::Equals($saved.project_root, $ProjectRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'El registro de procesos pertenece a otra carpeta. No se modificaron procesos.'
    }
    return $saved
}

function Write-LocalState($State) {
    $temporaryState = Join-Path $LocalDirectory 'processes.json.tmp'
    [System.IO.File]::WriteAllText(
        $temporaryState,
        ($State | ConvertTo-Json -Depth 4),
        [System.Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $temporaryState -Destination $StateFile -Force
}

function Get-OwnedProcess($Entry) {
    if ($null -eq $Entry) { return $null }
    try {
        $managedProcess = Get-Process -Id ([int]$Entry.process_id) -ErrorAction Stop
        $started = $managedProcess.StartTime.ToUniversalTime().Ticks.ToString()
        if ($started -ne [string]$Entry.start_time_utc_ticks) { return $null }
        if (-not [String]::Equals($managedProcess.Path, $Entry.executable_path, [StringComparison]::OrdinalIgnoreCase)) {
            return $null
        }
        return $managedProcess
    } catch {
        return $null
    }
}

function Start-OwnedProcess([string]$Name, [string]$Executable, [string[]]$Arguments, [string]$Directory) {
    $managedProcess = Start-Process -FilePath $Executable -ArgumentList $Arguments `
        -WorkingDirectory $Directory -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $LogDirectory "$Name.out.log") `
        -RedirectStandardError (Join-Path $LogDirectory "$Name.err.log")
    $managedProcess.Refresh()
    if ($managedProcess.HasExited) {
        throw "$Name termino al iniciar. Revisa los archivos $Name en $LogDirectory."
    }
    return [PSCustomObject]@{
        process_id = $managedProcess.Id
        start_time_utc_ticks = $managedProcess.StartTime.ToUniversalTime().Ticks.ToString()
        executable_path = $managedProcess.Path
    }
}

function Stop-OwnedProcess($Entry, [string]$Name) {
    $managedProcess = Get-OwnedProcess $Entry
    if ($null -eq $managedProcess) {
        Write-Host "$Name ya estaba detenido o su PID pertenece a otro proceso."
        return
    }
    # Python's Windows venv launcher and Vite can spawn child processes.
    # Only the tree of a process with matching PID, start time and path is stopped.
    & (Join-Path $env:SystemRoot 'System32\taskkill.exe') /PID $managedProcess.Id /T /F | Out-Null
    if ($LASTEXITCODE -ne 0 -and $null -ne (Get-OwnedProcess $Entry)) {
        throw "No se pudo detener $Name. No se eliminaron sus datos de seguimiento."
    }
    Write-Host "$Name detenido."
}

function Invoke-LocalDatabase([string]$Action) {
    if (-not (Test-Path -LiteralPath $PythonExecutable)) {
        throw 'Falta backend\.venv\Scripts\python.exe. Completa primero la instalacion de Python y dependencias.'
    }
    if (-not (Test-Path -LiteralPath $DatabaseScript)) {
        throw 'Falta backend\local_database.py.'
    }
    & $PythonExecutable $DatabaseScript $Action
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL no pudo completar la accion '$Action'." }
}
