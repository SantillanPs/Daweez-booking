@echo off
rem Double-click to fix the XP-58 receipt printer driver. See fix-xp58-printer.ps1 for why.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-xp58-printer.ps1"
