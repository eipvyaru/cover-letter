$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$expectedNodeVersion = 'v24.21.0'
$verificationRoot = Join-Path ([IO.Path]::GetTempPath()) ("cover-letter-release-{0}" -f [guid]::NewGuid().ToString('N'))
$worktreeAdded = $false
$locationPushed = $false
$failureMessage = $null

Set-Location -LiteralPath $repositoryRoot

# Git commit hooks export a relative GIT_INDEX_FILE. Nested worktree checkout
# would resolve it inside the new worktree and fail before creating its index.
Remove-Item -LiteralPath 'Env:GIT_INDEX_FILE' -ErrorAction SilentlyContinue

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-Host "`n==> $Label"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

try {
    Write-Host '==> Node.js version'
    $nodeVersionOutput = & node --version
    if ($LASTEXITCODE -ne 0) {
        throw "node --version failed with exit code $LASTEXITCODE."
    }
    $nodeVersion = ($nodeVersionOutput | Out-String).Trim()
    Write-Host $nodeVersion
    if ($nodeVersion -ne $expectedNodeVersion) {
        throw "Expected Node.js $expectedNodeVersion, received $nodeVersion."
    }

    Write-Host "`n==> Git worktree status"
    $statusLines = @(git status --short)
    if ($LASTEXITCODE -ne 0) {
        throw "git status --short failed with exit code $LASTEXITCODE."
    }
    if ($statusLines.Count -gt 0) {
        $statusLines | ForEach-Object { Write-Host $_ }
        throw 'The Git worktree is not clean.'
    }
    Write-Host 'clean'

    Write-Host "`n==> Sensitive-file tracking check"
    $trackedSensitiveFiles = @(git ls-files -- .env data)
    if ($LASTEXITCODE -ne 0) {
        throw "git ls-files failed with exit code $LASTEXITCODE."
    }
    if ($trackedSensitiveFiles.Count -gt 0) {
        $trackedSensitiveFiles | ForEach-Object { Write-Host $_ }
        throw 'Sensitive or runtime files are tracked by Git.'
    }
    Write-Host 'no tracked .env or data files'

    Write-Host "`n==> Release commit"
    & git log -1 --oneline
    if ($LASTEXITCODE -ne 0) {
        throw "git log failed with exit code $LASTEXITCODE."
    }

    Invoke-CheckedCommand 'Create isolated verification worktree' {
        git worktree add --detach $verificationRoot HEAD
    }
    $worktreeAdded = $true

    Push-Location -LiteralPath $verificationRoot
    $locationPushed = $true

    Invoke-CheckedCommand 'Clean dependency installation' { npm ci }
    Invoke-CheckedCommand 'Dependency vulnerability audit' { npm audit --audit-level=moderate }
    Invoke-CheckedCommand 'Database migrations' { npm run db:migrate }
    Invoke-CheckedCommand 'Lint' { npm run lint }
    Invoke-CheckedCommand 'TypeScript typecheck' { npm run typecheck }
    Invoke-CheckedCommand 'Automated tests' { npm test }
    Invoke-CheckedCommand 'Production build' { npm run build }
}
catch {
    $failureMessage = $_.Exception.Message
}
finally {
    if ($locationPushed) {
        Pop-Location
        $locationPushed = $false
    }

    Set-Location -LiteralPath $repositoryRoot
    if ($worktreeAdded) {
        Write-Host "`n==> Remove isolated verification worktree"
        & git worktree remove --force -- $verificationRoot
        if ($LASTEXITCODE -ne 0 -and -not $failureMessage) {
            $failureMessage = "Unable to remove verification worktree; git exited with code $LASTEXITCODE."
        }
    }
}

if ($failureMessage) {
    Write-Host "`nNOT READY: $failureMessage" -ForegroundColor Red
    Write-Host 'Do not push this commit to GitHub or deploy it to the VPS until the checks pass.' -ForegroundColor Red
    exit 1
}

Write-Host "`nREADY: this commit passed all local checks and is ready for manual push to GitHub and deployment to the VPS." -ForegroundColor Green
exit 0
