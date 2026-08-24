$ErrorActionPreference = "Stop"
Set-Location "$HOME\Documents\Sensum-OSRS-Dashboard"

$file = ".\V1.html"
if (!(Test-Path $file)) { throw "V1.html not found." }

# V1.12 encoding repair:
# Windows PowerShell 5.1 read a UTF-8-without-BOM file as Windows-1252,
# turning characters such as ✓ → âœ“ and → → â†’.
# Reverse that exact conversion, then save proper UTF-8 without BOM.

$utf8 = New-Object System.Text.UTF8Encoding($false)
$cp1252 = [System.Text.Encoding]::GetEncoding(1252)

$text = [System.IO.File]::ReadAllText((Resolve-Path $file), $utf8)

# Only repair if classic mojibake markers are present.
if ($text -match 'â|ðŸ|Ã|Â') {
    $bytes = $cp1252.GetBytes($text)
    $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)
    [System.IO.File]::WriteAllText((Resolve-Path $file), $fixed, $utf8)
    Write-Host "V1.html UTF-8 mojibake repaired." -ForegroundColor Green
} else {
    Write-Host "No mojibake markers found; V1.html was left unchanged." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Now deploy with:" -ForegroundColor Cyan
Write-Host '.\deploy.ps1 -Message "Repair V1.12 UTF-8 characters"'
