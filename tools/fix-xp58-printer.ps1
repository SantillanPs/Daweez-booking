# Fixes the XPrinter XP-58 driver so receipts print without blank gaps (run on each PC that prints receipts).
#
# The XP-58H moves the paper by itself after each 24-dot strip it prints (GS v 0), but XPrinter's driver file
# says it does not (`*CursorYAfterSendBlockData: NO_MOVE`), so Windows feeds another 24 dots (ESC J) after
# every strip: a 3 mm gap after every 3 mm of print, and text cut through the middle (the test page, 2026-10-18).
# Reinstalling or updating the driver puts the wrong line back, so run this again after that.
#
# Start it with fix-xp58-printer.cmd (double-click). Safe to run twice.

$ErrorActionPreference = 'Stop'

function Done($message) { Write-Host ''; Write-Host $message; Write-Host ''; Read-Host 'Press Enter to close' | Out-Null; exit }

# Changing a driver file needs administrator rights: ask for them once and start again.
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

try {
  # Every installed copy of the driver file (x64\3 on a 64-bit PC, W32X86\3 on a 32-bit one).
  $files = Get-ChildItem "$env:WINDIR\System32\spool\drivers" -Recurse -Filter 'XP58.GPD' -ErrorAction SilentlyContinue
  if (-not $files) { Done 'The XP-58 printer driver is not installed on this PC. Install it first, then run this again.' }

  $changed = $false
  foreach ($gpd in $files) {
    $text = [IO.File]::ReadAllText($gpd.FullName)
    if ($text -notmatch '\*CursorYAfterSendBlockData:\s*NO_MOVE') { continue }
    if (-not (Test-Path "$($gpd.FullName).bak")) { Copy-Item $gpd.FullName "$($gpd.FullName).bak" }
    $text = $text -replace '\*CursorYAfterSendBlockData:\s*NO_MOVE', '*CursorYAfterSendBlockData: AUTO_INCREMENT'
    [IO.File]::WriteAllText($gpd.FullName, $text, [Text.Encoding]::ASCII)
    # XP58.BUD is Windows' compiled copy of the file; delete it so it is rebuilt from the fixed one.
    Remove-Item (Join-Path $gpd.DirectoryName 'XP58.BUD') -ErrorAction SilentlyContinue
    $changed = $true
  }

  if (-not $changed) { Done 'Already fixed. Nothing to do.' }

  Write-Host 'Restarting the print service...'
  Restart-Service Spooler -Force
  Done 'Fixed. Print a test page: the lines should no longer be split.'
} catch {
  Done "Could not fix it: $($_.Exception.Message)"
}
