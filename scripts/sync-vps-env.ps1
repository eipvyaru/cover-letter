$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '..\.env'
$target = Join-Path $PSScriptRoot '..\data\.env.vps'
if (-not (Test-Path -LiteralPath $source)) { throw 'Source .env does not exist.' }
$lines = [IO.File]::ReadAllLines((Resolve-Path -LiteralPath $source), [Text.UTF8Encoding]::new($false))
$seen = @{}
foreach ($line in $lines) { if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=') { if ($seen.ContainsKey($Matches[1])) { throw "Duplicate key: $($Matches[1])" }; $seen[$Matches[1]] = $true } }
$required = @('SYSTEM_PROMPT_PATH','DATABASE_PATH'); foreach ($key in $required) { if (-not $seen.ContainsKey($key)) { throw "Missing key: $key" } }
$output = foreach ($line in $lines) { if ($line -match '^SYSTEM_PROMPT_PATH=') { 'SYSTEM_PROMPT_PATH=/var/lib/cover-letter/system_prompt.md' } elseif ($line -match '^DATABASE_PATH=') { 'DATABASE_PATH=/var/lib/cover-letter/cover-letter.sqlite' } else { $line } }
$dir = Split-Path -Parent $target; [IO.Directory]::CreateDirectory($dir) | Out-Null; $temp = "$target.tmp"; [IO.File]::WriteAllLines($temp,$output,[Text.UTF8Encoding]::new($false)); Move-Item -LiteralPath $temp -Destination $target -Force
Write-Output ('Synchronized keys: ' + (($seen.Keys | Sort-Object) -join ', ') + ' (values redacted)')
