@echo off
setlocal EnableExtensions
REM MAI-07 V3 Review Operations — one-click workflow (Windows)
cd /d "%~dp0"
REM Ascend to repository root (review_operations -> mai07_v3 -> reviews -> mokxya-ai -> docs -> repo)
cd ..\..\..\..\..
if not exist "erp_bot\src\oip\modules\language_runtime\transliteration\application\mai07_r3ja_review_ops.py" (
  echo ERROR: repository root not detected from script location.
  exit /b 2
)
set PYTHONPATH=erp_bot\src
where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: python not found on PATH.
  exit /b 2
)
python -m src.oip.modules.language_runtime.transliteration.application.mai07_r3ja_review_ops --run
set EXITCODE=%ERRORLEVEL%
echo.
echo Status file: docs\mokxya-ai\reviews\mai07_v3\review_operations\REVIEW_STATUS.json
echo Dashboard:   docs\mokxya-ai\reviews\mai07_v3\review_operations\REVIEW_STATUS.html
exit /b %EXITCODE%
