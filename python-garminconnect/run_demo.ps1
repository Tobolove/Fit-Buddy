# PowerShell script to run demo.py with virtual environment
Set-Location $PSScriptRoot
.\.venv\Scripts\Activate.ps1
python demo.py
