@echo off
setlocal
REM Diretorio deste script (com barra final). Funciona com duplo-clique ou via terminal.
set "ROOT=%~dp0"

echo ============================================
echo   Forzy Digital Twin - iniciando servicos
echo ============================================
echo.

REM --- Backend de autenticacao (porta 3000) ---
echo [1/3] Backend Auth (porta 3000)...
cd /d "%ROOT%server"
start "Forzy Backend" cmd /k "npm run dev"

REM --- Modelo de OCR (FastAPI, porta 8000) - so se o venv existir ---
echo [2/3] Modelo de OCR (porta 8000)...
if not exist "%ROOT%ocr\OCR-Model-main\.venv\Scripts\python.exe" goto sem_ocr
cd /d "%ROOT%ocr\OCR-Model-main"
REM Aspas aparam o espaco: PYTHONUTF8 aceita apenas 0 ou 1. Herdado pela janela abaixo.
set "PYTHONUTF8=1"
start "Forzy OCR" cmd /k ".venv\Scripts\python.exe -m uvicorn src.api.main:app --port 8000"
goto ocr_ok
:sem_ocr
echo       OCR nao configurado (venv ausente) - front usa fallback simulado.
echo       Setup: ocr\INTEGRATION.md
:ocr_ok

REM --- Frontend (Vite, porta 5173) ---
echo [3/3] Frontend (porta 5173)...
cd /d "%ROOT%"
start "Forzy Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo   Servicos iniciando em janelas separadas:
echo     Backend:   http://localhost:3000
echo     OCR Model: http://localhost:8000
echo     Frontend:  http://localhost:5173
echo.
echo   Feche cada janela para parar o respectivo servico.
echo ============================================
echo.
endlocal
