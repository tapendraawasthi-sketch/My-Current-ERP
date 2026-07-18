@echo off
setlocal EnableExtensions
cd /d "%~dp0"
cd ..\..\..\..\..
if not exist "erp_bot\src\oip\modules\language_runtime\transliteration\application\mai07_r3ja_review_ops.py" (
  echo ERROR: repository root not detected.
  exit /b 2
)
set PYTHONPATH=erp_bot\src
python -m src.oip.modules.language_runtime.transliteration.application.mai07_r3ja_review_ops --status
if exist "docs\mokxya-ai\reviews\mai07_v3\review_operations\REVIEW_STATUS.html" (
  start "" "docs\mokxya-ai\reviews\mai07_v3\review_operations\REVIEW_STATUS.html"
)
exit /b 0
