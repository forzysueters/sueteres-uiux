@echo off
setlocal
REM Diretorio deste script (com barra final). Funciona com duplo-clique ou via terminal.
set "ROOT=%~dp0"

echo ============================================
echo   Forzy Digital Twin - iniciando servicos
echo ============================================
echo.
echo   Dados e autenticacao vem do Supabase.
echo   Nao ha backend de aplicacao local.
echo.

REM --- Modelo de OCR (FastAPI, porta 8000) - so se o venv existir ---
echo [1/3] Modelo de OCR (porta 8000)...
if not exist "%ROOT%services\ocr\.venv\Scripts\python.exe" goto sem_ocr
cd /d "%ROOT%services\ocr"
REM Aspas aparam o espaco: PYTHONUTF8 aceita apenas 0 ou 1. Herdado pela janela abaixo.
set "PYTHONUTF8=1"
start "Forzy OCR" cmd /k ".venv\Scripts\python.exe -m uvicorn src.api.main:app --port 8000"
goto ocr_ok
:sem_ocr
echo       OCR nao configurado (venv ausente) - front usa fallback simulado.
echo       Setup: docs\OCR_INTEGRATION.md
:ocr_ok

REM --- Modelo de Anomalia (FastAPI, porta 8001) - so se o venv existir ---
echo [2/3] Modelo de Anomalia (porta 8001)...
if not exist "%ROOT%services\anomaly\.venv\Scripts\python.exe" goto sem_anom
cd /d "%ROOT%services\anomaly"
set "PYTHONUTF8=1"
start "Forzy Anomaly" cmd /k ".venv\Scripts\python.exe -m uvicorn src.api.main:app --port 8001"
goto anom_ok
:sem_anom
echo       Anomalia nao configurada (venv ausente) - front usa fallback simulado.
echo       Setup: rode npm run python:setup na raiz
:anom_ok

REM --- Frontend (Vite, porta 5173) ---
echo [3/3] Frontend (porta 5173)...
cd /d "%ROOT%"
start "Forzy Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo   Servicos iniciando em janelas separadas:
echo     OCR Model: http://localhost:8000
echo     Anomaly:   http://localhost:8001
echo     Frontend:  http://localhost:5173
echo     Banco:     Supabase (VITE_SUPABASE_URL no .env)
echo.
echo   Feche cada janela para parar o respectivo servico.
echo ============================================
echo.
endlocal
