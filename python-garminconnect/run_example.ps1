# PowerShell script to run example.py with virtual environment
Set-Location $PSScriptRoot
.\.venv\Scripts\Activate.ps1
python example.py
