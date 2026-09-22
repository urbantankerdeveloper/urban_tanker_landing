param(
  [string]$OutputDirectory = "./backups"
)

$ErrorActionPreference = "Stop"
if (-not $env:MONGODB_URI) { throw "MONGODB_URI is required." }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path $OutputDirectory "urban-tanker-$stamp.archive.gz"
mongodump --uri $env:MONGODB_URI --archive=$archive --gzip

$retentionValue = if ($env:BACKUP_RETENTION_DAYS) { $env:BACKUP_RETENTION_DAYS } else { "30" }
$retentionDays = [int]$retentionValue
Get-ChildItem -Path $OutputDirectory -Filter "*.archive.gz" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$retentionDays) } | Remove-Item -Force
Write-Output "Backup created: $archive"