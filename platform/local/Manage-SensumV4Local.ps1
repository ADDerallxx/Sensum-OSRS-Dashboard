[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'status', 'migrate', 'backup')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$composeFile = Join-Path $PSScriptRoot 'compose.yaml'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$backupRoot = Join-Path $repoRoot '.platform-local\backups'
$containerName = 'sensum-v4-postgres'
$databaseName = 'sensum_v4'
$databaseUser = 'sensum_v4'

function Get-DockerExecutable {
  $command = Get-Command docker -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $installed = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
  if (Test-Path -LiteralPath $installed) { return $installed }

  throw 'Docker CLI was not found. Start Docker Desktop, then try again.'
}

function Set-LocalDatabasePassword {
  $password = [Environment]::GetEnvironmentVariable('SENSUM_V4_DB_PASSWORD', 'Process')
  if ([string]::IsNullOrWhiteSpace($password)) {
    $password = [Environment]::GetEnvironmentVariable('SENSUM_V4_DB_PASSWORD', 'User')
  }
  if ([string]::IsNullOrWhiteSpace($password)) {
    throw 'The user-scoped SENSUM_V4_DB_PASSWORD is missing. Run the local provisioning step again.'
  }
  $env:SENSUM_V4_DB_PASSWORD = $password
}

function Invoke-Docker {
  param([Parameter(Mandatory)][string[]]$Arguments)
  & $script:docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed with exit code $LASTEXITCODE."
  }
}

function Wait-ForDatabase {
  for ($attempt = 1; $attempt -le 40; $attempt++) {
    $health = & $script:docker inspect --format '{{.State.Health.Status}}' $containerName 2>$null
    if ($LASTEXITCODE -eq 0 -and $health -eq 'healthy') { return }
    Start-Sleep -Seconds 2
  }
  throw 'PostgreSQL did not become healthy within 80 seconds.'
}

function Invoke-Migrations {
  Wait-ForDatabase
  Invoke-Docker @('exec', $containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', $databaseUser, '-d', $databaseName, '-c', 'CREATE TABLE IF NOT EXISTS sensum_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());')

  $migrationFiles = Get-ChildItem (Join-Path $repoRoot 'platform\db\migrations') -File -Filter '*.sql' | Sort-Object Name
  foreach ($migration in $migrationFiles) {
    $escapedVersion = $migration.Name.Replace("'", "''")
    $applied = & $script:docker exec $containerName psql -v ON_ERROR_STOP=1 -U $databaseUser -d $databaseName -tAc "SELECT 1 FROM sensum_schema_migrations WHERE version='$escapedVersion';"
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect migration $($migration.Name)." }
    if ($null -ne $applied -and ([string]$applied).Trim() -eq '1') { continue }

    $migrationSql = Get-Content -LiteralPath $migration.FullName -Raw
    if ($migrationSql -notmatch '(?im)^\s*BEGIN;\s*$' -or $migrationSql -notmatch '(?im)^\s*COMMIT;\s*$') {
      throw "Migration $($migration.Name) must contain explicit BEGIN and COMMIT statements."
    }
    Invoke-Docker @('exec', $containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', $databaseUser, '-d', $databaseName, '-f', "/migrations/$($migration.Name)")
    Invoke-Docker @('exec', $containerName, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', $databaseUser, '-d', $databaseName, '-c', "INSERT INTO sensum_schema_migrations(version) VALUES ('$escapedVersion');")
  }

  $appliedCount = & $script:docker exec $containerName psql -v ON_ERROR_STOP=1 -U $databaseUser -d $databaseName -tAc 'SELECT count(*) FROM sensum_schema_migrations;'
  $tableCount = & $script:docker exec $containerName psql -v ON_ERROR_STOP=1 -U $databaseUser -d $databaseName -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
  if ($LASTEXITCODE -ne 0) { throw 'Database validation query failed.' }
  Write-Host "Sensum V4 database is healthy: $(([string]$appliedCount).Trim()) migrations, $(([string]$tableCount).Trim()) public tables."
}

function Backup-Database {
  Wait-ForDatabase
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $containerFile = "/tmp/sensum-v4-$stamp.dump"
  $localFile = Join-Path $backupRoot "sensum-v4-$stamp.dump"
  try {
    Invoke-Docker @('exec', $containerName, 'pg_dump', '-Fc', '-U', $databaseUser, '-d', $databaseName, '-f', $containerFile)
    Invoke-Docker @('cp', "${containerName}:$containerFile", $localFile)
  }
  finally {
    & $script:docker exec $containerName rm -f $containerFile 2>$null
  }
  if (-not (Test-Path -LiteralPath $localFile) -or (Get-Item -LiteralPath $localFile).Length -eq 0) {
    throw 'Database backup was not created correctly.'
  }
  Write-Host "Backup created: $localFile"
}

$script:docker = Get-DockerExecutable
$dockerBin = Split-Path -Parent $script:docker
$pathEntries = $env:PATH -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
if ($pathEntries -notcontains $dockerBin) {
  $env:PATH = "$dockerBin;$env:PATH"
}
Set-LocalDatabasePassword

switch ($Action) {
  'start' {
    Invoke-Docker @('compose', '-f', $composeFile, 'up', '-d')
    Invoke-Migrations
  }
  'stop' {
    Invoke-Docker @('compose', '-f', $composeFile, 'stop')
    Write-Host 'Sensum V4 local services stopped; database data was preserved.'
  }
  'status' {
    Invoke-Docker @('compose', '-f', $composeFile, 'ps')
  }
  'migrate' {
    Invoke-Migrations
  }
  'backup' {
    Backup-Database
  }
}
